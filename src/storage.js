export const STORAGE_KEY = 'grammar-drill-kit-progress';
export const SCHEMA_VERSION = 1;
export const THEMES = Object.freeze(['light', 'dark']);

function createDefaultData() {
  return {
    version: SCHEMA_VERSION,
    bestResults: {},
    mistakes: {},
    lastPracticed: {},
    theme: null,
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeTheme(theme) {
  return THEMES.includes(theme) ? theme : null;
}

function sanitizeBestResults(value) {
  if (!isPlainObject(value)) return {};
  const bestResults = {};
  for (const [moduleId, levels] of Object.entries(value)) {
    if (!isPlainObject(levels)) continue;
    const cleanLevels = {};
    for (const [level, result] of Object.entries(levels)) {
      if (!isPlainObject(result)) continue;
      const percentage = Number(result.percentage);
      const correct = Number(result.correct);
      const total = Number(result.total);
      const completedAt = typeof result.completedAt === 'string' ? result.completedAt : null;
      const hasValidScore = Number.isInteger(percentage)
        && percentage >= 0
        && percentage <= 100
        && Number.isInteger(correct)
        && correct >= 0
        && Number.isInteger(total)
        && total > 0
        && correct <= total
        && completedAt;

      if (hasValidScore) {
        cleanLevels[level] = { percentage, correct, total, completedAt };
      }
    }
    if (Object.keys(cleanLevels).length > 0) {
      bestResults[moduleId] = cleanLevels;
    }
  }
  return bestResults;
}

function sanitizeMistakes(value) {
  if (!isPlainObject(value)) return {};
  const mistakes = {};
  for (const [questionId, mistake] of Object.entries(value)) {
    if (!isPlainObject(mistake)) continue;
    const correctReviewCount = Number(mistake.correctReviewCount);
    const moduleId = typeof mistake.moduleId === 'string' ? mistake.moduleId : null;
    const level = typeof mistake.level === 'string' ? mistake.level : null;
    const addedAt = typeof mistake.addedAt === 'string' ? mistake.addedAt : null;
    const hasValidMistake = moduleId
      && level
      && Number.isInteger(correctReviewCount)
      && correctReviewCount >= 0
      && correctReviewCount <= 1;

    if (hasValidMistake) {
      mistakes[questionId] = {
        moduleId,
        level,
        correctReviewCount,
        addedAt,
      };
    }
  }
  return mistakes;
}

function sanitizeLastPracticed(value) {
  if (!isPlainObject(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(([, date]) => typeof date === 'string'),
  );
}

export function sanitizeData(value) {
  if (!isPlainObject(value) || value.version !== SCHEMA_VERSION) {
    return createDefaultData();
  }
  return {
    version: SCHEMA_VERSION,
    bestResults: sanitizeBestResults(value.bestResults),
    mistakes: sanitizeMistakes(value.mistakes),
    lastPracticed: sanitizeLastPracticed(value.lastPracticed),
    theme: sanitizeTheme(value.theme),
  };
}

export function createProgressStore(adapter) {
  let data = createDefaultData();

  function persist() {
    try {
      adapter?.setItem?.(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage must never block the app.
    }
  }

  function load() {
    try {
      const raw = adapter?.getItem?.(STORAGE_KEY);
      data = raw ? sanitizeData(JSON.parse(raw)) : createDefaultData();
    } catch {
      data = createDefaultData();
    }
    persist();
    return getData();
  }

  function getData() {
    return structuredClone(data);
  }

  function setData(nextData) {
    data = sanitizeData(nextData);
    persist();
    return getData();
  }

  load();

  return {
    getData,
    setTheme(theme) {
      data.theme = sanitizeTheme(theme);
      persist();
    },
    recordBestResult(moduleId, level, score, completedAt = new Date().toISOString()) {
      const next = {
        percentage: score.percentage,
        correct: score.correct,
        total: score.total,
        completedAt,
      };
      data.bestResults[moduleId] ??= {};
      const current = data.bestResults[moduleId][level];
      const isBest = !current
        || next.percentage > current.percentage
        || (next.percentage === current.percentage && next.total > current.total);

      if (isBest) {
        data.bestResults[moduleId][level] = next;
        persist();
        return true;
      }
      return false;
    },
    setLastPracticed(moduleId, date = new Date().toISOString().slice(0, 10)) {
      data.lastPracticed[moduleId] = date;
      persist();
    },
    addMistake(question, addedAt = new Date().toISOString()) {
      data.mistakes[question.id] = {
        moduleId: question.moduleId,
        level: question.level,
        correctReviewCount: 0,
        addedAt,
      };
      persist();
    },
    recordMistakeReview(questionId, isCorrect) {
      const mistake = data.mistakes[questionId];
      if (!mistake) {
        return 'missing';
      }
      if (!isCorrect) {
        mistake.correctReviewCount = 0;
        persist();
        return 'reset';
      }
      if (mistake.correctReviewCount >= 1) {
        delete data.mistakes[questionId];
        persist();
        return 'removed';
      }
      mistake.correctReviewCount = 1;
      persist();
      return 'incremented';
    },
    cleanupStaleMistakes(validQuestionIds) {
      let changed = false;
      for (const id of Object.keys(data.mistakes)) {
        if (!validQuestionIds.has(id)) {
          delete data.mistakes[id];
          changed = true;
        }
      }
      if (changed) {
        persist();
      }
      return changed;
    },
    resetProgressKeepTheme() {
      const theme = data.theme;
      data = createDefaultData();
      data.theme = theme;
      persist();
    },
  };
}

export function createBrowserProgressStore() {
  try {
    return createProgressStore(globalThis.localStorage);
  } catch {
    return createProgressStore();
  }
}
