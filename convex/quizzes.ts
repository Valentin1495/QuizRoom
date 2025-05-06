import { v } from 'convex/values';
import { query } from './_generated/server';

export const getQuizzesByCategory = query({
  args: {
    category: v.id('categories'),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('quizzes')
      .withIndex('byCategoryId', (q) => q.eq('categoryId', args.category))
      .collect();
  },
});
