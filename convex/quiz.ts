import { v } from 'convex/values';
import { mutation } from './_generated/server';

export const startSession = mutation({
  args: { setId: v.id('dailySets'), userId: v.id('users') },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error('User not found');

    const baseAllowance = { hint: 1, pass: 1 } as const;
    const inventory = user.helperInventory ?? {
      hint: 0,
      pass: 0,
      lastDailyGrant: undefined,
      rewardCooldowns: undefined,
    };

    const allowance = {
      hint: baseAllowance.hint + Math.max(0, inventory.hint ?? 0),
      pass: baseAllowance.pass + Math.max(0, inventory.pass ?? 0),
    } as const;

    const sid = await ctx.db.insert('sessions', {
      ...args,
      answers: [],
      score: 0,
      hintsUsed: 0,
      passesUsed: 0,
      helperAllowance: allowance,
      status: 'active',
      startedAt: Date.now(),
    });

    await ctx.db.patch(args.userId, {
      helperInventory: {
        hint: Math.max(0, (inventory.hint ?? 0) - (allowance.hint - baseAllowance.hint)),
        pass: Math.max(0, (inventory.pass ?? 0) - (allowance.pass - baseAllowance.pass)),
        lastDailyGrant: inventory.lastDailyGrant,
        rewardCooldowns: inventory.rewardCooldowns,
      },
    });

    return { sessionId: sid, allowance } as const;
  },
});

export const submitAnswer = mutation({
  args: {
    sessionId: v.id('sessions'),
    qid: v.id('questionBank'),
    choiceId: v.string(),
    elapsedMs: v.number(),
    usedHint: v.optional(v.boolean()),
  },
  handler: async (ctx, { sessionId, qid, choiceId, elapsedMs, usedHint }) => {
    const s = await ctx.db.get(sessionId);
    if (!s || s.status !== 'active') throw new Error('Invalid session');
    const q = await ctx.db.get(qid);
    if (!q) throw new Error('Invalid question');

    const allowance = s.helperAllowance ?? { hint: 1, pass: 1 };
    const passesUsed = s.passesUsed ?? 0;

    if (choiceId === '__PASS__') {
      if (passesUsed >= allowance.pass) throw new Error('No pass cards remaining');
      const updatedAnswers = [...s.answers, { qid, choiceId: 'pass', elapsedMs, correct: false, helperType: 'pass' as const }];
      await ctx.db.patch(sessionId, {
        answers: updatedAnswers,
        passesUsed: passesUsed + 1,
      });
      return { correct: false, score: s.score, helperType: 'pass' as const } as const;
    }

    let correct = (q as any).answerId === choiceId;
    const base = correct ? 100 : 0;
    const bonus = correct ? Math.max(0, Math.floor((10000 - elapsedMs) / 200)) : 0; // ~0..50
    const newScore = s.score + base + bonus;
    await ctx.db.patch(sessionId, {
      score: newScore,
      answers: [
        ...s.answers,
        {
          qid,
          choiceId,
          elapsedMs,
          correct,
          helperType: usedHint ? ('hint' as const) : undefined,
        },
      ],
    });
    return { correct, score: newScore, helperType: usedHint ? ('hint' as const) : undefined } as const;
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

export const consumeHint = mutation({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, { sessionId }) => {
    const s = await ctx.db.get(sessionId);
    if (!s || s.status !== 'active') throw new Error('Invalid session');
    const allowance = s.helperAllowance ?? { hint: 1, pass: 1 };
    const hintsUsed = s.hintsUsed ?? 0;
    if (hintsUsed >= allowance.hint) throw new Error('No hint cards remaining');
    await ctx.db.patch(sessionId, { hintsUsed: hintsUsed + 1 });
    return { remaining: allowance.hint - (hintsUsed + 1), total: allowance.hint } as const;
  },
});
