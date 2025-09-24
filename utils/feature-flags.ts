import * as Updates from 'expo-updates';

export type AppVariant = 'legacy' | 'greenfield';

function parseEnvVariant(): AppVariant | null {
  const value = (process.env.EXPO_PUBLIC_APP_VARIANT || '').toLowerCase();
  if (value === 'greenfield') return 'greenfield';
  if (value === 'legacy') return 'legacy';
  return null;
}

export function getReleaseChannelName(): string {
  try {
    // EAS Update channel when available; fallback to runtimeVersion or empty
    // channel may be undefined in some environments
    return (Updates.channel as string) || (Updates.runtimeVersion as string) || '';
  } catch (_err) {
    return '';
  }
}

export function getAppVariant(): AppVariant {
  const envVariant = parseEnvVariant();
  if (envVariant) return envVariant;

  const channel = getReleaseChannelName();
  if (['beta', 'preview', 'staging', 'greenfield'].includes(channel)) {
    return 'greenfield';
  }
  return 'legacy';
}

export function isGreenfieldEnabled(): boolean {
  return getAppVariant() === 'greenfield';
}
