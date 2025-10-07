import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { ensureAuthedUser, getAuthedUser } from "./lib/auth";
import type { MutationCtx } from "./_generated/server";

const PARTY_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generatePartyCode(length = 5) {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(Math.random() * PARTY_CODE_CHARS.length);
    code += PARTY_CODE_CHARS[idx];
  }
  return code;
}

async function isCodeAvailable(ctx: MutationCtx, code: string) {
  const existing = await ctx.db
    .query("matches")
    .withIndex("by_code", (q) => q.eq("code", code))
    .unique();
  return !existing;
}

export const createParty = mutation({
  args: {
    deckId: v.id("decks"),
  },
  handler: async (ctx, args) => {
    const { user } = await ensureAuthedUser(ctx);

    let code: string | null = null;
    for (let i = 0; i < 5; i += 1) {
      const candidate = generatePartyCode();
      const available = await isCodeAvailable(ctx, candidate);
      if (available) {
        code = candidate;
        break;
      }
    }
    if (!code) {
      throw new ConvexError("FAILED_TO_ALLOCATE_CODE");
    }

    const now = Date.now();
    const matchId = await ctx.db.insert("matches", {
      mode: "party",
      hostId: user._id,
      deckId: args.deckId,
      startedAt: now,
      code,
    });

    await ctx.db.insert("matchPlayers", {
      matchId,
      userId: user._id,
      score: 0,
      correct: 0,
      timeMs: 0,
      reactions: [],
      joinedAt: now,
    });

    return { matchId, code };
  },
});

export const joinByCode = mutation({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await ensureAuthedUser(ctx);
    const code = args.code.trim().toUpperCase();
    const match = await ctx.db
      .query("matches")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();

    if (!match) {
      throw new ConvexError("MATCH_NOT_FOUND");
    }
    if (match.endedAt) {
      throw new ConvexError("MATCH_ENDED");
    }

    const alreadyJoined = await ctx.db
      .query("matchPlayers")
      .withIndex("by_match", (q) => q.eq("matchId", match._id))
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first();

    if (!alreadyJoined) {
      await ctx.db.insert("matchPlayers", {
        matchId: match._id,
        userId: user._id,
        score: 0,
        correct: 0,
        timeMs: 0,
        reactions: [],
        joinedAt: Date.now(),
      });
    }

    return { matchId: match._id, deckId: match.deckId };
  },
});

export const liveLeaderboard = query({
  args: {
    matchId: v.id("matches"),
  },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) {
      throw new ConvexError("MATCH_NOT_FOUND");
    }

    const { user } = await getAuthedUser(ctx);

    const hostOrParticipant = await ctx.db
      .query("matchPlayers")
      .withIndex("by_match", (q) => q.eq("matchId", match._id))
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first();

    if (!hostOrParticipant && match.hostId !== user._id) {
      throw new ConvexError("NOT_AUTHORIZED_FOR_LEADERBOARD");
    }

    const players = await ctx.db
      .query("matchPlayers")
      .withIndex("by_match", (q) => q.eq("matchId", match._id))
      .collect();

    const leaderboard = await Promise.all(
      players.map(async (player) => {
        const profile = await ctx.db.get(player.userId);
        return {
          id: player._id,
          userId: player.userId,
          handle: profile?.handle ?? "unknown",
          avatarUrl: profile?.avatarUrl,
          score: player.score,
          correct: player.correct,
          timeMs: player.timeMs,
          reactions: player.reactions,
        };
      })
    );

    leaderboard.sort((a, b) => {
      if (b.score === a.score) {
        return a.timeMs - b.timeMs;
      }
      return b.score - a.score;
    });

    return {
      match: {
        id: match._id,
        mode: match.mode,
        deckId: match.deckId,
        hostId: match.hostId,
        code: match.code,
        startedAt: match.startedAt,
        endedAt: match.endedAt,
      },
      leaderboard,
    };
  },
});
