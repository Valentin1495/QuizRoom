import { query } from './_generated/server';
import { v } from 'convex/values';

export const getQuestionsByCategory = query({
  args: { category: v.string() },
  handler: async (ctx, { category }) => {
    return await ctx.db
      .query('questions')
      .withIndex('by_category', (q) => q.eq('category', category))
      .collect();
  },
});
