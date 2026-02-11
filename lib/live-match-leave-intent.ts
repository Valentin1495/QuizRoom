import AsyncStorage from '@react-native-async-storage/async-storage';

const LEAVE_INTENT_KEY = 'live_match:leave_intent:v1';
const LEAVE_INTENT_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

export const LEAVE_INTENT_BLOCK_MESSAGE = '현재 매치가 진행 중이에요. 종료 후 다시 시도해 주세요.';

type LeaveIntentRecord = {
  roomId: string;
  roomCode?: string;
  participantId?: string;
  createdAt: number;
  expiresAt: number;
};

function normalizeCode(code: string | null | undefined) {
  return code?.trim().toUpperCase() ?? '';
}

function safeParse(raw: string | null): LeaveIntentRecord[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => {
      if (!item || typeof item !== 'object') return false;
      return typeof item.roomId === 'string' && typeof item.expiresAt === 'number';
    }) as LeaveIntentRecord[];
  } catch {
    return [];
  }
}

async function loadActiveRecords() {
  const now = Date.now();
  const records = safeParse(await AsyncStorage.getItem(LEAVE_INTENT_KEY))
    .filter((record) => record.expiresAt > now);
  await AsyncStorage.setItem(LEAVE_INTENT_KEY, JSON.stringify(records));
  return records;
}

export async function setLiveMatchLeaveIntent(args: {
  roomId: string;
  roomCode?: string | null;
  participantId?: string | null;
  ttlMs?: number;
}) {
  const now = Date.now();
  const ttlMs = args.ttlMs ?? LEAVE_INTENT_TTL_MS;
  const roomCode = normalizeCode(args.roomCode);
  const records = await loadActiveRecords();
  const filtered = records.filter((record) => record.roomId !== args.roomId);
  filtered.push({
    roomId: args.roomId,
    roomCode: roomCode || undefined,
    participantId: args.participantId ?? undefined,
    createdAt: now,
    expiresAt: now + ttlMs,
  });
  await AsyncStorage.setItem(LEAVE_INTENT_KEY, JSON.stringify(filtered));
}

export async function hasLiveMatchLeaveIntentForCode(code: string) {
  const normalized = normalizeCode(code);
  if (!normalized) return false;
  const records = await loadActiveRecords();
  return records.some((record) => normalizeCode(record.roomCode) === normalized);
}

export async function hasLiveMatchLeaveIntentForRoomId(roomId: string) {
  if (!roomId) return false;
  const records = await loadActiveRecords();
  return records.some((record) => record.roomId === roomId);
}

export async function clearLiveMatchLeaveIntentForCode(code: string) {
  const normalized = normalizeCode(code);
  if (!normalized) return;
  const records = await loadActiveRecords();
  const filtered = records.filter((record) => normalizeCode(record.roomCode) !== normalized);
  await AsyncStorage.setItem(LEAVE_INTENT_KEY, JSON.stringify(filtered));
}
