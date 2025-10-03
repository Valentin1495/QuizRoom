import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";

type BoostType = "skip" | "fifty" | "hint";

type UseBoostResult =
    | { success: true; toRemove: number[] }
    | { success: true; hint: string }
    | { success: true; skipped: true }
    | { success: true };

export const useBoost = action({
    args: {
        sessionId: v.id("sessions"),
        boostType: v.union(v.literal("skip"), v.literal("fifty"), v.literal("hint")),
        questionId: v.id("questions"),
    },
    handler: async (ctx, { sessionId, boostType, questionId }): Promise<UseBoostResult> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("User not authenticated");
        }

        const user: Doc<'users'> | null = await ctx.runQuery(api.users.getUser, {});
        if (!user) {
            throw new Error("User not found");
        }

        const inventory: Doc<'inventories'> | null = await ctx.runQuery(api.inventories.getInventory, {});
        if (!inventory) {
            throw new Error("Inventory not found");
        }

        if (inventory.boosts[boostType as BoostType] <= 0) {
            throw new Error("Not enough boosts");
        }

        await ctx.runMutation(internal.inventories.decrementBoost, {
            boostType: boostType as BoostType,
        });

        if (boostType === "fifty") {
            const question: Doc<'questions'> | null = await ctx.runQuery(api.questions.getQuestion, { questionId: questionId as Id<'questions'> });
            if (!question) {
                throw new Error("Question not found");
            }

            const answerIndex: number = question.answerIndex;
            const choices: string[] = question.choices as string[];
            const incorrectChoices: number[] = choices
                .map((_: string, index: number) => index)
                .filter((index: number) => index !== answerIndex);

            // Shuffle incorrect choices and pick two to remove
            incorrectChoices.sort(() => Math.random() - 0.5);
            const toRemove: number[] = [incorrectChoices[0], incorrectChoices[1]];

            return { success: true, toRemove };
        }

        if (boostType === "hint") {
            const question: Doc<'questions'> | null = await ctx.runQuery(api.questions.getQuestion, { questionId: questionId as Id<'questions'> });
            if (!question) {
                throw new Error("Question not found");
            }
            // Return a portion of the explanation as a hint
            const hint: string = (question.explanation ?? "").substring(0, 50) + "...";
            return { success: true, hint };
        }

        if (boostType === "skip") {
            await ctx.runMutation(internal.sessions.skipQuestion, {
                sessionId: sessionId as Id<'sessions'>,
                questionId: questionId as Id<'questions'>,
            });
            return { success: true, skipped: true };
        }


        return { success: true };
    },
});
