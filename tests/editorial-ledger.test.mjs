import test from 'node:test';
import assert from 'node:assert/strict';
import { contentHash, stableStringify } from '../scripts/editorial-utils.mjs';
import { validateBlindLedger } from '../scripts/validate-blind-ledger.mjs';

const candidate = {
  id: 'conditionals-001',
  type: 'multiple_choice',
  level: 'easy',
  topic: 'first-conditional',
  context: 'home-family',
  prompt: 'If the alarm goes off tonight, we will call the building manager.',
  options: ['will call', 'called', 'would call', 'had called'],
  answer: 'will call',
  explanation: 'A real future possibility takes will plus the base verb in the result clause.',
  translation: 'Если сигнализация сработает сегодня ночью, мы позвоним управляющему.',
  example: 'If the parcel arrives before noon, Leo will bring it upstairs.',
  shuffleOptions: true,
};

function acceptedLedger(question = candidate) {
  const checks = {
    naturalModernEnglish: true,
    exactlyOneAnswer: true,
    threeWrongDistractors: true,
    specificExplanation: true,
    faithfulTranslation: true,
    nonCosmeticExample: true,
    sensibleTopicAndLevel: true,
    britishAmericanUnambiguous: true,
  };
  return {
    schemaVersion: '1.0',
    batchId: 'conditionals-001-001',
    moduleId: 'conditionals',
    summary: {
      uniqueSlots: 1,
      uniqueCandidates: 1,
      totalDecisions: 1,
      byVerdict: { ACCEPT: 1, REWRITE: 0, REJECT: 0 },
      finalByVerdict: { ACCEPT: 1, REWRITE: 0, REJECT: 0 },
      byCycle: [
        {
          cycle: 1,
          totalDecisions: 1,
          byVerdict: { ACCEPT: 1, REWRITE: 0, REJECT: 0 },
        },
      ],
    },
    decisions: [
      {
        decisionId: 'conditionals-001-a1-c1',
        slotId: question.id,
        questionId: question.id,
        candidateAttempt: 1,
        cycle: 1,
        contentHash: contentHash(question),
        verdict: 'ACCEPT',
        checks,
        failedChecks: [],
        nextAction: 'none',
        reviewedAt: '2026-07-17T00:00:00.000Z',
      },
    ],
  };
}

test('stable content hashing ignores object key insertion order', () => {
  assert.equal(stableStringify({ b: 2, a: 1 }), stableStringify({ a: 1, b: 2 }));
  assert.equal(contentHash({ b: 2, a: 1 }), contentHash({ a: 1, b: 2 }));
});

test('accepts a reconciled blind ledger whose final hash matches content', () => {
  const report = validateBlindLedger(acceptedLedger(), [candidate]);
  assert.equal(report.valid, true);
  assert.equal(report.summary.finalByVerdict.ACCEPT, 1);
});

test('rejects a stale ACCEPT after candidate content changes', () => {
  const ledger = acceptedLedger();
  const changed = { ...candidate, prompt: `${candidate.prompt} Please act immediately.` };
  const report = validateBlindLedger(ledger, [changed]);
  assert.equal(report.valid, false);
  assert.ok(report.errors.some((error) => error.includes('hash does not match')));
});
