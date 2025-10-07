import { query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_LIMIT = 20;

export const getFeed = query({
  args: {
    tag: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? DEFAULT_LIMIT, 50));
    const candidates = await ctx.db
      .query("decks")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .take(limit * 4);

    const filtered = candidates
      .filter((deck) => deck.visibility === "public")
      .filter((deck) => {
        if (!args.tag) return true;
        return deck.tags.includes(args.tag.toLowerCase());
      });

    const scored = filtered
      .map((deck) => ({
        deck,
        score: deck.likes * 2 + deck.plays + deck.createdAt / 1_000_000_000,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ deck }) => ({
        ...deck,
        id: deck._id,
      }));

    return scored;
  },
});
