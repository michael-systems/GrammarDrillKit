export const conditionalsModule = {
  metadata: {
    id: 'conditionals',
    title: 'Conditionals',
    description: 'Practise zero, first, second, third, and mixed conditional forms.',
    levelRange: 'A2-C1',
  },
  topics: [
    { id: 'zero-conditional', title: 'Zero Conditional' },
    { id: 'first-conditional', title: 'First Conditional' },
    { id: 'second-conditional', title: 'Second Conditional' },
    { id: 'third-conditional', title: 'Third Conditional' },
    { id: 'mixed-conditional', title: 'Mixed Conditional' },
  ],
  questions: [
    { id: 'conditionals-001', type: 'multiple_choice', level: 'easy', topic: 'zero-conditional', prompt: 'If water reaches 100°C, it ___.', options: ['boils', 'boiled', 'will boil', 'would boil'], answer: 'boils', explanation: 'Use the Zero Conditional for general truths: if + Present Simple, Present Simple.', translation: 'Если вода достигает 100°C, она кипит.', example: 'If you heat ice, it melts.', shuffleOptions: true },
    { id: 'conditionals-002', type: 'multiple_choice', level: 'easy', topic: 'first-conditional', prompt: 'If it rains tomorrow, we ___ at home.', options: ['stay', 'will stay', 'would stay', 'stayed'], answer: 'will stay', explanation: 'Use the First Conditional for real future possibilities: if + Present Simple, will + base verb.', translation: 'Если завтра пойдет дождь, мы останемся дома.', example: 'If I finish early, I will call you.', shuffleOptions: true },
    { id: 'conditionals-003', type: 'multiple_choice', level: 'medium', topic: 'second-conditional', prompt: 'If I had more time, I ___ more books.', options: ['read', 'will read', 'would read', 'had read'], answer: 'would read', explanation: 'This is the Second Conditional: if + Past Simple, would + base verb.', translation: 'Если бы у меня было больше времени, я бы читал больше книг.', example: 'If I had more money, I would travel more.', shuffleOptions: true },
    { id: 'conditionals-004', type: 'multiple_choice', level: 'medium', topic: 'second-conditional', prompt: 'If she ___ here, she would know what to do.', options: ['is', 'were', 'will be', 'has been'], answer: 'were', explanation: 'In formal Second Conditional sentences, use were for unreal situations with any subject.', translation: 'Если бы она была здесь, она бы знала, что делать.', example: 'If he were less busy, he would join us.', shuffleOptions: true },
    { id: 'conditionals-005', type: 'multiple_choice', level: 'hard', topic: 'third-conditional', prompt: 'If they had left earlier, they ___ the train.', options: ['caught', 'will catch', 'would catch', 'would have caught'], answer: 'would have caught', explanation: 'The Third Conditional describes an unreal past result: if + Past Perfect, would have + past participle.', translation: 'Если бы они ушли раньше, они бы успели на поезд.', example: 'If I had studied harder, I would have passed.', shuffleOptions: true },
    { id: 'conditionals-006', type: 'multiple_choice', level: 'hard', topic: 'mixed-conditional', prompt: 'If I had taken that job, I ___ in Berlin now.', options: ['would live', 'would have lived', 'will live', 'live'], answer: 'would live', explanation: 'This mixed conditional links an unreal past condition to a present result.', translation: 'Если бы я согласился на ту работу, я бы сейчас жил в Берлине.', example: 'If she had moved abroad, she would speak Spanish now.', shuffleOptions: true },
  ],
};
