# Grammar Drill Kit

Grammar Drill Kit is a lightweight static English grammar practice app for Russian-speaking learners who want to maintain and improve English from approximately A2 to C1. Iteration 2 builds on the first release and proves that one reusable quiz engine can power different learning modules without duplicating quiz logic.

## Iteration 2 scope

Implemented now:

- Vanilla HTML, CSS, and JavaScript only.
- Native ES modules that work on GitHub Pages.
- Three demo modules: Phrasal Verbs, Conditionals, and Modal Verbs.
- Multiple-choice sessions with module, difficulty, and 10 / 20 / 50 / All session-size selection.
- Persistent browser-only progress using `localStorage`: best results by module and level, last practiced dates, saved mistakes, and selected theme.
- Mistakes Review across all modules, using stored question IDs and cleaning up stale IDs when module content changes.
- Mistake mastery rule: the same mistake must be answered correctly twice consecutively in Mistakes Review before it is removed; a wrong answer or “I don’t know” resets that review counter.
- Compact progress summary and a reset-progress action that keeps the selected theme.
- Light/dark theme switching, saved only in the current browser.
- One question at a time with immediate feedback, correct answer, explanation, optional Russian translation, separate example reveal, next navigation, and final score.
- Dependency-free tests for quiz-engine and storage logic using Node's built-in test runner.

Intentionally deferred:

- Full question database.
- Text-input questions, although the engine reserves a `text_input` type constant for future use.
- Mixed, Exam, and Focused Practice modes.
- Backend, authentication, database, external APIs, packages, bundlers, and frameworks.

## Architecture

The app separates data, reusable quiz logic, and browser UI:

- `src/modules/*.js` contains module metadata, topics, and question data only.
- `src/module-registry.js` registers modules and exposes lookup helpers.
- `src/quiz-engine.js` contains grammar-agnostic pure functions for filtering, session creation, answer checking, scoring, and non-mutating option preparation.
- `src/app.js` owns DOM rendering and user interaction.
- `src/utilities.js` contains small shared helpers.

Adding a new module should require creating a new module file and importing it in `src/module-registry.js`; the quiz engine does not need grammar-specific changes.

## File structure

```text
index.html
styles.css
src/
  app.js
  quiz-engine.js
  storage.js
  module-registry.js
  utilities.js
  modules/
    phrasal-verbs.js
    conditionals.js
    modal-verbs.js
tests/
  quiz-engine.test.mjs
  storage.test.mjs
```

## Module schema

Each module exports an object with structured metadata, available topics, and questions:

```js
export const exampleModule = {
  metadata: {
    id: 'example-module',
    title: 'Example Module',
    description: 'Short learner-facing description.',
    levelRange: 'A2-C1',
  },
  topics: [
    { id: 'example-topic', title: 'Example Topic' },
  ],
  questions: [],
};
```

## Question schema

The current app implements only multiple-choice questions:

```js
{
  id: 'conditionals-001',
  type: 'multiple_choice',
  level: 'medium',
  topic: 'second-conditional',
  prompt: 'If I had more time, I ___ more books.',
  options: ['read', 'will read', 'would read', 'had read'],
  answer: 'would read',
  explanation: 'This is the Second Conditional: if + Past Simple, would + base verb.',
  translation: 'Если бы у меня было больше времени, я бы читал больше книг.',
  example: 'If I had more money, I would travel more.',
  shuffleOptions: true,
}
```

Question IDs should be stable and unique within the full app, for example `modal-verbs-006`.

## Run locally

Because the app uses native ES modules, open it through a static server rather than directly from the filesystem. From the repository root, run one of these commands:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in a browser.

If Python is unavailable, any simple static server is fine as long as it serves the repository root without bundling or rewriting modules.

## Run tests

```bash
node --test
```

The tests use Node's built-in test runner and require no npm install step. Progress data remains only in the current browser through `localStorage` under the `grammar-drill-kit-progress` key; there is no account, cloud sync, analytics, import/export, or backend.

## GitHub Pages compatibility

The project is fully static. It uses relative paths, native ES modules, and no build step, so the repository root can be served directly by GitHub Pages.
