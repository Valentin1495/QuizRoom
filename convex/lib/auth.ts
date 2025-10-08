import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { ConvexError } from "convex/values";

const DEFAULT_AVATAR = "https://avatars.dicebear.com/api/initials/quizroom.png";

type AuthIdentity = {
  identityId: string;
  provider: string;
  handle: string;
  avatarUrl?: string;
};

type RawUserIdentity = NonNullable<
  Awaited<ReturnType<QueryCtx["auth"]["getUserIdentity"]>>
> & {
  provider?: string;
  picture?: string;
  pictureUrl?: string;
  nickname?: string;
  preferredUsername?: string;
};

function inferProvider(identity: RawUserIdentity) {
  if (identity.provider) {
    return identity.provider;
  }
  if (identity.issuer) {
    try {
      const { hostname } = new URL(identity.issuer);
      if (hostname) {
        return hostname.replace(/^www\./, "");
      }
    } catch {
      return identity.issuer;
    }
  }
  return "unknown";
}

function buildAuthIdentity(identity: RawUserIdentity): AuthIdentity {
  const identityId = identity.tokenIdentifier ??
    (identity.issuer ? `${identity.issuer}:${identity.subject}` : identity.subject);
  const provider = inferProvider(identity);
  const fallbackSuffix = identity.subject.slice(-6) || identityId.slice(-6);
  const handleBase =
    identity.nickname ??
    identity.preferredUsername ??
    identity.name ??
    identity.email ??
    `user-${fallbackSuffix}`;
  const sanitizedHandle =
    handleBase.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase() || `user-${fallbackSuffix}`;
  const avatarUrl = identity.picture ?? identity.pictureUrl ?? undefined;
  return {
    identityId,
    provider,
    handle: sanitizedHandle,
    avatarUrl,
  };
}

async function fetchUserByIdentity(ctx: QueryCtx | MutationCtx, identityId: string) {
  return ctx.db
    .query("users")
    .withIndex("by_identity", (q) => q.eq("identityId", identityId))
    .unique();
}

export async function getAuthedUser(ctx: QueryCtx): Promise<{ user: Doc<"users">; auth: AuthIdentity }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("NOT_AUTHENTICATED");
  }
  const authIdentity = buildAuthIdentity(identity);
  const user = await fetchUserByIdentity(ctx, authIdentity.identityId);
  if (!user) {
    throw new ConvexError("USER_NOT_FOUND");
  }
  return { user, auth: authIdentity };
}

export async function ensureAuthedUser(ctx: MutationCtx): Promise<{ user: Doc<"users">; auth: AuthIdentity }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("NOT_AUTHENTICATED");
  }
  const authIdentity = buildAuthIdentity(identity);
  const existing = await fetchUserByIdentity(ctx, authIdentity.identityId);
  if (existing) {
    return { user: existing, auth: authIdentity };
  }

  const now = Date.now();
  const newId = await ctx.db.insert("users", {
    identityId: authIdentity.identityId,
    provider: authIdentity.provider,
    handle: authIdentity.handle,
    avatarUrl: authIdentity.avatarUrl ?? DEFAULT_AVATAR,
    interests: [],
    streak: 0,
    xp: 0,
    cosmetics: [],
    createdAt: now,
  });

  const user = await ctx.db.get(newId);
  if (!user) {
    throw new ConvexError("USER_CREATION_FAILED");
  }
  return { user, auth: authIdentity };
}
