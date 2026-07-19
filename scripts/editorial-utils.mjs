import { createHash } from 'node:crypto';

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, sortValue(value[key])]),
    );
  }
  return value;
}

export function stableStringify(value) {
  return JSON.stringify(sortValue(value));
}

export function contentHash(value) {
  return `sha256:${createHash('sha256').update(stableStringify(value)).digest('hex')}`;
}

export const BLIND_CHECKS = Object.freeze([
  'naturalModernEnglish',
  'exactlyOneAnswer',
  'threeWrongDistractors',
  'specificExplanation',
  'faithfulTranslation',
  'nonCosmeticExample',
  'sensibleTopicAndLevel',
  'britishAmericanUnambiguous',
]);

export const VERDICTS = Object.freeze(['ACCEPT', 'REWRITE', 'REJECT']);
