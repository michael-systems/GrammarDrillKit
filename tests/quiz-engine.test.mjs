import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateScore, checkAnswer, createSession, filterQuestions, prepareQuestion } from '../src/quiz-engine.js';

const questions = [
  { id: 'q1', type: 'multiple_choice', level: 'easy', topic: 'alpha', prompt: 'One', options: ['a', 'b', 'c'], answer: 'a', shuffleOptions: true },
  { id: 'q2', type: 'multiple_choice', level: 'medium', topic: 'alpha', prompt: 'Two', options: ['d', 'e', 'f'], answer: 'e', shuffleOptions: true },
  { id: 'q3', type: 'multiple_choice', level: 'hard', topic: 'beta', prompt: 'Three', options: ['g', 'h', 'i'], answer: 'i', shuffleOptions: false },
];

function fixedRandom() {
  return 0;
}

test('filters questions by level, topic, and implemented type', () => {
  assert.deepEqual(filterQuestions(questions, { level: 'medium', topic: 'alpha' }).map((q) => q.id), ['q2']);
  assert.deepEqual(filterQuestions(questions, { level: 'all', topic: 'beta' }).map((q) => q.id), ['q3']);
});

test('session size is capped when fewer questions exist than requested', () => {
  const session = createSession(questions, { level: 'easy', size: 10, random: fixedRandom });
  assert.equal(session.length, 1);
  assert.equal(session[0].id, 'q1');
});

test('all session size returns every matching question', () => {
  const session = createSession(questions, { size: 'all', random: fixedRandom });
  assert.equal(session.length, questions.length);
});

test('scoring counts correct answers and rounds percentage', () => {
  const results = [checkAnswer(questions[0], 'a'), checkAnswer(questions[1], 'd'), checkAnswer(questions[2], null)];
  assert.deepEqual(calculateScore(results), { correct: 1, total: 3, percentage: 33 });
});

test('preparing a question shuffles option copies without mutating source data', () => {
  const originalOptions = [...questions[0].options];
  const prepared = prepareQuestion(questions[0], fixedRandom);
  assert.notEqual(prepared.options, questions[0].options);
  assert.deepEqual(questions[0].options, originalOptions);
  assert.deepEqual(prepared.options.sort(), originalOptions.sort());
});

test('questions with shuffleOptions false still receive copied options', () => {
  const prepared = prepareQuestion(questions[2], fixedRandom);
  assert.notEqual(prepared.options, questions[2].options);
  assert.deepEqual(prepared.options, questions[2].options);
});
