import { v } from "convex/values";
import { mutation } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { ensureAuthedUser } from "../lib/auth";
import { PARTY_DECK_DEFINITIONS } from "../../constants/party-decks";

function uniqueQuestionIds(ids: Id<"questions">[]): Id<"questions">[] {
    const seen = new Set<string>();
    const result: Id<"questions">[] = [];
    for (const id of ids) {
        const key = id as string;
        if (!seen.has(key)) {
            seen.add(key);
            result.push(id);
        }
    }
    return result;
}

export const seedPartyDecks = mutation({
    args: {
        dryRun: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        await ensureAuthedUser(ctx);
        const now = Date.now();
        const existingDecks = await ctx.db.query("partyDecks").collect();
        const existingBySlug = new Map(existingDecks.map((deck) => [deck.slug, deck]));
        const seen = new Set<string>();
        const changes: {
            slug: string;
            questionCount: number;
            action: "created" | "updated" | "disabled" | "skipped";
            reason?: string;
        }[] = [];

        for (const def of PARTY_DECK_DEFINITIONS) {
            const fetchLimit = def.questionLimit ?? 120;
            const perCategoryFetch = Math.max(Math.ceil(fetchLimit * 1.5 / def.sourceCategories.length), 30);
            const pool: Id<"questions">[] = [];

            for (const category of def.sourceCategories) {
                const docs = await ctx.db
                    .query("questions")
                    .withIndex("by_category_createdAt", (q) => q.eq("category", category))
                    .order("desc")
                    .take(perCategoryFetch);
                docs.forEach((doc) => {
                    if (doc) {
                        pool.push(doc._id);
                    }
                });
            }

            let questionIds = uniqueQuestionIds(pool);
            for (let i = questionIds.length - 1; i > 0; i -= 1) {
                const j = Math.floor(Math.random() * (i + 1));
                [questionIds[i], questionIds[j]] = [questionIds[j], questionIds[i]];
            }
            questionIds = questionIds.slice(0, Math.min(fetchLimit, questionIds.length));

            const actionBase = existingBySlug.has(def.slug) ? "updated" : "created";
            seen.add(def.slug);

            if (questionIds.length === 0) {
                changes.push({
                    slug: def.slug,
                    questionCount: 0,
                    action: "skipped",
                    reason: "NO_QUESTIONS",
                });
                continue;
            }

            if (!args.dryRun) {
                const payload = {
                    slug: def.slug,
                    title: def.title,
                    emoji: def.emoji,
                    description: def.description,
                    sourceCategories: def.sourceCategories,
                    questionIds,
                    totalQuestions: questionIds.length,
                    isActive: def.isActive ?? true,
                    updatedAt: now,
                };
                const existing = existingBySlug.get(def.slug);
                if (existing) {
                    await ctx.db.patch(existing._id, payload);
                } else {
                    await ctx.db.insert("partyDecks", {
                        ...payload,
                        createdAt: now,
                    });
                }
            }

            changes.push({
                slug: def.slug,
                questionCount: questionIds.length,
                action: actionBase,
            });
        }

        for (const deck of existingDecks) {
            if (seen.has(deck.slug)) {
                continue;
            }
            if (!args.dryRun) {
                await ctx.db.patch(deck._id, {
                    isActive: false,
                    updatedAt: now,
                });
            }
            changes.push({
                slug: deck.slug,
                questionCount: deck.totalQuestions,
                action: "disabled",
            });
        }

        return { changes, dryRun: args.dryRun ?? false, total: changes.length };
    },
});
