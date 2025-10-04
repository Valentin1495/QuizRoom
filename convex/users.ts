import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getUser = query({
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
            .first();

        return user;
    },
});

export const storeUser = mutation({
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Called storeUser without authentication present");
        }

        // Check if we've already stored this identity before.
        const user = await ctx.db
            .query("users")
            .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
            .first();

        // If we've seen this identity before, do nothing.
        if (user !== null) {
            return user._id;
        }

        // If it's a new identity, create a new user.
        return await ctx.db.insert("users", {
            authId: identity.subject,
            nickname: identity.nickname!,
            avatar: identity.pictureUrl!,
            country: "kr",
            createdAt: Date.now(),
        });
    },
});

export const updateProfile = mutation({
    args: {
        nickname: v.string(),
        avatar: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
            .first();

        if (!user) {
            throw new Error("User not found");
        }

        return await ctx.db.patch(user._id, {
            nickname: args.nickname,
            avatar: args.avatar,
        });
    },
});

export const mergeGuestData = mutation({
    args: {
        guestId: v.string(),
    },
    handler: async (ctx, { guestId }) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
            .first();

        if (!user) {
            throw new Error("User not found");
        }

        // Define the tables and their respective guest indexes
        const tablesToMerge: { tableName: any; indexName: string }[] = [
            { tableName: "sessions", indexName: "by_guest_status" },
            { tableName: "inventories", indexName: "by_guest" },
            { tableName: "reports", indexName: "by_guest" },
            // "leaderboards" and "purchases" could be added here if needed
        ];

        for (const { tableName, indexName } of tablesToMerge) {
            const records = await ctx.db
                .query(tableName)
                .withIndex(indexName, (q) => q.eq("guestId", guestId))
                .collect();

            for (const record of records) {
                await ctx.db.patch(record._id, {
                    userId: user._id,
                    guestId: undefined, // Clear the guestId
                });
            }
        }
    },
});
