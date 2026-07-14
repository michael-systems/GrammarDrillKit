import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { modules } from '../src/module-registry.js';
import { REQUIRED_PHRASAL_TOPICS, normalize, validateModules } from '../scripts/validate-content.mjs';

const phrasal = modules.find((module) => module.metadata.id === 'phrasal-verbs');

test('all registered modules pass content validation', () => {
  const result = validateModules(modules);
  assert.deepEqual(result.errors, []);
});

test('Phrasal Verbs donor import is complete and traceable', () => {
  assert.equal(phrasal.questions.length, 150);
  assert.deepEqual(countBy(phrasal.questions, 'level'), { easy: 50, medium: 50, hard: 50 });
  assert.deepEqual(phrasal.questions.map((q) => q.id), Array.from({ length: 150 }, (_, i) => `phrasal-verbs-${String(i + 1).padStart(3, '0')}`));
  const donorEntries = phrasal.questions.map((q) => q.donorEntry);
  assert.equal(new Set(donorEntries).size, 150);
  assert.deepEqual([...new Set(donorEntries)].sort((a, b) => a - b), Array.from({ length: 150 }, (_, i) => i + 1));
  for (const q of phrasal.questions) { assert.equal(q.answer, q.donorKey); assert.equal(q.source, 'PhrasalVerbsQuiz donor DATA'); }
});

test('Phrasal Verbs topics, prompts, and options are valid', () => {
  const topicIds = phrasal.topics.map((topic) => topic.id);
  assert.deepEqual(topicIds, REQUIRED_PHRASAL_TOPICS);
  const topicCounts = countBy(phrasal.questions, 'topic');
  for (const topic of REQUIRED_PHRASAL_TOPICS) assert.ok(topicCounts[topic] >= 5 && topicCounts[topic] <= 30, `${topic}: ${topicCounts[topic]}`);
  assert.equal(new Set(phrasal.questions.map((q) => q.id)).size, phrasal.questions.length);
  assert.equal(new Set(phrasal.questions.map((q) => normalize(q.prompt))).size, phrasal.questions.length);
  const donorKeys = new Set(phrasal.questions.map((q) => q.donorKey));
  const forbiddenExplanationPhrases = ['matches the meaning', 'The example uses a past form', 'The example shows the form in context'];
  for (const q of phrasal.questions) {
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options.map(normalize)).size, 4);
    assert.equal(q.options.filter((option) => option === q.answer).length, 1);
    for (const option of q.options) assert.ok(donorKeys.has(option), `${q.id}: ${option}`);
    for (const phrase of forbiddenExplanationPhrases) assert.doesNotMatch(q.explanation, new RegExp(phrase));
    assert.doesNotMatch([q.prompt, q.explanation, q.example, q.answer, ...q.options].join(' '), new RegExp(['dis' + 'tractor', 'place' + 'holder', 'Modern ' + 'example', 'stated ' + 'context', 'generated ' + 'answer', 'donor-import'].join('|'), 'i'));
    assert.doesNotMatch([q.prompt, q.explanation, q.example, q.answer, ...q.options].join(' '), /[\u0400-\u04FF]/);
  }
});

test('creator footer uses one fixed telegram.me link', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.equal((html.match(/Made by M/g) || []).length, 1);
  assert.match(html, /href="https:\/\/telegram\.me\/lifeforevery"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.doesNotMatch(`${html}\n${css}`, /https:\/\/t\.me\/lifeforevery/);
  assert.match(css, /\.creator-footer\s*\{[^}]*position:\s*fixed/i);
  assert.doesNotMatch(css, /@media[^}]+\.creator-footer\s*\{[^}]*text-align:\s*left/is);
  assert.doesNotMatch(css, /@media[^}]+\.creator-footer\s*\{[^}]*left:\s*0/is);
});

function countBy(items, key) { return items.reduce((acc, item) => { acc[item[key]] = (acc[item[key]] || 0) + 1; return acc; }, {}); }
