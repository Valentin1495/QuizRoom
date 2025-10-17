import { v } from "convex/values";
import { type Doc } from "../_generated/dataModel";
import { mutation, type MutationCtx } from "../_generated/server";

export const upsertQuestionByPromptHash = mutation({
    args: {
        promptHash: v.string(),
        doc: v.object({
            deckId: v.id("decks"),
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
            createdAt: v.number(),
            qualityScore: v.number(),
            elo: v.number(),
            choiceShuffleSeed: v.number(),
        }),
        allowDuplicate: v.optional(v.boolean()), // 기본 false
        upsert: v.optional(v.boolean()),         // 기본 true
    },
    handler: async (ctx: MutationCtx, args) => {
        const allowDup = args.allowDuplicate ?? false;
        const upsert = args.upsert ?? true;

        const existing = await ctx.db
            .query("questions")
            .withIndex("by_promptHash", (q) => q.eq("promptHash", args.promptHash))
            .first();

        if (existing) {
            if (!allowDup && !upsert) return { updated: 0, inserted: 0, skipped: 1 };
            if (upsert) {
                await ctx.db.patch(existing._id, { ...args.doc, promptHash: args.promptHash } as Partial<Doc<"questions">>);
                return { updated: 1, inserted: 0, skipped: 0 };
            } else {
                return { updated: 0, inserted: 0, skipped: 1 };
            }
        }

        await ctx.db.insert("questions", { ...args.doc, promptHash: args.promptHash } as any);
        return { updated: 0, inserted: 1, skipped: 0 };
    },
});
