export function deriveGuestNickname(key: string): string;
export function deriveGuestNickname(key: string | null | undefined): string | null;
export function deriveGuestNickname(key: string | null | undefined): string | null {
  if (!key) return null;
  const suffix = key.slice(-4).toUpperCase().padStart(4, "0");
  return `Guest ${suffix}`;
}

export function deriveGuestAvatarId(key: string): number;
export function deriveGuestAvatarId(key: string | null | undefined): number | undefined;
export function deriveGuestAvatarId(key: string | null | undefined): number | undefined {
  if (!key) return undefined;
  const suffix = key.slice(-4);
  const parsed = parseInt(suffix, 36);
  if (Number.isNaN(parsed)) return undefined;
  return parsed % 100;
}
