import { v } from "convex/values";
import { mutation, MutationCtx, query } from "./_generated/server";
import { ensureAuthedUser } from "./lib/auth";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
function getKstDateKey(ts: number = Date.now()): string {
  const kstMs = ts + KST_OFFSET_MS;
  return new Date(kstMs).toISOString().slice(0, 10); // YYYY-MM-DD
}
function diffDays(from?: string | null, to?: string | null): number | null {
  if (!from || !to) return null;
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) return null;
  return Math.floor((toMs - fromMs) / (24 * 60 * 60 * 1000));
}

// XP -> 레벨 변환 함수
export function calculateLevel(xp: number): { 
  level: number; 
  current: number; 
  next: number; 
  progress: number;
  totalXpForLevel: number;
} {
  let level = 1;
  let totalXp = 0;
  
  // 레벨당 필요 XP: 100 * level^1.5
  while (totalXp + Math.floor(100 * Math.pow(level, 1.5)) <= xp) {
    totalXp += Math.floor(100 * Math.pow(level, 1.5));
    level++;
  }
  
  const current = xp - totalXp;
  const next = Math.floor(100 * Math.pow(level, 1.5));
  const progress = Math.min(100, Math.round((current / next) * 100));
  
  return { level, current, next, progress, totalXpForLevel: totalXp };
}

// 레벨별 타이틀
export function getLevelTitle(level: number): string {
  if (level >= 60) return '챌린저';
  if (level >= 50) return '그랜드 마스터';
  if (level >= 40) return '마스터';
  if (level >= 30) return '다이아몬드';
  if (level >= 20) return '플래티넘';
  if (level >= 15) return '골드';
  if (level >= 10) return '실버';
  if (level >= 5) return '브론즈';
  return '아이언';
}

export const ensureSelf = mutation({
  args: {},
  handler: async (ctx) => {
    const { user, auth } = await ensureAuthedUser(ctx);
    const levelInfo = calculateLevel(user.xp);

    return {
      userId: user._id,
      handle: user.handle,
      avatarUrl: user.avatarUrl,
      provider: auth.provider,
      streak: user.streak,
      xp: user.xp,
      level: levelInfo.level,
      levelProgress: levelInfo.progress,
      levelTitle: getLevelTitle(levelInfo.level),
      xpToNextLevel: levelInfo.next - levelInfo.current,
      interests: user.interests,
      totalCorrect: user.totalCorrect,
      totalPlayed: user.totalPlayed,
    };
  },
});

export const getSelfStats = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await ensureAuthedUser(ctx as MutationCtx);
    const levelInfo = calculateLevel(user.xp);
    return {
      streak: user.streak,
      xp: user.xp,
      level: levelInfo.level,
      levelProgress: levelInfo.progress,
      levelTitle: getLevelTitle(levelInfo.level),
      xpCurrent: levelInfo.current,
      xpNext: levelInfo.next,
      totalCorrect: user.totalCorrect,
      totalPlayed: user.totalPlayed,
    };
  },
});

export const updateStats = mutation({
  args: {
    correct: v.number(),
  },
  handler: async (ctx, { correct }) => {
    const { user } = await ensureAuthedUser(ctx as MutationCtx);

    await ctx.db.patch(user._id, {
      xp: user.xp + correct * 10,
      totalCorrect: user.totalCorrect + correct,
      totalPlayed: user.totalPlayed + 5,
    });
  },
});

export const logStreakProgress = mutation({
  args: {
    mode: v.union(v.literal("daily"), v.literal("swipe"), v.literal("live_match")),
    answered: v.optional(v.number()),
    dateKey: v.optional(v.string()),
  },
  handler: async (ctx, { mode, answered, dateKey }) => {
    const { user } = await ensureAuthedUser(ctx as MutationCtx);
    const today = dateKey ?? getKstDateKey();
    const lastDate = user.lastStreakDate ?? null;

    if (mode === "swipe" && (answered ?? 0) < 20) {
      return { updated: false, reason: "insufficient_swipe_answers", streak: user.streak };
    }

    if (lastDate === today) {
      return { updated: false, reason: "already_logged", streak: user.streak };
    }

    const delta = diffDays(lastDate, today);
    const nextStreak = delta === 1 ? user.streak + 1 : 1;

    await ctx.db.patch(user._id, {
      streak: nextStreak,
      lastStreakDate: today,
    });

    return { updated: true, streak: nextStreak, lastDate, date: today };
  },
});

export const resetSelf = mutation({
  args: {},
  handler: async (ctx) => {
    const { user } = await ensureAuthedUser(ctx);
    await ctx.db.delete(user._id);
  },
});
