import { modules, getModuleById } from './module-registry.js';
import { calculateScore, checkAnswer, createSession } from './quiz-engine.js';
import { formatLevel } from './utilities.js';

const app = document.querySelector('#app');
const state = { session: [], currentIndex: 0, results: [], answered: false, lastResult: null, showExample: false };

function renderSelection() {
  const moduleOptions = modules.map((module) => `<option value="${module.metadata.id}">${module.metadata.title}</option>`).join('');
  app.innerHTML = `
    <form id="setup-form">
      <div class="controls">
        <div class="field"><label for="module">Module</label><select id="module" name="module">${moduleOptions}</select></div>
        <div class="field"><label for="level">Difficulty</label><select id="level" name="level"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div>
        <div class="field"><label for="size">Session size</label><select id="size" name="size"><option value="10">10</option><option value="all">All</option></select></div>
      </div>
      <div id="module-summary" class="module-summary"></div>
      <button type="submit">Start</button>
    </form>`;

  const form = document.querySelector('#setup-form');
  const moduleSelect = document.querySelector('#module');
  const summary = document.querySelector('#module-summary');
  const updateSummary = () => {
    const selectedModule = getModuleById(moduleSelect.value);
    summary.innerHTML = `<h2>${selectedModule.metadata.title}</h2><p>${selectedModule.metadata.description}</p><p class="muted">Topics: ${selectedModule.topics.map((topic) => topic.title).join(', ')}</p>`;
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

function renderQuestion() {
  if (state.session.length === 0) {
    app.innerHTML = `<div class="result"><h2>No questions found</h2><p class="muted">Try another difficulty or module.</p><button id="back">Return to module selection</button></div>`;
    document.querySelector('#back').addEventListener('click', renderSelection);
    return;
  }

  const question = state.session[state.currentIndex];
  const options = question.options.map((option) => {
    const classes = ['option'];
    if (state.answered && option === question.answer) classes.push('correct');
    if (state.answered && option === state.lastResult?.selectedAnswer && !state.lastResult.isCorrect) classes.push('incorrect');
    return `<button class="${classes.join(' ')}" data-answer="${option}" ${state.answered ? 'disabled' : ''}>${option}</button>`;
  }).join('');

  app.innerHTML = `
    <div class="progress">Question ${state.currentIndex + 1} of ${state.session.length} · ${formatLevel(question.level)}</div>
    <span class="badge">${question.topic.replaceAll('-', ' ')}</span>
    <div class="prompt">${question.prompt}</div>
    <div class="options">${options}</div>
    <div class="button-row"><button class="secondary" id="dont-know" ${state.answered ? 'disabled' : ''}>I don't know</button></div>
    <div id="feedback-slot">${state.answered ? feedbackTemplate(question) : ''}</div>`;

  document.querySelectorAll('[data-answer]').forEach((button) => {
    button.addEventListener('click', () => answerQuestion(button.dataset.answer));
  });
  document.querySelector('#dont-know').addEventListener('click', () => answerQuestion(null));
  document.querySelector('#show-example')?.addEventListener('click', () => { state.showExample = true; renderQuestion(); });
  document.querySelector('#next')?.addEventListener('click', nextQuestion);
}

function feedbackTemplate(question) {
  const result = state.lastResult;
  const status = result.isCorrect ? 'Correct' : 'Incorrect';
  const example = state.showExample ? `<p><strong>Example:</strong> ${question.example}</p>` : '<button class="secondary" id="show-example">Show example</button>';
  return `<section class="feedback ${result.isCorrect ? 'correct' : 'incorrect'}"><h2>${status}</h2><p><strong>Correct answer:</strong> ${result.correctAnswer}</p><p>${question.explanation}</p>${question.translation ? `<p><strong>Translation:</strong> ${question.translation}</p>` : ''}${example}<div class="button-row"><button id="next">${state.currentIndex === state.session.length - 1 ? 'Finish' : 'Next'}</button></div></section>`;
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
  const score = calculateScore(state.results);
  app.innerHTML = `<div class="result"><h2>Session complete</h2><p class="score">${score.correct}/${score.total}</p><p>${score.percentage}% correct</p><button id="back">Return to module selection</button></div>`;
  document.querySelector('#back').addEventListener('click', renderSelection);
}

renderSelection();
