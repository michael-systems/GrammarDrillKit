import { modules, getModuleById } from './module-registry.js?v=20260719-session-size';
import { calculateScore, checkAnswer } from './quiz-engine.js?v=20260719-session-size';
import {
  createMistakesReviewSession,
  MODE_LABELS,
  SESSION_MODES,
  planSession,
} from './session-planner.js?v=20260719-session-size';
import { formatLevel } from './utilities.js?v=20260719-session-size';
import {
  createBrowserProgressStore,
  THEMES,
  INTERFACE_SIZES,
  DEFAULT_INTERFACE_SIZE,
} from './storage.js?v=20260719-session-size';

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
  moduleIds: [],
  level: null,
  topic: null,
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

function setView(view) {
  document.body.dataset.view = view;
}

function clearApp() {
  app.replaceChildren();
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  progressStore.setTheme(theme);
}

function applyInterfaceSize(interfaceSize) {
  const safeSize = INTERFACE_SIZES.includes(interfaceSize) ? interfaceSize : DEFAULT_INTERFACE_SIZE;
  document.documentElement.dataset.size = safeSize;
  progressStore.setInterfaceSize(safeSize);
}

function getCurrentInterfaceSize() {
  const saved = progressStore.getData().interfaceSize;
  return INTERFACE_SIZES.includes(saved) ? saved : DEFAULT_INTERFACE_SIZE;
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
  setView('selection');
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

  const sizeLabel = document.createElement('label');
  sizeLabel.className = 'theme-toggle';
  sizeLabel.textContent = 'Interface size';
  const interfaceSizeSelect = document.createElement('select');
  interfaceSizeSelect.id = 'interface-size';
  interfaceSizeSelect.name = 'interfaceSize';
  [
    ['compact', 'Compact'],
    ['small', 'Small'],
    ['medium', 'Medium'],
    ['large', 'Large'],
  ].forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    interfaceSizeSelect.append(option);
  });
  interfaceSizeSelect.value = getCurrentInterfaceSize();
  interfaceSizeSelect.addEventListener('change', () => applyInterfaceSize(interfaceSizeSelect.value));
  sizeLabel.append(interfaceSizeSelect);
  topActions.append(sizeLabel);

  const controls = document.createElement('div');
  controls.className = 'controls';

  const modeField = createField('Mode', 'mode');
  const modeSelect = modeField.querySelector('select');
  [
    [SESSION_MODES.practice, 'Practice'],
    [SESSION_MODES.mixed, 'Mixed'],
    [SESSION_MODES.exam, 'Exam'],
    [SESSION_MODES.focused, 'Focused Practice'],
  ].forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    modeSelect.append(option);
  });

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
  [['all', 'All levels'], ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']].forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    levelSelect.append(option);
  });

  const topicField = createField('Topic', 'topic');
  const topicSelect = topicField.querySelector('select');

  const sizeField = createField('Session size', 'size');
  const sizeSelect = sizeField.querySelector('select');
  [['10', '10'], ['20', '20'], ['50', '50'], ['all', 'All']].forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    sizeSelect.append(option);
  });

  controls.append(modeField, moduleField, topicField, levelField, sizeField);
  const summary = document.createElement('div');
  summary.id = 'module-summary';
  summary.className = 'module-summary';

  const progress = document.createElement('div');
  progress.id = 'progress-summary';
  progress.className = 'progress-summary';

  const buttonRow = document.createElement('div');
  buttonRow.className = 'button-row';
  const startButton = createButton('Start practice', { type: 'submit' });
  buttonRow.append(startButton);
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

  const rebuildTopicOptions = () => {
    const selectedModule = getModuleById(moduleSelect.value);
    const previousTopic = topicSelect.value;
    topicSelect.replaceChildren();
    selectedModule.topics.forEach((topic) => {
      const option = document.createElement('option');
      option.value = topic.id;
      option.textContent = topic.title;
      topicSelect.append(option);
    });
    if (selectedModule.topics.some((topic) => topic.id === previousTopic)) {
      topicSelect.value = previousTopic;
    }
  };

  const updateModeControls = () => {
    const isMixed = modeSelect.value === SESSION_MODES.mixed;
    const isFocused = modeSelect.value === SESSION_MODES.focused;
    moduleField.hidden = isMixed;
    moduleSelect.disabled = isMixed;
    topicField.hidden = !isFocused;
    topicSelect.disabled = !isFocused;
    rebuildTopicOptions();
    startButton.textContent = modeSelect.value === SESSION_MODES.exam ? 'Start exam' : 'Start practice';
  };

  const updateSummary = () => {
    updateModeControls();
    const selectedModule = getModuleById(moduleSelect.value);
    const data = progressStore.getData();
    const totalMistakes = Object.keys(data.mistakes).length;
    summary.replaceChildren();
    progress.replaceChildren();
    if (modeSelect.value === SESSION_MODES.mixed) {
      appendTextElement(summary, 'h2', 'Mixed Practice');
      appendTextElement(summary, 'p', 'Questions are drawn from all registered modules.');
    } else {
      appendTextElement(summary, 'h2', selectedModule.metadata.title);
      appendTextElement(summary, 'p', selectedModule.metadata.description);
    }
    const topicSummary = selectedModule.topics.map((topic) => topic.title).join(', ');
    if (modeSelect.value !== SESSION_MODES.mixed) {
      appendTextElement(summary, 'p', `Topics: ${topicSummary}`, 'muted');
      if (modeSelect.value === SESSION_MODES.focused) {
        const currentTopic = selectedModule.topics.find((topic) => topic.id === topicSelect.value);
        appendTextElement(summary, 'p', `Focused topic: ${currentTopic?.title ?? 'Select a topic'}`, 'muted');
      }
    }
    appendTextElement(progress, 'h3', 'Progress');
    if (modeSelect.value === SESSION_MODES.mixed) {
      appendTextElement(progress, 'p', 'Mixed Practice uses all registered modules at the selected difficulty.', 'muted');
    } else {
      const best = data.bestResults[selectedModule.metadata.id]?.[levelSelect.value];
      const bestSummary = best
        ? `Best ${formatLevel(levelSelect.value)}: ${best.correct}/${best.total} (${best.percentage}%)`
        : `Best ${formatLevel(levelSelect.value)}: not yet recorded`;
      appendTextElement(progress, 'p', bestSummary, 'muted');
    }
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

    if (modeSelect.value !== SESSION_MODES.mixed && data.lastPracticed[selectedModule.metadata.id]) {
      appendTextElement(
        progress,
        'p',
        `Last practiced: ${data.lastPracticed[selectedModule.metadata.id]}`,
        'muted',
      );
    }
  };
  modeSelect.addEventListener('change', updateSummary);
  moduleSelect.addEventListener('change', updateSummary);
  topicSelect.addEventListener('change', updateSummary);
  levelSelect.addEventListener('change', updateSummary);
  updateSummary();

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const mode = formData.get('mode');
    const selectedModule = mode === SESSION_MODES.mixed ? null : getModuleById(formData.get('module'));
    const plan = planSession(modules, {
      mode,
      moduleId: formData.get('module'),
      topicId: formData.get('topic'),
      level: formData.get('level'),
      size: formData.get('size'),
    });

    startSession(plan.session, {
      mode,
      moduleId: selectedModule?.metadata.id ?? null,
      moduleIds: plan.moduleIds,
      level: formData.get('level'),
      topic: plan.topic,
    });
  });
  reviewButton.addEventListener('click', () => {
    const formData = new FormData(form);
    const mistakes = createMistakesReviewSession(getMistakeQuestions(), {
      size: formData.get('size'),
    });
    startSession(mistakes, { mode: 'review', moduleId: null, moduleIds: [] });
  });
  resetButton.addEventListener('click', () => {
    const confirmed = globalThis.confirm(
      'Reset all scores, mistakes, and practice dates? Your theme and interface size will be kept.',
    );

    if (confirmed) {
      progressStore.resetProgressKeepTheme();
      updateSummary();
    }
  });
}

function startSession(session, { mode, moduleId = null, moduleIds = [], level = null, topic = null }) {
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
    moduleIds,
    level,
    topic,
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
  setView('session');
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
        : 'Try another difficulty, module, or topic.',
      'muted',
    );

    const backButton = createButton('Return to module selection', { id: 'back' });
    backButton.addEventListener('click', renderSelection);
    result.append(backButton);
    app.append(result);
    return;
  }

  const question = state.session[state.currentIndex];
  const modeLabel = state.mode === 'review' ? 'Mistakes Review' : MODE_LABELS[state.mode];
  const progressText = `${modeLabel} · Question ${state.currentIndex + 1} of ${state.session.length} · ${formatLevel(question.level)}`;
  const toolbar = document.createElement('div');
  toolbar.className = 'session-toolbar';
  appendTextElement(toolbar, 'div', progressText, 'progress');
  toolbar.append(createEndSessionButton());
  app.append(toolbar);

  const workspace = document.createElement('div');
  workspace.className = `session-workspace${state.answered ? ' answered' : ''}`;
  const questionPane = document.createElement('section');
  questionPane.className = 'question-pane';
  questionPane.setAttribute('aria-label', 'Question');
  if (state.topic) {
    appendTextElement(questionPane, 'p', `Topic: ${state.topic.title}`, 'muted compact-topic');
  }
  appendTextElement(questionPane, 'span', state.topic?.title ?? question.topic.replaceAll('-', ' '), 'badge');
  appendTextElement(questionPane, 'div', question.prompt, 'prompt');

  const options = document.createElement('div');
  options.className = 'options';

  question.options.forEach((option, index) => {
    const classes = ['option'];

    if (state.answered && state.mode !== SESSION_MODES.exam && option === question.answer) {
      classes.push('correct');
    }

    const isIncorrectSelection = state.answered
      && state.mode !== SESSION_MODES.exam
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
  questionPane.append(options);

  const buttonRow = document.createElement('div');
  buttonRow.className = 'button-row';

  const dontKnowButton = createButton("I don't know", {
    id: 'dont-know',
    className: 'secondary',
    disabled: state.answered,
  });
  dontKnowButton.addEventListener('click', () => answerQuestion(null));
  buttonRow.append(dontKnowButton);
  questionPane.append(buttonRow);
  workspace.append(questionPane);

  if (state.answered) {
    const feedbackSlot = document.createElement('div');
    feedbackSlot.id = 'feedback-slot';
    feedbackSlot.className = 'feedback-pane';
    feedbackSlot.append(state.mode === SESSION_MODES.exam ? createExamFeedback() : createFeedback(question));
    workspace.append(feedbackSlot);
  }

  app.append(workspace);
}


function createEndSessionButton() {
  const button = createButton('End session', { className: 'secondary danger-action', type: 'button' });
  button.addEventListener('click', () => {
    const message = state.mode === SESSION_MODES.exam
      ? 'End this Exam? Your unfinished Exam answers and result will be discarded.'
      : 'End this session? Completed answer and mistake updates will remain, but no session result will be saved.';
    if (globalThis.confirm(message)) {
      renderSelection();
    }
  });
  return button;
}

function createExamFeedback() {
  const feedback = document.createElement('section');
  feedback.className = 'feedback neutral';
  appendTextElement(feedback, 'h2', 'Answer recorded');
  appendTextElement(feedback, 'p', 'Continue when you are ready.', 'muted');
  const buttonRow = document.createElement('div');
  buttonRow.className = 'button-row';
  const nextButton = createButton(state.currentIndex === state.session.length - 1 ? 'Finish' : 'Next', { id: 'next' });
  nextButton.addEventListener('click', nextQuestion);
  buttonRow.append(nextButton);
  feedback.append(buttonRow);
  return feedback;
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

  if ([SESSION_MODES.practice, SESSION_MODES.mixed, SESSION_MODES.focused].includes(state.mode) && !state.lastResult.isCorrect) {
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
  setView('result');
  clearApp();
  const score = calculateScore(state.results);

  if (state.mode === SESSION_MODES.practice) {
    progressStore.recordBestResult(state.moduleId, state.level, score);
    progressStore.setLastPracticed(state.moduleId);
  }

  if ([SESSION_MODES.mixed, SESSION_MODES.focused].includes(state.mode)) {
    state.moduleIds.forEach((moduleId) => progressStore.setLastPracticed(moduleId));
  }

  if (state.mode === SESSION_MODES.exam) {
    state.results.forEach((answerResult, index) => {
      if (!answerResult.isCorrect) {
        progressStore.addMistake(state.session[index]);
      }
    });
    progressStore.setLastPracticed(state.moduleId);
  }

  const result = document.createElement('div');
  result.className = 'result';

  appendTextElement(
    result,
    'h2',
    state.mode === 'review' ? 'Mistakes Review complete' : `${MODE_LABELS[state.mode]} complete`,
  );
  if (state.topic) {
    appendTextElement(result, 'p', `Topic: ${state.topic.title}`, 'muted');
  }
  appendTextElement(result, 'p', `${score.correct}/${score.total}`, 'score');
  appendTextElement(result, 'p', `${score.percentage}% correct`);

  const backButton = createButton('Return to module selection', { id: 'back' });
  backButton.addEventListener('click', renderSelection);
  result.append(backButton);
  app.append(result);
}

applyTheme(getCurrentTheme());
applyInterfaceSize(getCurrentInterfaceSize());
renderSelection();
