import { v } from 'convex/values';
import { internalMutation, query, QueryCtx } from './_generated/server';

export const createUser = internalMutation({
  args: {
    clerkId: v.string(),
    username: v.string(),
    fullName: v.string(),
    email: v.string(),
    profileImage: v.string(),
    level: v.number(),
    experience: v.number(),
    coins: v.number(),
    streak: v.number(),
    settings: v.optional(
      v.object({
        notifications: v.boolean(),
        sound: v.boolean(),
        vibration: v.boolean(),
        darkMode: v.boolean(),
        language: v.string(),
      })
    ),
  },
  async handler(
    ctx,
    {
      clerkId,
      username,
      fullName,
      email,
      profileImage,
      level,
      experience,
      coins,
      streak,
      settings,
    }
  ) {
    const userAttributes = {
      clerkId,
      username,
      fullName,
      email,
      profileImage,
      level,
      experience,
      coins,
      streak,
      settings,
    };

    await ctx.db.insert('users', userAttributes);
  },
});

export const getCurrentUserByClerkId = query({
  handler: async (ctx) => await getCurrentUser(ctx),
});

export async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    return null;
  }
  return await userByClerkId(ctx, identity.subject);
}

async function userByClerkId(ctx: QueryCtx, clerkId: string) {
  return await ctx.db
    .query('users')
    .withIndex('byClerkId', (q) => q.eq('clerkId', clerkId))
    .unique();
}

export async function getCurrentUserOrThrow(ctx: QueryCtx) {
  const userRecord = await getCurrentUser(ctx);
  if (!userRecord) throw new Error("Can't get current user");
  return userRecord;
}
