import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { modules } from '../src/module-registry.js';
import { runValidation } from '../scripts/validate-content.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const blueprint = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'reports', 'content-blueprint.json'), 'utf8'),
);
const moduleBlueprint = blueprint.modules.find((module) => module.id === 'conditionals');
const conditionalsModule = modules.find((module) => module.metadata.id === 'conditionals');

test('registers Conditionals second with exactly 100 stable questions', () => {
  assert.equal(modules[1], conditionalsModule);
  assert.equal(conditionalsModule.questions.length, 100);
  assert.deepEqual(
    conditionalsModule.questions.map((question) => question.id),
    Array.from({ length: 100 }, (_, index) => `conditionals-${String(index + 1).padStart(3, '0')}`),
  );
});

test('keeps every Conditionals item structurally usable as a four-option question', () => {
  conditionalsModule.questions.forEach((question) => {
    assert.equal(question.type, 'multiple_choice', question.id);
    assert.equal(question.shuffleOptions, true, question.id);
    assert.equal(question.options.length, 4, question.id);
    assert.equal(new Set(question.options).size, 4, question.id);
    assert.equal(
      question.options.filter((option) => option === question.answer).length,
      1,
      question.id,
    );
    for (const field of ['prompt', 'answer', 'explanation', 'translation', 'example']) {
      assert.equal(typeof question[field], 'string', `${question.id}/${field}`);
      assert.ok(question[field].trim().length > 0, `${question.id}/${field}`);
    }
  });
});

test('matches the exact Conditionals level, topic, and context blueprint', () => {
  const questions = conditionalsModule.questions;
  for (const [level, expected] of Object.entries(moduleBlueprint.levels)) {
    assert.equal(questions.filter((question) => question.level === level).length, expected, level);
  }
  for (const topic of moduleBlueprint.topics) {
    const topicQuestions = questions.filter((question) => question.topic === topic.id);
    assert.equal(topicQuestions.length, topic.total, topic.id);
    for (const [level, expected] of Object.entries(topic.levels)) {
      assert.equal(
        topicQuestions.filter((question) => question.level === level).length,
        expected,
        `${topic.id}/${level}`,
      );
    }
  }
  for (const context of blueprint.contexts) {
    assert.equal(questions.filter((question) => question.context === context).length, 10, context);
  }
});

test('passes the reusable validator in Conditionals module scope', async () => {
  const report = await runValidation({ writeReport: false, moduleId: 'conditionals' });
  assert.equal(report.valid, true, JSON.stringify(report.errors, null, 2));
  assert.equal(report.totals.modules, 1);
  assert.equal(report.totals.questions, 100);
});
