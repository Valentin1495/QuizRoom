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

    if (existingUser) {
      // 기존 사용자 업데이트
      await ctx.db.patch(existingUser._id, {
        email: args.email,
        displayName: args.displayName,
        photoURL: args.photoURL,
        lastLoginAt: now,
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
