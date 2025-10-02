import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const reportQuestion = mutation({
  args: {
    qid: v.id("questions"),
    reason: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { qid, reason, note }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User is not authenticated");
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found in database");
    }

    await ctx.db.insert("reports", {
      userId: user._id,
      qid,
      reason,
      note,
      createdAt: Date.now(),
      resolved: false,
    });
  },
});
