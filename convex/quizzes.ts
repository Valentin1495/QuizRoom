import { v } from 'convex/values';
import { query } from './_generated/server';

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
      v.literal('nonsense')
    ),
    category: v.optional(
      v.union(
        v.literal('kpop-music'),
        v.literal('world-knowledge'),
        v.literal('trivia-tmi'),
        v.literal('memes-trends'),
        v.literal('sports'),
        v.literal('science-tech'),
        v.literal('math-logic'),
        v.literal('movies-drama'),
        v.literal('korean-movie'),
        v.literal('foreign-movie'),
        v.literal('korean-celebrity'),
        v.literal('foreign-celebrity')
      )
    ),
    questionFormat: v.optional(
      v.union(v.literal('multiple'), v.literal('short'))
    ),
    difficulty: v.optional(
      v.union(v.literal('easy'), v.literal('medium'), v.literal('hard'))
    ),
  },
  handler: async (ctx, args) => {
    // quizType 기준으로 먼저 가져오고
    const quizzes = await ctx.db
      .query('quizzes')
      .withIndex('byQuizType', (q) => q.eq('quizType', args.quizType))
      .collect();

    // 나머지 조건 필터링
    return quizzes.filter((quiz) => {
      const matchCategory = args.category
        ? quiz.category === args.category
        : true;
      const matchType = args.questionFormat
        ? quiz.questionFormat === args.questionFormat
        : true;
      const matchDifficulty = args.difficulty
        ? quiz.difficulty === args.difficulty
        : true;
      return matchCategory && matchType && matchDifficulty;
    });
  },
});
