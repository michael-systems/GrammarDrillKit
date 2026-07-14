import { phrasalVerbsModule } from './modules/phrasal-verbs.js';
import { articlesModule } from './modules/articles.js';
import { tensesModule } from './modules/tenses.js';
import { prepositionsModule } from './modules/prepositions.js';
import { gerundsInfinitivesModule } from './modules/gerunds-infinitives.js';
import { relativeClausesModule } from './modules/relative-clauses.js';
import { passiveVoiceModule } from './modules/passive-voice.js';
import { reportedSpeechModule } from './modules/reported-speech.js';
import { modalsModule } from './modules/modals.js';
import { conditionalsModule } from './modules/conditionals.js';

export const modules = [phrasalVerbsModule, articlesModule, tensesModule, prepositionsModule, gerundsInfinitivesModule, relativeClausesModule, passiveVoiceModule, reportedSpeechModule, modalsModule, conditionalsModule];

export function getModuleById(moduleId) {
  return modules.find((module) => module.metadata.id === moduleId);
}
