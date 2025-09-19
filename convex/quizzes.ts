import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

export const getQuestionsByQuizType = query({
  args: {
    quizType: v.union(
      v.literal('knowledge'),
      v.literal('celebrity'),
      v.literal('four-character'),
      v.literal('movie-chain'),
      v.literal('proverb-chain'),
      v.literal('slang'),
      v.literal('logo'),
      v.literal('nonsense'),
      v.null()
    ),
    category: v.optional(
      v.union(
        v.literal('general'),
        v.literal('history-culture'),
        v.literal('arts-literature'),
        v.literal('kpop-music'),
        v.literal('sports'),
        v.literal('science-tech'),
        v.literal('math-logic'),
        v.literal('entertainment'),
        v.literal('korean-movie'),
        v.literal('foreign-movie'),
        v.literal('korean-celebrity'),
        v.literal('foreign-celebrity'),
        v.null()
      )
    ),
    questionFormat: v.union(
      v.literal('multiple'),
      v.literal('short'),
      v.null()
    ),
    difficulty: v.union(
      v.literal('easy'),
      v.literal('medium'),
      v.literal('hard'),
      v.null()
    ),
  },
  handler: async (ctx, args) => {
    // map quizType → testQuestions.category
    const mapQuizTypeToCategory = (qt: any) => {
      switch (qt) {
        case 'knowledge':
          return 'general';
        case 'celebrity':
          return 'entertainment';
        case 'four-character':
          return 'four-character-idioms';
        case 'movie-chain':
          return 'entertainment';
        case 'proverb-chain':
          return 'general';
        case 'slang':
          return 'slang';
        case 'logo':
          return 'general';
        case 'nonsense':
          return 'slang';
        default:
          return null;
      }
    };
    // map legacy quizzes.category → testQuestions.subcategory
    const mapLegacyCategoryToSubcategory = (cat?: string | null) => {
      switch (cat) {
        case 'kpop-music':
        case 'general':
        case 'history-culture':
        case 'arts-literature':
        case 'sports':
        case 'science-tech':
        case 'math-logic':
          return cat;
        case 'entertainment':
        case 'korean-movie':
        case 'foreign-movie':
          return 'movies';
        default:
          return null;
      }
    };

    const targetCategory = mapQuizTypeToCategory(args.quizType);
    if (!targetCategory) return [];

    const all = await ctx.db
      .query('testQuestions')
      .withIndex('byCategory', (q) => q.eq('category', targetCategory))
      .collect();

    return all.filter((q) => {
      const mappedSub = mapLegacyCategoryToSubcategory(args.category as any);
      const matchSubcategory = args.category ? q.subcategory === mappedSub : true;
      const matchType = args.questionFormat
        ? q.questionFormat === args.questionFormat
        : true;
      const matchDifficulty = args.difficulty
        ? q.difficulty === args.difficulty
        : true;
      return matchSubcategory && matchType && matchDifficulty;
    }) as any[];
  },
});

// 방법 1: 배치 삽입 mutation (가장 추천)
export const insertQuizBatch = mutation({
  args: {
    quizzes: v.array(
      v.object({
        quizType: v.union(
          v.literal('knowledge'),
          v.literal('celebrity'),
          v.literal('four-character'),
          v.literal('movie-chain'),
          v.literal('proverb-chain'),
          v.literal('slang'),
          v.literal('logo'),
          v.literal('nonsense'),
          v.null()
        ),
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
            v.literal('korean-movie'),
            v.literal('foreign-movie'),
            v.literal('korean-celebrity'),
            v.literal('foreign-celebrity'),
            v.null()
          )
        ),
        questionFormat: v.union(
          v.literal('multiple'),
          v.literal('short'),
          v.null()
        ),
        difficulty: v.union(
          v.literal('easy'),
          v.literal('medium'),
          v.literal('hard'),
          v.null()
        ),
        answer: v.optional(v.string()),
        answers: v.optional(v.array(v.string())),
        options: v.optional(v.array(v.string())),
        question: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const mapQuizTypeToCategory = (qt: any) => {
      switch (qt) {
        case 'knowledge':
          return 'general';
        case 'celebrity':
          return 'entertainment';
        case 'four-character':
          return 'four-character-idioms';
        case 'movie-chain':
          return 'entertainment';
        case 'proverb-chain':
          return 'general';
        case 'slang':
          return 'slang';
        case 'logo':
          return 'general';
        case 'nonsense':
          return 'slang';
        default:
          return null;
      }
    };
    const mapLegacyCategoryToSubcategory = (cat?: string | null) => {
      switch (cat) {
        case 'kpop-music':
        case 'general':
        case 'history-culture':
        case 'arts-literature':
        case 'sports':
        case 'science-tech':
        case 'math-logic':
          return cat;
        case 'entertainment':
        case 'korean-movie':
        case 'foreign-movie':
          return 'movies';
        default:
          return null;
      }
    };

    const docs = args.quizzes
      .map((q) => {
        const category = mapQuizTypeToCategory(q.quizType);
        if (!category) return null;
        const subcategory = mapLegacyCategoryToSubcategory(q.category as any);
        return {
          category, // testQuestions.category
          subcategory: subcategory ?? undefined,
          question: q.question,
          questionFormat: q.questionFormat,
          difficulty: q.difficulty,
          options: q.options ?? undefined,
          answer: q.answer ?? undefined,
          answers: q.answers ?? undefined,
        } as const;
      })
      .filter(Boolean) as Array<{
        category: 'general' | 'entertainment' | 'slang' | 'capitals' | 'four-character-idioms';
        subcategory?: 'kpop-music' | 'general' | 'history-culture' | 'arts-literature' | 'sports' | 'science-tech' | 'math-logic' | 'movies' | 'drama-variety';
        question: string;
        questionFormat: 'multiple' | 'short' | null;
        difficulty: 'easy' | 'medium' | 'hard' | null;
        options?: string[];
        answer?: string;
        answers?: string[];
      }>;

    try {
      for (const doc of docs) {
        await ctx.db.insert('testQuestions', doc as any);
      }
      return { success: true, count: docs.length };
    } catch (error) {
      console.error('Batch insert failed:', error);
      throw new Error(`배치 삽입 실패: ${error}`);
    }
  },
});
