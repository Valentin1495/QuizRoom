import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

export const getQuestionsByQuizType = query({
  args: {
    quizType: v.union(
      v.literal('knowledge'),
      v.literal('celebrity'),
      v.literal('four-character'),
      v.literal('movie-chain'),
      v.literal('proverb-chain'),
      v.literal('slang'),
      v.literal('logo'),
      v.literal('nonsense'),
      v.null()
    ),
    category: v.optional(
      v.union(
        v.literal('general'),
        v.literal('history-culture'),
        v.literal('arts-literature'),
        v.literal('kpop-music'),
        v.literal('sports'),
        v.literal('science-tech'),
        v.literal('math-logic'),
        v.literal('entertainment'),
        v.literal('korean-movie'),
        v.literal('foreign-movie'),
        v.literal('korean-celebrity'),
        v.literal('foreign-celebrity'),
        v.null()
      )
    ),
    questionFormat: v.union(
      v.literal('multiple'),
      v.literal('short'),
      v.null()
    ),
    difficulty: v.union(
      v.literal('easy'),
      v.literal('medium'),
      v.literal('hard'),
      v.null()
    ),
  },
  handler: async (ctx, args) => {
    // quizType 기준으로 먼저 가져오고
    const quizzes = await ctx.db
      .query('quizzes')
      .withIndex('byQuizType', (q) => q.eq('quizType', args.quizType))
      .collect();

    // 나머지 조건 필터링
    return quizzes.filter((quiz) => {
      const matchCategory = args.category
        ? quiz.category === args.category
        : true;
      const matchType = args.questionFormat
        ? quiz.questionFormat === args.questionFormat
        : true;
      const matchDifficulty = args.difficulty
        ? quiz.difficulty === args.difficulty
        : true;
      return matchCategory && matchType && matchDifficulty;
    });
  },
});

// 방법 1: 배치 삽입 mutation (가장 추천)
export const insertQuizBatch = mutation({
  args: {
    quizzes: v.array(
      v.object({
        quizType: v.union(
          v.literal('knowledge'),
          v.literal('celebrity'),
          v.literal('four-character'),
          v.literal('movie-chain'),
          v.literal('proverb-chain'),
          v.literal('slang'),
          v.literal('logo'),
          v.literal('nonsense'),
          v.null()
        ),
        category: v.optional(
          v.union(
            v.literal('kpop-music'),
            v.literal('history-culture'),
            v.literal('arts-literature'),
            v.literal('general'),
            v.literal('sports'),
            v.literal('science-tech'),
            v.literal('math-logic'),
            v.literal('entertainment'),
            v.literal('korean-movie'),
            v.literal('foreign-movie'),
            v.literal('korean-celebrity'),
            v.literal('foreign-celebrity'),
            v.null()
          )
        ),
        questionFormat: v.union(
          v.literal('multiple'),
          v.literal('short'),
          v.null()
        ),
        difficulty: v.union(
          v.literal('easy'),
          v.literal('medium'),
          v.literal('hard'),
          v.null()
        ),
        answer: v.optional(v.string()),
        answers: v.optional(v.array(v.string())),
        options: v.optional(v.array(v.string())),
        question: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // 서버에서 배치로 처리하여 성능 향상
    const insertPromises = args.quizzes.map((quiz) =>
      ctx.db.insert('quizzes', quiz)
    );

    try {
      await Promise.all(insertPromises);
      return { success: true, count: args.quizzes.length };
    } catch (error) {
      console.error('Batch insert failed:', error);
      throw new Error(`배치 삽입 실패: ${error}`);
    }
  },
});
