import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const APPROVED_DIR = path.join(ROOT, 'content-work', 'approved');
const MODULE_DIR = path.join(ROOT, 'src', 'modules');

const moduleDetails = {
  'phrasal-verbs': {
    exportName: 'phrasalVerbsModule',
    description: 'Practise 150 donor-traced phrasal-verb meanings in clear modern contexts.',
  },
  conditionals: {
    exportName: 'conditionalsModule',
    description: 'Practise real, unreal, mixed, and formally expressed conditions.',
  },
  'modal-verbs': {
    exportName: 'modalVerbsModule',
    description: 'Practise ability, permission, obligation, advice, probability, and modal deduction.',
  },
  'tenses-active': {
    exportName: 'tensesActiveModule',
    description: 'Choose active English tense forms from precise time, aspect, and discourse context.',
  },
  'tenses-passive': {
    exportName: 'tensesPassiveModule',
    description: 'Practise passive forms across tenses, modal structures, and reporting patterns.',
  },
  articles: {
    exportName: 'articlesModule',
    description: 'Practise a, an, the, and zero article in modern everyday usage.',
  },
  prepositions: {
    exportName: 'prepositionsModule',
    description: 'Practise prepositions of time, place, movement, and common dependent patterns.',
  },
  'gerund-infinitive': {
    exportName: 'gerundInfinitiveModule',
    description: 'Practise gerund and infinitive patterns, including changes of meaning.',
  },
  'word-order-questions': {
    exportName: 'wordOrderQuestionsModule',
    description: 'Practise statement order, direct and indirect questions, tags, and adverb placement.',
  },
  'reported-speech': {
    exportName: 'reportedSpeechModule',
    description: 'Practise reported statements, questions, requests, commands, and reporting verbs.',
  },
};

function titleCaseTopic(topicId) {
  const smallWords = new Set(['of', 'and']);
  return topicId
    .split('-')
    .map((word, index) => (
      index > 0 && smallWords.has(word)
        ? word
        : `${word.charAt(0).toUpperCase()}${word.slice(1)}`
    ))
    .join(' ');
}

function loadApprovedQuestions(moduleId) {
  const files = fs.readdirSync(APPROVED_DIR)
    .filter((file) => file.startsWith(`${moduleId}-`) && file.endsWith('.json'))
    .sort();
  if (files.length === 0) {
    throw new Error(`No approved package files found for ${moduleId}.`);
  }
  return files.flatMap((file) => {
    const value = JSON.parse(fs.readFileSync(path.join(APPROVED_DIR, file), 'utf8'));
    if (!Array.isArray(value)) throw new TypeError(`${file} must contain a JSON array.`);
    return value;
  });
}

function compileModule(moduleBlueprint) {
  const details = moduleDetails[moduleBlueprint.id];
  if (!details) throw new Error(`Missing compiler metadata for ${moduleBlueprint.id}.`);
  const questions = loadApprovedQuestions(moduleBlueprint.id);
  if (questions.length !== moduleBlueprint.total) {
    throw new Error(`${moduleBlueprint.id}: expected ${moduleBlueprint.total} approved questions; found ${questions.length}.`);
  }
  questions.forEach((question, index) => {
    const expectedId = `${moduleBlueprint.id}-${String(index + 1).padStart(3, '0')}`;
    if (question.id !== expectedId) {
      throw new Error(`${moduleBlueprint.id}: expected ${expectedId} at approved index ${index + 1}; found ${question.id}.`);
    }
  });

  const moduleObject = {
    metadata: {
      id: moduleBlueprint.id,
      title: moduleBlueprint.title,
      description: details.description,
      levelRange: 'A2-C1',
    },
    topics: moduleBlueprint.topics.map((topic) => ({
      id: topic.id,
      title: titleCaseTopic(topic.id),
    })),
    questions,
  };
  const output = `export const ${details.exportName} = ${JSON.stringify(moduleObject, null, 2)};\n`;
  fs.writeFileSync(path.join(MODULE_DIR, `${moduleBlueprint.id}.js`), output, 'utf8');
  console.log(`Compiled ${moduleBlueprint.id}: ${questions.length} questions.`);
}

const blueprint = JSON.parse(fs.readFileSync(path.join(ROOT, 'reports', 'content-blueprint.json'), 'utf8'));
const requested = process.argv.slice(2);
const moduleIds = requested.includes('--all')
  ? blueprint.modules.map((module) => module.id)
  : requested;
if (moduleIds.length === 0) {
  throw new Error('Usage: node scripts/compile-modules.mjs --all | <module-id> [...]');
}
for (const moduleId of moduleIds) {
  const moduleBlueprint = blueprint.modules.find((module) => module.id === moduleId);
  if (!moduleBlueprint) throw new Error(`Unknown module "${moduleId}".`);
  compileModule(moduleBlueprint);
}
