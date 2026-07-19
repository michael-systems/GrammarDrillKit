import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const REQUIRED_QUESTION_FIELDS = [
  'id',
  'type',
  'level',
  'topic',
  'context',
  'prompt',
  'options',
  'answer',
  'explanation',
  'translation',
  'example',
  'shuffleOptions',
];
const REQUIRED_PHRASAL_FIELDS = [
  'source',
  'donorEntry',
  'donorQ',
  'donorExample',
  'donorKey',
  'donorTense',
];
const LEVELS = ['easy', 'medium', 'hard'];
const CYRILLIC = /[\u0400-\u04ff]/u;
const PLACEHOLDER = /\b(?:item\s+\d+|distractor-\d+|placeholder|modern example|todo|lorem ipsum|test question|option\s+[ab])\b/i;

export function normalizeText(value) {
  return String(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/_{2,}/g, ' blank ')
    .replace(/[^\p{L}\p{N}']+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizedOpening(value, wordCount = 5) {
  return normalizeText(value).split(' ').slice(0, wordCount).join(' ');
}

function optionSignature(options) {
  return options.map(normalizeText).sort().join(' || ');
}

function tokenJaccard(left, right) {
  const a = new Set(normalizeText(left).split(' ').filter(Boolean));
  const b = new Set(normalizeText(right).split(' ').filter(Boolean));
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const token of a) {
    if (b.has(token)) shared += 1;
  }
  return shared / (a.size + b.size - shared);
}

function groupRepeated(items, keyFn, minimum = 2) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    const bucket = groups.get(key) ?? [];
    bucket.push(item.id);
    groups.set(key, bucket);
  }
  return [...groups.entries()]
    .filter(([, ids]) => ids.length >= minimum)
    .map(([value, ids]) => ({ value, count: ids.length, ids }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function stringsOutsideTranslation(value, currentPath = [], output = []) {
  if (typeof value === 'string') {
    if (currentPath.at(-1) !== 'translation') {
      output.push({ path: currentPath.join('.'), value });
    }
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => stringsOutsideTranslation(entry, [...currentPath, String(index)], output));
    return output;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, entry]) => {
      stringsOutsideTranslation(entry, [...currentPath, key], output);
    });
  }
  return output;
}

export function parseDonorData(html) {
  const match = html.match(/const\s+DATA\s*=\s*(\[[\s\S]*?\])\s*;/);
  if (!match) {
    throw new Error('Could not locate const DATA in donor HTML.');
  }
  const data = Function(`"use strict"; return (${match[1]});`)();
  if (!Array.isArray(data)) {
    throw new TypeError('Donor DATA is not an array.');
  }
  return data;
}

function recordCount(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function pushIssue(collection, code, message, details = {}) {
  collection.push({ code, message, ...details });
}

function validateQuestion({
  question,
  module,
  expectedId,
  blueprintTopic,
  allowedContexts,
  donor,
  donorKeySet,
  seenIds,
  promptOwners,
  exampleOwners,
  optionSignatures,
  errors,
}) {
  const ref = `${module.metadata.id}/${question?.id ?? expectedId}`;
  if (!question || typeof question !== 'object' || Array.isArray(question)) {
    pushIssue(errors, 'question.invalid', `${ref}: question must be an object.`);
    return;
  }

  for (const field of REQUIRED_QUESTION_FIELDS) {
    if (!(field in question)) {
      pushIssue(errors, 'question.field.missing', `${ref}: missing required field "${field}".`);
    }
  }

  for (const field of ['id', 'type', 'level', 'topic', 'context', 'prompt', 'answer', 'explanation', 'translation', 'example']) {
    if (typeof question[field] !== 'string' || question[field].trim() === '') {
      pushIssue(errors, 'question.field.empty', `${ref}: "${field}" must be a non-empty string.`);
    }
  }

  if (question.id !== expectedId) {
    pushIssue(errors, 'question.id.sequence', `${ref}: expected stable ID "${expectedId}".`);
  }
  if (seenIds.has(question.id)) {
    pushIssue(errors, 'question.id.duplicate', `${ref}: duplicate question ID.`);
  }
  seenIds.add(question.id);

  if (question.type !== 'multiple_choice') {
    pushIssue(errors, 'question.type', `${ref}: only multiple_choice is supported.`);
  }
  if (!LEVELS.includes(question.level)) {
    pushIssue(errors, 'question.level', `${ref}: invalid level "${question.level}".`);
  }
  if (!blueprintTopic) {
    pushIssue(errors, 'question.topic', `${ref}: topic "${question.topic}" is not in the module blueprint.`);
  }
  if (!allowedContexts.includes(question.context)) {
    pushIssue(errors, 'question.context', `${ref}: context "${question.context}" is not in the blueprint.`);
  }
  if (question.shuffleOptions !== true) {
    pushIssue(errors, 'question.shuffle', `${ref}: shuffleOptions must be true.`);
  }

  if (!Array.isArray(question.options) || question.options.length !== 4) {
    pushIssue(errors, 'question.options.count', `${ref}: options must contain exactly four entries.`);
  } else {
    const normalized = question.options.map(normalizeText);
    if (question.options.some((option) => typeof option !== 'string' || option.trim() === '')) {
      pushIssue(errors, 'question.options.empty', `${ref}: every option must be a non-empty string.`);
    }
    if (new Set(normalized).size !== 4) {
      pushIssue(errors, 'question.options.duplicate', `${ref}: all four options must be unique.`);
    }
    const answerCount = question.options.filter((option) => option === question.answer).length;
    if (answerCount !== 1) {
      pushIssue(errors, 'question.answer.membership', `${ref}: answer must occur in options exactly once.`);
    }
    recordCount(optionSignatures, optionSignature(question.options));
  }

  for (const [field, value] of Object.entries(question)) {
    if (typeof value === 'string' && PLACEHOLDER.test(value)) {
      pushIssue(errors, 'question.placeholder', `${ref}: forbidden placeholder token in "${field}".`);
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (typeof entry === 'string' && PLACEHOLDER.test(entry)) {
          pushIssue(errors, 'question.placeholder', `${ref}: forbidden placeholder token in "${field}".`);
        }
      });
    }
  }

  for (const item of stringsOutsideTranslation(question)) {
    if (CYRILLIC.test(item.value)) {
      pushIssue(errors, 'question.cyrillic', `${ref}: Cyrillic text is allowed only in translation.`, { field: item.path });
    }
  }

  const normalizedPrompt = normalizeText(question.prompt);
  const normalizedExample = normalizeText(question.example);
  if (tokenJaccard(question.prompt, question.example) >= 0.72) {
    pushIssue(errors, 'question.example.cosmetic', `${ref}: example is too close to the prompt to provide a new context.`);
  }
  if (promptOwners.has(normalizedPrompt)) {
    pushIssue(errors, 'question.prompt.duplicate', `${ref}: exact normalized prompt duplicates ${promptOwners.get(normalizedPrompt)}.`);
  } else {
    promptOwners.set(normalizedPrompt, question.id);
  }
  if (exampleOwners.has(normalizedExample)) {
    pushIssue(errors, 'question.example.duplicate', `${ref}: exact normalized example duplicates ${exampleOwners.get(normalizedExample)}.`);
  } else {
    exampleOwners.set(normalizedExample, question.id);
  }

  if (module.metadata.id === 'phrasal-verbs') {
    for (const field of REQUIRED_PHRASAL_FIELDS) {
      if (!(field in question)) {
        pushIssue(errors, 'phrasal.field.missing', `${ref}: missing donor field "${field}".`);
      }
    }
    if (!Number.isInteger(question.donorEntry) || question.donorEntry < 1 || question.donorEntry > 150) {
      pushIssue(errors, 'phrasal.donorEntry', `${ref}: donorEntry must be an integer from 1 to 150.`);
      return;
    }
    const source = donor[question.donorEntry - 1];
    if (!source) {
      pushIssue(errors, 'phrasal.donorEntry.missing', `${ref}: donor entry does not exist.`);
      return;
    }
    if (question.source !== 'donor/PhrasalVerbsQuiz-index.html') {
      pushIssue(errors, 'phrasal.source', `${ref}: source path is not authoritative donor path.`);
    }
    if (question.donorQ !== source.q) {
      pushIssue(errors, 'phrasal.donorQ', `${ref}: donorQ changed from donor entry ${question.donorEntry}.`);
    }
    if (question.donorKey !== source.key || question.answer !== source.key) {
      pushIssue(errors, 'phrasal.donorKey', `${ref}: donorKey/answer changed from donor entry ${question.donorEntry}.`);
    }
    if (question.donorTense !== source.tense) {
      pushIssue(errors, 'phrasal.donorTense', `${ref}: donorTense changed from donor entry ${question.donorEntry}.`);
    }
    if (typeof question.translation !== 'string' || !question.translation.includes(source.rt)) {
      pushIssue(errors, 'phrasal.translation', `${ref}: translation must preserve the exact donor rt.`);
    }
    if (question.donorExample !== source.ex) {
      pushIssue(errors, 'phrasal.donorExample', `${ref}: donorExample changed from donor ex.`);
    }
    if (Array.isArray(question.options)) {
      question.options.forEach((option) => {
        if (!donorKeySet.has(option)) {
          pushIssue(errors, 'phrasal.option.source', `${ref}: option "${option}" is not a donor key.`);
        }
      });
    }
  }
}

export function validateModules({
  modules,
  blueprint,
  donor,
  moduleFiles,
}) {
  const errors = [];
  const warnings = [];
  const seenIds = new Set();
  const promptOwners = new Map();
  const exampleOwners = new Map();
  const optionSignatures = new Map();
  const donorKeySet = new Set(donor.map((entry) => entry.key));
  const expectedIds = blueprint.modules.map((module) => module.id);
  const actualIds = modules.map((module) => module?.metadata?.id);
  const expectedFiles = expectedIds.map((id) => `${id}.js`).sort();
  const actualFiles = [...moduleFiles].sort();

  if (modules.length !== blueprint.modules.length) {
    pushIssue(
      errors,
      'registry.count',
      `Registry scope must contain exactly ${blueprint.modules.length} modules; found ${modules.length}.`,
    );
  }
  if (new Set(actualIds).size !== actualIds.length) {
    pushIssue(errors, 'registry.duplicate', 'Registry contains duplicate module IDs.');
  }
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    pushIssue(errors, 'registry.order', 'Registry IDs or order do not match the required module order.', {
      expected: expectedIds,
      actual: actualIds,
    });
  }
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    pushIssue(errors, 'registry.files', 'Production module files do not exactly match registered required modules.', {
      expected: expectedFiles,
      actual: actualFiles,
    });
  }

  const moduleSummaries = [];
  for (const moduleBlueprint of blueprint.modules) {
    const module = modules.find((candidate) => candidate?.metadata?.id === moduleBlueprint.id);
    if (!module) {
      pushIssue(errors, 'module.missing', `Missing module "${moduleBlueprint.id}".`);
      continue;
    }
    if (module.metadata.title !== moduleBlueprint.title) {
      pushIssue(errors, 'module.title', `${moduleBlueprint.id}: title must be "${moduleBlueprint.title}".`);
    }
    if (typeof module.metadata.description !== 'string' || module.metadata.description.trim() === '') {
      pushIssue(errors, 'module.description', `${moduleBlueprint.id}: metadata.description must be non-empty.`);
    }
    if (typeof module.metadata.levelRange !== 'string' || module.metadata.levelRange.trim() === '') {
      pushIssue(errors, 'module.levelRange', `${moduleBlueprint.id}: metadata.levelRange must be non-empty.`);
    }
    if (!Array.isArray(module.topics)) {
      pushIssue(errors, 'module.topics', `${moduleBlueprint.id}: topics must be an array.`);
      continue;
    }
    if (!Array.isArray(module.questions)) {
      pushIssue(errors, 'module.questions', `${moduleBlueprint.id}: questions must be an array.`);
      continue;
    }

    const topicIds = module.topics.map((topic) => topic.id);
    const expectedTopicIds = moduleBlueprint.topics.map((topic) => topic.id);
    if (new Set(topicIds).size !== topicIds.length) {
      pushIssue(errors, 'module.topics.duplicate', `${moduleBlueprint.id}: duplicate topic IDs.`);
    }
    if (JSON.stringify(topicIds) !== JSON.stringify(expectedTopicIds)) {
      pushIssue(errors, 'module.topics.contract', `${moduleBlueprint.id}: topic IDs/order do not match blueprint.`, {
        expected: expectedTopicIds,
        actual: topicIds,
      });
    }
    for (const topic of module.topics) {
      if (typeof topic.title !== 'string' || topic.title.trim() === '') {
        pushIssue(errors, 'module.topic.title', `${moduleBlueprint.id}/${topic.id}: topic title must be non-empty.`);
      }
      if (CYRILLIC.test(topic.title)) {
        pushIssue(errors, 'module.topic.cyrillic', `${moduleBlueprint.id}/${topic.id}: topic title contains Cyrillic.`);
      }
    }

    if (module.questions.length !== moduleBlueprint.total) {
      pushIssue(errors, 'module.count', `${moduleBlueprint.id}: expected ${moduleBlueprint.total} questions; found ${module.questions.length}.`);
    }
    const levelCounts = Object.fromEntries(LEVELS.map((level) => [level, 0]));
    const topicCounts = Object.fromEntries(moduleBlueprint.topics.map((topic) => [
      topic.id,
      Object.fromEntries(LEVELS.map((level) => [level, 0])),
    ]));
    const contextCounts = Object.fromEntries(blueprint.contexts.map((context) => [context, 0]));
    const donorEntries = new Set();

    module.questions.forEach((question, index) => {
      if (LEVELS.includes(question?.level)) levelCounts[question.level] += 1;
      if (topicCounts[question?.topic] && LEVELS.includes(question?.level)) {
        topicCounts[question.topic][question.level] += 1;
      }
      if (question?.context in contextCounts) contextCounts[question.context] += 1;
      if (moduleBlueprint.id === 'phrasal-verbs' && Number.isInteger(question?.donorEntry)) {
        if (donorEntries.has(question.donorEntry)) {
          pushIssue(errors, 'phrasal.donorEntry.duplicate', `${question.id}: duplicate donorEntry ${question.donorEntry}.`);
        }
        donorEntries.add(question.donorEntry);
      }
      const topicBlueprint = moduleBlueprint.topics.find((topic) => topic.id === question?.topic);
      const expectedId = `${moduleBlueprint.id}-${String(index + 1).padStart(3, '0')}`;
      validateQuestion({
        question,
        module,
        expectedId,
        blueprintTopic: topicBlueprint,
        allowedContexts: blueprint.contexts,
        donor,
        donorKeySet,
        seenIds,
        promptOwners,
        exampleOwners,
        optionSignatures,
        errors,
      });
    });

    for (const level of LEVELS) {
      if (levelCounts[level] !== moduleBlueprint.levels[level]) {
        pushIssue(errors, 'module.level.count', `${moduleBlueprint.id}: ${level} expected ${moduleBlueprint.levels[level]}, found ${levelCounts[level]}.`);
      }
    }
    for (const topicBlueprint of moduleBlueprint.topics) {
      const actual = topicCounts[topicBlueprint.id];
      for (const level of LEVELS) {
        if (actual[level] !== topicBlueprint.levels[level]) {
          pushIssue(
            errors,
            'module.topic.level.count',
            `${moduleBlueprint.id}/${topicBlueprint.id}: ${level} expected ${topicBlueprint.levels[level]}, found ${actual[level]}.`,
          );
        }
      }
    }
    const expectedContextCount = moduleBlueprint.id === 'phrasal-verbs'
      ? blueprint.contextPolicy.phrasalVerbsQuotaPerContext
      : blueprint.contextPolicy.newModuleQuotaPerContext;
    for (const [context, count] of Object.entries(contextCounts)) {
      if (count !== expectedContextCount) {
        pushIssue(
          errors,
          'module.context.count',
          `${moduleBlueprint.id}/${context}: expected ${expectedContextCount}, found ${count}.`,
        );
      }
    }
    if (moduleBlueprint.id === 'phrasal-verbs') {
      const expectedDonorEntries = Array.from({ length: 150 }, (_, index) => index + 1);
      const actualDonorEntries = [...donorEntries].sort((a, b) => a - b);
      if (JSON.stringify(actualDonorEntries) !== JSON.stringify(expectedDonorEntries)) {
        pushIssue(errors, 'phrasal.donorEntry.coverage', 'Phrasal Verbs must cover donorEntry 1-150 exactly once.');
      }
    }

    moduleSummaries.push({
      id: moduleBlueprint.id,
      title: module.metadata.title,
      total: module.questions.length,
      levels: levelCounts,
      topics: Object.fromEntries(
        Object.entries(topicCounts).map(([topic, counts]) => [
          topic,
          { total: LEVELS.reduce((sum, level) => sum + counts[level], 0), levels: counts },
        ]),
      ),
      contexts: contextCounts,
    });
  }

  for (const [signature, count] of optionSignatures) {
    if (count > 3) {
      pushIssue(errors, 'question.options.excessive', `An identical option set appears ${count} times.`, { signature });
    } else if (count > 1) {
      pushIssue(warnings, 'question.options.repeated', `An identical option set appears ${count} times.`, { signature });
    }
  }

  const questions = modules.flatMap((module) => module.questions ?? []);
  const globalLevels = Object.fromEntries(LEVELS.map((level) => [
    level,
    questions.filter((question) => question.level === level).length,
  ]));
  const expectedGlobalLevels = Object.fromEntries(LEVELS.map((level) => [
    level,
    blueprint.modules.reduce((sum, module) => sum + module.levels[level], 0),
  ]));
  for (const level of LEVELS) {
    if (globalLevels[level] !== expectedGlobalLevels[level]) {
      pushIssue(
        errors,
        'content.level.total',
        `Global ${level} count must be ${expectedGlobalLevels[level]}; found ${globalLevels[level]}.`,
      );
    }
  }
  const repeatedOpenings = groupRepeated(questions, (question) => normalizedOpening(question.prompt), 6);
  const repeatedExplanations = groupRepeated(questions, (question) => normalizeText(question.explanation), 2);
  const repeatedContexts = groupRepeated(
    questions.filter((question) => typeof question.context === 'string'),
    (question) => normalizeText(question.context),
    1,
  );
  const repeatedOptionSets = groupRepeated(questions, (question) => (
    Array.isArray(question.options) ? optionSignature(question.options) : ''
  ), 2);
  const nearDuplicatePrompts = [];
  for (let leftIndex = 0; leftIndex < questions.length; leftIndex += 1) {
    const left = questions[leftIndex];
    if (normalizeText(left.prompt).split(' ').length < 6) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < questions.length; rightIndex += 1) {
      const right = questions[rightIndex];
      if (Math.abs(left.prompt.length - right.prompt.length) > Math.max(left.prompt.length, right.prompt.length) * 0.35) continue;
      const score = tokenJaccard(left.prompt, right.prompt);
      if (score >= 0.82 && normalizeText(left.prompt) !== normalizeText(right.prompt)) {
        nearDuplicatePrompts.push({
          left: left.id,
          right: right.id,
          score: Number(score.toFixed(3)),
        });
      }
      if (nearDuplicatePrompts.length >= 500) break;
    }
    if (nearDuplicatePrompts.length >= 500) break;
  }

  if (repeatedOpenings.length > 0) {
    pushIssue(warnings, 'heuristic.prompt.openings', `${repeatedOpenings.length} prompt openings occur at least six times.`);
  }
  if (repeatedExplanations.length > 0) {
    pushIssue(warnings, 'heuristic.explanations', `${repeatedExplanations.length} exact explanations are repeated.`);
  }
  if (nearDuplicatePrompts.length > 0) {
    pushIssue(warnings, 'heuristic.prompt.near', `${nearDuplicatePrompts.length} near-duplicate prompt pairs require examiner review.`);
  }

  return {
    valid: errors.length === 0,
    generatedAt: new Date().toISOString(),
    totals: {
      modules: modules.length,
      questions: questions.length,
      levels: globalLevels,
      errors: errors.length,
      warnings: warnings.length,
    },
    modules: moduleSummaries,
    errors,
    warnings,
    heuristics: {
      normalizedPromptOpenings: repeatedOpenings,
      nearDuplicatePrompts,
      repeatedExplanations,
      repeatedContexts,
      repeatedOptionSets,
    },
  };
}

export function validateProductShell({ indexHtml, stylesCss, appJs }) {
  const errors = [];
  const visibleCount = (indexHtml.match(/>Made by M</g) ?? []).length;
  if (visibleCount !== 1) {
    pushIssue(errors, 'product.credit.count', `index.html must contain exactly one visible "Made by M"; found ${visibleCount}.`);
  }
  const creditAnchor = indexHtml.match(/<a\b[^>]*href="https:\/\/telegram\.me\/lifeforevery"[^>]*>Made by M<\/a>/);
  if (!creditAnchor) {
    pushIssue(errors, 'product.credit.link', 'Made by M must link to https://telegram.me/lifeforevery.');
  } else {
    if (!/\btarget="_blank"/.test(creditAnchor[0])) {
      pushIssue(errors, 'product.credit.target', 'Made by M must use target="_blank".');
    }
    const rel = creditAnchor[0].match(/\brel="([^"]+)"/)?.[1]?.split(/\s+/) ?? [];
    if (!rel.includes('noopener') || !rel.includes('noreferrer')) {
      pushIssue(errors, 'product.credit.rel', 'Made by M must use rel="noopener noreferrer".');
    }
  }
  if (indexHtml.includes('https://t.me/')) {
    pushIssue(errors, 'product.credit.shortUrl', 'index.html must not use the shortened t.me URL.');
  }
  if (/Made by M|telegram\.me\/lifeforevery|t\.me\/lifeforevery/.test(appJs)) {
    pushIssue(errors, 'product.credit.runtime', 'Made by M must not be rendered or referenced by app.js.');
  }

  const footerRules = stylesCss.match(/\.creator-footer\s*\{([^}]*)\}/)?.[1] ?? '';
  for (const [property, pattern] of [
    ['position: fixed', /position\s*:\s*fixed/],
    ['right', /\bright\s*:/],
    ['bottom', /\bbottom\s*:/],
  ]) {
    if (!pattern.test(footerRules)) {
      pushIssue(errors, 'product.credit.css', `.creator-footer is missing ${property}.`);
    }
  }
  if (!/env\(safe-area-inset-right\)/.test(stylesCss) || !/env\(safe-area-inset-bottom\)/.test(stylesCss)) {
    pushIssue(errors, 'product.credit.safeArea', 'Made by M positioning must account for right and bottom safe-area insets.');
  }
  if (!/\.app-shell[^{}]*\{[^}]*padding-bottom\s*:/s.test(stylesCss)) {
    pushIssue(errors, 'product.credit.overlap', 'The app shell must reserve bottom space for the fixed credit.');
  }
  if (/\.creator-footer\s*\{[^}]*text-align\s*:\s*left/s.test(stylesCss)) {
    pushIssue(errors, 'product.credit.mobile', 'Made by M must remain right-aligned on mobile.');
  }
  return { valid: errors.length === 0, errors };
}

export function validateDraftPackage({
  questions,
  moduleId,
  start,
  end,
  blueprint,
  donor,
}) {
  const errors = [];
  const warnings = [];
  const moduleBlueprint = blueprint.modules.find((module) => module.id === moduleId);
  if (!moduleBlueprint) {
    pushIssue(errors, 'package.module', `Unknown module "${moduleId}".`);
    return { valid: false, errors, warnings, totals: { questions: 0, errors: errors.length, warnings: 0 } };
  }
  if (!Array.isArray(questions)) {
    pushIssue(errors, 'package.shape', 'Draft package must be a JSON array.');
    return { valid: false, errors, warnings, totals: { questions: 0, errors: errors.length, warnings: 0 } };
  }
  const expectedCount = end - start + 1;
  if (questions.length !== expectedCount) {
    pushIssue(errors, 'package.count', `Expected ${expectedCount} questions for ${start}-${end}; found ${questions.length}.`);
  }

  const seenIds = new Set();
  const promptOwners = new Map();
  const exampleOwners = new Map();
  const optionSignatures = new Map();
  const donorKeySet = new Set(donor.map((entry) => entry.key));
  const module = { metadata: { id: moduleId } };
  const donorEntries = new Set();
  questions.forEach((question, index) => {
    const slot = start + index;
    const topicBlueprint = moduleBlueprint.topics.find((topic) => topic.id === question?.topic);
    validateQuestion({
      question,
      module,
      expectedId: `${moduleId}-${String(slot).padStart(3, '0')}`,
      blueprintTopic: topicBlueprint,
      allowedContexts: blueprint.contexts,
      donor,
      donorKeySet,
      seenIds,
      promptOwners,
      exampleOwners,
      optionSignatures,
      errors,
    });
    if (moduleId === 'phrasal-verbs') {
      if (question?.donorEntry !== slot) {
        pushIssue(errors, 'package.donor.sequence', `${question?.id ?? slot}: expected donorEntry ${slot}.`);
      }
      if (donorEntries.has(question?.donorEntry)) {
        pushIssue(errors, 'package.donor.duplicate', `${question?.id ?? slot}: duplicate donorEntry ${question?.donorEntry}.`);
      }
      donorEntries.add(question?.donorEntry);
      const expectedLevel = slot <= 50 ? 'easy' : slot <= 100 ? 'medium' : 'hard';
      if (question?.level !== expectedLevel) {
        pushIssue(errors, 'package.donor.level', `${question?.id ?? slot}: donor slot ${slot} must be ${expectedLevel}.`);
      }
    }
  });

  for (const [signature, count] of optionSignatures) {
    if (count > 3) {
      pushIssue(errors, 'package.options.excessive', `An identical option set appears ${count} times.`, { signature });
    } else if (count > 1) {
      pushIssue(warnings, 'package.options.repeated', `An identical option set appears ${count} times.`, { signature });
    }
  }
  const repeatedOpenings = groupRepeated(questions, (question) => normalizedOpening(question.prompt), 6);
  const repeatedExplanations = groupRepeated(questions, (question) => normalizeText(question.explanation), 2);
  if (repeatedOpenings.length > 0) {
    pushIssue(warnings, 'package.prompt.openings', `${repeatedOpenings.length} prompt openings occur at least six times.`);
  }
  if (repeatedExplanations.length > 0) {
    pushIssue(warnings, 'package.explanations', `${repeatedExplanations.length} exact explanations are repeated.`);
  }
  return {
    valid: errors.length === 0,
    moduleId,
    range: { start, end },
    totals: { questions: questions.length, errors: errors.length, warnings: warnings.length },
    errors,
    warnings,
    heuristics: { repeatedOpenings, repeatedExplanations },
  };
}

export async function runValidation({ writeReport = true, moduleId = null } = {}) {
  const blueprint = JSON.parse(fs.readFileSync(path.join(ROOT, 'reports', 'content-blueprint.json'), 'utf8'));
  const moduleBlueprint = moduleId
    ? blueprint.modules.find((module) => module.id === moduleId)
    : null;
  if (moduleId && !moduleBlueprint) {
    throw new Error(`Unknown module "${moduleId}".`);
  }
  const activeBlueprint = moduleBlueprint
    ? { ...blueprint, modules: [moduleBlueprint] }
    : blueprint;
  const donorHtml = fs.readFileSync(path.join(ROOT, 'donor', 'PhrasalVerbsQuiz-index.html'), 'utf8');
  const donor = parseDonorData(donorHtml);
  const registryUrl = `${pathToFileURL(path.join(ROOT, 'src', 'module-registry.js')).href}?validator=${Date.now()}`;
  const { modules: registeredModules } = await import(registryUrl);
  const modules = moduleId
    ? registeredModules.filter((module) => module?.metadata?.id === moduleId)
    : registeredModules;
  const moduleFiles = fs.readdirSync(path.join(ROOT, 'src', 'modules'))
    .filter((file) => file.endsWith('.js'))
    .filter((file) => !moduleId || file === `${moduleId}.js`);
  const report = validateModules({ modules, blueprint: activeBlueprint, donor, moduleFiles });
  report.scope = moduleId ?? 'all';
  const productShell = validateProductShell({
    indexHtml: fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'),
    stylesCss: fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8'),
    appJs: fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8'),
  });
  report.productShell = productShell;
  report.errors.push(...productShell.errors);
  report.totals.errors = report.errors.length;
  report.valid = report.errors.length === 0;

  if (writeReport) {
    fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
    fs.writeFileSync(
      path.join(ROOT, 'reports', moduleId ? `${moduleId}-validator-report.json` : 'validator-report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8',
    );
  }
  return report;
}

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const moduleFlagIndex = process.argv.indexOf('--module');
  const moduleId = moduleFlagIndex >= 0 ? process.argv[moduleFlagIndex + 1] : null;
  if (moduleFlagIndex >= 0 && (!moduleId || moduleId.startsWith('--'))) {
    throw new Error('Usage: node scripts/validate-content.mjs [--module <id>] [--no-write]');
  }
  const report = await runValidation({
    writeReport: !process.argv.includes('--no-write'),
    moduleId,
  });
  console.log(`Content validator: ${report.valid ? 'PASS' : 'FAIL'}`);
  console.log(`Modules: ${report.totals.modules}; questions: ${report.totals.questions}; errors: ${report.totals.errors}; warnings: ${report.totals.warnings}`);
  for (const issue of report.errors.slice(0, 40)) {
    console.error(`ERROR [${issue.code}] ${issue.message}`);
  }
  if (report.errors.length > 40) {
    console.error(`... ${report.errors.length - 40} additional errors are recorded in reports/validator-report.json`);
  }
  for (const issue of report.warnings.slice(0, 20)) {
    console.warn(`WARN [${issue.code}] ${issue.message}`);
  }
  if (!report.valid) process.exitCode = 1;
}
