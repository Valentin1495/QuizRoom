import { v } from 'convex/values';
import { query } from './_generated/server';

export const getKnowledgeCategories = query({
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
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('categories')
      .withIndex('byQuizType', (q) => q.eq('quizType', args.quizType))
      .collect();
  },
});
