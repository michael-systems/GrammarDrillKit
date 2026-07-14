import test from 'node:test';
import assert from 'node:assert/strict';
import { modules } from '../src/module-registry.js';

const EXPECTED_MODULES = 10;
const QUESTIONS_PER_MODULE = 100;
const EXPECTED_LEVELS = { easy: 30, medium: 40, hard: 30 };

test('content pack has exactly 10 modules and 1000 questions', () => {
  assert.equal(modules.length, EXPECTED_MODULES);
  assert.equal(modules.reduce((sum, module) => sum + module.questions.length, 0), 1000);
});

test('each module has 100 questions with required level distribution', () => {
  for (const module of modules) {
    assert.equal(module.questions.length, QUESTIONS_PER_MODULE, module.metadata.id);
    const counts = Object.fromEntries(Object.keys(EXPECTED_LEVELS).map((level) => [level, 0]));
    for (const question of module.questions) counts[question.level] += 1;
    assert.deepEqual(counts, EXPECTED_LEVELS, module.metadata.id);
  }
});

test('questions have valid multiple-choice schema and unique ids', () => {
  const ids = new Set();
  for (const module of modules) {
    const topics = new Set(module.topics.map((topic) => topic.id));
    for (const question of module.questions) {
      assert.equal(question.type, 'multiple_choice');
      assert.ok(!ids.has(question.id), question.id);
      ids.add(question.id);
      assert.ok(topics.has(question.topic), `${question.id} topic`);
      assert.equal(question.options.length, 4, `${question.id} options`);
      assert.ok(question.options.includes(question.answer), `${question.id} answer in options`);
      assert.ok(question.prompt && question.explanation && question.translation && question.example);
    }
  }
});

test('phrasal verbs are exactly 100 donor-traceable adapted entries', () => {
  const module = modules.find((item) => item.metadata.id === 'phrasal-verbs');
  assert.equal(module.questions.length, 100);
  assert.equal(module.questions.filter((question) => question.source === 'donor/PhrasalVerbsQuiz-index.html DATA').length, 100);
  assert.equal(new Set(module.questions.map((question) => question.donorEntry)).size, 100);
});
