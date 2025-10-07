import { mutation } from "./_generated/server";
import { ensureAuthedUser } from "./lib/auth";

export const ensureSelf = mutation({
  args: {},
  handler: async (ctx) => {
    const { user, auth } = await ensureAuthedUser(ctx);

    return {
      userId: user._id,
      handle: user.handle,
      avatarUrl: user.avatarUrl,
      provider: auth.provider,
      streak: user.streak,
      xp: user.xp,
      interests: user.interests,
    };
  },
});
