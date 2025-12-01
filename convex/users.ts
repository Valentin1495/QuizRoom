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

// 스트릭 보너스 배율 (연속 플레이 일수에 따라 차등)
export function getStreakMultiplier(streak: number): number {
  if (streak >= 7) return 2.0;  // 7일+ 연속: ×2.0
  if (streak >= 6) return 1.8;  // 6일 연속: ×1.8
  if (streak >= 5) return 1.6;  // 5일 연속: ×1.6
  if (streak >= 4) return 1.4;  // 4일 연속: ×1.4
  if (streak >= 3) return 1.25; // 3일 연속: ×1.25
  if (streak >= 2) return 1.1;  // 2일 연속: ×1.1
  return 1.0;                   // 1일 이하: ×1.0
}

// 스트릭 보너스 적용
export function applyStreakBonus(baseXp: number, streak: number): number {
  const multiplier = getStreakMultiplier(streak);
  return Math.round(baseXp * multiplier);
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

// 데일리 퀴즈 XP 상수
const DAILY_XP_PER_CORRECT = 10;    // 정답당 +10 XP
const DAILY_COMPLETION_BONUS = 50;   // 6문제 완료 시 +50 XP
const DAILY_PERFECT_BONUS = 30;      // 6문제 전부 정답 시 추가 +30 XP
const DAILY_TOTAL_QUESTIONS = 6;

export const updateStats = mutation({
  args: {
    correct: v.number(),
    total: v.optional(v.number()), // 총 문제 수 (완료 여부 판단용)
  },
  handler: async (ctx, { correct, total }) => {
    const { user } = await ensureAuthedUser(ctx as MutationCtx);

    // 기본 정답 XP
    let xpGain = correct * DAILY_XP_PER_CORRECT;

    // 완료 보너스 (6문제 모두 풀었을 때)
    const questionsAnswered = total ?? DAILY_TOTAL_QUESTIONS;
    if (questionsAnswered >= DAILY_TOTAL_QUESTIONS) {
      xpGain += DAILY_COMPLETION_BONUS;

      // 퍼펙트 보너스 (6문제 전부 정답)
      if (correct >= DAILY_TOTAL_QUESTIONS) {
        xpGain += DAILY_PERFECT_BONUS;
      }
    }

    await ctx.db.patch(user._id, {
      xp: user.xp + xpGain,
      totalCorrect: user.totalCorrect + correct,
      totalPlayed: user.totalPlayed + questionsAnswered,
    });

    return {
      xpGain,
      completionBonus: questionsAnswered >= DAILY_TOTAL_QUESTIONS ? DAILY_COMPLETION_BONUS : 0,
      perfectBonus: correct >= DAILY_TOTAL_QUESTIONS ? DAILY_PERFECT_BONUS : 0,
    };
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
