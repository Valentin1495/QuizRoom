import { v } from 'convex/values';
import { mutation } from './_generated/server';

export const createReport = mutation({
  args: {
    questionId: v.id('quizzes'),
    userId: v.string(),
    reason: v.union(
      v.literal('정답 오류'),
      v.literal('문제 불명확'),
      v.literal('기타')
    ),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('reports', args);
  },
});
