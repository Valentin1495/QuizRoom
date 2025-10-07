import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const deckVisibilityEnum = v.union(
  v.literal("public"),
  v.literal("unlisted"),
  v.literal("private")
);

const deckStatusEnum = v.union(
  v.literal("draft"),
  v.literal("published"),
  v.literal("blocked")
);

const questionTypeEnum = v.union(
  v.literal("mcq"),
  v.literal("image"),
  v.literal("audio"),
  v.literal("boolean")
);

const matchModeEnum = v.union(
  v.literal("daily"),
  v.literal("swipe"),
  v.literal("party")
);

export default defineSchema({
  users: defineTable({
    identityId: v.string(),
    provider: v.string(),
    handle: v.string(),
    avatarUrl: v.optional(v.string()),
    interests: v.array(v.string()),
    streak: v.number(),
    xp: v.number(),
    cosmetics: v.array(v.string()),
    createdAt: v.number(),
  })
    .index("by_identity", ["identityId"])
    .index("by_handle", ["handle"]),

  decks: defineTable({
    title: v.string(),
    description: v.string(),
    tags: v.array(v.string()),
    authorId: v.id("users"),
    visibility: deckVisibilityEnum,
    language: v.string(),
    plays: v.number(),
    likes: v.number(),
    status: deckStatusEnum,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_author", ["authorId"])
    .index("by_status", ["status"])
    .index("by_visibility", ["visibility"]),

  questions: defineTable({
    deckId: v.id("decks"),
    type: questionTypeEnum,
    prompt: v.string(),
    mediaUrl: v.optional(v.string()),
    choices: v.array(
      v.object({
        id: v.string(),
        text: v.string(),
      })
    ),
    answerIndex: v.number(),
    explanation: v.optional(v.string()),
    difficulty: v.number(),
    createdAt: v.number(),
  }).index("by_deck", ["deckId"]),

  matches: defineTable({
    mode: matchModeEnum,
    hostId: v.id("users"),
    deckId: v.optional(v.id("decks")),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    code: v.optional(v.string()),
  })
    .index("by_deck", ["deckId"])
    .index("by_code", ["code"]),

  matchPlayers: defineTable({
    matchId: v.id("matches"),
    userId: v.id("users"),
    score: v.number(),
    correct: v.number(),
    timeMs: v.number(),
    reactions: v.array(
      v.object({
        type: v.string(),
        atMs: v.number(),
      })
    ),
    joinedAt: v.number(),
  })
    .index("by_match", ["matchId"])
    .index("by_user", ["userId"]),

  reports: defineTable({
    deckId: v.id("decks"),
    questionId: v.optional(v.id("questions")),
    reporterId: v.id("users"),
    reason: v.string(),
    createdAt: v.number(),
    resolved: v.boolean(),
  })
    .index("by_deck", ["deckId"])
    .index("by_question", ["questionId"])
    .index("by_reporter", ["reporterId"]),
});
