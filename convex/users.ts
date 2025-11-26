import { v } from "convex/values";
import { mutation, MutationCtx, query } from "./_generated/server";
import { ensureAuthedUser } from "./lib/auth";

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
      streak: user.streak + 1,
      xp: user.xp + correct * 10,
      totalCorrect: user.totalCorrect + correct,
      totalPlayed: user.totalPlayed + 5,
    });
  },
});

export const resetSelf = mutation({
  args: {},
  handler: async (ctx) => {
    const { user } = await ensureAuthedUser(ctx);
    await ctx.db.delete(user._id);
  },
});
