import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getInventory = query({
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("User not authenticated");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
            .first();

        if (!user) {
            throw new Error("User not found");
        }

        const inventory = await ctx.db
            .query("inventories")
            .filter((q) => q.eq(q.field("userId"), user._id))
            .first();

        return inventory;
    },
});

export const decrementBoost = internalMutation({
    args: {
        boostType: v.union(v.literal("skip"), v.literal("fifty"), v.literal("hint")),
    },
    handler: async (ctx, { boostType }) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("User not authenticated");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
            .first();

        if (!user) {
            throw new Error("User not found");
        }

        const inventory = await ctx.db
            .query("inventories")
            .filter((q) => q.eq(q.field("userId"), user._id))
            .first();

        if (!inventory) {
            throw new Error("Inventory not found");
        }

        if (inventory.boosts[boostType] > 0) {
            await ctx.db.patch(inventory._id, {
                boosts: {
                    ...inventory.boosts,
                    [boostType]: inventory.boosts[boostType] - 1,
                },
            });
        }
    },
});

export const ensureInventory = internalMutation({
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Unauthenticated call to ensureInventory");
        }
        const user = await ctx.db
            .query("users")
            .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
            .first();

        if (!user) {
            throw new Error("User not found for ensureInventory");
        }

        const existingInventory = await ctx.db.query("inventories")
            .filter(q => q.eq(q.field("userId"), user._id))
            .first();

        if (existingInventory) {
            return;
        }

        await ctx.db.insert("inventories", {
            userId: user._id,
            coins: 0,
            boosts: {
                skip: 1,
                fifty: 1,
                hint: 1,
            },
            premium: false,
        });
    }
});

export const addCoins = internalMutation({
    args: {
        amount: v.number(),
    },
    handler: async (ctx, { amount }) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Unauthenticated call to addCoins");
        }
        const user = await ctx.db
            .query("users")
            .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
            .first();

        if (!user) {
            throw new Error("User not found for addCoins");
        }

        const inventory = await ctx.db.query("inventories")
            .filter(q => q.eq(q.field("userId"), user._id))
            .first();

        if (!inventory) {
            throw new Error("Inventory not found for addCoins");
        }

        await ctx.db.patch(inventory._id, {
            coins: inventory.coins + amount,
        });
    }
});
