import { v } from 'convex/values';
import { query } from './_generated/server';

export const getQuizzesByQuizType = query({
  args: {
    quizType: v.union(
      v.literal('knowledge'),
      v.literal('celebrity'),
      v.literal('four-character'),
      v.literal('movie-chain'),
      v.literal('proverb-chain'),
      v.literal('slang'),
      v.literal('logo')
    ),
    type: v.optional(v.union(v.literal('multiple'), v.literal('short'))),
    difficulty: v.optional(
      v.union(v.literal('easy'), v.literal('medium'), v.literal('hard'))
    ),
  },
  handler: async (ctx, args) => {
    // 1. 해당 quizType의 카테고리 목록 조회
    const categories = await ctx.db
      .query('categories')
      .withIndex('byQuizType', (q) => q.eq('quizType', args.quizType))
      .collect();

    const categoryIds = categories.map((cat) => cat._id);

    // 2. 해당 카테고리들에 속한 quiz 가져오기
    const allQuizzes = await Promise.all(
      categoryIds.map(async (categoryId) => {
        const quizzes = await ctx.db
          .query('quizzes')
          .withIndex('byCategoryId', (q) => q.eq('categoryId', categoryId))
          .collect();
        return quizzes;
      })
    );

    const flatQuizzes = allQuizzes.flat();

    // 3. type, difficulty로 필터링
    return flatQuizzes.filter((quiz) => {
      const typeMatches = args.type ? quiz.type === args.type : true;
      const diffMatches = args.difficulty
        ? quiz.difficulty === args.difficulty
        : true;
      return typeMatches && diffMatches;
    });
  },
});
