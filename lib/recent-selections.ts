import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CategoryMeta } from '@/constants/categories';

const RECENT_SWIPE_CATEGORY_KEY_PREFIX = 'recent:swipeCategory:v2';
const RECENT_LIVE_MATCH_DECK_KEY_PREFIX = 'recent:liveMatchDeck:v2';

export type RecentSwipeCategory = Pick<CategoryMeta, 'slug' | 'title' | 'icon'>;
export type RecentLiveMatchDeck = {
  id: string;
  slug: string;
  title: string;
  emoji: string;
};

export type RecentSelectionScope = {
  userId?: string | null;
  guestKey?: string | null;
};

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function sanitizeScopeValue(value: string) {
  return value.replace(/[^A-Za-z0-9._-]/g, '_');
}

function buildScopedKey(prefix: string, scope?: RecentSelectionScope) {
  if (scope?.userId) {
    return `${prefix}:user:${sanitizeScopeValue(scope.userId)}`;
  }
  if (scope?.guestKey) {
    return `${prefix}:guest:${sanitizeScopeValue(scope.guestKey)}`;
  }
  return `${prefix}:anon`;
}

export async function loadRecentSwipeCategory(scope?: RecentSelectionScope): Promise<RecentSwipeCategory | null> {
  const key = buildScopedKey(RECENT_SWIPE_CATEGORY_KEY_PREFIX, scope);
  return safeParseJson<RecentSwipeCategory>(await AsyncStorage.getItem(key));
}

export async function saveRecentSwipeCategory(
  category: CategoryMeta,
  scope?: RecentSelectionScope
): Promise<void> {
  const value: RecentSwipeCategory = {
    slug: category.slug,
    title: category.title,
    icon: category.icon,
  };
  const key = buildScopedKey(RECENT_SWIPE_CATEGORY_KEY_PREFIX, scope);
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function loadRecentLiveMatchDeck(scope?: RecentSelectionScope): Promise<RecentLiveMatchDeck | null> {
  const key = buildScopedKey(RECENT_LIVE_MATCH_DECK_KEY_PREFIX, scope);
  return safeParseJson<RecentLiveMatchDeck>(await AsyncStorage.getItem(key));
}

export async function saveRecentLiveMatchDeck(
  deck: RecentLiveMatchDeck,
  scope?: RecentSelectionScope
): Promise<void> {
  const value: RecentLiveMatchDeck = {
    id: deck.id,
    slug: deck.slug,
    title: deck.title,
    emoji: deck.emoji,
  };
  const key = buildScopedKey(RECENT_LIVE_MATCH_DECK_KEY_PREFIX, scope);
  await AsyncStorage.setItem(key, JSON.stringify(value));
}
