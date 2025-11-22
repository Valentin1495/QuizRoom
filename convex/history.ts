import { v } from "convex/values";

import { mutation, MutationCtx, query } from "./_generated/server";
import { ensureAuthedUser } from "./lib/auth";

const dailyHistoryInput = v.object({
  date: v.string(),
  correct: v.number(),
  total: v.number(),
  timerMode: v.optional(v.string()),
  durationMs: v.optional(v.number()),
  category: v.optional(v.string()),
});

const swipeHistoryInput = v.object({
  category: v.string(),
  tags: v.optional(v.array(v.string())),
  answered: v.number(),
  correct: v.number(),
  maxStreak: v.number(),
  avgResponseMs: v.number(),
  totalScoreDelta: v.number(),
});

const liveMatchHistoryInput = v.object({
  deckSlug: v.optional(v.string()),
  deckTitle: v.optional(v.string()),
  roomCode: v.optional(v.string()),
  rank: v.optional(v.number()),
  totalParticipants: v.optional(v.number()),
  totalScore: v.number(),
  answered: v.optional(v.number()),
  correct: v.optional(v.number()),
});

const historyLogArgs = v.object({
  mode: v.union(v.literal("daily"), v.literal("swipe"), v.literal("live_match")),
  sessionId: v.string(),
  data: v.union(dailyHistoryInput, swipeHistoryInput, liveMatchHistoryInput),
});

export const logEntry = mutation({
  args: historyLogArgs,
  handler: async (ctx, args) => {
    const { user } = await ensureAuthedUser(ctx as MutationCtx);
    const now = Date.now();
    const data = args.data;

    const existing = await ctx.db
      .query("quizHistory")
      .withIndex("by_user_mode_session", (q) =>
        q.eq("userId", user._id).eq("mode", args.mode).eq("sessionId", args.sessionId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        payload: data,
        createdAt: now,
      });
      return existing._id;
    }

    return ctx.db.insert("quizHistory", {
      userId: user._id,
      mode: args.mode,
      sessionId: args.sessionId,
      createdAt: now,
      payload: data,
    });
  },
});

export const listHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await ensureAuthedUser(ctx as MutationCtx);
    const limit = Math.max(1, Math.min(args.limit ?? 10, 50));

    const fetchMode = async (mode: "daily" | "swipe" | "live_match") =>
      ctx.db
        .query("quizHistory")
        .withIndex("by_user_mode_createdAt", (q) => q.eq("userId", user._id).eq("mode", mode))
        .order("desc")
        .take(limit);

    const [daily, swipe, liveMatch] = await Promise.all([
      fetchMode("daily"),
      fetchMode("swipe"),
      fetchMode("live_match"),
    ]);

    return {
      daily,
      swipe,
      liveMatch,
    };
  },
});
