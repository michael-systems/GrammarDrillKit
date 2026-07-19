import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { modules } from '../src/module-registry.js';
import {
  createMistakesReviewSession,
  planSession,
  SESSION_MODES,
} from '../src/session-planner.js';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const noShuffle = () => 0;

function practice(moduleId, size, level = 'all') {
  return planSession(modules, {
    mode: SESSION_MODES.practice,
    moduleId,
    level,
    size,
    random: noShuffle,
  }).session;
}

function assertUniqueIds(questions) {
  assert.equal(
    new Set(questions.map((question) => question.id)).size,
    questions.length,
  );
}

test('Phrasal Verbs honours session sizes 10, 20, 50, and All', () => {
  for (const [size, expected] of [['10', 10], ['20', 20], ['50', 50], ['all', 150]]) {
    const session = practice('phrasal-verbs', size);
    assert.equal(session.length, expected, size);
    assertUniqueIds(session);
  }
});

test('Conditionals honours session sizes 10, 20, 50, and All', () => {
  for (const [size, expected] of [['10', 10], ['20', 20], ['50', 50], ['all', 100]]) {
    const session = practice('conditionals', size);
    assert.equal(session.length, expected, size);
    assertUniqueIds(session);
  }
});

test('Conditionals All returns the complete selected level', () => {
  assert.equal(practice('conditionals', 'all', 'easy').length, 30);
  assert.equal(practice('conditionals', 'all', 'medium').length, 40);
  assert.equal(practice('conditionals', 'all', 'hard').length, 30);
});

test('a requested size larger than the eligible pool returns the pool without duplicates', () => {
  const session = practice('conditionals', '50', 'easy');
  assert.equal(session.length, 30);
  assertUniqueIds(session);
});

test('Mistakes Review is capped by actual mistakes and is never padded', () => {
  const mistakes = [
    modules[0].questions[0],
    modules[1].questions[0],
  ];
  const review = createMistakesReviewSession(mistakes, {
    size: '50',
    random: noShuffle,
  });
  assert.equal(review.length, 2);
  assert.deepEqual(
    new Set(review.map((question) => question.id)),
    new Set(mistakes.map((question) => question.id)),
  );
  assertUniqueIds(review);
});

test('runtime imports share one cache-busting asset version', () => {
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
  const registryJs = fs.readFileSync(path.join(ROOT, 'src', 'module-registry.js'), 'utf8');
  const plannerJs = fs.readFileSync(path.join(ROOT, 'src', 'session-planner.js'), 'utf8');
  const quizEngineJs = fs.readFileSync(path.join(ROOT, 'src', 'quiz-engine.js'), 'utf8');
  const version = indexHtml.match(/src\/app\.js\?v=([^"]+)/)?.[1];

  assert.ok(version, 'index.html must version the app module');
  for (const [file, source, imports] of [
    ['app.js', appJs, [
      'module-registry.js',
      'quiz-engine.js',
      'session-planner.js',
      'storage.js',
      'utilities.js',
    ]],
    ['module-registry.js', registryJs, [
      'modules/phrasal-verbs.js',
      'modules/conditionals.js',
      'modules/modal-verbs.js',
    ]],
    ['session-planner.js', plannerJs, ['quiz-engine.js', 'utilities.js']],
    ['quiz-engine.js', quizEngineJs, ['utilities.js']],
  ]) {
    for (const importedFile of imports) {
      assert.ok(
        source.includes(`${importedFile}?v=${version}`),
        `${file} must import ${importedFile} with asset version ${version}`,
      );
    }
  }
});
