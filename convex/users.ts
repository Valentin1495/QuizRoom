import { v } from 'convex/values';
import { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';

// 사용자 생성 또는 업데이트
export const createOrUpdateUser = mutation({
  args: {
    firebaseUid: v.string(),
    email: v.string(),
    displayName: v.optional(v.string()),
    photoURL: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<'users'>> => {
    // 기존 사용자 확인
    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_firebase_uid', (q) => q.eq('firebaseUid', args.firebaseUid))
      .unique();

    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);
    const defaultInventory = { hint: 0, pass: 0, lastDailyGrant: today } as const;
    const inventory = existingUser?.helperInventory ?? defaultInventory;

    if (existingUser) {
      // 기존 사용자 업데이트
      const shouldGrantDaily = inventory.lastDailyGrant !== today;
      const grantTarget = inventory.hint <= inventory.pass ? 'hint' : 'pass';
      const nextInventory = shouldGrantDaily
        ? {
          hint: inventory.hint + (grantTarget === 'hint' ? 1 : 0),
          pass: inventory.pass + (grantTarget === 'pass' ? 1 : 0),
          lastDailyGrant: today,
          ...(inventory.rewardCooldowns ? { rewardCooldowns: inventory.rewardCooldowns } : {}),
        }
        : inventory;
      await ctx.db.patch(existingUser._id, {
        email: args.email,
        displayName: args.displayName,
        photoURL: args.photoURL,
        lastLoginAt: now,
        helperInventory: nextInventory,
      });
      return existingUser._id;
    } else {
      // 새 사용자 생성
      const userId = await ctx.db.insert('users', {
        firebaseUid: args.firebaseUid,
        email: args.email,
        displayName: args.displayName,
        photoURL: args.photoURL,
        lastLoginAt: now,
        coins: 0,
        experience: 0,
        level: 0,
        streak: 0,
        helperInventory: defaultInventory,
      });
      return userId;
    }
  },
});

// 사용자 조회
export const getUserByFirebaseUid = query({
  args: { firebaseUid: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_firebase_uid', (q) => q.eq('firebaseUid', args.firebaseUid))
      .unique();
  },
});

// 모든 사용자 조회
export const getAllUsers = query({
  handler: async (ctx) => {
    return await ctx.db.query('users').collect();
  },
});
