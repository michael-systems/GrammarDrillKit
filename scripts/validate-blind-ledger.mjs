import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BLIND_CHECKS, contentHash, VERDICTS } from './editorial-utils.mjs';

function emptyCounts() {
  return { ACCEPT: 0, REWRITE: 0, REJECT: 0 };
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function decisionOrder(left, right) {
  return left.candidateAttempt - right.candidateAttempt
    || left.cycle - right.cycle;
}

export function validateBlindLedger(ledger, candidates) {
  const errors = [];
  const decisions = Array.isArray(ledger?.decisions) ? ledger.decisions : [];
  const candidateById = new Map(candidates.map((question) => [question.id, question]));
  const decisionIds = new Set();
  const bySlot = new Map();

  if (candidateById.size !== candidates.length) errors.push('Candidate question IDs must be unique.');
  for (const decision of decisions) {
    const ref = decision?.decisionId ?? '<missing-decision-id>';
    if (decisionIds.has(ref)) errors.push(`${ref}: duplicate decisionId.`);
    decisionIds.add(ref);
    if (!candidateById.has(decision.questionId)) errors.push(`${ref}: questionId is absent from candidate package.`);
    if (!VERDICTS.includes(decision.verdict)) errors.push(`${ref}: invalid verdict.`);
    if (!Number.isInteger(decision.candidateAttempt) || decision.candidateAttempt < 1) errors.push(`${ref}: invalid candidateAttempt.`);
    if (!Number.isInteger(decision.cycle) || decision.cycle < 1 || decision.cycle > 3) errors.push(`${ref}: invalid cycle.`);
    if (!/^sha256:[a-f0-9]{64}$/.test(decision.contentHash ?? '')) errors.push(`${ref}: invalid contentHash.`);
    const falseChecks = [];
    for (const check of BLIND_CHECKS) {
      if (typeof decision.checks?.[check] !== 'boolean') errors.push(`${ref}: missing boolean check ${check}.`);
      if (decision.checks?.[check] === false) falseChecks.push(check);
    }
    const failed = Array.isArray(decision.failedChecks) ? [...decision.failedChecks].sort() : [];
    if (!sameJson(failed, [...new Set(falseChecks)].sort())) {
      errors.push(`${ref}: failedChecks must exactly match false checks.`);
    }
    if (decision.verdict === 'ACCEPT') {
      if (falseChecks.length > 0 || decision.nextAction !== 'none') errors.push(`${ref}: ACCEPT requires all checks true and nextAction none.`);
    } else if (decision.verdict === 'REWRITE') {
      if (falseChecks.length === 0 || decision.nextAction !== 'rewrite') errors.push(`${ref}: REWRITE requires a failed check and nextAction rewrite.`);
    } else if (decision.verdict === 'REJECT') {
      if (falseChecks.length === 0 || decision.nextAction !== 'replace') errors.push(`${ref}: REJECT requires a failed check and nextAction replace.`);
    }
    const bucket = bySlot.get(decision.slotId) ?? [];
    bucket.push(decision);
    bySlot.set(decision.slotId, bucket);
  }

  const latestBySlot = new Map();
  for (const [slotId, slotDecisions] of bySlot) {
    slotDecisions.sort(decisionOrder);
    const attempts = new Map();
    for (const decision of slotDecisions) {
      const bucket = attempts.get(decision.candidateAttempt) ?? [];
      bucket.push(decision);
      attempts.set(decision.candidateAttempt, bucket);
    }
    const attemptNumbers = [...attempts.keys()].sort((a, b) => a - b);
    attemptNumbers.forEach((attempt, index) => {
      if (attempt !== index + 1) errors.push(`${slotId}: candidate attempts must begin at 1 and be contiguous.`);
      const attemptDecisions = attempts.get(attempt).sort((a, b) => a.cycle - b.cycle);
      attemptDecisions.forEach((decision, cycleIndex) => {
        if (decision.cycle !== cycleIndex + 1) errors.push(`${slotId}/attempt-${attempt}: cycles must begin at 1 and be contiguous.`);
        if (cycleIndex < attemptDecisions.length - 1 && decision.verdict === 'ACCEPT') {
          errors.push(`${slotId}/attempt-${attempt}: no decision may follow ACCEPT.`);
        }
        if (cycleIndex < attemptDecisions.length - 1 && decision.verdict === 'REJECT') {
          errors.push(`${slotId}/attempt-${attempt}: no decision may follow REJECT.`);
        }
      });
    });
    latestBySlot.set(slotId, slotDecisions.at(-1));
  }

  for (const candidate of candidates) {
    const finalDecision = latestBySlot.get(candidate.id);
    if (!finalDecision) {
      errors.push(`${candidate.id}: no blind decision.`);
      continue;
    }
    if (finalDecision.verdict !== 'ACCEPT') errors.push(`${candidate.id}: latest blind verdict is ${finalDecision.verdict}, not ACCEPT.`);
    if (finalDecision.contentHash !== contentHash(candidate)) errors.push(`${candidate.id}: final ACCEPT hash does not match candidate content.`);
    if (finalDecision.questionId !== candidate.id || finalDecision.slotId !== candidate.id) {
      errors.push(`${candidate.id}: final decision slotId/questionId mismatch.`);
    }
  }

  const byVerdict = emptyCounts();
  const finalByVerdict = emptyCounts();
  const cycleMap = new Map();
  for (const decision of decisions) {
    if (VERDICTS.includes(decision.verdict)) byVerdict[decision.verdict] += 1;
    const cycleCounts = cycleMap.get(decision.cycle) ?? emptyCounts();
    if (VERDICTS.includes(decision.verdict)) cycleCounts[decision.verdict] += 1;
    cycleMap.set(decision.cycle, cycleCounts);
  }
  for (const decision of latestBySlot.values()) {
    if (VERDICTS.includes(decision.verdict)) finalByVerdict[decision.verdict] += 1;
  }
  const summary = {
    uniqueSlots: bySlot.size,
    uniqueCandidates: new Set(decisions.map((decision) => `${decision.slotId}/${decision.candidateAttempt}`)).size,
    totalDecisions: decisions.length,
    byVerdict,
    finalByVerdict,
    byCycle: [...cycleMap.entries()].sort(([a], [b]) => a - b).map(([cycle, counts]) => ({
      cycle,
      totalDecisions: Object.values(counts).reduce((sum, count) => sum + count, 0),
      byVerdict: counts,
    })),
  };
  if (!sameJson(ledger?.summary, summary)) errors.push('Declared ledger summary does not match recomputed summary.');

  return { valid: errors.length === 0, errors, summary };
}

function runCli() {
  const [ledgerPath, ...candidatePaths] = process.argv.slice(2);
  if (!ledgerPath || candidatePaths.length === 0) {
    throw new Error('Usage: node scripts/validate-blind-ledger.mjs <ledger.json> <candidate.json> [...]');
  }
  const ledger = JSON.parse(fs.readFileSync(path.resolve(ledgerPath), 'utf8'));
  const candidates = candidatePaths.flatMap((file) => {
    const value = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
    if (!Array.isArray(value)) throw new TypeError(`${file} must contain a JSON array.`);
    return value;
  });
  const report = validateBlindLedger(ledger, candidates);
  console.log(`Blind ledger validator: ${report.valid ? 'PASS' : 'FAIL'}`);
  console.log(`Decisions: ${report.summary.totalDecisions}; slots: ${report.summary.uniqueSlots}; final ACCEPT: ${report.summary.finalByVerdict.ACCEPT}`);
  report.errors.forEach((error) => console.error(`ERROR ${error}`));
  if (!report.valid) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runCli();
}
