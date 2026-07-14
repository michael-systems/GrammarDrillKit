import { modules } from '../src/module-registry.js';

export const REQUIRED_PHRASAL_TOPICS = [
  'everyday-routines','movement-and-access','work-and-study','communication','relationships','travel-and-transport','decisions-and-progress','problems-and-solutions','money-and-services','technology-and-media','health-and-lifestyle','change-and-results',
];
const LEVELS = new Set(['easy', 'medium', 'hard']);
const blockedText = ['dis' + 'tractor', 'place' + 'holder', 'option-1', 'Item', 'Modern ' + 'example', 'stated ' + 'context', 'generated ' + 'answer', 'works as a generic answer', 'donor-import'];
const FORBIDDEN = blockedText.map((text) => text === 'Item' ? /Item\s+\d+/i : new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
const HTML = /<[^>]+>/;
const CYRILLIC = /[\u0400-\u04FF]/;
export const normalize = (value) => String(value).trim().toLowerCase().replace(/\s+/g, ' ');
function countBy(items, key) { return items.reduce((acc, item) => { const value = typeof key === 'function' ? key(item) : item[key]; acc[value] = (acc[value] || 0) + 1; return acc; }, {}); }
function fail(errors, message) { errors.push(message); }
function checkText(errors, label, value, { allowCyrillic = false } = {}) {
  if (typeof value !== 'string' || !value.trim()) fail(errors, `${label} must be a non-empty string.`);
  if (typeof value === 'string') {
    if (HTML.test(value)) fail(errors, `${label} contains HTML.`);
    for (const pattern of FORBIDDEN) if (pattern.test(value)) fail(errors, `${label} contains blocked filler text.`);
    if (!allowCyrillic && CYRILLIC.test(value)) fail(errors, `${label} contains Cyrillic outside translation.`);
  }
}
export function validateModules(registry = modules) {
  const errors = []; const moduleIds = new Set(); const questionIds = new Set(); const prompts = new Set(); const promptAnswers = new Set();
  for (const mod of registry) {
    const id = mod?.metadata?.id;
    checkText(errors, 'module id', id); if (id) { if (moduleIds.has(id)) fail(errors, `Duplicate module ID ${id}.`); moduleIds.add(id); }
    checkText(errors, `${id} title`, mod?.metadata?.title); checkText(errors, `${id} description`, mod?.metadata?.description);
    const topicIds = new Set();
    for (const topic of mod.topics || []) { checkText(errors, `${id} topic id`, topic.id); checkText(errors, `${id} topic title`, topic.title); if (topicIds.has(topic.id)) fail(errors, `${id} duplicate topic ${topic.id}.`); topicIds.add(topic.id); }
    if (!Array.isArray(mod.questions)) fail(errors, `${id} questions must be an array.`);
    for (const q of mod.questions || []) {
      const prefix = `${id}/${q.id || '(missing id)'}`;
      checkText(errors, `${prefix} id`, q.id); if (questionIds.has(q.id)) fail(errors, `Duplicate question ID ${q.id}.`); questionIds.add(q.id);
      if (q.type !== 'multiple_choice') fail(errors, `${prefix} type must be multiple_choice.`);
      if (!LEVELS.has(q.level)) fail(errors, `${prefix} level must be easy, medium, or hard.`);
      if (!topicIds.has(q.topic)) fail(errors, `${prefix} topic ${q.topic} is not registered.`);
      checkText(errors, `${prefix} prompt`, q.prompt); checkText(errors, `${prefix} answer`, q.answer); checkText(errors, `${prefix} explanation`, q.explanation); checkText(errors, `${prefix} example`, q.example); checkText(errors, `${prefix} translation`, q.translation, { allowCyrillic: true });
      if (!Array.isArray(q.options) || q.options.length !== 4) fail(errors, `${prefix} must have exactly four options.`);
      const optionCounts = new Map();
      for (const option of q.options || []) { checkText(errors, `${prefix} option`, option); optionCounts.set(normalize(option), (optionCounts.get(normalize(option)) || 0) + 1); }
      for (const [option, count] of optionCounts) if (count > 1) fail(errors, `${prefix} duplicate option ${option}.`);
      if ((q.options || []).filter((option) => option === q.answer).length !== 1) fail(errors, `${prefix} answer must appear exactly once among options.`);
      if (typeof q.shuffleOptions !== 'boolean') fail(errors, `${prefix} shuffleOptions must be boolean.`);
      const np = normalize(q.prompt); if (prompts.has(np)) fail(errors, `Duplicate prompt: ${q.prompt}`); prompts.add(np);
      const npa = `${np}||${normalize(q.answer)}`; if (promptAnswers.has(npa)) fail(errors, `Duplicate prompt + answer: ${q.prompt}`); promptAnswers.add(npa);
      if (id === 'phrasal-verbs') {
        if (q.source !== 'PhrasalVerbsQuiz donor DATA') fail(errors, `${prefix} source is invalid.`);
        if (!Number.isInteger(q.donorEntry) || q.donorEntry < 1 || q.donorEntry > 150) fail(errors, `${prefix} donorEntry is invalid.`);
        checkText(errors, `${prefix} donorKey`, q.donorKey); checkText(errors, `${prefix} donorTense`, q.donorTense);
        if (q.answer !== q.donorKey) fail(errors, `${prefix} answer must equal donorKey.`);
      }
    }
    if (id === 'phrasal-verbs') validatePhrasal(mod, errors);
  }
  return { ok: errors.length === 0, errors, summary: summarize(registry) };
}
function validatePhrasal(mod, errors) {
  if (mod.questions.length !== 150) fail(errors, 'Phrasal Verbs must contain exactly 150 questions.');
  const levels = countBy(mod.questions, 'level'); if (levels.easy !== 50 || levels.medium !== 50 || levels.hard !== 50) fail(errors, 'Phrasal Verbs level counts must be 50/50/50.');
  const topicIds = mod.topics.map((topic) => topic.id); if (topicIds.length !== 12) fail(errors, 'Phrasal Verbs must have exactly 12 topics.');
  for (const topic of REQUIRED_PHRASAL_TOPICS) if (!topicIds.includes(topic)) fail(errors, `Missing Phrasal Verbs topic ${topic}.`);
  const topicCounts = countBy(mod.questions, 'topic'); for (const topic of REQUIRED_PHRASAL_TOPICS) if ((topicCounts[topic] || 0) < 5 || (topicCounts[topic] || 0) > 30) fail(errors, `${topic} must contain 5-30 questions.`);
  const entries = new Set();
  for (let i = 1; i <= 150; i += 1) {
    const q = mod.questions[i - 1]; if (q?.id !== `phrasal-verbs-${String(i).padStart(3, '0')}`) fail(errors, `Expected phrasal-verbs-${String(i).padStart(3, '0')} at position ${i}.`);
  }
  for (const q of mod.questions) entries.add(q.donorEntry);
  for (let i = 1; i <= 150; i += 1) if (!entries.has(i)) fail(errors, `Missing donorEntry ${i}.`);
}
export function summarize(registry = modules) { return registry.map((mod) => ({ id: mod.metadata.id, questionCount: mod.questions.length, levelCounts: countBy(mod.questions, 'level'), topicCounts: countBy(mod.questions, 'topic'), donorCoverage: mod.metadata.id === 'phrasal-verbs' ? `${Math.min(...mod.questions.map((q) => q.donorEntry))}-${Math.max(...mod.questions.map((q) => q.donorEntry))} (${new Set(mod.questions.map((q) => q.donorEntry)).size}/150)` : undefined })); }
export function printSummary(result) { for (const item of result.summary) { console.log(`Module: ${item.id}`); console.log(`  Questions: ${item.questionCount}`); console.log(`  Levels: ${JSON.stringify(item.levelCounts)}`); console.log(`  Topics: ${JSON.stringify(item.topicCounts)}`); if (item.donorCoverage) console.log(`  Phrasal Verbs donor-entry coverage: ${item.donorCoverage}`); } }
if (import.meta.url === `file://${process.argv[1]}`) { const result = validateModules(); printSummary(result); if (!result.ok) { console.error('\nContent validation failed:'); for (const error of result.errors) console.error(`- ${error}`); process.exit(1); } console.log('\nContent validation passed.'); }
