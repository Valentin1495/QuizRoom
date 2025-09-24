import { v } from 'convex/values';
import { query } from './_generated/server';

export const getTopByDate = query({
  args: { date: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { date, limit }) => {
    const docs = await ctx.db
      .query('leaderboards')
      .withIndex('by_date_score', (q) => q.eq('date', date))
      .order('desc')
      .take(limit ?? 100);
    return docs;
  },
});
