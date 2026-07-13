export const phrasalVerbsModule = {
  metadata: { id: 'phrasal-verbs', title: 'Phrasal Verbs', description: 'Practise common phrasal verbs in practical contexts.', levelRange: 'A2-C1' },
  topics: [
    { id: 'daily-life', title: 'Daily Life' },
    { id: 'work-study', title: 'Work and Study' },
    { id: 'relationships', title: 'Relationships' },
  ],
  questions: [
    { id: 'phrasal-verbs-001', type: 'multiple_choice', level: 'easy', topic: 'daily-life', prompt: 'Please ___ your shoes before you enter the flat.', options: ['take off', 'take up', 'take in', 'take over'], answer: 'take off', explanation: 'Take off means remove something you are wearing.', translation: 'Пожалуйста, снимите обувь перед входом в квартиру.', example: 'He took off his coat because it was warm.', shuffleOptions: true },
    { id: 'phrasal-verbs-002', type: 'multiple_choice', level: 'easy', topic: 'daily-life', prompt: 'I need to ___ at 7 a.m. tomorrow.', options: ['get up', 'get by', 'get over', 'get away'], answer: 'get up', explanation: 'Get up means leave your bed after sleeping.', translation: 'Мне нужно встать завтра в 7 утра.', example: 'She gets up early on weekdays.', shuffleOptions: true },
    { id: 'phrasal-verbs-003', type: 'multiple_choice', level: 'medium', topic: 'work-study', prompt: 'Can you ___ this report before the meeting?', options: ['look after', 'look into', 'look up to', 'look down on'], answer: 'look into', explanation: 'Look into means investigate or examine a problem.', translation: 'Можешь изучить этот отчет перед встречей?', example: 'The manager promised to look into the complaint.', shuffleOptions: true },
    { id: 'phrasal-verbs-004', type: 'multiple_choice', level: 'medium', topic: 'relationships', prompt: 'They ___ after a small argument, but they are friends again now.', options: ['fell out', 'fell behind', 'fell for', 'fell through'], answer: 'fell out', explanation: 'Fall out means stop being friendly because of a disagreement.', translation: 'Они поссорились из-за небольшого спора, но теперь снова друзья.', example: 'We fell out last year, but we solved the problem.', shuffleOptions: true },
    { id: 'phrasal-verbs-005', type: 'multiple_choice', level: 'hard', topic: 'work-study', prompt: 'The deadline was moved up, so we have to ___ the schedule.', options: ['keep up with', 'come up with', 'put up with', 'catch up on'], answer: 'keep up with', explanation: 'Keep up with means stay at the same speed or level as something demanding.', translation: 'Срок перенесли на более ранний, поэтому нам нужно успевать за графиком.', example: 'It is hard to keep up with all the new rules.', shuffleOptions: true },
    { id: 'phrasal-verbs-006', type: 'multiple_choice', level: 'hard', topic: 'relationships', prompt: 'She finally ___ the fact that the plan would not work.', options: ['came up against', 'came down with', 'came round to', 'came across as'], answer: 'came round to', explanation: 'Come round to means gradually accept an idea or opinion.', translation: 'Она наконец приняла тот факт, что план не сработает.', example: 'He came round to my suggestion after a long discussion.', shuffleOptions: true },
  ],
};
