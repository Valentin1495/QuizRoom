import { v } from 'convex/values';
import { mutation } from './_generated/server';

// 삭제됨: quizzes 테이블 제거에 따라 데이터 복사 마이그레이션 불필요

export const stripTestTypeFromCategoryStats = mutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { dryRun = true }) => {
    const stats = await ctx.db.query('categoryStats').collect();
    let cleaned = 0;
    for (const s of stats) {
      if ((s as any).testType !== undefined) {
        if (!dryRun) {
          const { testType, ...rest } = s as any;
          delete rest._id;
          await ctx.db.patch(s._id, rest);
        }
        cleaned++;
      }
    }
    return { cleaned, dryRun };
  },
});

export const stripTestTypeEverywhere = mutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { dryRun = true }) => {
    let cleaned = 0;
    const tables: any[] = ['categoryStats', 'challenges', 'gamificationData', 'testQuestions'];
    for (const table of tables) {
      const docs = await ctx.db.query(table as any).collect();
      for (const d of docs as any[]) {
        const hasTestType = d.testType !== undefined;
        const hasType = d.type !== undefined;
        if (hasTestType || hasType) {
          if (!dryRun) {
            // Convex에서는 patch에 undefined 값을 주면 해당 필드가 제거됩니다.
            const patch: any = {};
            if (hasTestType) patch.testType = undefined;
            if (hasType) patch.type = undefined;
            await ctx.db.patch(d._id, patch);
          }
          cleaned++;
        }
      }
    }
    return { cleaned, dryRun };
  },
});

export const stripTypeFromTestQuestions = mutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { dryRun = true }) => {
    const docs = await ctx.db.query('testQuestions').collect();
    let cleaned = 0;
    for (const d of docs as any[]) {
      if (d.type !== undefined) {
        if (!dryRun) {
          await ctx.db.patch(d._id, { type: undefined });
        }
        cleaned++;
      }
    }
    return { cleaned, dryRun };
  },
});

export const normalizeTestQuestionsCategories = mutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { dryRun = true }) => {
    const allowed = new Set([
      'general',
      'entertainment',
      'slang',
      'capitals',
      'four-character-idioms',
    ]);
    const docs = await ctx.db.query('testQuestions').collect();
    let fixed = 0;
    for (const d of docs as any[]) {
      if (!allowed.has(d.category)) {
        if (!dryRun) {
          await ctx.db.patch(d._id, { category: 'general' });
        }
        fixed++;
      }
    }
    return { fixed, dryRun };
  },
});
