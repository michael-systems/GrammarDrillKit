import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgressStore, SCHEMA_VERSION, STORAGE_KEY } from '../src/storage.js';

function memoryAdapter(initial = {}) {
  const store = { ...initial };
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = value; },
    dump: () => ({ ...store }),
  };
}

const question = { id: 'q1', moduleId: 'mod', level: 'easy' };

test('loads default storage state when storage is empty', () => {
  const adapter = memoryAdapter();
  const store = createProgressStore(adapter);
  assert.deepEqual(store.getData(), { version: SCHEMA_VERSION, bestResults: {}, mistakes: {}, lastPracticed: {}, theme: null });
});

test('serializes and restores valid progress', () => {
  const adapter = memoryAdapter();
  const store = createProgressStore(adapter);
  store.setTheme('dark');
  store.recordBestResult('mod', 'easy', { correct: 8, total: 10, percentage: 80 }, '2026-01-01T00:00:00.000Z');
  store.setLastPracticed('mod', '2026-01-02');
  store.addMistake(question, '2026-01-03T00:00:00.000Z');

  const restored = createProgressStore(adapter).getData();
  assert.equal(restored.theme, 'dark');
  assert.deepEqual(restored.bestResults.mod.easy, { correct: 8, total: 10, percentage: 80, completedAt: '2026-01-01T00:00:00.000Z' });
  assert.equal(restored.lastPracticed.mod, '2026-01-02');
  assert.equal(restored.mistakes.q1.correctReviewCount, 0);
});

test('recovers from malformed stored data', () => {
  const adapter = memoryAdapter({ [STORAGE_KEY]: '{not json' });
  const store = createProgressStore(adapter);
  assert.deepEqual(store.getData().mistakes, {});
});

test('compares best scores by percentage then question count', () => {
  const store = createProgressStore(memoryAdapter());
  assert.equal(store.recordBestResult('mod', 'easy', { correct: 8, total: 10, percentage: 80 }, 'a'), true);
  assert.equal(store.recordBestResult('mod', 'easy', { correct: 4, total: 5, percentage: 80 }, 'b'), false);
  assert.equal(store.recordBestResult('mod', 'easy', { correct: 16, total: 20, percentage: 80 }, 'c'), true);
  assert.equal(store.getData().bestResults.mod.easy.total, 20);
});

test('adds a mistake with a zero review count', () => {
  const store = createProgressStore(memoryAdapter());
  store.addMistake(question, 'now');
  assert.deepEqual(store.getData().mistakes.q1, { moduleId: 'mod', level: 'easy', correctReviewCount: 0, addedAt: 'now' });
});

test('wrong review resets a mistake counter', () => {
  const store = createProgressStore(memoryAdapter());
  store.addMistake(question);
  store.recordMistakeReview('q1', true);
  assert.equal(store.recordMistakeReview('q1', false), 'reset');
  assert.equal(store.getData().mistakes.q1.correctReviewCount, 0);
});

test('correct review increments the counter once', () => {
  const store = createProgressStore(memoryAdapter());
  store.addMistake(question);
  assert.equal(store.recordMistakeReview('q1', true), 'incremented');
  assert.equal(store.getData().mistakes.q1.correctReviewCount, 1);
});

test('two consecutive correct reviews remove a mistake', () => {
  const store = createProgressStore(memoryAdapter());
  store.addMistake(question);
  store.recordMistakeReview('q1', true);
  assert.equal(store.recordMistakeReview('q1', true), 'removed');
  assert.equal(store.getData().mistakes.q1, undefined);
});

test('stale question cleanup removes missing question IDs', () => {
  const store = createProgressStore(memoryAdapter());
  store.addMistake(question);
  store.addMistake({ id: 'stale', moduleId: 'mod', level: 'easy' });
  assert.equal(store.cleanupStaleMistakes(new Set(['q1'])), true);
  assert.deepEqual(Object.keys(store.getData().mistakes), ['q1']);
});

test('resetProgressKeepTheme clears progress while preserving selected theme', () => {
  const store = createProgressStore(memoryAdapter());
  store.setTheme('dark');
  store.recordBestResult('mod', 'easy', { correct: 8, total: 10, percentage: 80 }, '2026-01-01T00:00:00.000Z');
  store.setLastPracticed('mod', '2026-01-02');
  store.addMistake(question, '2026-01-03T00:00:00.000Z');

  store.resetProgressKeepTheme();

  assert.deepEqual(store.getData(), {
    version: SCHEMA_VERSION,
    bestResults: {},
    mistakes: {},
    lastPracticed: {},
    theme: 'dark',
  });
});
