import { conditionalsModule } from './modules/conditionals.js';
import { modalVerbsModule } from './modules/modal-verbs.js';
import { phrasalVerbsModule } from './modules/phrasal-verbs.js';

export const modules = [phrasalVerbsModule, conditionalsModule, modalVerbsModule];

export function getModuleById(moduleId) {
  return modules.find((module) => module.metadata.id === moduleId);
}
