import { action, internalMutation, mutation, query } from './_generated/server';
import type { ActionCtx, MutationCtx, QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { v } from 'convex/values';
import { api, internal } from './_generated/api';
import { shuffle } from 'lodash';

// This internal mutation replaces the flawed `getUserId` helper.
// It can safely access the database to find or create a user.
export const getOrCreateDummyUser = internalMutation({
  handler: async (ctx: MutationCtx) => {
    // For now, we'll create a dummy user if one doesn't exist.
    const user = await ctx.db.query('users').first();
    if (user) {
      return user._id;
    }
    return await ctx.db.insert('users', {
      // In a real app, you'd get these from the auth provider.
      authId: 'dummy-user-' + Math.random().toString(36).slice(2),
      nickname: 'Guest',
      avatar: 'avatar_url',
      country: 'KR',
      createdAt: Date.now(),
    });
  },
});

const calcScore = (msLeft: number, streak: number) => {
  const base = 100;
  const timeBonus = Math.round(Math.min(50, msLeft / 200)); // Max 50
  const streakMul = Math.min(1.5, 1 + 0.1 * Math.max(0, streak - 1));
  return Math.round((base + timeBonus) * streakMul);
};

const GRADE_BANDS: Doc<'questions'>['gradeBand'][] = [
  'kinder',
  'elem_low',
  'elem_high',
  'middle',
  'high',
  'college',
];

export const startSession = action({
  args: { category: v.string() },
  handler: async (ctx: ActionCtx, { category }) => {
    const userId = await ctx.runMutation(internal.sessions.getOrCreateDummyUser);

    const questionsPerGrade = {
      kinder: 2,
      elem_low: 2,
      elem_high: 2,
      middle: 2,
      high: 2,
      college: 1,
    };

    const questionPromises = GRADE_BANDS.map((gradeBand) =>
      ctx.runQuery(api.questions.getQuestionsByCategory, {
        category,
        gradeBand,
      })
    );
    const questionsByGrade = await Promise.all(questionPromises);

    const selectedQuestions: Doc<'questions'>[] = [];
    for (let i = 0; i < GRADE_BANDS.length; i++) {
      const gradeBand = GRADE_BANDS[i];
      const count = questionsPerGrade[gradeBand];
      const pool = questionsByGrade[i];

      if (pool.length < count) {
        throw new Error(
          `Not enough questions for category ${category} and grade ${gradeBand}. Found ${pool.length}, need ${count}.`
        );
      }
      selectedQuestions.push(...shuffle(pool).slice(0, count));
    }

    const questionIds = selectedQuestions.map((q) => q._id);
    const difficultyCurve = selectedQuestions.map((q) => q.gradeBand);

    const sessionId: Id<'sessions'> = await ctx.runMutation(
      internal.sessions.createSession,
      {
        userId,
        category,
        questions: questionIds,
        difficultyCurve,
      }
    );

    return { sessionId };
  },
});

export const createSession = internalMutation({
  args: {
    userId: v.id('users'),
    category: v.string(),
    questions: v.array(v.id('questions')),
    difficultyCurve: v.array(
      v.union(
        v.literal('kinder'),
        v.literal('elem_low'),
        v.literal('elem_high'),
        v.literal('middle'),
        v.literal('high'),
        v.literal('college')
      )
    ),
  },
  handler: async (ctx: MutationCtx, { userId, category, questions, difficultyCurve }) => {
    return await ctx.db.insert('sessions', {
      userId,
      status: 'active',
      mode: 'quick',
      category,
      difficultyCurve,
      questions,
      answers: [],
      score: 0,
      streak: 0,
      streakDelta: 0,
      startedAt: Date.now(),
    });
  },
});

export const getSession = query({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx: QueryCtx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) {
      return null;
    }
    const questions = await Promise.all(
      session.questions.map((qId) => ctx.db.get(qId))
    );
    // Filter out any null questions if a question was deleted.
    const nonNullQuestions = questions.filter(Boolean);

    return {
      ...session,
      questions: nonNullQuestions,
    };
  },
});

export const submitAnswer = mutation({
  args: {
    sessionId: v.id('sessions'),
    qid: v.id('questions'),
    choiceIndex: v.number(),
    ms: v.number(),
  },
  handler: async (ctx: MutationCtx, { sessionId, qid, choiceIndex, ms }) => {
    const question = await ctx.db.get(qid);
    if (!question) {
      throw new Error('Question not found');
    }

    const session = await ctx.db.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    if (session.status === 'ended') {
      throw new Error('Session has already ended');
    }

    const isCorrect = question.answerIndex === choiceIndex;

    const answer = {
      qid,
      choice: choiceIndex,
      correct: isCorrect,
      ms,
    };

    let score = session.score;
    let streak = session.streak;

    if (isCorrect) {
      // Assuming total time is 20s (20000ms) for time bonus calculation
      const msLeft = Math.max(0, 20000 - ms);
      const points = calcScore(msLeft, streak);
      score += points;
      streak += 1;
    } else {
      streak = 0;
    }

    const updatedAnswers = [...session.answers, answer];

    await ctx.db.patch(sessionId, {
      answers: updatedAnswers,
      score,
      streak,
    });

    // Check if it's the end of a difficulty stage
    const currentQuestionIndex = updatedAnswers.length - 1;
    const currentGradeBand = session.difficultyCurve[currentQuestionIndex];
    const nextGradeBand = session.difficultyCurve[currentQuestionIndex + 1]; // undefined if it's the last question

    if (currentGradeBand !== nextGradeBand) {
      // This is the last question of the current grade band
      const firstQuestionIndexInStage = session.difficultyCurve.indexOf(currentGradeBand);
      const answersForCurrentStage = updatedAnswers.slice(firstQuestionIndexInStage);

      const allCorrectInStage = answersForCurrentStage.every((a) => a.correct);

      if (!allCorrectInStage) {
        // End the session if any answer in the stage is incorrect
        await ctx.db.patch(sessionId, {
          status: 'ended',
          endedAt: Date.now(),
        });
        // Note: You might want to update the leaderboard even for failed sessions.
        // If so, call the leaderboard update logic here.
      }
    }

    return { correct: isCorrect };
  },
});

export const updateSessionStatus = internalMutation({
  args: {
    sessionId: v.id('sessions'),
    status: v.union(v.literal('active'), v.literal('ended')),
  },
  handler: async (ctx: MutationCtx, { sessionId, status }) => {
    await ctx.db.patch(sessionId, {
      status,
      endedAt: status === 'ended' ? Date.now() : undefined,
    });
  },
});

export const endSession = action({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx: ActionCtx, { sessionId }) => {
    const session = await ctx.runQuery(api.sessions.getSession, { sessionId });
    if (!session) {
      throw new Error("Session not found");
    }
    if (session.status === 'ended') {
      // Avoid re-ending a session
      return;
    }

    await ctx.runMutation(internal.sessions.updateSessionStatus, {
      sessionId,
      status: 'ended',
    });

    await ctx.runMutation(internal.leaderboards.updateLeaderboard, {
      userId: session.userId,
      score: session.score,
    });
  },
});