import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    authId: v.string(),
    nickname: v.string(),
    avatar: v.string(),
    country: v.string(),
    createdAt: v.number(),
  }).index("by_authId", ["authId"]),
  sessions: defineTable({
    userId: v.id("users"),
    status: v.union(v.literal("active"), v.literal("ended")),
    mode: v.string(),
    category: v.string(),
    difficultyCurve: v.array(v.number()),
    questions: v.array(v.id("questions")),
          answers: v.array(v.object({ qid: v.id("questions"), choice: v.number(), correct: v.boolean(), ms: v.number() })),
          score: v.number(),
          streak: v.number(),
          streakDelta: v.number(),
          startedAt: v.number(),
          endedAt: v.optional(v.number()),  }).index("by_user_status", ["userId", "status"]),
  questions: defineTable({
    source: v.union(v.literal("curated"), v.literal("ai")),
    locale: v.string(),
    category: v.string(),
    gradeBand: v.string(),
    stem: v.string(),
    choices: v.array(v.string()),
    answerIndex: v.number(),
    explanation: v.string(),
    difficulty: v.number(),
    flags: v.array(v.string()),
    quality: v.number(),
    createdAt: v.number(),
  }).index("by_category", ["category"]),
  leaderboards: defineTable({
    period: v.string(),
    userId: v.id("users"),
    score: v.number(),
    runs: v.number(),
    updatedAt: v.number(),
  }).index("by_period_user", ["period", "userId"])
    .index("by_period_score", ["period", "score"]),
  inventories: defineTable({
    userId: v.id("users"),
    coins: v.number(),
    boosts: v.object({
      skip: v.number(), fifty: v.number(), hint: v.number()
    }),
    premium: v.boolean(),
    seasonPass: v.optional(v.string())
  }),
  purchases: defineTable({
    userId: v.id("users"),
    sku: v.string(),
    priceKRW: v.number(),
    platform: v.string(),
    receipt: v.string(),
    createdAt: v.number(),
  }),
  reports: defineTable({
    userId: v.id("users"),
    qid: v.id("questions"),
    reason: v.string(),
    note: v.optional(v.string()),
    createdAt: v.number(),
    resolved: v.boolean(),
  }),
  ai_prompts: defineTable({
    type: v.string(),
    input: v.string(),
    output: v.string(),
    model: v.string(),
    createdAt: v.number(),
    traceId: v.string(),
  })
});