const quizzes = [
  {
    answers: ['라그랑주 승수법', 'Lagrange multiplier'],
    category: 'math-logic',
    difficulty: 'hard',
    question:
      '제약 조건이 있는 다변수 함수의 극값을 찾는 데 사용되는 수학적 방법은 무엇인가요?',
    questionFormat: 'short',
    quizType: 'knowledge',
  },
];
console.log(quizzes.length);

export const uploadQuizBatch = async (insertQuizBatch: any) => {
  try {
    const result = await insertQuizBatch({ quizzes });
    console.log(`✅ Successfully uploaded ${result.count} quizzes in batch`);
    return result;
  } catch (error) {
    console.error('❌ Batch upload failed:', error);
    throw error;
  }
};
