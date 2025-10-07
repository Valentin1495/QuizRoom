import { useCallback, useMemo } from 'react';

import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';

export function useDeckFeed(options?: { tag?: string; limit?: number }) {
  const args = useMemo(
    () => ({
      tag: options?.tag,
      limit: options?.limit,
    }),
    [options?.tag, options?.limit]
  );
  const result = useQuery(api.decks.getFeed, args);
  return {
    decks: result ?? [],
    isLoading: result === undefined,
  };
}

export function useCreateParty() {
  const mutation = useMutation(api.matches.createParty);
  return useCallback(
    (deckId: Id<'decks'>) =>
      mutation({ deckId }).then((payload) => ({
        matchId: payload.matchId,
        code: payload.code,
      })),
    [mutation]
  );
}

export function useJoinParty() {
  const mutation = useMutation(api.matches.joinByCode);
  return useCallback(
    (code: string) =>
      mutation({ code }).then((payload) => ({
        matchId: payload.matchId,
        deckId: payload.deckId,
      })),
    [mutation]
  );
}

export function useLiveLeaderboard(matchId: Id<'matches'>) {
  const result = useQuery(api.matches.liveLeaderboard, { matchId });
  return {
    leaderboard: result ?? null,
    isLoading: result === undefined,
  };
}

export { api };
