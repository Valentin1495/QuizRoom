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

const matchStateEnum = v.union(
  v.literal("lobby"),
  v.literal("in_progress"),
  v.literal("finished")
);

const partyStatusEnum = v.union(
  v.literal("lobby"),
  v.literal("countdown"),
  v.literal("question"),
  v.literal("grace"),
  v.literal("reveal"),
  v.literal("leaderboard"),
  v.literal("results"),
  v.literal("paused")
);

const partyRules = v.object({
  rounds: v.number(),
  readSeconds: v.number(),
  answerSeconds: v.number(),
  graceSeconds: v.number(),
  revealSeconds: v.number(),
  leaderboardSeconds: v.number(),
});

const partyActionType = v.union(
  v.literal("start"),
  v.literal("rematch"),
  v.literal("toLobby")
);

const partyPendingAction = v.object({
  type: partyActionType,
  executeAt: v.number(),
  delayMs: v.number(),
  createdAt: v.number(),
  initiatedBy: v.id("users"),
  label: v.string(),
});

const partyPauseState = v.object({
  previousStatus: partyStatusEnum,
  remainingMs: v.optional(v.number()),
  pausedAt: v.number(),
});

const dailyCategoryEnum = v.union(
  v.literal("tech"),
  v.literal("series"),
  v.literal("music"),
  v.literal("fashion"),
  v.literal("movie"),
  v.literal("sports"),
  v.literal("meme")
);

const dailyChoice = v.object({
  id: v.string(),
  text: v.string(),
});

const dailyQuestion = v.object({
  id: v.string(),
  prompt: v.string(),
  choices: v.array(dailyChoice),
  answerId: v.string(),
  explanation: v.string(),
  difficulty: v.number(),
});

const dailyShareTemplate = v.object({
  headline: v.string(),
  cta: v.string(),
  emoji: v.string(),
});

export default defineSchema({
  users: defineTable({
    identityId: v.string(),
    provider: v.string(),
    handle: v.string(),
    avatarUrl: v.optional(v.string()),
    interests: v.array(v.string()),
    streak: v.number(),
    xp: v.number(),
    totalCorrect: v.number(),
    totalPlayed: v.number(),
    cosmetics: v.array(v.string()),
    createdAt: v.number(),
    skill: v.optional(
      v.object({
        global: v.number(),
        tags: v.array(
          v.object({
            tag: v.string(),
            rating: v.number(),
          })
        ),
      })
    ),
    sessionPref: v.optional(
      v.object({
        swipe: v.optional(
          v.object({
            lastCursor: v.optional(v.number()),
            excludeIds: v.optional(v.array(v.id("questions"))),
            updatedAt: v.optional(v.number()),
            category: v.optional(v.string()),
          })
        ),
      })
    ),
  })
    .index("by_identity", ["identityId"])
    .index("by_handle", ["handle"]),

  categories: defineTable({
    slug: v.string(),
    title: v.string(),
    emoji: v.string(),
    description: v.string(),
    sampleTags: v.optional(v.array(v.string())),
    neighbors: v.optional(
      v.array(
        v.object({
          slug: v.string(),
          weight: v.number(),
        })
      )
    ),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_createdAt", ["createdAt"]),

  decks: defineTable({
    slug: v.string(),
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
    .index("by_slug", ["slug"])
    .index("by_author", ["authorId"])
    .index("by_status", ["status"])
    .index("by_visibility", ["visibility"]),

  questions: defineTable({
    deckId: v.id("decks"),
    category: v.string(),
    type: questionTypeEnum,
    prompt: v.string(),
    promptHash: v.string(), // ✅ 추가: 정규화된 prompt 해시 (sha256 hex)
    mediaUrl: v.optional(v.string()),
    mediaMeta: v.optional(v.object({
      aspect: v.optional(v.string()),        // "16:9" | "1:1" 등
      width: v.optional(v.number()),
      height: v.optional(v.number()),
    })),
    tags: v.optional(v.array(v.string())),
    choices: v.array(v.object({ id: v.string(), text: v.string() })),
    answerIndex: v.number(),
    explanation: v.optional(v.string()),
    difficulty: v.number(),
    createdAt: v.number(),
    qualityScore: v.optional(v.number()),
    elo: v.optional(v.number()),
    choiceShuffleSeed: v.optional(v.number()),
  })
    .index("by_deck", ["deckId"])
    .index("by_category_createdAt", ["category", "createdAt"])
    .index("by_elo_createdAt", ["elo", "createdAt"])
    .index("by_createdAt", ["createdAt"])
    .index("by_promptHash", ["promptHash"]),


  matches: defineTable({
    mode: matchModeEnum,
    hostId: v.id("users"),
    deckId: v.optional(v.id("decks")),
    state: matchStateEnum,
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    code: v.optional(v.string()),
  })
    .index("by_deck", ["deckId"])
    .index("by_code", ["code"]),

  matchPlayers: defineTable({
    matchId: v.id("matches"),
    userId: v.id("users"),
    identityId: v.string(),
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
    .index("by_user", ["userId"])
    .index("by_identity", ["matchId", "identityId"]),

  partyRooms: defineTable({
    code: v.string(),
    hostId: v.id("users"),
    status: partyStatusEnum,
    deckId: v.optional(v.id("decks")),
    rules: partyRules,
    currentRound: v.number(),
    totalRounds: v.number(),
    serverNow: v.optional(v.number()),
    phaseEndsAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    version: v.number(),
    createdAt: v.number(),
    pendingAction: v.optional(partyPendingAction),
    pauseState: v.optional(partyPauseState),
  })
    .index("by_code", ["code"])
    .index("by_host", ["hostId"]),

  partyParticipants: defineTable({
    roomId: v.id("partyRooms"),
    userId: v.id("users"),
    identityId: v.string(),
    nickname: v.string(),
    isHost: v.boolean(),
    joinedAt: v.number(),
    lastSeenAt: v.number(),
    totalScore: v.number(),
    avgResponseMs: v.number(),
    answers: v.number(),
    removedAt: v.optional(v.number()),
    disconnectedAt: v.optional(v.number()),
  })
    .index("by_room", ["roomId"])
    .index("by_room_user", ["roomId", "userId"]),

  partyRounds: defineTable({
    roomId: v.id("partyRooms"),
    index: v.number(),
    questionId: v.id("questions"),
    startedAt: v.number(),
    closedAt: v.optional(v.number()),
    revealAt: v.optional(v.number()),
  })
    .index("by_room", ["roomId"])
    .index("by_room_index", ["roomId", "index"]),

  partyAnswers: defineTable({
    roomId: v.id("partyRooms"),
    roundIndex: v.number(),
    userId: v.id("users"),
    choiceIndex: v.number(),
    receivedAt: v.number(),
    isCorrect: v.boolean(),
    scoreDelta: v.number(),
  })
    .index("by_room_round", ["roomId", "roundIndex"])
    .index("by_room_user", ["roomId", "userId"])
    .index("by_room_user_round", ["roomId", "userId", "roundIndex"]),

  partyLogs: defineTable({
    roomId: v.id("partyRooms"),
    type: v.string(),
    payload: v.any(),
    createdAt: v.number(),
  }).index("by_room", ["roomId"]),

  reports: defineTable({
    deckId: v.id("decks"),
    questionId: v.optional(v.id("questions")),
    reporterId: v.id("users"),
    reason: v.string(),
    note: v.optional(v.string()),
    createdAt: v.number(),
    resolved: v.boolean(),
  })
    .index("by_deck", ["deckId"])
    .index("by_question", ["questionId"])
    .index("by_reporter", ["reporterId"]),

  dailyQuizzes: defineTable({
    availableDate: v.string(),
    category: dailyCategoryEnum,
    questions: v.array(dailyQuestion),
    shareTemplate: dailyShareTemplate,
  }).index("by_date", ["availableDate"]),

  answers: defineTable({
    userId: v.id("users"),
    questionId: v.id("questions"),
    category: v.string(),
    tags: v.optional(v.array(v.string())),
    choiceId: v.string(),
    answerToken: v.string(),
    isCorrect: v.boolean(),
    timeMs: v.number(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_question", ["questionId", "createdAt"])
    .index("by_user_question", ["userId", "questionId"]),

  user_skill: defineTable({
    userId: v.id("users"),
    key: v.string(),          // "category:kpop_music" or "tag:아이브"
    elo: v.number(),          // 기본 1200
    updatedAt: v.number(),
  }).index("by_user_key", ["userId", "key"]),

  bookmarks: defineTable({
    userId: v.id("users"),
    questionId: v.id("questions"),
    createdAt: v.number(),
  })
    .index("by_user_question", ["userId", "questionId"])
    .index("by_user_created", ["userId", "createdAt"]),

  tag_index: defineTable({
    tag: v.string(),
    questionId: v.id("questions"),
    category: v.string(),
    createdAt: v.number(),
  })
    .index("by_tag_createdAt", ["tag", "createdAt"])
    .index("by_tag_category", ["tag", "category"])
});
