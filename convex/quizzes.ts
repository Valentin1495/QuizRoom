import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

export const getQuestions = query({
  args: {
    category: v.optional(
      v.union(
        v.literal('general'),
        v.literal('history-culture'),
        v.literal('arts-literature'),
        v.literal('kpop-music'),
        v.literal('sports'),
        v.literal('science-tech'),
        v.literal('math-logic'),
        v.literal('movies'),
        v.literal('drama-variety'),
        v.null(),
      ),
    ),
    questionFormat: v.union(
      v.literal('multiple'),
      v.literal('short'),
      v.literal('true_false'),
      v.literal('filmography'),
      v.null(),
    ),
    difficulty: v.union(v.literal('easy'), v.literal('medium'), v.literal('hard'), v.null()),
  },
  handler: async (ctx, args) => {
    const inferTopCategory = (cat?: string | null) => {
      if (!cat) return null as any;
      const entertainmentSubs = new Set(['movies', 'drama-variety']);
      const knowledgeSubs = new Set([
        'general',
        'history-culture',
        'arts-literature',
        'kpop-music',
        'sports',
        'science-tech',
        'math-logic',
      ]);
      if (entertainmentSubs.has(cat)) return 'entertainment' as const;
      if (knowledgeSubs.has(cat)) return 'general' as const;
      return null as any;
    };

    const topCategory = inferTopCategory(args.category as any);
    if (!topCategory) return [];

    const all = await ctx.db
      .query('testQuestions')
      .withIndex('byCategory', (q) => q.eq('category', topCategory))
      .collect();

    const normalizeSubcategory = (cat?: string | null) => {
      switch (cat) {
        case 'kpop-music':
        case 'general':
        case 'history-culture':
        case 'arts-literature':
        case 'sports':
        case 'science-tech':
        case 'math-logic':
        case 'movies':
        case 'drama-variety':
          return cat;
        default:
          return null;
      }
    };

    return all.filter((q: any) => {
      const normalizedSub = normalizeSubcategory(args.category as any);
      const matchSubcategory = args.category ? q.subcategory === normalizedSub : true;
      const matchType = args.questionFormat ? q.questionFormat === args.questionFormat : true;
      const matchDifficulty = args.difficulty ? q.difficulty === args.difficulty : true;
      return matchSubcategory && matchType && matchDifficulty;
    }) as any[];
  },
});

export const insertQuizBatch = mutation({
  args: {
    quizzes: v.array(
      v.object({
        category: v.optional(
          v.union(
            v.literal('kpop-music'),
            v.literal('history-culture'),
            v.literal('arts-literature'),
            v.literal('general'),
            v.literal('sports'),
            v.literal('science-tech'),
            v.literal('math-logic'),
            v.literal('entertainment'),
            v.literal('movies'),
            v.literal('drama-variety'),
            v.null(),
          ),
        ),
        questionFormat: v.union(v.literal('multiple'), v.literal('short'), v.null()),
        difficulty: v.union(v.literal('easy'), v.literal('medium'), v.literal('hard'), v.null()),
        answer: v.optional(v.string()),
        answers: v.optional(v.array(v.string())),
        options: v.optional(v.array(v.string())),
        question: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const inferTopCategory = (cat?: string | null) => {
      if (!cat) return null as any;
      const entertainmentSubs = new Set(['movies', 'drama-variety']);
      const knowledgeSubs = new Set([
        'general',
        'history-culture',
        'arts-literature',
        'kpop-music',
        'sports',
        'science-tech',
        'math-logic',
      ]);
      if (entertainmentSubs.has(cat)) return 'entertainment' as const;
      if (knowledgeSubs.has(cat)) return 'general' as const;
      return null as any;
    };

    const normalizeSubcategory = (cat?: string | null) => {
      switch (cat) {
        case 'kpop-music':
        case 'general':
        case 'history-culture':
        case 'arts-literature':
        case 'sports':
        case 'science-tech':
        case 'math-logic':
        case 'movies':
        case 'drama-variety':
          return cat;
        default:
          return null;
      }
    };

    const docs = args.quizzes.map((q) => {
      const category = inferTopCategory(q.category as any);
      const subcategory = normalizeSubcategory(q.category as any);
      return {
        category,
        subcategory: subcategory ?? undefined,
        question: q.question,
        questionFormat: q.questionFormat,
        difficulty: q.difficulty,
        options: q.options ?? undefined,
        answer: q.answer ?? undefined,
        answers: q.answers ?? undefined,
      } as const;
    });

    try {
      for (const doc of docs) {
        if (!doc.category) continue;
        await ctx.db.insert('testQuestions', doc as any);
      }
      return { success: true, count: docs.length };
    } catch (error) {
      console.error('Batch insert failed:', error);
      throw new Error(`배치 삽입 실패: ${error}`);
    }
  },
});
