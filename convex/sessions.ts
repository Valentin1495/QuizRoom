import { action, internalMutation, mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { api, internal } from './_generated/api';

// NOTE: This is a placeholder for a real user authentication system.
// In a real app, you'd get the user ID from the session.
const getUserId = async (ctx: any) => {
  // For now, we'll create a dummy user if one doesn't exist.
  const user = await ctx.db.query('users').first();
  if (user) return user._id;
  return await ctx.db.insert('users', {
    // In a real app, you'd get these from the auth provider.
    authId: 'dummy-user-' + Math.random().toString(36).slice(2),
    nickname: 'Guest',
    avatar: 'avatar_url',
    country: 'KR',
    createdAt: Date.now(),
  });
};

const calcScore = (msLeft: number, streak: number) => {
  const base = 100;
  const timeBonus = Math.round(Math.min(50, msLeft / 200)); // Max 50
  const streakMul = Math.min(1.5, 1 + 0.1 * Math.max(0, streak - 1));
  return Math.round((base + timeBonus) * streakMul);
};

export const startSession = action({
  args: { category: v.string() },
  handler: async (ctx, { category }) => {
    const userId = await getUserId(ctx);

    // Fetch a pool of questions for the given category.
    // In a real app, you might have more sophisticated logic for question selection.
    const pool = await ctx.runQuery(api.questions.getQuestionsByCategory, { category });

    if (pool.length === 0) {
      throw new Error(`No questions found for category: ${category}`);
    }

    // Pick 10 random questions.
    const pick10 = pool.sort(() => Math.random() - 0.5).slice(0, 10).map(q => q._id);

    const sessionId = await ctx.runMutation(api.sessions.createSession, {
      userId,
      category,
      questions: pick10,
    });

    return { sessionId };
  },
});

export const createSession = mutation({
  args: {
    userId: v.id('users'),
    category: v.string(),
    questions: v.array(v.id('questions')),
  },
  handler: async (ctx, { userId, category, questions }) => {
    return await ctx.db.insert('sessions', {
      userId,
      status: 'active',
      mode: 'quick',
      category,
      difficultyCurve: [1, 1, 2, 2, 3, 3, 3, 4, 4, 5], // Example curve
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
  handler: async (ctx, { sessionId }) => {
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
  handler: async (ctx, { sessionId, qid, choiceIndex, ms }) => {
    const question = await ctx.db.get(qid);
    if (!question) {
      throw new Error('Question not found');
    }

    const session = await ctx.db.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
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

    await ctx.db.patch(sessionId, {
      answers: [...session.answers, answer],
      score,
      streak,
    });

    return { correct: isCorrect };
  },
});

export const updateSessionStatus = internalMutation({
  args: {
    sessionId: v.id('sessions'),
    status: v.union(v.literal('active'), v.literal('ended')),
  },
  handler: async (ctx, { sessionId, status }) => {
    await ctx.db.patch(sessionId, {
      status,
      endedAt: status === 'ended' ? Date.now() : undefined,
    });
  },
});

export const endSession = action({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, { sessionId }) => {
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