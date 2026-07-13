# Grammar Drill Kit

Grammar Drill Kit is a lightweight static English grammar practice app for Russian-speaking learners who want to maintain and improve English from approximately A2 to C1. Iteration 4 finishes the static product shell with Practice, Mixed Practice, Exam, Focused Practice, Mistakes Review, persistent interface-size presets, and responsive polish while keeping the app dependency-free and GitHub Pages-compatible.

## Use the app

Open the public GitHub Pages app in any modern browser:

https://michael-systems.github.io/GrammarDrillKit/

Normal learner usage requires no server, installation, terminal commands, download, account, or setup. Friends and learners can simply open the link and practice in the browser.

## Current scope

Implemented now:

- Vanilla HTML, CSS, and JavaScript only.
- Native ES modules that work on GitHub Pages.
- Three demo modules: Phrasal Verbs, Conditionals, and Modal Verbs.
- Multiple-choice Practice sessions with module, difficulty, and 10 / 20 / 50 / All session-size selection.
- Mixed Practice draws from all registered modules at the selected difficulty and size.
- Exam mode records answers without immediate feedback and saves mistakes only when the exam is completed.
- Focused Practice filters by module topic, difficulty, and size using topic IDs from the selected module.
- Mistakes Review remains a separate action across all modules.
- End session is available exactly once in the active-session toolbar; unfinished sessions do not save final results or last-practiced dates, while already-saved non-Exam mistake updates remain.
- Persistent browser-only progress using `localStorage`: regular Practice best results by module and level, last practiced dates, saved mistakes, selected theme, and selected interface size.
- Mistakes Review across all modules, using stored question IDs and cleaning up stale IDs when module content changes.
- Mistake mastery rule: the same mistake must be answered correctly twice consecutively in Mistakes Review before it is removed; a wrong answer or “I don’t know” resets that review counter.
- Compact progress summary and a reset-progress action that keeps the selected theme and interface size.
- Light/dark theme switching and four saved interface-size presets: Compact, Small, Medium, and Large. Medium is the default when no saved size exists.
- Compact active-session layout with a shorter product header and a two-pane question/feedback workspace for Compact and Small desktop views.
- Compact is designed to fit answered sessions at 1280 × 720 and 1366 × 768 desktop viewports; Small is designed to fit answered sessions at 1366 × 768. Expanded examples or future longer content may naturally require scrolling.
- Responsive phone-width layout stacks controls and session panes into one column without fixed overlays or horizontal scrolling.
- Subtle creator footer link: [Made by M](https://t.me/lifeforevery).
- Practice, Mixed Practice, Focused Practice, and Mistakes Review show one question at a time with immediate feedback, correct answer, explanation, optional Russian translation, separate example reveal, next navigation, and final score.
- Exam shows no per-question correctness, correct answer, explanation, translation, or example until the final score.
- Dependency-free tests for quiz-engine, session-planner, and storage logic using Node's built-in test runner.

Intentionally deferred:

- Full question database.
- Text-input questions, although the engine reserves a `text_input` type constant for future use.
- Backend, authentication, database, external APIs, packages, bundlers, and frameworks.

## Architecture

The app separates data, reusable quiz logic, and browser UI:

- `src/modules/*.js` contains module metadata, topics, and question data only.
- `src/module-registry.js` registers modules and exposes lookup helpers.
- `src/quiz-engine.js` contains grammar-agnostic pure functions for filtering, session creation, answer checking, scoring, and non-mutating option preparation.
- `src/session-planner.js` contains grammar-neutral mode constants and pure session planning for Practice, Mixed Practice, Exam, and Focused Practice.
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
  session-planner.js
  storage.js
  module-registry.js
  utilities.js
  modules/
    phrasal-verbs.js
    conditionals.js
    modal-verbs.js
tests/
  quiz-engine.test.mjs
  session-planner.test.mjs
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

## Developer local testing

Normal users only need the GitHub Pages link above; no local server or installation is required for normal use. Developers testing a cloned repository locally should use a simple static server because the app uses native ES modules. From the repository root, run one of these commands:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in a browser.

If Python is unavailable, any simple static server is fine as long as it serves the repository root without bundling or rewriting modules.

## Run tests

```bash
node --test
```

The tests use Node's built-in test runner and require no npm install step. Progress data remains only in the current browser through `localStorage` under the `grammar-drill-kit-progress` key. Only regular Practice persists best scores. Mixed Practice, Exam, Focused Practice, and Mistakes Review can update mistakes and last-practiced dates when completed as designed, but they do not create separate score histories. There is no account, cloud sync, analytics, import/export, or backend.

## GitHub Pages compatibility

The project is fully static. It uses relative paths, native ES modules, and no build step, so the repository root can be served directly by GitHub Pages.
