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

const calcScore = (
  msLeft: number,
  streak: number,
  boostUsed?: "skip" | "fifty" | "hint"
) => {
  const base = 100;
  let timeBonus = Math.round(Math.min(50, msLeft / 200)); // Max 50

  if (boostUsed === 'hint') {
    timeBonus = Math.round(timeBonus / 2);
  }

  const streakMul = Math.min(1.5, 1 + 0.1 * Math.max(0, streak - 1));
  return Math.round((base + timeBonus) * streakMul);
};

const GRADE_BANDS: Exclude<Doc<'questions'>['gradeBand'], 'double_down'>[] = [
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

    const questionsPerGrade: Record<Doc<'questions'>['gradeBand'], number> = {
      kinder: 2,
      elem_low: 2,
      elem_high: 2,
      middle: 2,
      high: 2,
      college: 2,
      double_down: 0, // Not used in a standard session
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
        v.literal('college'),
        v.literal('double_down')
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
    boostUsed: v.optional(
      v.union(v.literal("skip"), v.literal("fifty"), v.literal("hint"))
    ),
  },
  handler: async (ctx: MutationCtx, { sessionId, qid, choiceIndex, ms, boostUsed }) => {
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

    // End the session immediately if the answer is incorrect
    if (!isCorrect) {
      await ctx.db.patch(sessionId, {
        status: 'ended',
        endedAt: Date.now(),
        // Add the incorrect answer to the list before ending
        answers: [
          ...session.answers,
          {
            qid,
            choice: choiceIndex,
            correct: false,
            ms,
            boostUsed,
          },
        ],
        streak: 0, // Reset streak
      });
      return { correct: false };
    }

    const answer = {
      qid,
      choice: choiceIndex,
      correct: isCorrect,
      ms,
      boostUsed,
    };

    let score = session.score;
    let streak = session.streak;

    if (isCorrect) {
      // Assuming total time is 20s (20000ms) for time bonus calculation
      const msLeft = Math.max(0, 20000 - ms);
      const points = calcScore(msLeft, streak, boostUsed);
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

    // The stage-gate logic is no longer needed here,
    // as any incorrect answer already terminates the session.
    // We can simply proceed to the next question if correct.

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

export const requestDoubleDownQuestion = action({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx: ActionCtx, { sessionId }) => {
    const session: any = await ctx.runQuery(api.sessions.getSession, { sessionId }) as any;
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status === 'ended') {
      throw new Error('Session has already ended');
    }

    if (session.questions.length > session.answers.length) {
      throw new Error('Double down can only be requested after completing the main quiz.');
    }

    const lastQuestion: any = session.questions[session.questions.length - 1] as any;
    if (lastQuestion && lastQuestion.gradeBand === 'double_down') {
      throw new Error('Double down question has already been added.');
    }

    const doubleDownQuestions = await ctx.runQuery(
      api.questions.getQuestionsByCategory,
      {
        category: session.category,
        gradeBand: 'double_down',
      }
    ) as Doc<'questions'>[];

    if (doubleDownQuestions.length === 0) {
      throw new Error('No double down question found for this category.');
    }

    const question: Doc<'questions'> = shuffle(doubleDownQuestions)[0];

    await ctx.runMutation(internal.sessions.addDoubleDownQuestionToSession, {
      sessionId,
      questionId: question._id,
    });

    return question;
  },
});

export const addDoubleDownQuestionToSession = internalMutation({
  args: { sessionId: v.id('sessions'), questionId: v.id('questions') },
  handler: async (ctx, { sessionId, questionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    await ctx.db.patch(sessionId, {
      questions: [...session.questions, questionId],
      difficultyCurve: [...session.difficultyCurve, 'double_down'],
    });
  },
});

export const submitDoubleDownAnswer = action({
  args: { sessionId: v.id('sessions'), choiceIndex: v.number(), ms: v.number() },
  handler: async (ctx: ActionCtx, { sessionId, choiceIndex, ms }) => {
    const session: any = await ctx.runQuery(api.sessions.getSession, { sessionId }) as any;
    if (!session) {
      throw new Error('Session not found');
    }

    const doubleDownQuestion: Doc<'questions'> | undefined = session.questions[session.questions.length - 1] as Doc<'questions'> | undefined;
    if (!doubleDownQuestion) {
      throw new Error('Double down question not found in session.');
    }

    if (doubleDownQuestion.gradeBand !== 'double_down') {
      throw new Error('Double down question has not been added to this session yet.');
    }

    const isCorrect: boolean = doubleDownQuestion.answerIndex === choiceIndex;
    const finalScore: number = isCorrect ? session.score * 2 : Math.round(session.score * 0.5);

    await ctx.runMutation(internal.sessions.endDoubleDownSession, {
      sessionId,
      finalScore,
      isCorrect,
      choiceIndex,
      ms
    });

    return { correct: isCorrect, finalScore };
  },
});

export const endDoubleDownSession = internalMutation({
  args: {
    sessionId: v.id('sessions'),
    finalScore: v.number(),
    isCorrect: v.boolean(),
    choiceIndex: v.number(),
    ms: v.number(),
  },
  handler: async (ctx, { sessionId, finalScore, isCorrect, choiceIndex, ms }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error('Session not found');

    const lastQuestionId = session.questions[session.questions.length - 1];
    const lastQuestion = await ctx.db.get(lastQuestionId);

    if (!lastQuestion || lastQuestion.gradeBand !== 'double_down') {
      throw new Error('Invalid double down question state.');
    }

    await ctx.db.patch(sessionId, {
      score: finalScore,
      status: 'ended',
      endedAt: Date.now(),
      answers: [
        ...session.answers,
        {
          qid: lastQuestionId,
          choice: choiceIndex,
          correct: isCorrect,
          ms,
        },
      ],
    });
  },
});

export const skipQuestion = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    questionId: v.id("questions"),
  },
  handler: async (ctx, { sessionId, questionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Find the question to get the correct answer index
    const question = await ctx.db.get(questionId);
    if (!question) {
      throw new Error("Question not found");
    }

    await ctx.db.patch(session._id, {
      answers: [
        ...session.answers,
        {
          qid: questionId,
          choice: question.answerIndex, // Mark correct answer to maintain streak
          correct: true,
          ms: 0,
          boostUsed: "skip",
        },
      ],
      streak: session.streak + 1, // Maintain streak
    });
  },
});