import { query } from './_generated/server';
import { v } from 'convex/values';
import { Doc } from './_generated/dataModel';

export const getQuestionsByCategory = query({
  args: {
    category: v.string(),
    gradeBand: v.union(
      v.literal('kinder'),
      v.literal('elem_low'),
      v.literal('elem_high'),
      v.literal('middle'),
      v.literal('high'),
      v.literal('college')
    ),
  },
  handler: async (ctx, { category, gradeBand }) => {
    return await ctx.db
      .query('questions')
      .withIndex('by_category_gradeBand', (q) =>
        q.eq('category', category).eq('gradeBand', gradeBand)
      )
      .collect();
  },
});
