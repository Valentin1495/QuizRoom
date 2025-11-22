import { useCallback, useMemo } from 'react';

import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';

export const ROOM_EXPIRED_MESSAGE = '퀴즈룸이 만료됐어요. 새로 생성해 주세요.';
export const ROOM_NOT_FOUND_MESSAGE = '퀴즈룸을 찾을 수 없어요. 초대 코드를 확인해주세요.';
export const ROOM_FULL_MESSAGE = '퀴즈룸이 가득 찼어요. 다른 방을 찾아주세요.';
export const ROOM_IN_PROGRESS_MESSAGE =
  '퀴즈 진행 중에는 다시 입장할 수 없어요. 게임이 끝난 뒤 다시 시도해 주세요.';

export function extractJoinErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : null;
  if (!message) {
    return '코드를 확인하거나 방이 이미 시작되었는지 확인해주세요.';
  }
  if (message.includes(ROOM_EXPIRED_MESSAGE)) return ROOM_EXPIRED_MESSAGE;
  if (message.includes(ROOM_NOT_FOUND_MESSAGE)) return ROOM_NOT_FOUND_MESSAGE;
  if (message.includes(ROOM_FULL_MESSAGE)) return ROOM_FULL_MESSAGE;
  if (message.includes(ROOM_IN_PROGRESS_MESSAGE)) return ROOM_IN_PROGRESS_MESSAGE;
  return message;
}

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

export function useCreateLiveMatchRoom() {
  const mutation = useMutation(api.rooms.create);
  return useCallback(
    (args: { deckId?: Id<'liveMatchDecks'>; nickname?: string; guestKey?: string }) =>
      mutation({ deckId: args.deckId, nickname: args.nickname, guestKey: args.guestKey }).then((payload) => ({
        roomId: payload.roomId,
        code: payload.code,
        participantId: payload.participantId,
        pendingAction: payload.pendingAction ?? null,
      })),
    [mutation]
  );
}

export function useJoinLiveMatchRoom() {
  const mutation = useMutation(api.rooms.join);
  return useCallback(
    async (args: { code: string; nickname?: string; guestKey?: string }) => {
      try {
        const payload = await mutation({
          code: args.code,
          nickname: args.nickname,
          guestKey: args.guestKey,
        });

        if ((payload as any)?.expired) {
          throw new Error(ROOM_EXPIRED_MESSAGE);
        }

        return {
          roomId: (payload as any).roomId,
          participantId: (payload as any).participantId,
          pendingAction: (payload as any).pendingAction ?? null,
        };
      } catch (error) {
        throw new Error(extractJoinErrorMessage(error));
      }
    },
    [mutation]
  );
}

export function useLiveMatchDecks() {
  const result = useQuery(api.rooms.listDecks, {});
  return {
    decks: result ?? [],
    isLoading: result === undefined,
  };
}

export function useLiveLeaderboard(roomId: Id<'liveMatchRooms'>, options?: { guestKey?: string }) {
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
