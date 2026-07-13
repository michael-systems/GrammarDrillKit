import { modules, getModuleById } from './module-registry.js';
import { calculateScore, checkAnswer, createSession } from './quiz-engine.js';
import { formatLevel } from './utilities.js';

const app = document.querySelector('#app');
const state = { session: [], currentIndex: 0, results: [], answered: false, lastResult: null, showExample: false };

function appendTextElement(parent, tagName, text, className) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

function createButton(text, { id, className, disabled = false, type } = {}) {
  const button = document.createElement('button');
  button.textContent = text;
  if (id) button.id = id;
  if (className) button.className = className;
  if (disabled) button.disabled = true;
  if (type) button.type = type;
  return button;
}

function clearApp() {
  app.replaceChildren();
}

function renderSelection() {
  clearApp();

  const form = document.createElement('form');
  form.id = 'setup-form';

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
  [
    ['easy', 'Easy'],
    ['medium', 'Medium'],
    ['hard', 'Hard'],
  ].forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    levelSelect.append(option);
  });

  const sizeField = createField('Session size', 'size');
  const sizeSelect = sizeField.querySelector('select');
  [
    ['10', '10'],
    ['all', 'All'],
  ].forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    sizeSelect.append(option);
  });

  controls.append(moduleField, levelField, sizeField);
  const summary = document.createElement('div');
  summary.id = 'module-summary';
  summary.className = 'module-summary';
  form.append(controls, summary, createButton('Start', { type: 'submit' }));
  app.append(form);

  const updateSummary = () => {
    const selectedModule = getModuleById(moduleSelect.value);
    summary.replaceChildren();
    appendTextElement(summary, 'h2', selectedModule.metadata.title);
    appendTextElement(summary, 'p', selectedModule.metadata.description);
    appendTextElement(summary, 'p', `Topics: ${selectedModule.topics.map((topic) => topic.title).join(', ')}`, 'muted');
  };
  moduleSelect.addEventListener('change', updateSummary);
  updateSummary();

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const selectedModule = getModuleById(formData.get('module'));
    state.session = createSession(selectedModule.questions, { level: formData.get('level'), size: formData.get('size') });
    state.currentIndex = 0;
    state.results = [];
    state.answered = false;
    state.lastResult = null;
    state.showExample = false;
    renderQuestion();
  });
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
    appendTextElement(result, 'h2', 'No questions found');
    appendTextElement(result, 'p', 'Try another difficulty or module.', 'muted');
    const backButton = createButton('Return to module selection', { id: 'back' });
    backButton.addEventListener('click', renderSelection);
    result.append(backButton);
    app.append(result);
    return;
  }

  const question = state.session[state.currentIndex];
  appendTextElement(app, 'div', `Question ${state.currentIndex + 1} of ${state.session.length} · ${formatLevel(question.level)}`, 'progress');
  appendTextElement(app, 'span', question.topic.replaceAll('-', ' '), 'badge');
  appendTextElement(app, 'div', question.prompt, 'prompt');

  const options = document.createElement('div');
  options.className = 'options';
  question.options.forEach((option, index) => {
    const classes = ['option'];
    if (state.answered && option === question.answer) classes.push('correct');
    if (state.answered && option === state.lastResult?.selectedAnswer && !state.lastResult.isCorrect) classes.push('incorrect');
    const button = createButton(option, { className: classes.join(' '), disabled: state.answered });
    button.dataset.optionIndex = String(index);
    button.addEventListener('click', () => answerQuestion(question.options[index]));
    options.append(button);
  });
  app.append(options);

  const buttonRow = document.createElement('div');
  buttonRow.className = 'button-row';
  const dontKnowButton = createButton("I don't know", { id: 'dont-know', className: 'secondary', disabled: state.answered });
  dontKnowButton.addEventListener('click', () => answerQuestion(null));
  buttonRow.append(dontKnowButton);
  app.append(buttonRow);

  const feedbackSlot = document.createElement('div');
  feedbackSlot.id = 'feedback-slot';
  if (state.answered) feedbackSlot.append(createFeedback(question));
  app.append(feedbackSlot);
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

  if (state.showExample) {
    const example = document.createElement('p');
    const exampleLabel = document.createElement('strong');
    exampleLabel.textContent = 'Example:';
    example.append(exampleLabel, ` ${question.example}`);
    feedback.append(example);
  } else {
    const showExampleButton = createButton('Show example', { id: 'show-example', className: 'secondary' });
    showExampleButton.addEventListener('click', () => { state.showExample = true; renderQuestion(); });
    feedback.append(showExampleButton);
  }

  const buttonRow = document.createElement('div');
  buttonRow.className = 'button-row';
  const nextButton = createButton(state.currentIndex === state.session.length - 1 ? 'Finish' : 'Next', { id: 'next' });
  nextButton.addEventListener('click', nextQuestion);
  buttonRow.append(nextButton);
  feedback.append(buttonRow);
  return feedback;
}

function answerQuestion(selectedAnswer) {
  if (state.answered) return;
  state.lastResult = checkAnswer(state.session[state.currentIndex], selectedAnswer);
  state.results.push(state.lastResult);
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
  state.showExample = false;
  renderQuestion();
}

function renderResult() {
  clearApp();
  const score = calculateScore(state.results);
  const result = document.createElement('div');
  result.className = 'result';
  appendTextElement(result, 'h2', 'Session complete');
  appendTextElement(result, 'p', `${score.correct}/${score.total}`, 'score');
  appendTextElement(result, 'p', `${score.percentage}% correct`);
  const backButton = createButton('Return to module selection', { id: 'back' });
  backButton.addEventListener('click', renderSelection);
  result.append(backButton);
  app.append(result);
}

renderSelection();
