import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { modules } from '../src/module-registry.js';
import {
  parseDonorData,
  runValidation,
} from '../scripts/validate-content.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const blueprint = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'reports', 'content-blueprint.json'), 'utf8'),
);
const donor = parseDonorData(
  fs.readFileSync(path.join(ROOT, 'donor', 'PhrasalVerbsQuiz-index.html'), 'utf8'),
);
const moduleBlueprint = blueprint.modules.find((module) => module.id === 'phrasal-verbs');
const phrasalVerbsModule = modules.find((module) => module.metadata.id === 'phrasal-verbs');

test('registers Phrasal Verbs first with exactly 150 stable donor-backed questions', () => {
  assert.equal(modules[0], phrasalVerbsModule);
  assert.equal(phrasalVerbsModule.questions.length, 150);
  assert.deepEqual(
    phrasalVerbsModule.questions.map((question) => question.id),
    Array.from({ length: 150 }, (_, index) => `phrasal-verbs-${String(index + 1).padStart(3, '0')}`),
  );
  assert.deepEqual(
    phrasalVerbsModule.questions.map((question) => question.donorEntry),
    Array.from({ length: 150 }, (_, index) => index + 1),
  );
});

test('preserves donor provenance and uses only donor keys as answer choices', () => {
  const donorKeys = new Set(donor.map((entry) => entry.key));
  phrasalVerbsModule.questions.forEach((question, index) => {
    const source = donor[index];
    assert.equal(question.donorQ, source.q, question.id);
    assert.equal(question.donorKey, source.key, question.id);
    assert.equal(question.answer, source.key, question.id);
    assert.equal(question.donorTense, source.tense, question.id);
    assert.equal(question.donorExample, source.ex, question.id);
    assert.ok(question.translation.includes(source.rt), question.id);
    assert.equal(new Set(question.options).size, 4, question.id);
    assert.equal(question.options.filter((option) => option === question.answer).length, 1, question.id);
    assert.ok(question.options.every((option) => donorKeys.has(option)), question.id);
  });
});

test('matches the exact Phrasal Verbs level, topic, and context blueprint', () => {
  const questions = phrasalVerbsModule.questions;
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
    assert.equal(questions.filter((question) => question.context === context).length, 15, context);
  }
});

test('passes the reusable validator in module scope', async () => {
  const report = await runValidation({ writeReport: false, moduleId: 'phrasal-verbs' });
  assert.equal(report.valid, true, JSON.stringify(report.errors, null, 2));
  assert.equal(report.totals.modules, 1);
  assert.equal(report.totals.questions, 150);
});
