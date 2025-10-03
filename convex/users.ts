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

        if (user !== null) {
            // If we've seen this identity before but the name has changed, patch the user.
            if (user.nickname !== identity.nickname) {
                await ctx.db.patch(user._id, { nickname: identity.nickname });
            }
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
