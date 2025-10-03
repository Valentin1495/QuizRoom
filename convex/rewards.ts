import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";

const AD_REWARD_COINS = 50 as const;

type ClaimAdRewardResult = { success: true; newCoinBalance: number };

export const claimAdReward = action({
    args: {},
    handler: async (ctx): Promise<ClaimAdRewardResult> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("User not authenticated");
        }

        const user: Doc<'users'> | null = await ctx.runQuery(api.users.getUser, {});
        if (!user) {
            throw new Error("User not found");
        }

        let inventory: Doc<'inventories'> | null = await ctx.runQuery(api.inventories.getInventory, {});
        if (!inventory) {
            // It's possible the user doesn't have an inventory record yet.
            await ctx.runMutation(internal.inventories.ensureInventory, {});
            inventory = await ctx.runQuery(api.inventories.getInventory, {});
        }

        await ctx.runMutation(internal.inventories.addCoins, {
            amount: AD_REWARD_COINS,
        });

        const newBalance = (inventory?.coins ?? 0) + AD_REWARD_COINS;
        return { success: true, newCoinBalance: newBalance };
    },
});
