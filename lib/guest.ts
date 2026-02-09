import {
  deriveAvatarSeedFromIdentity as deriveAvatarSeedFromIdentityShared,
  deriveGuestNicknameFromKey,
} from '../supabase/functions/_shared/guest';

export function deriveGuestNickname(key: string): string;
export function deriveGuestNickname(key: string | null | undefined): string | null;
export function deriveGuestNickname(key: string | null | undefined): string | null {
  if (!key) return null;
  return deriveGuestNicknameFromKey(key);
}

export function deriveAvatarSeedFromIdentity(identityId: string | null | undefined, fallback = 'guest') {
  return deriveAvatarSeedFromIdentityShared(identityId, fallback);
}

export function deriveGuestAvatarSeed(guestKey: string | null | undefined): string | null {
  if (!guestKey) return null;
  return deriveAvatarSeedFromIdentity(`guest:${guestKey}`);
}

const DICEBEAR_GLASS_AVATAR_URL = 'https://api.dicebear.com/9.x/glass/png';

export function buildGuestAvatarUrl(seed: string) {
  const normalized = seed.trim() || 'guest';
  return `${DICEBEAR_GLASS_AVATAR_URL}?seed=${encodeURIComponent(normalized)}`;
}
