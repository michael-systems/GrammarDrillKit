// Keep this query token aligned with index.html and app.js whenever deployed
// session code or module content changes, so browsers cannot reuse demo data.
import { conditionalsModule } from './modules/conditionals.js?v=20260719-session-size';
import { modalVerbsModule } from './modules/modal-verbs.js?v=20260719-session-size';
import { phrasalVerbsModule } from './modules/phrasal-verbs.js?v=20260719-session-size';

export const modules = [phrasalVerbsModule, conditionalsModule, modalVerbsModule];

export function getModuleById(moduleId) {
  return modules.find((module) => module.metadata.id === moduleId);
}
