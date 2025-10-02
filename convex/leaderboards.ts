import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import dayjs from "dayjs";
import weekOfYear from "dayjs/plugin/weekOfYear";
dayjs.extend(weekOfYear);

export const getWeeklyLeaderboard = query({
  args: { topN: v.optional(v.number()) },
  handler: async (ctx, { topN = 100 }) => {
    const week = dayjs().week();
    const year = dayjs().year();
    const period = `weekly:${year}-${week}`;

    const leaderboard = await ctx.db
      .query("leaderboards")
      .withIndex("by_period_score", (q) => q.eq("period", period))
      .order("desc")
      .take(topN);

    const users = await Promise.all(
      leaderboard.map((entry) => ctx.db.get(entry.userId))
    );

    return leaderboard.map((entry, i) => ({
      ...entry,
      user: users[i],
    }));
  },
});

export const updateLeaderboard = internalMutation({
  args: {
    userId: v.id("users"),
    score: v.number(),
  },
  handler: async (ctx, { userId, score }) => {
    const week = dayjs().week();
    const year = dayjs().year();
    const period = `weekly:${year}-${week}`;

    const existingEntry = await ctx.db
      .query("leaderboards")
      .withIndex("by_period_user", (q) =>
        q.eq("period", period).eq("userId", userId)
      )
      .unique();

    if (existingEntry) {
      if (score > existingEntry.score) {
        await ctx.db.patch(existingEntry._id, {
          score,
          runs: existingEntry.runs + 1,
          updatedAt: Date.now(),
        });
      } else {
        await ctx.db.patch(existingEntry._id, {
          runs: existingEntry.runs + 1,
          updatedAt: Date.now(),
        });
      }
    } else {
      await ctx.db.insert("leaderboards", {
        period,
        userId,
        score,
        runs: 1,
        updatedAt: Date.now(),
      });
    }
  },
});
