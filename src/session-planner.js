import { createSession, prepareQuestion } from './quiz-engine.js?v=20260719-session-size';
import { shuffleArray } from './utilities.js?v=20260719-session-size';

export const SESSION_MODES = Object.freeze({
  practice: 'practice',
  mixed: 'mixed',
  exam: 'exam',
  focused: 'focused',
});

export const MODE_LABELS = Object.freeze({
  [SESSION_MODES.practice]: 'Practice',
  [SESSION_MODES.mixed]: 'Mixed Practice',
  [SESSION_MODES.exam]: 'Exam',
  [SESSION_MODES.focused]: 'Focused Practice',
});

function attachModuleId(module) {
  return module.questions.map((question) => ({
    ...question,
    moduleId: module.metadata.id,
  }));
}

function findModule(modules, moduleId) {
  return modules.find((module) => module.metadata.id === moduleId) ?? null;
}

function uniqueModuleIds(questions) {
  return [...new Set(questions.map((question) => question.moduleId).filter(Boolean))];
}

function findTopic(module, topicId) {
  return module?.topics.find((topic) => topic.id === topicId) ?? null;
}

export function createMistakesReviewSession(
  questions,
  { size = 'all', random = Math.random } = {},
) {
  const shuffled = shuffleArray(questions, random);
  const limit = size === 'all'
    ? shuffled.length
    : Math.min(Number(size), shuffled.length);
  return shuffled
    .slice(0, limit)
    .map((question) => prepareQuestion(question, random));
}

export function planSession(modules, options = {}) {
  const {
    mode = SESSION_MODES.practice,
    moduleId,
    topicId,
    level = 'all',
    size = 'all',
    random = Math.random,
  } = options;

  if (mode === SESSION_MODES.mixed) {
    const questions = modules.flatMap(attachModuleId);
    const session = createSession(questions, { level, size, random });
    return { mode, session, moduleIds: uniqueModuleIds(session), topic: null };
  }

  const selectedModule = findModule(modules, moduleId);
  if (!selectedModule) {
    return { mode, session: [], moduleIds: [], topic: null };
  }

  const topic = mode === SESSION_MODES.focused ? findTopic(selectedModule, topicId) : null;
  if (mode === SESSION_MODES.focused && !topic) {
    return { mode, session: [], moduleIds: [selectedModule.metadata.id], topic: null };
  }

  const session = createSession(attachModuleId(selectedModule), {
    level,
    topic: topic?.id ?? 'all',
    size,
    random,
  });

  return {
    mode,
    session,
    moduleIds: uniqueModuleIds(session),
    topic,
  };
}
