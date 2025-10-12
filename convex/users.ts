import { v } from "convex/values";
import { mutation, MutationCtx, query } from "./_generated/server";
import { ensureAuthedUser } from "./lib/auth";

export const ensureSelf = mutation({
  args: {},
  handler: async (ctx) => {
    const { user, auth } = await ensureAuthedUser(ctx);

    return {
      userId: user._id,
      handle: user.handle,
      avatarUrl: user.avatarUrl,
      provider: auth.provider,
      streak: user.streak,
      xp: user.xp,
      interests: user.interests,
      totalCorrect: user.totalCorrect,
      totalPlayed: user.totalPlayed,
    };
  },
});

export const getSelfStats = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await ensureAuthedUser(ctx as MutationCtx);
    return {
      streak: user.streak,
      xp: user.xp,
      totalCorrect: user.totalCorrect,
      totalPlayed: user.totalPlayed,
    };
  },
});

export const updateStats = mutation({
  args: {
    correct: v.number(),
  },
  handler: async (ctx, { correct }) => {
    const { user } = await ensureAuthedUser(ctx as MutationCtx);

    await ctx.db.patch(user._id, {
      streak: user.streak + 1,
      xp: user.xp + correct * 10,
      totalCorrect: user.totalCorrect + correct,
      totalPlayed: user.totalPlayed + 5,
    });
  },
});

export const resetSelf = mutation({
  args: {},
  handler: async (ctx) => {
    const { user } = await ensureAuthedUser(ctx);
    await ctx.db.delete(user._id);
  },
});
