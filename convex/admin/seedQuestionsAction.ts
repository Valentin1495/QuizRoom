
"use node";

import { v } from "convex/values";
import { createHash, randomInt } from "crypto";
import { api } from "../_generated/api";
import { action, type ActionCtx } from "../_generated/server";

function normalizePrompt(p: string) {
  return p.trim().replace(/\s+/g, " ").toLowerCase();
}
function sha256Hex(s: string) {
  return createHash("sha256").update(s).digest("hex");
}
function mapElo(difficulty?: number) {
  const d = typeof difficulty === "number" ? difficulty : 0.5;
  return Math.round(1200 + (d - 0.5) * 800);
}

// ✅ deckId 대신 deckSlug(string)로 받습니다.
const QuestionItem = v.object({
  deckSlug: v.string(),                 // "deck_seed_sports_games"
  category: v.string(),
  type: v.string(),                     // "multiple_choice"
  prompt: v.string(),
  mediaUrl: v.optional(v.string()),
  mediaMeta: v.optional(v.object({
    aspect: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  })),
  tags: v.optional(v.array(v.string())),
  choices: v.array(v.object({ id: v.string(), text: v.string() })),
  answerIndex: v.number(),
  explanation: v.optional(v.string()),
  difficulty: v.number(),
  createdAt: v.optional(v.number()),
  qualityScore: v.optional(v.number()),
  elo: v.optional(v.number()),
  choiceShuffleSeed: v.optional(v.number()),
});

export const seedQuestionsAction = action({
  args: {
    items: v.array(v.object({
      deckSlug: v.string(),
      category: v.string(),
      type: v.string(),
      prompt: v.string(),
      mediaUrl: v.optional(v.string()),
      mediaMeta: v.optional(v.object({
        aspect: v.optional(v.string()),
        width: v.optional(v.number()),
        height: v.optional(v.number()),
      })),
      tags: v.optional(v.array(v.string())),
      choices: v.array(v.object({ id: v.string(), text: v.string() })),
      answerIndex: v.number(),
      explanation: v.optional(v.string()),
      difficulty: v.number(),
      createdAt: v.optional(v.number()),
      qualityScore: v.optional(v.number()),
      elo: v.optional(v.number()),
      choiceShuffleSeed: v.optional(v.number()),
    })),
    // ✅ 덱 생성에 필요한 authorId 등 필수 필드 전달
    authorId: v.id("users"),
    deckVisibility: v.optional(v.union(v.literal("public"), v.literal("unlisted"), v.literal("private"))),
    deckLanguage: v.optional(v.string()),
    deckStatus: v.optional(v.union(v.literal("draft"), v.literal("published"), v.literal("blocked"))),
    deckTags: v.optional(v.array(v.string())),
    deckDescription: v.optional(v.string()),
    allowDuplicatePrompts: v.optional(v.boolean()),
    upsertByPrompt: v.optional(v.boolean()),
  },
  handler: async (ctx: ActionCtx, args) => {
    const allowDup = args.allowDuplicatePrompts ?? false;
    const upsert = args.upsertByPrompt ?? true;
    const now = Math.floor(Date.now() / 1000);

    let inserted = 0, updated = 0, skipped = 0;

    for (const q of args.items) {
      // 1) deckSlug -> deckId 확보 (필수값 함께 전달)
      const deckId = await ctx.runMutation(api.admin.decks.ensureDeckBySlug, {
        slug: q.deckSlug,
        title: q.deckSlug,
        authorId: args.authorId,              // ✅ 필수
        visibility: args.deckVisibility ?? "unlisted",
        language: args.deckLanguage ?? "ko",
        status: args.deckStatus ?? "draft",
        tags: args.deckTags ?? [],
        description: args.deckDescription ?? "",
      });

      // 2) promptHash 생성/업서트 (생략: 이전 답변의 upsert 뮤테이션 호출 코드 그대로)
      const promptHash = createHash("sha256").update(
        q.prompt.trim().replace(/\s+/g, " ").toLowerCase()
      ).digest("hex");

      const doc = {
        deckId,
        category: q.category,
        type: q.type,
        prompt: q.prompt.trim(),
        mediaUrl: q.mediaUrl ?? undefined,
        mediaMeta: q.mediaMeta ?? undefined,
        tags: q.tags ?? [],
        choices: q.choices,
        answerIndex: q.answerIndex,
        explanation: q.explanation ?? "",
        difficulty: q.difficulty,
        createdAt: q.createdAt ?? now,
        qualityScore: typeof q.qualityScore === "number" ? q.qualityScore : 0.5,
        elo: typeof q.elo === "number" ? q.elo : Math.round(1200 + (q.difficulty - 0.5) * 800),
        choiceShuffleSeed: typeof q.choiceShuffleSeed === "number" ? q.choiceShuffleSeed : randomInt(0, 1000),
      };

      const res = await ctx.runMutation(api.admin.upsertMutation.upsertQuestionByPromptHash, {
        promptHash,
        doc: doc as any,
        allowDuplicate: allowDup,
        upsert,
      });

      inserted += res.inserted ?? 0;
      updated += res.updated ?? 0;
      skipped += res.skipped ?? 0;
    }

    return { inserted, updated, skipped, total: args.items.length };
  },
});
