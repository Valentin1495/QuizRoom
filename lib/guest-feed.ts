import sportsGames from "@/assets/data/swipe/sports_games.json";

export type GuestSwipeSource = {
  deckSlug: string;
  category: string;
  type: string;
  prompt: string;
  tags: string[];
  choices: { id: string; text: string }[];
  answerIndex: number;
  explanation?: string;
  difficulty: number;
  createdAt?: number;
  qualityScore?: number;
  elo?: number;
  mediaUrl?: string | null;
  choiceShuffleSeed?: number;
};

type GuestCatalog = Record<string, GuestSwipeSource[]>;

const catalog: GuestCatalog = {
  sports_games: sportsGames as GuestSwipeSource[],
};

const FALLBACK_CATEGORY = "sports_games";

function normalizeCategory(slug: string) {
  return slug.trim().toLowerCase();
}

export function resolveGuestSources(
  category: string,
  desired: number,
  tags?: string[]
): GuestSwipeSource[] {
  const normalized = normalizeCategory(category);
  const base =
    catalog[normalized] ??
    catalog[FALLBACK_CATEGORY] ??
    ([] as GuestSwipeSource[]);
  if (base.length === 0) {
    return [];
  }
  const normalizedTags =
    tags?.map((tag) => tag.trim().toLowerCase()).filter(Boolean) ?? [];
  const hasTagFilter = normalizedTags.length > 0;
  const filtered = hasTagFilter
    ? base.filter((entry) => {
        const entryTags =
          entry.tags?.map((tag) => tag.trim().toLowerCase()) ?? [];
        return entryTags.some((tag) => normalizedTags.includes(tag));
      })
    : base;

  const working = filtered.length > 0 ? filtered : base;
  // Shuffle a shallow copy for variation
  const shuffled = [...working];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  if (shuffled.length >= desired) {
    return shuffled.slice(0, desired);
  }

  const expanded: GuestSwipeSource[] = [];
  while (expanded.length < desired) {
    expanded.push(...shuffled);
  }
  return expanded.slice(0, desired);
}
