import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CategoryMeta } from '@/constants/categories';
import type { LiveMatchDeck } from '@/lib/database.types';

export const RECENT_SWIPE_CATEGORY_KEY = 'recent:swipeCategory:v1';
export const RECENT_LIVE_MATCH_DECK_KEY = 'recent:liveMatchDeck:v1';

export type RecentSwipeCategory = Pick<CategoryMeta, 'slug' | 'title' | 'icon'>;
export type RecentLiveMatchDeck = Pick<LiveMatchDeck, 'id' | 'slug' | 'title' | 'emoji'>;

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function loadRecentSwipeCategory(): Promise<RecentSwipeCategory | null> {
  return safeParseJson<RecentSwipeCategory>(await AsyncStorage.getItem(RECENT_SWIPE_CATEGORY_KEY));
}

export async function saveRecentSwipeCategory(category: CategoryMeta): Promise<void> {
  const value: RecentSwipeCategory = {
    slug: category.slug,
    title: category.title,
    icon: category.icon,
  };
  await AsyncStorage.setItem(RECENT_SWIPE_CATEGORY_KEY, JSON.stringify(value));
}

export async function loadRecentLiveMatchDeck(): Promise<RecentLiveMatchDeck | null> {
  return safeParseJson<RecentLiveMatchDeck>(await AsyncStorage.getItem(RECENT_LIVE_MATCH_DECK_KEY));
}

export async function saveRecentLiveMatchDeck(deck: LiveMatchDeck): Promise<void> {
  const value: RecentLiveMatchDeck = {
    id: deck.id,
    slug: deck.slug,
    title: deck.title,
    emoji: deck.emoji,
  };
  await AsyncStorage.setItem(RECENT_LIVE_MATCH_DECK_KEY, JSON.stringify(value));
}

