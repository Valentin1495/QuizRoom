import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

export const ensureTodaySet = mutation({
  args: { locale: v.string() },
  handler: async (ctx, { locale }) => {
    const today = new Date().toISOString().slice(0, 10);
    let set = await ctx.db
      .query('dailySets')
      .withIndex('by_date_locale', (q) => q.eq('date', today).eq('locale', locale))
      .first();

    if (!set) {
      const qs = await ctx.db
        .query('questionBank')
        .withIndex('by_locale_diff', (q) => q.eq('locale', locale))
        .take(9);
      const id = await ctx.db.insert('dailySets', {
        date: today,
        questionIds: qs.map((q) => q._id),
        locale,
      });
      set = (await ctx.db.get(id))!;
    }
    return set;
  },
});

export const getTodaySet = query({
  args: { locale: v.string() },
  handler: async (ctx, { locale }) => {
    const today = new Date().toISOString().slice(0, 10);
    const set = await ctx.db
      .query('dailySets')
      .withIndex('by_date_locale', (q) => q.eq('date', today).eq('locale', locale))
      .first();

    if (!set) return null;

    const questions: any[] = [];
    for (const qid of set.questionIds) {
      const q = await ctx.db.get(qid);
      if (q) questions.push({ id: q._id, ...q });
    }

    return { ...set, questions } as any;
  },
});

export const resetDailySets = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query('dailySets').collect();
    for (const doc of all) {
      await ctx.db.delete(doc._id);
    }
    return { deleted: all.length } as const;
  },
});
