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
  const mutation = useMutation(api.rooms.create);
  return useCallback(
    (deckId?: Id<'decks'>, nickname?: string) =>
      mutation({ deckId, nickname }).then((payload) => ({
        roomId: payload.roomId,
        code: payload.code,
        pendingAction: payload.pendingAction ?? null,
      })),
    [mutation]
  );
}

export function useJoinParty() {
  const mutation = useMutation(api.rooms.join);
  return useCallback(
    (code: string, nickname?: string) =>
      mutation({ code, nickname }).then((payload) => ({
        roomId: payload.roomId,
        pendingAction: payload.pendingAction ?? null,
      })),
    [mutation]
  );
}

export function useLiveLeaderboard(roomId: Id<'partyRooms'>) {
  const result = useQuery(api.rooms.getRoomState, { roomId });
  return {
    leaderboard: result && result.status === 'ok' ? result.currentRound?.leaderboard ?? null : null,
    isLoading: result === undefined,
  };
}

export { api };
