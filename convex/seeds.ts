import { v } from 'convex/values';
import { mutation } from './_generated/server';

export const insertQuestionBankBatch = mutation({
  args: {
    items: v.array(
      v.object({
        stem: v.string(),
        choices: v.array(v.object({ id: v.string(), text: v.string() })),
        answerId: v.string(),
        subject: v.string(),
        difficulty: v.number(),
        locale: v.string(),
        reviewed: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, { items }) => {
    let count = 0;
    for (const it of items) {
      await ctx.db.insert('questionBank', it as any);
      count += 1;
    }
    return { inserted: count } as const;
  },
});
