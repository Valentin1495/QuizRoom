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
    (args: { deckId?: Id<'partyDecks'>; nickname?: string; guestKey?: string }) =>
      mutation({ deckId: args.deckId, nickname: args.nickname, guestKey: args.guestKey }).then((payload) => ({
        roomId: payload.roomId,
        code: payload.code,
        participantId: payload.participantId,
        pendingAction: payload.pendingAction ?? null,
      })),
    [mutation]
  );
}

export function useJoinParty() {
  const mutation = useMutation(api.rooms.join);
  return useCallback(
    (args: { code: string; nickname?: string; guestKey?: string }) =>
      mutation({ code: args.code, nickname: args.nickname, guestKey: args.guestKey }).then((payload) => ({
        roomId: payload.roomId,
        participantId: payload.participantId,
        pendingAction: payload.pendingAction ?? null,
      })),
    [mutation]
  );
}

export function usePartyDecks() {
  const result = useQuery(api.rooms.listDecks, {});
  return {
    decks: result ?? [],
    isLoading: result === undefined,
  };
}

export function useLiveLeaderboard(roomId: Id<'partyRooms'>, options?: { guestKey?: string }) {
  const args = useMemo(() => {
    if (options?.guestKey) {
      return { roomId, guestKey: options.guestKey };
    }
    return { roomId };
  }, [options?.guestKey, roomId]);
  const result = useQuery(api.rooms.getRoomState, args);
  return {
    leaderboard: result && result.status === 'ok' ? result.currentRound?.leaderboard ?? null : null,
    isLoading: result === undefined,
  };
}

export { api };
