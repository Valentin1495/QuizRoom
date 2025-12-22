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
  const hash = key.split('').reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);
  return Math.abs(hash) % 20;
}
