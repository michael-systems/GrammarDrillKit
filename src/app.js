import { modules, getModuleById } from './module-registry.js';
import { calculateScore, checkAnswer, createSession, prepareQuestion } from './quiz-engine.js';
import { formatLevel, shuffleArray } from './utilities.js';
import { createBrowserProgressStore, THEMES } from './storage.js';

const app = document.querySelector('#app');
const progressStore = createBrowserProgressStore();
const state = {
  session: [],
  currentIndex: 0,
  results: [],
  answered: false,
  lastResult: null,
  reviewOutcome: null,
  showExample: false,
  mode: 'practice',
  moduleId: null,
  level: null,
};

function appendTextElement(parent, tagName, text, className) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  element.textContent = text;
  parent.append(element);
  return element;
}

function createButton(text, { id, className, disabled = false, type } = {}) {
  const button = document.createElement('button');
  button.textContent = text;
  if (id) {
    button.id = id;
  }

  if (className) {
    button.className = className;
  }

  if (disabled) {
    button.disabled = true;
  }

  if (type) {
    button.type = type;
  }
  return button;
}

function clearApp() {
  app.replaceChildren();
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  progressStore.setTheme(theme);
}

function getCurrentTheme() {
  const saved = progressStore.getData().theme;
  if (THEMES.includes(saved)) {
    return saved;
  }
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function allQuestionsWithModule() {
  return modules.flatMap((module) =>
    module.questions.map((question) => ({
      ...question,
      moduleId: module.metadata.id,
    })),
  );
}

function getMistakeQuestions() {
  const questionsById = new Map(
    allQuestionsWithModule().map((question) => [question.id, question]),
  );
  progressStore.cleanupStaleMistakes(new Set(questionsById.keys()));
  return Object.keys(progressStore.getData().mistakes)
    .map((id) => questionsById.get(id))
    .filter(Boolean);
}

function renderSelection() {
  clearApp();

  const form = document.createElement('form');
  form.id = 'setup-form';

  const topActions = document.createElement('div');
  topActions.className = 'top-actions';
  const themeLabel = document.createElement('label');
  themeLabel.className = 'theme-toggle';
  themeLabel.textContent = 'Theme';
  const themeSelect = document.createElement('select');
  themeSelect.id = 'theme';
  themeSelect.name = 'theme';
  [['light', 'Light'], ['dark', 'Dark']].forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    themeSelect.append(option);
  });
  themeSelect.value = getCurrentTheme();
  themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));
  themeLabel.append(themeSelect);
  topActions.append(themeLabel);

  const controls = document.createElement('div');
  controls.className = 'controls';

  const moduleField = createField('Module', 'module');
  const moduleSelect = moduleField.querySelector('select');
  modules.forEach((module) => {
    const option = document.createElement('option');
    option.value = module.metadata.id;
    option.textContent = module.metadata.title;
    moduleSelect.append(option);
  });

  const levelField = createField('Difficulty', 'level');
  const levelSelect = levelField.querySelector('select');
  [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']].forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    levelSelect.append(option);
  });

  const sizeField = createField('Session size', 'size');
  const sizeSelect = sizeField.querySelector('select');
  [['10', '10'], ['20', '20'], ['50', '50'], ['all', 'All']].forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    sizeSelect.append(option);
  });

  controls.append(moduleField, levelField, sizeField);
  const summary = document.createElement('div');
  summary.id = 'module-summary';
  summary.className = 'module-summary';

  const progress = document.createElement('div');
  progress.id = 'progress-summary';
  progress.className = 'progress-summary';

  const buttonRow = document.createElement('div');
  buttonRow.className = 'button-row';
  buttonRow.append(createButton('Start practice', { type: 'submit' }));
  const reviewButton = createButton('Review mistakes', {
    id: 'review-mistakes',
    className: 'secondary',
    type: 'button',
  });
  const resetButton = createButton('Reset progress', {
    id: 'reset-progress',
    className: 'secondary',
    type: 'button',
  });
  buttonRow.append(reviewButton, resetButton);
  form.append(topActions, controls, summary, progress, buttonRow);
  app.append(form);

  const updateSummary = () => {
    const selectedModule = getModuleById(moduleSelect.value);
    const data = progressStore.getData();
    const totalMistakes = Object.keys(data.mistakes).length;
    summary.replaceChildren();
    progress.replaceChildren();
    appendTextElement(summary, 'h2', selectedModule.metadata.title);
    appendTextElement(summary, 'p', selectedModule.metadata.description);
    const topicSummary = selectedModule.topics.map((topic) => topic.title).join(', ');
    appendTextElement(summary, 'p', `Topics: ${topicSummary}`, 'muted');
    const best = data.bestResults[selectedModule.metadata.id]?.[levelSelect.value];
    appendTextElement(progress, 'h3', 'Progress');
    const bestSummary = best
      ? `Best ${formatLevel(levelSelect.value)}: ${best.correct}/${best.total} (${best.percentage}%)`
      : `Best ${formatLevel(levelSelect.value)}: not yet recorded`;
    appendTextElement(progress, 'p', bestSummary, 'muted');
    appendTextElement(progress, 'p', `Total mistakes: ${totalMistakes}`, 'muted');

    const mistakeList = document.createElement('dl');
    mistakeList.className = 'mistake-breakdown muted';

    modules.forEach((module) => {
      const count = Object.values(data.mistakes).filter(
        (mistake) => mistake.moduleId === module.metadata.id,
      ).length;

      const term = document.createElement('dt');
      term.textContent = module.metadata.title;

      const description = document.createElement('dd');
      description.textContent = String(count);

      mistakeList.append(term, description);
    });

    progress.append(mistakeList);

    if (data.lastPracticed[selectedModule.metadata.id]) {
      appendTextElement(
        progress,
        'p',
        `Last practiced: ${data.lastPracticed[selectedModule.metadata.id]}`,
        'muted',
      );
    }
  };
  moduleSelect.addEventListener('change', updateSummary);
  levelSelect.addEventListener('change', updateSummary);
  updateSummary();

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const selectedModule = getModuleById(formData.get('module'));
    const questions = selectedModule.questions.map((question) => ({
      ...question,
      moduleId: selectedModule.metadata.id,
    }));
    const session = createSession(questions, {
      level: formData.get('level'),
      size: formData.get('size'),
    });

    startSession(
      session,
      'practice',
      selectedModule.metadata.id,
      formData.get('level'),
    );
  });
  reviewButton.addEventListener('click', () => {
    const formData = new FormData(form);
    const reviewSize = formData.get('size') === 'all'
      ? undefined
      : Number(formData.get('size'));
    const mistakes = shuffleArray(getMistakeQuestions())
      .slice(0, reviewSize)
      .map((question) => prepareQuestion(question));
    startSession(mistakes, 'review', null, null);
  });
  resetButton.addEventListener('click', () => {
    const confirmed = globalThis.confirm(
      'Reset all scores, mistakes, and practice dates? Your theme will be kept.',
    );

    if (confirmed) {
      progressStore.resetProgressKeepTheme();
      updateSummary();
    }
  });
}

function startSession(session, mode, moduleId, level) {
  Object.assign(state, {
    session,
    currentIndex: 0,
    results: [],
    answered: false,
    lastResult: null,
    reviewOutcome: null,
    showExample: false,
    mode,
    moduleId,
    level,
  });
  renderQuestion();
}

function createField(labelText, selectId) {
  const field = document.createElement('div');
  field.className = 'field';

  const label = document.createElement('label');
  label.htmlFor = selectId;
  label.textContent = labelText;

  const select = document.createElement('select');
  select.id = selectId;
  select.name = selectId;

  field.append(label, select);
  return field;
}

function renderQuestion() {
  clearApp();

  if (state.session.length === 0) {
    const result = document.createElement('div');
    result.className = 'result';

    appendTextElement(
      result,
      'h2',
      state.mode === 'review' ? 'No mistakes to review' : 'No questions found',
    );
    appendTextElement(
      result,
      'p',
      state.mode === 'review'
        ? 'Great work — your Mistakes Review list is empty.'
        : 'Try another difficulty or module.',
      'muted',
    );

    const backButton = createButton('Return to module selection', { id: 'back' });
    backButton.addEventListener('click', renderSelection);
    result.append(backButton);
    app.append(result);
    return;
  }

  const question = state.session[state.currentIndex];
  const modePrefix = state.mode === 'review' ? 'Mistakes Review · ' : '';
  appendTextElement(
    app,
    'div',
    `${modePrefix}Question ${state.currentIndex + 1} of ${state.session.length} · ${formatLevel(question.level)}`,
    'progress',
  );
  appendTextElement(app, 'span', question.topic.replaceAll('-', ' '), 'badge');
  appendTextElement(app, 'div', question.prompt, 'prompt');

  const options = document.createElement('div');
  options.className = 'options';

  question.options.forEach((option, index) => {
    const classes = ['option'];

    if (state.answered && option === question.answer) {
      classes.push('correct');
    }

    const isIncorrectSelection = state.answered
      && option === state.lastResult?.selectedAnswer
      && !state.lastResult.isCorrect;

    if (isIncorrectSelection) {
      classes.push('incorrect');
    }

    const button = createButton(option, {
      className: classes.join(' '),
      disabled: state.answered,
    });
    button.addEventListener('click', () => answerQuestion(question.options[index]));
    options.append(button);
  });
  app.append(options);

  const buttonRow = document.createElement('div');
  buttonRow.className = 'button-row';

  const dontKnowButton = createButton("I don't know", {
    id: 'dont-know',
    className: 'secondary',
    disabled: state.answered,
  });
  dontKnowButton.addEventListener('click', () => answerQuestion(null));
  buttonRow.append(dontKnowButton);
  app.append(buttonRow);

  const feedbackSlot = document.createElement('div');
  feedbackSlot.id = 'feedback-slot';

  if (state.answered) {
    feedbackSlot.append(createFeedback(question));
  }

  app.append(feedbackSlot);
}

function getReviewFeedbackMessage() {
  if (state.reviewOutcome === 'incremented') {
    return '1 of 2 correct reviews completed.';
  }

  if (state.reviewOutcome === 'removed') {
    return 'Mastered — removed from Mistakes Review.';
  }

  if (state.reviewOutcome === 'reset') {
    return 'Review progress reset to 0 of 2.';
  }

  return null;
}

function createFeedback(question) {
  const result = state.lastResult;
  const feedback = document.createElement('section');
  feedback.className = `feedback ${result.isCorrect ? 'correct' : 'incorrect'}`;

  appendTextElement(feedback, 'h2', result.isCorrect ? 'Correct' : 'Incorrect');

  const answer = document.createElement('p');
  const answerLabel = document.createElement('strong');
  answerLabel.textContent = 'Correct answer:';
  answer.append(answerLabel, ` ${result.correctAnswer}`);
  feedback.append(answer);

  appendTextElement(feedback, 'p', question.explanation);

  if (question.translation) {
    const translation = document.createElement('p');
    const translationLabel = document.createElement('strong');
    translationLabel.textContent = 'Translation:';
    translation.append(translationLabel, ` ${question.translation}`);
    feedback.append(translation);
  }

  if (state.mode === 'review') {
    const reviewMessage = getReviewFeedbackMessage();

    if (reviewMessage) {
      appendTextElement(feedback, 'p', reviewMessage, 'muted');
    }
  }

  if (state.showExample) {
    const example = document.createElement('p');
    const exampleLabel = document.createElement('strong');
    exampleLabel.textContent = 'Example:';
    example.append(exampleLabel, ` ${question.example}`);
    feedback.append(example);
  } else {
    const showExampleButton = createButton('Show example', {
      id: 'show-example',
      className: 'secondary',
    });
    showExampleButton.addEventListener('click', () => {
      state.showExample = true;
      renderQuestion();
    });
    feedback.append(showExampleButton);
  }

  const buttonRow = document.createElement('div');
  buttonRow.className = 'button-row';

  const nextButton = createButton(state.currentIndex === state.session.length - 1 ? 'Finish' : 'Next', {
    id: 'next',
  });
  nextButton.addEventListener('click', nextQuestion);
  buttonRow.append(nextButton);
  feedback.append(buttonRow);

  return feedback;
}

function answerQuestion(selectedAnswer) {
  if (state.answered) {
    return;
  }

  const question = state.session[state.currentIndex];
  state.lastResult = checkAnswer(question, selectedAnswer);
  state.results.push(state.lastResult);
  state.reviewOutcome = null;

  if (state.mode === 'practice' && !state.lastResult.isCorrect) {
    progressStore.addMistake(question);
  }

  if (state.mode === 'review') {
    state.reviewOutcome = progressStore.recordMistakeReview(
      question.id,
      state.lastResult.isCorrect,
    );
  }

  state.answered = true;
  state.showExample = false;
  renderQuestion();
}

function nextQuestion() {
  if (state.currentIndex === state.session.length - 1) {
    renderResult();
    return;
  }

  state.currentIndex += 1;
  state.answered = false;
  state.lastResult = null;
  state.reviewOutcome = null;
  state.showExample = false;
  renderQuestion();
}

function renderResult() {
  clearApp();
  const score = calculateScore(state.results);

  if (state.mode === 'practice') {
    progressStore.recordBestResult(state.moduleId, state.level, score);
    progressStore.setLastPracticed(state.moduleId);
  }

  const result = document.createElement('div');
  result.className = 'result';

  appendTextElement(
    result,
    'h2',
    state.mode === 'review' ? 'Mistakes Review complete' : 'Session complete',
  );
  appendTextElement(result, 'p', `${score.correct}/${score.total}`, 'score');
  appendTextElement(result, 'p', `${score.percentage}% correct`);

  const backButton = createButton('Return to module selection', { id: 'back' });
  backButton.addEventListener('click', renderSelection);
  result.append(backButton);
  app.append(result);
}

applyTheme(getCurrentTheme());
renderSelection();
