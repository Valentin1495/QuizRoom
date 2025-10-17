import { v } from "convex/values";
import { query } from "./_generated/server";

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

// export const internalSeedTestDeck = internalMutation({
//   args: {},
//   handler: async (ctx) => {
//     const { db } = ctx;
//     const identity = await ctx.auth.getUserIdentity();
//     if (!identity) {
//       throw new Error("Not authenticated");
//     }

//     const user = await db
//       .query("users")
//       .withIndex("by_identity", (q) => q.eq("identityId", identity.tokenIdentifier))
//       .unique();

//     if (!user) {
//       throw new Error("User not found");
//     }

//     const now = Date.now();
//     const deckId = await db.insert("decks", {
//       title: "상식 퀴즈 (테스트용)",
//       description: "개발 테스트를 위해 자동으로 생성된 덱입니다.",
//       tags: ["상식", "테스트"],
//       authorId: user._id,
//       visibility: "public",
//       language: "ko",
//       plays: 0,
//       likes: 0,
//       status: "published",
//       createdAt: now,
//       updatedAt: now,
//     });

//     await db.insert("questions", {
//       deckId,
//       type: "mcq",
//       prompt: "대한민국의 수도는 어디일까요?",
//       choices: [{ id: "a", text: "부산" }, { id: "b", text: "서울" }, { id: "c", text: "인천" }],
//       answerIndex: 1,
//       difficulty: 1,
//       createdAt: now,
//     });

//     await db.insert("questions", {
//       deckId,
//       type: "mcq",
//       prompt: "세상에서 가장 높은 산은 무엇일까요?",
//       choices: [{ id: "a", text: "한라산" }, { id: "b", text: "백두산" }, { id: "c", text: "에베레스트" }],
//       answerIndex: 2,
//       difficulty: 2,
//       createdAt: now,
//     });

//     await db.insert("questions", {
//       deckId,
//       type: "mcq",
//       prompt: "컴퓨터의 두뇌 역할을 하는 핵심 부품은 무엇일까요?",
//       choices: [{ id: "a", "text": "CPU" }, { id: "b", text: "RAM" }, { id: "c", text: "GPU" }],
//       answerIndex: 0,
//       difficulty: 2,
//       createdAt: now,
//     });

//     return { deckId };
//   },
// });

export const getFirstDeck = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("decks").first();
  },
});
