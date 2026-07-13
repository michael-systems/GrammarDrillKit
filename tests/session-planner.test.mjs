import test from 'node:test';
import assert from 'node:assert/strict';
import { SESSION_MODES, planSession } from '../src/session-planner.js';

const testModules = Object.freeze([
  {
    metadata: { id: 'alpha', title: 'Alpha' },
    topics: Object.freeze([{ id: 'topic-a', title: 'Topic A' }, { id: 'topic-b', title: 'Topic B' }]),
    questions: Object.freeze([
      Object.freeze({ id: 'a1', type: 'multiple_choice', level: 'easy', topic: 'topic-a', options: Object.freeze(['a', 'b']), answer: 'a' }),
      Object.freeze({ id: 'a2', type: 'multiple_choice', level: 'medium', topic: 'topic-a', options: Object.freeze(['c', 'd']), answer: 'c' }),
      Object.freeze({ id: 'a3', type: 'multiple_choice', level: 'easy', topic: 'topic-b', options: Object.freeze(['e', 'f']), answer: 'e' }),
    ]),
  },
  {
    metadata: { id: 'beta', title: 'Beta' },
    topics: Object.freeze([{ id: 'topic-c', title: 'Topic C' }]),
    questions: Object.freeze([
      Object.freeze({ id: 'b1', type: 'multiple_choice', level: 'easy', topic: 'topic-c', options: Object.freeze(['g', 'h']), answer: 'g' }),
      Object.freeze({ id: 'b2', type: 'multiple_choice', level: 'hard', topic: 'topic-c', options: Object.freeze(['i', 'j']), answer: 'i' }),
    ]),
  },
]);

const noShuffle = () => 0;

test('Practice session uses only the selected module and level', () => {
  const plan = planSession(testModules, { mode: SESSION_MODES.practice, moduleId: 'alpha', level: 'easy', size: 'all', random: noShuffle });
  assert.deepEqual(plan.session.map((question) => question.id).sort(), ['a1', 'a3']);
  assert.deepEqual(new Set(plan.session.map((question) => question.moduleId)), new Set(['alpha']));
});

test('Mixed session can draw from multiple modules and preserves moduleId', () => {
  const plan = planSession(testModules, { mode: SESSION_MODES.mixed, level: 'easy', size: 'all', random: noShuffle });
  assert.deepEqual(new Set(plan.session.map((question) => question.moduleId)), new Set(['alpha', 'beta']));
  assert.equal(plan.session.find((question) => question.id === 'b1').moduleId, 'beta');
});

test('Focused Practice includes only the selected topic', () => {
  const plan = planSession(testModules, { mode: SESSION_MODES.focused, moduleId: 'alpha', topicId: 'topic-a', level: 'all', size: 'all', random: noShuffle });
  assert.deepEqual(plan.session.map((question) => question.id).sort(), ['a1', 'a2']);
  assert.equal(plan.topic.title, 'Topic A');
});

test('Focused Practice respects difficulty', () => {
  const plan = planSession(testModules, { mode: SESSION_MODES.focused, moduleId: 'alpha', topicId: 'topic-a', level: 'medium', size: 'all', random: noShuffle });
  assert.deepEqual(plan.session.map((question) => question.id), ['a2']);
});

test('Exam session uses the selected module and level', () => {
  const plan = planSession(testModules, { mode: SESSION_MODES.exam, moduleId: 'beta', level: 'hard', size: 'all', random: noShuffle });
  assert.deepEqual(plan.session.map((question) => question.id), ['b2']);
  assert.deepEqual(plan.moduleIds, ['beta']);
});

test('Requested size greater than availability uses all available questions', () => {
  const plan = planSession(testModules, { mode: SESSION_MODES.practice, moduleId: 'beta', level: 'easy', size: '50', random: noShuffle });
  assert.equal(plan.session.length, 1);
});

test('Source module and question data are not mutated', () => {
  const before = JSON.stringify(testModules);
  planSession(testModules, { mode: SESSION_MODES.mixed, level: 'all', size: 'all', random: noShuffle });
  assert.equal(JSON.stringify(testModules), before);
});

test('Invalid module or topic selection produces an empty session safely', () => {
  const invalidModule = planSession(testModules, { mode: SESSION_MODES.practice, moduleId: 'missing', level: 'easy', size: 'all' });
  assert.deepEqual(invalidModule.session, []);
  const invalidTopic = planSession(testModules, { mode: SESSION_MODES.focused, moduleId: 'alpha', topicId: 'missing', level: 'easy', size: 'all' });
  assert.deepEqual(invalidTopic.session, []);
});
