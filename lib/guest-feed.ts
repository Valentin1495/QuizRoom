import dramaMovie from '@/assets/data/swipe/drama_movie.json';
import fashionLife from '@/assets/data/swipe/fashion_life.json';
import generalKnowledge from '@/assets/data/swipe/general_knowledge.json';
import kpopMusic from '@/assets/data/swipe/kpop_music.json';
import newsIssues from '@/assets/data/swipe/news_issues.json';
import sportsGames from '@/assets/data/swipe/sports_games.json';
import techIt from '@/assets/data/swipe/tech_it.json';
import varietyReality from '@/assets/data/swipe/variety_reality.json';

export type GuestSwipeSource = {
  deckSlug: string;
  category: string;
  prompt: string;
  mediaUrl?: string | null;
  choices: { id: string; text: string }[];
  answerIndex: number;
  difficulty?: number | null;
  createdAt?: number;
  tags?: string[];
  qualityScore?: number;
  elo?: number;
  explanation?: string | null;
  type?: string;
};

const ALL_SOURCES: Record<string, GuestSwipeSource[]> = {
  kpop_music: kpopMusic,
  variety_reality: varietyReality,
  drama_movie: dramaMovie,
  sports_games: sportsGames,
  tech_it: techIt,
  fashion_life: fashionLife,
  news_issues: newsIssues,
  general_knowledge: generalKnowledge,
};

const shuffle = <T>(array: T[], seed: number): T[] => {
  const result = [...array];
  let m = result.length;
  let t: T;
  let i: number;

  const random = () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  while (m) {
    i = Math.floor(random() * m--);
    t = result[m];
    result[m] = result[i];
    result[i] = t;
  }
  return result;
};

export function resolveGuestSources(
  primaryCategory: string,
  limit: number,
  tags?: string[]
): GuestSwipeSource[] {
  const primarySources = ALL_SOURCES[primaryCategory] ?? [];
  const seed = Date.now();

  // Filter by tags if provided
  const normalizedTags =
    tags?.map((tag) => tag.trim().toLowerCase()).filter(Boolean) ?? [];
  const hasTagFilter = normalizedTags.length > 0;
  let filteredSources = primarySources;
  if (hasTagFilter) {
    filteredSources = primarySources.filter((entry) => {
      const entryTags =
        entry.tags?.map((tag) => tag.trim().toLowerCase()) ?? [];
      return entryTags.some((tag) => normalizedTags.includes(tag));
    });

    if (filteredSources.length === 0) {
      filteredSources = primarySources;
    }
  }

  const seen = new Set<string>();
  const takeUnique = (sources: GuestSwipeSource[]) => {
    for (const source of sources) {
      const key = `${source.deckSlug}:${source.prompt}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      results.push(source);
      if (results.length >= limit) {
        return true;
      }
    }
    return false;
  };

  const results: GuestSwipeSource[] = [];
  if (takeUnique(shuffle(filteredSources, seed))) {
    return results;
  }

  const otherCategories = Object.entries(ALL_SOURCES).filter(
    ([slug]) => slug !== primaryCategory
  );
  if (otherCategories.length) {
    const flattenedOthers = otherCategories.flatMap(([, entries]) => entries);
    if (hasTagFilter) {
      const matchingOthers = flattenedOthers.filter((entry) => {
        const entryTags =
          entry.tags?.map((tag) => tag.trim().toLowerCase()) ?? [];
        return entryTags.some((tag) => normalizedTags.includes(tag));
      });
      if (matchingOthers.length) {
        if (takeUnique(shuffle(matchingOthers, seed + 1))) {
          return results;
        }
      }
    }
    if (takeUnique(shuffle(flattenedOthers, seed + 2))) {
      return results;
    }
  }

  if (results.length === 0 && filteredSources.length === 0) {
    return [];
  }

  const fallbackPool =
    results.length > 0 ? [...results] : shuffle(filteredSources, seed);
  if (fallbackPool.length === 0) {
    return results;
  }

  const filler = shuffle(fallbackPool, seed + 3);
  while (results.length < limit) {
    for (const entry of filler) {
      results.push(entry);
      if (results.length >= limit) {
        break;
      }
    }
  }

  return results.slice(0, limit);
}
