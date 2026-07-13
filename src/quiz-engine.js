import { shuffleArray } from './utilities.js';

export const QUESTION_TYPES = Object.freeze({
  multipleChoice: 'multiple_choice',
  textInput: 'text_input',
});

export function filterQuestions(questions, { level = 'all', topic = 'all', type = QUESTION_TYPES.multipleChoice } = {}) {
  return questions.filter((question) => {
    const matchesType = !type || question.type === type;
    const matchesLevel = level === 'all' || question.level === level;
    const matchesTopic = topic === 'all' || question.topic === topic;
    return matchesType && matchesLevel && matchesTopic;
  });
}

export function prepareQuestion(question, random = Math.random) {
  const prepared = { ...question };
  if (question.type === QUESTION_TYPES.multipleChoice) {
    prepared.options = question.shuffleOptions === false ? [...question.options] : shuffleArray(question.options, random);
  }
  return prepared;
}

export function createSession(questions, { level = 'all', topic = 'all', size = 'all', random = Math.random } = {}) {
  const filtered = filterQuestions(questions, { level, topic });
  const shuffled = shuffleArray(filtered, random);
  const limit = size === 'all' ? shuffled.length : Math.min(Number(size), shuffled.length);
  return shuffled.slice(0, limit).map((question) => prepareQuestion(question, random));
}

export function checkAnswer(question, selectedAnswer) {
  const isKnown = selectedAnswer !== null && selectedAnswer !== undefined;
  return {
    isCorrect: isKnown && selectedAnswer === question.answer,
    selectedAnswer: isKnown ? selectedAnswer : null,
    correctAnswer: question.answer,
  };
}

export function calculateScore(results) {
  const total = results.length;
  const correct = results.filter((result) => result.isCorrect).length;
  const percentage = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { correct, total, percentage };
}
