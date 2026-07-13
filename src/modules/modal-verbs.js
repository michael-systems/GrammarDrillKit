export const modalVerbsModule = {
  metadata: { id: 'modal-verbs', title: 'Modal Verbs', description: 'Practise modals for obligation, advice, possibility, and deduction.', levelRange: 'A2-C1' },
  topics: [
    { id: 'obligation', title: 'Obligation' },
    { id: 'advice', title: 'Advice' },
    { id: 'possibility', title: 'Possibility' },
    { id: 'deduction', title: 'Deduction' },
  ],
  questions: [
    { id: 'modal-verbs-001', type: 'multiple_choice', level: 'easy', topic: 'obligation', prompt: 'You ___ wear a seat belt in the car.', options: ['must', 'might', 'could', 'would'], answer: 'must', explanation: 'Must expresses a strong obligation or rule.', translation: 'Ты должен пристегиваться ремнем безопасности в машине.', example: 'Visitors must show their ID at reception.', shuffleOptions: true },
    { id: 'modal-verbs-002', type: 'multiple_choice', level: 'easy', topic: 'advice', prompt: 'You ___ see a doctor if the pain continues.', options: ['should', 'must not', 'might not', 'would'], answer: 'should', explanation: 'Should is commonly used to give advice.', translation: 'Тебе следует обратиться к врачу, если боль продолжается.', example: 'You should practise a little every day.', shuffleOptions: true },
    { id: 'modal-verbs-003', type: 'multiple_choice', level: 'medium', topic: 'possibility', prompt: 'We ___ be late because there is heavy traffic.', options: ['might', 'must', 'should have', 'had to'], answer: 'might', explanation: 'Might expresses a future possibility, not certainty.', translation: 'Мы можем опоздать, потому что сильное движение.', example: 'I might join you later if I finish work.', shuffleOptions: true },
    { id: 'modal-verbs-004', type: 'multiple_choice', level: 'medium', topic: 'deduction', prompt: 'The lights are off. They ___ be at home.', options: ['can', 'must not', 'cannot', 'should'], answer: 'cannot', explanation: 'Cannot can express a logical deduction that something is impossible or very unlikely.', translation: 'Свет выключен. Они, должно быть, не дома.', example: 'That cannot be the right address; the street name is different.', shuffleOptions: true },
    { id: 'modal-verbs-005', type: 'multiple_choice', level: 'hard', topic: 'deduction', prompt: 'She ___ have forgotten the meeting; she is usually very organised.', options: ['must', 'could not', 'should', 'may not'], answer: 'could not', explanation: 'Could not have + past participle can express a strong negative deduction about the past.', translation: 'Она не могла забыть о встрече; обычно она очень организованная.', example: 'He could not have written this email; he was offline.', shuffleOptions: true },
    { id: 'modal-verbs-006', type: 'multiple_choice', level: 'hard', topic: 'obligation', prompt: 'You ___ have submitted the form yesterday; the deadline was extended.', options: ['need not', 'need not have', 'must not', 'cannot have'], answer: 'need not have', explanation: 'Need not have + past participle means an action was done, but it was unnecessary.', translation: 'Тебе не нужно было отправлять форму вчера; срок продлили.', example: 'We need not have hurried because the train was delayed.', shuffleOptions: true },
  ],
};
