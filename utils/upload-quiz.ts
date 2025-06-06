const quizzes = [
  {
    answers: ['에드거 앨런 포', 'Edgar Allan Poe'],
    category: 'arts-literature',
    difficulty: 'hard',
    question:
      "'검은 고양이', '우울한 곰' 등의 작품으로 유명한 미국 고딕 문학 작가는 누구인가요?",
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
