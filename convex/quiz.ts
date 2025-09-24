import { v } from 'convex/values';
import { mutation } from './_generated/server';

export const startSession = mutation({
  args: { setId: v.id('dailySets'), userId: v.id('users') },
  handler: async (ctx, args) => {
    const sid = await ctx.db.insert('sessions', {
      ...args,
      answers: [],
      score: 0,
      hintsUsed: 0,
      status: 'active',
      startedAt: Date.now(),
    });
    return sid;
  },
});

export const submitAnswer = mutation({
  args: {
    sessionId: v.id('sessions'),
    qid: v.id('questionBank'),
    choiceId: v.string(),
    elapsedMs: v.number(),
  },
  handler: async (ctx, { sessionId, qid, choiceId, elapsedMs }) => {
    const s = await ctx.db.get(sessionId);
    if (!s || s.status !== 'active') throw new Error('Invalid session');
    const q = await ctx.db.get(qid);
    if (!q) throw new Error('Invalid question');
    const correct = (q as any).answerId === choiceId;
    const base = correct ? 100 : 0;
    const bonus = correct ? Math.max(0, Math.floor((10000 - elapsedMs) / 200)) : 0; // ~0..50
    const newScore = (s as any).score + base + bonus;
    await ctx.db.patch(sessionId, {
      score: newScore,
      answers: [...(s as any).answers, { qid, choiceId, elapsedMs, correct }],
    });
    return { correct, score: newScore } as const;
  },
});

export const finalize = mutation({
  args: { sessionId: v.id('sessions'), doubleDown: v.boolean() },
  handler: async (ctx, { sessionId, doubleDown }) => {
    const s = await ctx.db.get(sessionId);
    if (!s || (s as any).status !== 'active') throw new Error('Invalid session');
    const answers = (s as any).answers as Array<{ correct: boolean }>;
    const corrects = answers.filter((a) => a.correct).length;
    const baseScore = (s as any).score as number;

    // MVP: double down doubles only if last question correct; else 0
    const allAnswered = answers.length > 0; // guard
    const lastCorrect = allAnswered ? answers[answers.length - 1].correct : false;
    let final = baseScore;
    if (doubleDown) {
      final = lastCorrect ? baseScore * 2 : 0;
    }

    await ctx.db.patch(sessionId, {
      status: 'done',
      finishedAt: Date.now(),
      score: final,
    });

    const date = new Date().toISOString().slice(0, 10);
    await ctx.db.insert('leaderboards', {
      date,
      userId: (s as any).userId,
      score: final,
      handle: 'player',
    });

    return { final } as const;
  },
});
