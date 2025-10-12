import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const CATEGORY_ENUM = v.union(
  v.literal("tech"),
  v.literal("series"),
  v.literal("music"),
  v.literal("fashion"),
  v.literal("movie"),
  v.literal("sports"),
  v.literal("meme")
);

const CHOICE_SHAPE = v.object({
  id: v.string(),
  text: v.string(),
});

const QUESTION_SHAPE = v.object({
  id: v.string(),
  prompt: v.string(),
  choices: v.array(CHOICE_SHAPE),
  answerId: v.string(),
  explanation: v.string(),
  difficulty: v.number(),
});

const SHARE_TEMPLATE_SHAPE = v.object({
  headline: v.string(),
  cta: v.string(),
  emoji: v.string(),
});

function resolveKstDateString(date = new Date()) {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const adjusted = new Date(date.getTime() + KST_OFFSET_MS);
  const year = adjusted.getUTCFullYear();
  const month = `${adjusted.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${adjusted.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const getDailyQuiz = query({
  args: {
    date: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const targetDate = args.date ?? resolveKstDateString();
    const quiz = await ctx.db
      .query("dailyQuizzes")
      .withIndex("by_date", (q) => q.eq("availableDate", targetDate))
      .unique();

    if (!quiz) {
      return null;
    }

    return {
      id: quiz._id,
      availableDate: quiz.availableDate,
      category: quiz.category,
      questions: quiz.questions,
      shareTemplate: quiz.shareTemplate,
    };
  },
});

export const upsertQuiz = mutation({
  args: {
    availableDate: v.string(),
    category: CATEGORY_ENUM,
    questions: v.array(QUESTION_SHAPE),
    shareTemplate: SHARE_TEMPLATE_SHAPE,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dailyQuizzes")
      .withIndex("by_date", (q) => q.eq("availableDate", args.availableDate))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        category: args.category,
        questions: args.questions,
        shareTemplate: args.shareTemplate,
      });
      return existing._id;
    }

    return ctx.db.insert("dailyQuizzes", {
      availableDate: args.availableDate,
      category: args.category,
      questions: args.questions,
      shareTemplate: args.shareTemplate,
    });
  },
});
