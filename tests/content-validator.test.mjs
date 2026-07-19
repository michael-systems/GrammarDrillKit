import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeText,
  parseDonorData,
  validateDraftPackage,
  validateProductShell,
} from '../scripts/validate-content.mjs';

const blueprint = {
  contexts: ['home-family'],
  modules: [
    {
      id: 'conditionals',
      title: 'Conditionals',
      total: 1,
      levels: { easy: 1, medium: 0, hard: 0 },
      topics: [
        { id: 'first-conditional', total: 1, levels: { easy: 1, medium: 0, hard: 0 } },
      ],
    },
  ],
};

const validQuestion = {
  id: 'conditionals-001',
  type: 'multiple_choice',
  level: 'easy',
  topic: 'first-conditional',
  context: 'home-family',
  prompt: 'The forecast says the storm will arrive tonight. If it reaches us, we ___ indoors.',
  options: ['will stay', 'stayed', 'would stay', 'had stayed'],
  answer: 'will stay',
  explanation: 'The forecast presents a real future possibility, so the result clause uses will plus the base verb.',
  translation: 'По прогнозу шторм придёт сегодня ночью. Если он доберётся до нас, мы останемся дома.',
  example: 'If the roads freeze overnight, the council will close the bridge.',
  shuffleOptions: true,
};

test('normalizes Unicode quotes, blanks, punctuation, and whitespace consistently', () => {
  assert.equal(normalizeText('  “If” ___ NOW!  '), 'if blank now');
});

test('extracts donor DATA without executing the surrounding HTML', () => {
  const donor = parseDonorData(`
    <script>
    const DATA = [
      { q: "Meaning.", rt: "Перевод.", key: "give up", tense: "past", ex: "Example." }
    ];
    </script>
  `);
  assert.equal(donor.length, 1);
  assert.equal(donor[0].key, 'give up');
});

test('accepts a structurally complete draft package', () => {
  const report = validateDraftPackage({
    questions: [validQuestion],
    moduleId: 'conditionals',
    start: 1,
    end: 1,
    blueprint,
    donor: [],
  });
  assert.equal(report.valid, true);
  assert.equal(report.totals.errors, 0);
});

test('rejects ambiguous answer membership and Cyrillic outside translation', () => {
  const invalid = structuredClone(validQuestion);
  invalid.prompt = 'Если storm reaches us, we ___ indoors.';
  invalid.options[1] = 'will stay';
  const report = validateDraftPackage({
    questions: [invalid],
    moduleId: 'conditionals',
    start: 1,
    end: 1,
    blueprint,
    donor: [],
  });
  assert.equal(report.valid, false);
  assert.ok(report.errors.some((issue) => issue.code === 'question.options.duplicate'));
  assert.ok(report.errors.some((issue) => issue.code === 'question.answer.membership'));
  assert.ok(report.errors.some((issue) => issue.code === 'question.cyrillic'));
});

test('accepts only the fixed telegram credit outside app runtime rendering', () => {
  const report = validateProductShell({
    indexHtml: '<footer class="creator-footer"><a href="https://telegram.me/lifeforevery" target="_blank" rel="noopener noreferrer">Made by M</a></footer>',
    stylesCss: '.app-shell { padding-bottom: 50px; } .creator-footer { position: fixed; right: calc(1px + env(safe-area-inset-right)); bottom: calc(1px + env(safe-area-inset-bottom)); text-align: right; }',
    appJs: 'export const app = true;',
  });
  assert.equal(report.valid, true);
});

test('rejects the shortened credit URL and mobile left alignment', () => {
  const report = validateProductShell({
    indexHtml: '<a href="https://t.me/lifeforevery">Made by M</a>',
    stylesCss: '.creator-footer { position: fixed; right: 0; bottom: 0; text-align: left; }',
    appJs: '',
  });
  assert.equal(report.valid, false);
  assert.ok(report.errors.some((issue) => issue.code === 'product.credit.shortUrl'));
  assert.ok(report.errors.some((issue) => issue.code === 'product.credit.mobile'));
});
