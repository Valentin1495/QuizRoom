import { ConvexError, v } from "convex/values";
import { deriveGuestAvatarId, deriveGuestNickname } from "../lib/guest";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { ensureAuthedUser, getOptionalAuthedUser } from "./lib/auth";

type CtxWithDb = Pick<MutationCtx, "db"> | Pick<QueryCtx, "db">;

type PendingActionType = "start" | "rematch" | "toLobby";

type SchedulePendingActionOptions = {
    type: PendingActionType;
    delayMs?: number;
    initiatedByUserId?: Id<"users">;
    initiatedIdentity?: string;
    label: string;
    patch?: Partial<RoomDoc>;
};

type RoomDoc = Doc<"liveMatchRooms">;
type ParticipantDoc = Doc<"liveMatchParticipants">;

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const DEFAULT_RULES = {
    rounds: 10,
    readSeconds: 3,
    answerSeconds: 10,
    graceSeconds: 2,
    revealSeconds: 6,
    leaderboardSeconds: 5,
};

const LOBBY_EXPIRES_MS = 1000 * 60;
const ACTION_DELAY_MIN_MS = 2000;
const ACTION_DELAY_MAX_MS = 10000;
const ACTION_DELAY_DEFAULT_MS = 3000;
const PARTICIPANT_LIMIT = 10;
const PARTICIPANT_TIMEOUT_MS = 30 * 1000;
const PARTICIPANT_OFFLINE_GRACE_MS = 2 * 60 * 1000;

const GUEST_IDENTITY_PREFIX = "guest:";

function normalizeGuestKey(raw?: string) {
    const key = raw?.trim();
    if (!key) {
        return null;
    }
    if (key.length > 128) {
        throw new ConvexError("INVALID_GUEST_KEY");
    }
    return key;
}

function requireGuestKey(raw?: string) {
    const key = normalizeGuestKey(raw);
    if (!key) {
        throw new ConvexError("GUEST_AUTH_REQUIRED");
    }
    return key;
}

function guestIdentity(key: string) {
    return `${GUEST_IDENTITY_PREFIX}${key}`;
}

function getParticipantGuestAvatarId(participant: ParticipantDoc) {
    if (!participant.isGuest) return null;
    if (participant.guestAvatarId != null) {
        return participant.guestAvatarId;
    }
    if (participant.identityId?.startsWith(GUEST_IDENTITY_PREFIX)) {
        const key = participant.identityId.slice(GUEST_IDENTITY_PREFIX.length);
        return deriveGuestAvatarId(key) ?? null;
    }
    return null;
}

async function resolveHostParticipant(
    ctx: MutationCtx,
    room: RoomDoc,
    guestKey?: string
): Promise<ParticipantDoc> {
    const authed = await getOptionalAuthedUser(ctx);
    if (authed) {
        const participant = await loadParticipantByUser(ctx, room._id, authed.user._id);
        if (participant && participant.isHost) {
            return participant;
        }
    }
    if (guestKey) {
        const identity = guestIdentity(requireGuestKey(guestKey));
        const participant = await loadParticipantByIdentity(ctx, room._id, identity);
        if (participant && participant.isHost) {
            return participant;
        }
    }
    throw new ConvexError("NOT_AUTHORIZED");
}

type LiveMatchRules = typeof DEFAULT_RULES;

export const cancelPendingAction = mutation({
    args: {
        roomId: v.id("liveMatchRooms"),
        guestKey: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const loadedRoom = await loadRoom(ctx, args.roomId);
        const activeRoom = await ensureActiveRoom(ctx, loadedRoom);
        if (!activeRoom) {
            return;
        }
        let room = activeRoom;
        room = (await refreshRoomParticipants(ctx, room)).room;
        if (!room.pendingAction) {
            return;
        }

        await ctx.db.patch(room._id, {
            pendingAction: undefined,
            version: (room.version ?? 0) + 1,
        });

        await ctx.db.insert("liveMatchLogs", {
            roomId: room._id,
            type: "action_cancelled",
            payload: {
                type: room.pendingAction.type,
                cancelledAt: Date.now(),
                initiatedByUserId: room.pendingAction.initiatedBy ?? null,
                initiatedIdentity: room.pendingAction.initiatedIdentity ?? null,
            },
            createdAt: Date.now(),
        });
    },
})

async function generateUniqueCode(ctx: MutationCtx, length = 6) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
        let code = "";
        for (let i = 0; i < length; i += 1) {
            code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
        }
        const existing = await ctx.db
            .query("liveMatchRooms")
            .withIndex("by_code", (q) => q.eq("code", code))
            .first();
        if (!existing) {
            return code;
        }
    }
    throw new ConvexError("FAILED_TO_ALLOCATE_CODE");
}

async function resolveDeck(ctx: MutationCtx, deckId?: Id<"liveMatchDecks">) {
    if (deckId) {
        const deck = await ctx.db.get(deckId);
        if (!deck || !deck.isActive || deck.totalQuestions === 0 || deck.questionIds.length === 0) {
            throw new ConvexError("DECK_NOT_AVAILABLE");
        }
        return deck;
    }
    const deck = await ctx.db
        .query("liveMatchDecks")
        .withIndex("by_active_updatedAt", (q) => q.eq("isActive", true))
        .order("desc")
        .first();
    if (!deck) {
        throw new ConvexError("NO_DECK_AVAILABLE");
    }
    if (deck.totalQuestions === 0 || deck.questionIds.length === 0) {
        throw new ConvexError("DECK_NOT_AVAILABLE");
    }
    return deck;
}

async function loadRoom(ctx: CtxWithDb, roomId: Id<"liveMatchRooms">) {
    const room = await ctx.db.get(roomId);
    if (!room) {
        throw new ConvexError("ROOM_NOT_FOUND");
    }
    return room;
}

function isRoomExpired(room: RoomDoc) {
    return typeof room.expiresAt === "number" && room.expiresAt <= Date.now();
}

async function deleteRoomCascade(ctx: MutationCtx, room: RoomDoc) {
    const [participants, rounds, answers, logs] = await Promise.all([
        ctx.db.query("liveMatchParticipants").withIndex("by_room", (q) => q.eq("roomId", room._id)).collect(),
        ctx.db.query("liveMatchRounds").withIndex("by_room", (q) => q.eq("roomId", room._id)).collect(),
        ctx.db.query("liveMatchAnswers").withIndex("by_room_round", (q) => q.eq("roomId", room._id)).collect(),
        ctx.db.query("liveMatchLogs").withIndex("by_room", (q) => q.eq("roomId", room._id)).collect(),
    ]);

    await Promise.all([
        ...participants.map((doc) => ctx.db.delete(doc._id)),
        ...rounds.map((doc) => ctx.db.delete(doc._id)),
        ...answers.map((doc) => ctx.db.delete(doc._id)),
        ...logs.map((doc) => ctx.db.delete(doc._id)),
    ]);

    await ctx.db.delete(room._id);
}

async function ensureActiveRoom(ctx: MutationCtx, room: RoomDoc): Promise<RoomDoc | null> {
    if (!isRoomExpired(room)) {
        return room;
    }
    const participants = await ctx.db
        .query("liveMatchParticipants")
        .withIndex("by_room", (q) => q.eq("roomId", room._id))
        .collect();
    const activeCount = participants.filter((p) => !p.removedAt).length;

    // Only expire when nobody remains; otherwise extend the expiry window.
    if (activeCount > 0) {
        const extendedExpiry = Date.now() + LOBBY_EXPIRES_MS;
        if (!room.expiresAt || room.expiresAt < extendedExpiry) {
            await ctx.db.patch(room._id, { expiresAt: extendedExpiry });
        }
        return { ...room, expiresAt: extendedExpiry };
    }

    await deleteRoomCascade(ctx, room);
    return null;
}

async function regenerateRoomRounds(
    ctx: MutationCtx,
    room: RoomDoc,
    requestedRounds?: number
) {
    const deckId = room.deckId;
    if (!deckId) {
        throw new ConvexError("DECK_NOT_SELECTED");
    }
    const deck = await resolveDeck(ctx, deckId);
    const desiredRounds =
        requestedRounds ??
        (typeof room.rules?.rounds === "number" ? room.rules.rounds : undefined) ??
        DEFAULT_RULES.rounds;
    const roundsToSelect = Math.max(1, Math.min(desiredRounds, deck.totalQuestions));
    const questions = await selectQuestions(ctx, deck._id, roundsToSelect);

    const existingRounds = await ctx.db
        .query("liveMatchRounds")
        .withIndex("by_room", (q) => q.eq("roomId", room._id))
        .collect();
    if (existingRounds.length > 0) {
        await Promise.all(existingRounds.map((round) => ctx.db.delete(round._id)));
    }

    for (let index = 0; index < questions.length; index += 1) {
        await ctx.db.insert("liveMatchRounds", {
            roomId: room._id,
            index,
            questionId: questions[index]._id,
            startedAt: 0,
            closedAt: undefined,
            revealAt: undefined,
        });
    }

    return questions.length;
}

async function resetRoomState(ctx: MutationCtx, room: RoomDoc) {
    const participants = await ctx.db
        .query("liveMatchParticipants")
        .withIndex("by_room", (q) => q.eq("roomId", room._id))
        .collect();
    await Promise.all(
        participants.map((participant) =>
            ctx.db.patch(participant._id, {
                totalScore: 0,
                answers: 0,
                avgResponseMs: 0,
                isReady: false,
            })
        )
    );

    const answers = await ctx.db
        .query("liveMatchAnswers")
        .withIndex("by_room_round", (q) => q.eq("roomId", room._id))
        .collect();
    if (answers.length > 0) {
        await Promise.all(answers.map((answer) => ctx.db.delete(answer._id)));
    }

    if (!room.deckId) {
        const existingRounds = await ctx.db
            .query("liveMatchRounds")
            .withIndex("by_room", (q) => q.eq("roomId", room._id))
            .collect();
        await Promise.all(
            existingRounds.map((round) =>
                ctx.db.patch(round._id, {
                    startedAt: 0,
                    closedAt: undefined,
                    revealAt: undefined,
                })
            )
        );
        return existingRounds.length;
    }

    return regenerateRoomRounds(ctx, room);
}

async function loadParticipantByUser(
    ctx: CtxWithDb,
    roomId: Id<"liveMatchRooms">,
    userId?: Id<"users">
) {
    if (!userId) {
        return null;
    }
    const participant = await ctx.db
        .query("liveMatchParticipants")
        .withIndex("by_room_user", (q) => q.eq("roomId", roomId).eq("userId", userId))
        .first();
    if (!participant || participant.removedAt) {
        return null;
    }
    return participant;
}

async function loadParticipantByIdentity(
    ctx: CtxWithDb,
    roomId: Id<"liveMatchRooms">,
    identityId: string
) {
    const participant = await ctx.db
        .query("liveMatchParticipants")
        .withIndex("by_room_identity", (q) => q.eq("roomId", roomId).eq("identityId", identityId))
        .first();
    if (!participant || participant.removedAt) {
        return null;
    }
    return participant;
}

async function requireParticipantAccess(
    ctx: MutationCtx,
    roomId: Id<"liveMatchRooms">,
    participantId: Id<"liveMatchParticipants">,
    guestKey?: string
): Promise<ParticipantDoc> {
    const participant = await ctx.db.get(participantId);
    if (!participant || participant.roomId !== roomId || participant.removedAt) {
        throw new ConvexError("NOT_IN_ROOM");
    }
    if (participant.userId) {
        const { user } = await ensureAuthedUser(ctx);
        if (user._id !== participant.userId) {
            throw new ConvexError("NOT_AUTHORIZED");
        }
    } else {
        const key = requireGuestKey(guestKey);
        if (participant.identityId !== guestIdentity(key)) {
            throw new ConvexError("NOT_AUTHORIZED");
        }
    }
    return participant;
}

async function loadRound(
    ctx: CtxWithDb,
    roomId: Id<"liveMatchRooms">,
    index: number
) {
    return ctx.db
        .query("liveMatchRounds")
        .withIndex("by_room_index", (q) => q.eq("roomId", roomId).eq("index", index))
        .unique();
}

function clampDelay(delayMs?: number) {
    if (!delayMs || Number.isNaN(delayMs)) return ACTION_DELAY_DEFAULT_MS;
    return Math.min(Math.max(delayMs, ACTION_DELAY_MIN_MS), ACTION_DELAY_MAX_MS);
}

function isParticipantConnected(participant: ParticipantDoc, now: number) {
    return now - participant.lastSeenAt <= PARTICIPANT_TIMEOUT_MS;
}

const PAUSABLE_STATUSES = new Set<RoomDoc["status"]>([
    "countdown",
    "question",
    "grace",
    "reveal",
    "leaderboard",
]);

async function refreshRoomParticipants(
    ctx: MutationCtx,
    room: RoomDoc
): Promise<{ room: RoomDoc; participants: ParticipantDoc[] }> {
    const participants = await ctx.db
        .query("liveMatchParticipants")
        .withIndex("by_room", (q) => q.eq("roomId", room._id))
        .collect();
    const now = Date.now();

    const active: ParticipantDoc[] = [];
    for (const participant of participants) {
        if (participant.removedAt) {
            continue;
        }
        const isCurrentlyConnected = isParticipantConnected(participant, now);
        if (isCurrentlyConnected) {
            if (participant.disconnectedAt) {
                await ctx.db.patch(participant._id, { disconnectedAt: undefined });
                participant.disconnectedAt = undefined;
            }
            active.push(participant);
            continue;
        }

        const disconnectedAt = participant.disconnectedAt ?? now;
        if (!participant.disconnectedAt) {
            await ctx.db.patch(participant._id, { disconnectedAt, isReady: false });
            participant.disconnectedAt = disconnectedAt;
            participant.isReady = false;
        }

        if (now - disconnectedAt > PARTICIPANT_OFFLINE_GRACE_MS) {
            await ctx.db.patch(participant._id, {
                removedAt: now,
                disconnectedAt: undefined,
                isHost: false,
                isReady: false,
            });
            participant.removedAt = now;
            participant.disconnectedAt = undefined;
            participant.isHost = false;
            participant.isReady = false;
        }
    }
    let activeParticipants = active.sort((a, b) => a.joinedAt - b.joinedAt);

    let updatedRoom = room;
    if (activeParticipants.length === 0) {
        const hasAnyRemaining = participants.some((participant) => !participant.removedAt);
        if (!hasAnyRemaining && room.status !== "lobby") {
            const resetNow = Date.now();
            await ctx.db.patch(room._id, {
                status: "lobby",
                currentRound: 0,
                serverNow: resetNow,
                phaseEndsAt: undefined,
                pauseState: undefined,
                pendingAction: undefined,
                expiresAt: resetNow + LOBBY_EXPIRES_MS,
                version: (room.version ?? 0) + 1,
            });
            updatedRoom = {
                ...room,
                status: "lobby",
                currentRound: 0,
                serverNow: resetNow,
                phaseEndsAt: undefined,
                pauseState: undefined,
                pendingAction: undefined,
                expiresAt: resetNow + LOBBY_EXPIRES_MS,
                version: (room.version ?? 0) + 1,
            };
        }
        return { room: updatedRoom, participants: [] };
    }

    const hostStillPresent = activeParticipants.some((participant) => {
        if (room.hostId && participant.userId && participant.userId === room.hostId) {
            return true;
        }
        return participant.identityId === room.hostIdentity;
    });
    if (activeParticipants.length > 0 && !hostStillPresent) {
        const newHost = activeParticipants.find((participant) => participant.userId) ?? activeParticipants[0];
        if (newHost) {
            await ctx.db.patch(room._id, {
                hostId: newHost.userId ?? undefined,
                hostIdentity: newHost.identityId,
                version: (room.version ?? 0) + 1,
            });
            await ctx.db.patch(newHost._id, { isHost: true });
            await Promise.all(
                activeParticipants
                    .filter((participant) => participant._id !== newHost._id && participant.isHost)
                    .map((participant) => ctx.db.patch(participant._id, { isHost: false }))
            );
            await ctx.db.insert("liveMatchLogs", {
                roomId: room._id,
                type: "host_transferred",
                payload: {
                    previousHost: room.hostId ?? null,
                    previousHostIdentity: room.hostIdentity,
                    newHost: newHost.userId ?? null,
                    newHostIdentity: newHost.identityId,
                    transferredAt: now,
                },
                createdAt: now,
            });
            updatedRoom = {
                ...room,
                hostId: newHost.userId ?? undefined,
                hostIdentity: newHost.identityId,
                version: (room.version ?? 0) + 1,
            };
            activeParticipants = activeParticipants.map((participant) =>
                participant._id === newHost._id
                    ? { ...participant, isHost: true }
                    : participant.isHost
                        ? { ...participant, isHost: false }
                        : participant
            );
        }
    }

    return { room: updatedRoom, participants: activeParticipants };
}

function attachRanks<T extends { totalScore: number }>(items: T[]) {
    const ranked: (T & { rank: number })[] = [];
    for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const previous = ranked[index - 1];
        const rank = previous && previous.totalScore === item.totalScore ? previous.rank : index + 1;
        ranked.push({ ...item, rank });
    }
    return ranked;
}

async function performPendingAction(ctx: MutationCtx, room: RoomDoc) {
    const action = room.pendingAction;
    if (!action) return;
    const now = Date.now();
    if (action.executeAt > now) return;

    let hostParticipant: ParticipantDoc | null = null;
    if (room.hostId) {
        hostParticipant = await loadParticipantByUser(ctx, room._id, room.hostId);
    }
    if (!hostParticipant) {
        hostParticipant = await loadParticipantByIdentity(ctx, room._id, room.hostIdentity);
    }
    if (!hostParticipant) {
        await ctx.db.patch(room._id, {
            pendingAction: undefined,
            version: (room.version ?? 0) + 1,
        });
        await ctx.db.insert("liveMatchLogs", {
            roomId: room._id,
            type: "action_cancelled",
            payload: {
                reason: "host_left",
                type: action.type,
                cancelledAt: now,
            },
            createdAt: now,
        });
        return;
    }

    switch (action.type) {
        case "start": {
            if (room.status !== "lobby") {
                await ctx.db.patch(room._id, {
                    pendingAction: undefined,
                    version: (room.version ?? 0) + 1,
                });
                await ctx.db.insert("liveMatchLogs", {
                    roomId: room._id,
                    type: "action_cancelled",
                    payload: {
                        reason: "invalid_state",
                        expected: "lobby",
                        actual: room.status,
                        type: action.type,
                        cancelledAt: now,
                    },
                    createdAt: now,
                });
                return;
            }
            const deckId = room.deckId;
            if (!deckId) {
                await ctx.db.patch(room._id, { pendingAction: undefined });
                throw new ConvexError("DECK_NOT_SELECTED");
            }

            const existingRounds = await ctx.db
                .query("liveMatchRounds")
                .withIndex("by_room", (q) => q.eq("roomId", room._id))
                .collect();
            if (existingRounds.length === 0) {
                const questions = await selectQuestions(ctx, deckId, room.totalRounds);
                for (let index = 0; index < questions.length; index += 1) {
                    await ctx.db.insert("liveMatchRounds", {
                        roomId: room._id,
                        index,
                        questionId: questions[index]._id,
                        startedAt: 0,
                        closedAt: undefined,
                        revealAt: undefined,
                    });
                }
            }

            const now2 = Date.now();
            await ctx.db.patch(room._id, {
                status: "countdown",
                currentRound: 0,
                serverNow: now2,
                phaseEndsAt: now2 + room.rules.readSeconds * 1000,
                expiresAt: now2 + LOBBY_EXPIRES_MS,
                version: (room.version ?? 0) + 1,
                pendingAction: undefined,
                pauseState: undefined,
            });
            break;
        }
        case "rematch": {
            if (room.status !== "results" && room.status !== "lobby") {
                await ctx.db.patch(room._id, {
                    pendingAction: undefined,
                    version: (room.version ?? 0) + 1,
                });
                await ctx.db.insert("liveMatchLogs", {
                    roomId: room._id,
                    type: "action_cancelled",
                    payload: {
                        reason: "invalid_state",
                        expected: "results",
                        actual: room.status,
                        type: action.type,
                        cancelledAt: now,
                    },
                    createdAt: now,
                });
                return;
            }
            const newRoundCount = await resetRoomState(ctx, room);
            const now2 = Date.now();
            await ctx.db.patch(room._id, {
                status: "countdown",
                currentRound: 0,
                serverNow: now2,
                phaseEndsAt: now2 + room.rules.readSeconds * 1000,
                expiresAt: now2 + LOBBY_EXPIRES_MS,
                version: (room.version ?? 0) + 1,
                pendingAction: undefined,
                pauseState: undefined,
                totalRounds: newRoundCount,
                rules: { ...room.rules, rounds: newRoundCount },
            });
            break;
        }
        case "toLobby": {
            if (room.status !== "results") {
                await ctx.db.patch(room._id, {
                    pendingAction: undefined,
                    version: (room.version ?? 0) + 1,
                });
                await ctx.db.insert("liveMatchLogs", {
                    roomId: room._id,
                    type: "action_cancelled",
                    payload: {
                        reason: "invalid_state",
                        expected: "results",
                        actual: room.status,
                        type: action.type,
                        cancelledAt: now,
                    },
                    createdAt: now,
                });
                return;
            }
            const newRoundCount = await resetRoomState(ctx, room);
            const now2 = Date.now();
            await ctx.db.patch(room._id, {
                status: "lobby",
                currentRound: 0,
                serverNow: now2,
                phaseEndsAt: undefined,
                expiresAt: now2 + LOBBY_EXPIRES_MS,
                version: (room.version ?? 0) + 1,
                pendingAction: undefined,
                pauseState: undefined,
                totalRounds: newRoundCount,
                rules: { ...room.rules, rounds: newRoundCount },
            });
            break;
        }
        default: {
            await ctx.db.patch(room._id, { pendingAction: undefined });
            break;
        }
    }
}

async function schedulePendingAction(
    ctx: MutationCtx,
    room: RoomDoc,
    options: SchedulePendingActionOptions
) {
    const delayMs = clampDelay(options.delayMs);
    const executeAt = Date.now() + delayMs;
    const patch: Partial<RoomDoc> = {
        ...(options.patch ?? {}),
        pendingAction: {
            type: options.type,
            executeAt,
            delayMs,
            createdAt: Date.now(),
            initiatedBy: options.initiatedByUserId,
            initiatedIdentity: options.initiatedIdentity,
            label: options.label,
        },
        version: (room.version ?? 0) + 1,
    };
    await ctx.db.patch(room._id, patch);
    return { executeAt, delayMs };
}

async function loadPendingRoom(ctx: MutationCtx, roomId: Id<"liveMatchRooms">) {
    const room = await ctx.db.get(roomId);
    if (!room) {
        throw new ConvexError("ROOM_NOT_FOUND");
    }
    return room;
}

function computeScoreDelta(isCorrect: boolean, elapsedMs: number, rules: LiveMatchRules) {
    if (!isCorrect) return 0;
    const base = 100;
    const remainingSeconds = Math.max(0, rules.answerSeconds - elapsedMs / 1000);
    const bonus = Math.ceil((remainingSeconds / rules.answerSeconds) * 50);
    return base + bonus;
}

async function selectQuestions(
    ctx: MutationCtx,
    deckId: Id<"liveMatchDecks">,
    rounds: number
) {
    const deck = await ctx.db.get(deckId);
    if (!deck || !deck.isActive || deck.questionIds.length === 0) {
        throw new ConvexError("NO_QUESTIONS_AVAILABLE");
    }
    const questionIds = [...deck.questionIds];
    for (let i = questionIds.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [questionIds[i], questionIds[j]] = [questionIds[j], questionIds[i]];
    }
    const selectedIds = questionIds.slice(0, Math.min(rounds, questionIds.length));
    const questions = await Promise.all(selectedIds.map((id) => ctx.db.get(id)));
    const resolved = questions.filter((q): q is NonNullable<typeof q> => Boolean(q));
    if (resolved.length === 0) {
        throw new ConvexError("NO_QUESTIONS_AVAILABLE");
    }
    return resolved;
}

function sanitizeNickname(nickname?: string | null, fallback?: string) {
    const trimmed = nickname?.trim();
    if (trimmed && trimmed.length > 0) {
        return trimmed.slice(0, 24);
    }
    return fallback ?? "player";
}

export const listDecks = query({
    args: {},
    handler: async (ctx) => {
        const decks = await ctx.db
            .query("liveMatchDecks")
            .withIndex("by_active_updatedAt", (q) => q.eq("isActive", true))
            .order("desc")
            .collect();
        return decks.map((deck) => ({
            id: deck._id,
            slug: deck.slug,
            title: deck.title,
            emoji: deck.emoji,
            description: deck.description,
            questionCount: deck.totalQuestions,
            sourceCategories: deck.sourceCategories,
            updatedAt: deck.updatedAt,
        }));
    },
});

export const create = mutation({
    args: {
        deckId: v.optional(v.id("liveMatchDecks")),
        nickname: v.optional(v.string()),
        guestKey: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        let userId: Id<"users"> | undefined;
        let identityId: string;
        let nicknameFallback: string;
        if (identity) {
            const { user, auth } = await ensureAuthedUser(ctx);
            userId = user._id;
            identityId = auth.identityId;
            nicknameFallback = user.handle;
        } else {
            const key = requireGuestKey(args.guestKey);
            identityId = guestIdentity(key);
            nicknameFallback = deriveGuestNickname(key);
        }
        const deck = await resolveDeck(ctx, args.deckId);
        const totalRounds = Math.min(DEFAULT_RULES.rounds, deck.totalQuestions);
        if (totalRounds <= 0) {
            throw new ConvexError("DECK_NOT_AVAILABLE");
        }
        const code = await generateUniqueCode(ctx);
        const now = Date.now();
        const nickname = sanitizeNickname(args.nickname, nicknameFallback);

        const roomId = await ctx.db.insert("liveMatchRooms", {
            code,
            hostId: userId ?? undefined,
            hostIdentity: identityId,
            status: "lobby",
            deckId: deck._id,
            rules: { ...DEFAULT_RULES, rounds: totalRounds },
            currentRound: 0,
            totalRounds,
            serverNow: now,
            phaseEndsAt: undefined,
            expiresAt: now + LOBBY_EXPIRES_MS,
            version: 1,
            createdAt: now,
        });

        const participantId = await ctx.db.insert("liveMatchParticipants", {
            roomId,
            userId: userId ?? undefined,
            identityId,
            isGuest: !userId,
            guestAvatarId: !userId
                ? (() => {
                    const key = requireGuestKey(args.guestKey);
                    return deriveGuestAvatarId(key) ?? undefined;
                })()
                : undefined,
            nickname,
            isHost: true,
            isReady: false,
            joinedAt: now,
            lastSeenAt: now,
            totalScore: 0,
            avgResponseMs: 0,
            answers: 0,
            disconnectedAt: undefined,
        });

        return { roomId, code, participantId, pendingAction: null };
    },
});

export const join = mutation({
    args: {
        code: v.string(),
        nickname: v.optional(v.string()),
        guestKey: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const code = args.code.trim().toUpperCase();
        let room = await ctx.db
            .query("liveMatchRooms")
            .withIndex("by_code", (q) => q.eq("code", code))
            .unique();
        if (!room) {
            throw new ConvexError("퀴즈룸을 찾을 수 없어요. 초대 코드를 확인해주세요.");
        }

        room = await ensureActiveRoom(ctx, room);
        if (!room) {
            return { expired: true };
        }

        const refreshResult = await refreshRoomParticipants(ctx, room);
        room = refreshResult.room;

        const now = Date.now();
        let userId: Id<"users"> | undefined;
        let identityId: string;
        let nicknameFallback: string;
        let existingRecord: ParticipantDoc | null = null;
        let isGuest = false;

        if (identity) {
            const { user, auth } = await ensureAuthedUser(ctx);
            userId = user._id;
            identityId = auth.identityId;
            nicknameFallback = user.handle;
            existingRecord = await ctx.db
                .query("liveMatchParticipants")
                .withIndex("by_room_user", (q) => q.eq("roomId", room._id).eq("userId", user._id))
                .first();
        } else {
            const guestKey = requireGuestKey(args.guestKey);
            isGuest = true;
            identityId = guestIdentity(guestKey);
            nicknameFallback = deriveGuestNickname(guestKey);
            existingRecord = await ctx.db
                .query("liveMatchParticipants")
                .withIndex("by_room_identity", (q) => q.eq("roomId", room._id).eq("identityId", identityId))
                .first();
        }

        const nickname =
            args.nickname !== undefined
                ? sanitizeNickname(args.nickname, nicknameFallback)
                : existingRecord?.nickname ?? nicknameFallback;

        if (existingRecord) {
            if (existingRecord.removedAt) {
                if (room.status !== "lobby") {
                    throw new ConvexError("퀴즈 진행 중에는 다시 입장할 수 없어요. 게임이 끝난 뒤 다시 시도해 주세요.");
                }
                await ctx.db.patch(existingRecord._id, {
                    removedAt: undefined,
                    disconnectedAt: undefined,
                    nickname,
                    lastSeenAt: now,
                    isHost: identityId === room.hostIdentity,
                    userId,
                    identityId,
                    isGuest,
                    guestAvatarId: isGuest
                        ? (() => {
                            const key = requireGuestKey(args.guestKey);
                            return deriveGuestAvatarId(key) ?? undefined;
                        })()
                        : undefined,
                    isReady: false,
                });
            } else {
                await ctx.db.patch(existingRecord._id, {
                    nickname,
                    lastSeenAt: now,
                    disconnectedAt: undefined,
                    isHost: identityId === room.hostIdentity,
                    userId,
                    identityId,
                    isGuest,
                    guestAvatarId: isGuest
                        ? (() => {
                            const key = requireGuestKey(args.guestKey);
                            return deriveGuestAvatarId(key) ?? undefined;
                        })()
                        : undefined,
                    isReady: false,
                });
            }
            await refreshRoomParticipants(ctx, room);
            const refreshedRoom = await loadRoom(ctx, room._id);
            return {
                roomId: refreshedRoom._id,
                participantId: existingRecord._id,
                pendingAction: refreshedRoom.pendingAction ?? null,
            };
        }

        const totalParticipants = await ctx.db
            .query("liveMatchParticipants")
            .withIndex("by_room", (q) => q.eq("roomId", room._id))
            .collect();
        const participantCount = totalParticipants.filter((p) => !p.removedAt).length;
        if (participantCount >= PARTICIPANT_LIMIT) {
            throw new ConvexError("퀴즈룸이 가득 찼어요. 다른 방을 찾아주세요.");
        }

        const participantId = await ctx.db.insert("liveMatchParticipants", {
            roomId: room._id,
            userId,
            identityId,
            isGuest,
            guestAvatarId: isGuest
                ? (() => {
                    const key = requireGuestKey(args.guestKey);
                    return deriveGuestAvatarId(key) ?? undefined;
                })()
                : undefined,
            nickname,
            isHost: identityId === room.hostIdentity,
            isReady: false,
            joinedAt: now,
            lastSeenAt: now,
            totalScore: 0,
            avgResponseMs: 0,
            answers: 0,
            disconnectedAt: undefined,
            removedAt: undefined,
        });

        await refreshRoomParticipants(ctx, room);
        const updatedRoom = await loadRoom(ctx, room._id);

        return {
            roomId: updatedRoom._id,
            participantId,
            pendingAction: updatedRoom.pendingAction ?? null,
        };
    },
});

export const leave = mutation({
    args: {
        roomId: v.id("liveMatchRooms"),
        participantId: v.id("liveMatchParticipants"),
        guestKey: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const participant = await requireParticipantAccess(
            ctx,
            args.roomId,
            args.participantId,
            args.guestKey
        );
        const room = await ensureActiveRoom(ctx, await loadRoom(ctx, args.roomId));
        if (!room) {
            return;
        }
        await ctx.db.patch(participant._id, {
            removedAt: Date.now(),
            isHost: false,
            disconnectedAt: undefined,
            isReady: false,
        });
        await refreshRoomParticipants(ctx, room);
    },
});

export const heartbeat = mutation({
    args: {
        roomId: v.id("liveMatchRooms"),
        participantId: v.id("liveMatchParticipants"),
        guestKey: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const participant = await requireParticipantAccess(
            ctx,
            args.roomId,
            args.participantId,
            args.guestKey
        );
        await ctx.db.patch(participant._id, { lastSeenAt: Date.now(), disconnectedAt: undefined });

        const roomDoc = await ctx.db.get(args.roomId);
        if (!roomDoc) {
            return;
        }
        const room = await ensureActiveRoom(ctx, roomDoc as RoomDoc);
        if (!room) {
            return;
        }
        const refreshed = await refreshRoomParticipants(ctx, room);

        if (room.pendingAction && room.pendingAction.executeAt <= Date.now()) {
            await performPendingAction(ctx, room);
        }
    },
});

export const setReady = mutation({
    args: {
        roomId: v.id("liveMatchRooms"),
        participantId: v.id("liveMatchParticipants"),
        ready: v.boolean(),
        guestKey: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const participant = await requireParticipantAccess(
            ctx,
            args.roomId,
            args.participantId,
            args.guestKey
        );
        const room = await ensureActiveRoom(ctx, await loadRoom(ctx, args.roomId));
        if (!room) {
            return;
        }
        if (room.status !== "lobby") {
            throw new ConvexError("로비 상태에서만 준비를 변경할 수 있어요.");
        }
        if (room.pendingAction && room.pendingAction.type === "start") {
            throw new ConvexError("게임 시작이 곧 진행되어 준비 상태를 변경할 수 없어요.");
        }
        await ctx.db.patch(participant._id, {
            isReady: args.ready,
            lastSeenAt: Date.now(),
            disconnectedAt: undefined,
        });
        await refreshRoomParticipants(ctx, room);
    },
});

export const start = mutation({
    args: {
        roomId: v.id("liveMatchRooms"),
        delayMs: v.optional(v.number()),
        guestKey: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        let room = await ensureActiveRoom(ctx, await loadRoom(ctx, args.roomId));
        if (!room) {
            return { expired: true };
        }
        const refreshed = await refreshRoomParticipants(ctx, room);
        room = refreshed.room;
        const activeParticipants = refreshed.participants;
        if (activeParticipants.length === 0) {
            throw new ConvexError("참가자가 없어 게임을 시작할 수 없어요.");
        }
        const nonHostParticipants = activeParticipants.filter(
            (participant) => !(participant.isHost ?? false)
        );
        if (
            nonHostParticipants.length > 0 &&
            nonHostParticipants.some((participant) => !(participant.isReady ?? false))
        ) {
            throw new ConvexError("게스트와 참가자 모두 준비를 완료해야 해요.");
        }
        const hostParticipant = await resolveHostParticipant(ctx, room, args.guestKey);
        if (room.status !== "lobby") {
            throw new ConvexError("ROOM_ALREADY_STARTED");
        }
        if (room.pendingAction) {
            throw new ConvexError("ACTION_PENDING");
        }
        const totalRounds = await regenerateRoomRounds(ctx, room);

        if (totalRounds === 0) {
            throw new ConvexError("NO_ROUNDS_AVAILABLE");
        }

        const delayMs = clampDelay(args.delayMs);
        const executeAt = Date.now() + delayMs;

        await ctx.db.patch(room._id, {
            totalRounds,
            rules: { ...room.rules, rounds: totalRounds },
            pendingAction: {
                type: "start",
                executeAt,
                delayMs,
                createdAt: Date.now(),
                initiatedBy: hostParticipant.userId ?? room.hostId ?? undefined,
                initiatedIdentity: hostParticipant.identityId,
                label: "게임 시작",
            },
            version: (room.version ?? 0) + 1,
        });

    },
});

export const progress = mutation({
    args: {
        roomId: v.id("liveMatchRooms"),
        guestKey: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        let room = await ensureActiveRoom(ctx, await loadRoom(ctx, args.roomId));
        if (!room) {
            return;
        }
        room = (await refreshRoomParticipants(ctx, room)).room;
        await resolveHostParticipant(ctx, room, args.guestKey);

        switch (room.status) {
            case "countdown": {
                const round = await loadRound(ctx, room._id, room.currentRound);
                if (!round) {
                    throw new ConvexError("ROUND_NOT_FOUND");
                }
                const now = Date.now();
                await ctx.db.patch(round._id, {
                    startedAt: now,
                    closedAt: undefined,
                    revealAt: undefined,
                });
                await ctx.db.patch(room._id, {
                    status: "question",
                    serverNow: now,
                    phaseEndsAt: now + DEFAULT_RULES.answerSeconds * 1000,
                    version: (room.version ?? 0) + 1,
                    pendingAction: undefined,
                    pauseState: undefined,
                });
                break;
            }
            case "question": {
                const round = await loadRound(ctx, room._id, room.currentRound);
                if (!round) {
                    throw new ConvexError("ROUND_NOT_FOUND");
                }
                const now = Date.now();
                await ctx.db.patch(round._id, {
                    closedAt: now,
                });
                await ctx.db.patch(room._id, {
                    status: "grace",
                    serverNow: now,
                    phaseEndsAt: now + DEFAULT_RULES.graceSeconds * 1000,
                    version: (room.version ?? 0) + 1,
                    pendingAction: undefined,
                    pauseState: undefined,
                });
                break;
            }
            case "grace": {
                const now = Date.now();
                await ctx.db.patch(room._id, {
                    status: "reveal",
                    serverNow: now,
                    phaseEndsAt: now + DEFAULT_RULES.revealSeconds * 1000,
                    version: (room.version ?? 0) + 1,
                    pendingAction: undefined,
                    pauseState: undefined,
                });
                break;
            }
            case "reveal": {
                const now = Date.now();
                await ctx.db.patch(room._id, {
                    status: "leaderboard",
                    serverNow: now,
                    phaseEndsAt: now + DEFAULT_RULES.leaderboardSeconds * 1000,
                    version: (room.version ?? 0) + 1,
                    pauseState: undefined,
                });
                break;
            }
            case "leaderboard": {
                const nextIndex = room.currentRound + 1;
                const now = Date.now();
                if (nextIndex >= room.totalRounds) {
                    await ctx.db.patch(room._id, {
                        status: "results",
                        currentRound: 0,
                        serverNow: now,
                        phaseEndsAt: undefined,
                        expiresAt: now + LOBBY_EXPIRES_MS,
                        version: (room.version ?? 0) + 1,
                        pendingAction: undefined,
                        pauseState: undefined,
                    });
                } else {
                    await ctx.db.patch(room._id, {
                        status: "countdown",
                        currentRound: nextIndex,
                        serverNow: now,
                        phaseEndsAt: now + DEFAULT_RULES.readSeconds * 1000,
                        version: (room.version ?? 0) + 1,
                        pendingAction: undefined,
                        pauseState: undefined,
                    });
                }
                break;
            }
            default:
                break;
        }
    },
});

export const pause = mutation({
    args: {
        roomId: v.id("liveMatchRooms"),
        guestKey: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        let room = await ensureActiveRoom(ctx, await loadRoom(ctx, args.roomId));
        if (!room) {
            return;
        }
        room = (await refreshRoomParticipants(ctx, room)).room;
        await resolveHostParticipant(ctx, room, args.guestKey);
        if (room.status === "paused") {
            return;
        }
        if (!PAUSABLE_STATUSES.has(room.status)) {
            throw new ConvexError("INVALID_STATE");
        }
        if (room.pendingAction) {
            throw new ConvexError("ACTION_PENDING");
        }

        const now = Date.now();
        const remainingMs = room.phaseEndsAt ? Math.max(0, room.phaseEndsAt - now) : undefined;

        await ctx.db.patch(room._id, {
            status: "paused",
            serverNow: now,
            phaseEndsAt: undefined,
            pauseState: {
                previousStatus: room.status,
                remainingMs,
                pausedAt: now,
            },
            version: (room.version ?? 0) + 1,
        });
    },
});

export const resume = mutation({
    args: {
        roomId: v.id("liveMatchRooms"),
        guestKey: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        let room = await ensureActiveRoom(ctx, await loadRoom(ctx, args.roomId));
        if (!room) {
            return;
        }
        room = (await refreshRoomParticipants(ctx, room)).room;
        await resolveHostParticipant(ctx, room, args.guestKey);
        if (room.status !== "paused" || !room.pauseState) {
            throw new ConvexError("INVALID_STATE");
        }
        const previousStatus = room.pauseState.previousStatus;
        if (previousStatus === "paused") {
            throw new ConvexError("INVALID_STATE");
        }

        const now = Date.now();
        const remainingMs = room.pauseState.remainingMs;

        if (previousStatus === "question" && remainingMs !== undefined) {
            const round = await loadRound(ctx, room._id, room.currentRound);
            if (round) {
                const answerWindowMs =
                    (room.rules?.answerSeconds ?? DEFAULT_RULES.answerSeconds) * 1000;
                const elapsedBeforePause = Math.max(
                    0,
                    Math.min(answerWindowMs, answerWindowMs - remainingMs)
                );
                const adjustedStart = now - elapsedBeforePause;
                await ctx.db.patch(round._id, {
                    startedAt: adjustedStart,
                });
            }
        }

        await ctx.db.patch(room._id, {
            status: previousStatus,
            serverNow: now,
            phaseEndsAt: remainingMs !== undefined ? now + remainingMs : undefined,
            pauseState: undefined,
            version: (room.version ?? 0) + 1,
        });
    },
});

export const submitAnswer = mutation({
    args: {
        roomId: v.id("liveMatchRooms"),
        participantId: v.id("liveMatchParticipants"),
        choiceIndex: v.number(),
        clientTs: v.number(),
        guestKey: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const room = await ensureActiveRoom(ctx, await loadRoom(ctx, args.roomId));
        if (!room) {
            return;
        }
        if (room.status !== "question" && room.status !== "grace") {
            throw new ConvexError("ROUND_NOT_ACTIVE");
        }

        const participant = await requireParticipantAccess(
            ctx,
            room._id,
            args.participantId,
            args.guestKey
        );

        const round = await loadRound(ctx, room._id, room.currentRound);
        if (!round) {
            throw new ConvexError("ROUND_NOT_FOUND");
        }

        const question = await ctx.db.get(round.questionId);
        if (!question) {
            throw new ConvexError("QUESTION_NOT_FOUND");
        }

        const existing = await ctx.db
            .query("liveMatchAnswers")
            .withIndex("by_participant_round", (q) =>
                q.eq("participantId", participant._id).eq("roundIndex", room.currentRound)
            )
            .unique();
        if (existing) {
            return;
        }

        const now = Date.now();
        const answerWindowMs =
            (room.rules?.answerSeconds ?? DEFAULT_RULES.answerSeconds) * 1000;
        const inferredStart =
            round.startedAt && round.startedAt > 0
                ? round.startedAt
                : room.phaseEndsAt
                    ? Math.max(0, room.phaseEndsAt - answerWindowMs)
                    : now;
        const elapsed = Math.max(0, now - inferredStart);
        const isCorrect = question.answerIndex === args.choiceIndex;
        const delta = computeScoreDelta(isCorrect, elapsed, DEFAULT_RULES);

        await ctx.db.insert("liveMatchAnswers", {
            roomId: room._id,
            roundIndex: room.currentRound,
            participantId: participant._id,
            choiceIndex: args.choiceIndex,
            receivedAt: now,
            isCorrect,
            scoreDelta: delta,
        });

        const totalAnswers = participant.answers + 1;
        const totalAvg = participant.avgResponseMs * participant.answers;
        const newAvg = (totalAvg + elapsed) / totalAnswers;

        await ctx.db.patch(participant._id, {
            totalScore: participant.totalScore + delta,
            answers: totalAnswers,
            avgResponseMs: newAvg,
            lastSeenAt: now,
        });
    },
});

export const finish = mutation({
    args: {
        roomId: v.id("liveMatchRooms"),
        guestKey: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        let room = await ensureActiveRoom(ctx, await loadRoom(ctx, args.roomId));
        if (!room) {
            return;
        }
        room = (await refreshRoomParticipants(ctx, room)).room;
        await resolveHostParticipant(ctx, room, args.guestKey);
        await ctx.db.patch(room._id, {
            status: "results",
            serverNow: Date.now(),
            phaseEndsAt: undefined,
            version: (room.version ?? 0) + 1,
            pendingAction: undefined,
            pauseState: undefined,
        });
    },
});

export const resetToLobby = mutation({
    args: {
        roomId: v.id("liveMatchRooms"),
        guestKey: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        let room = await ensureActiveRoom(ctx, await loadRoom(ctx, args.roomId));
        if (!room) {
            return;
        }
        room = (await refreshRoomParticipants(ctx, room)).room;
        await resolveHostParticipant(ctx, room, args.guestKey);

        if (room.status !== "results" && room.status !== "lobby") {
            throw new ConvexError("INVALID_STATE");
        }

        const now = Date.now();
        let totalRounds = room.totalRounds;

        if (room.status === "results") {
            totalRounds = await resetRoomState(ctx, room);
        }

        await ctx.db.patch(room._id, {
            status: "lobby",
            currentRound: 0,
            serverNow: now,
            phaseEndsAt: undefined,
            expiresAt: now + LOBBY_EXPIRES_MS,
            version: (room.version ?? 0) + 1,
            pendingAction: undefined,
            pauseState: undefined,
            totalRounds,
            rules: { ...room.rules, rounds: totalRounds },
        });
    },
});

export const requestLobby = mutation({
    args: {
        roomId: v.id("liveMatchRooms"),
        participantId: v.id("liveMatchParticipants"),
        delayMs: v.optional(v.number()),
        guestKey: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const participant = await requireParticipantAccess(
            ctx,
            args.roomId,
            args.participantId,
            args.guestKey
        );
        let room = await ensureActiveRoom(ctx, await loadRoom(ctx, args.roomId));
        if (!room) {
            return;
        }
        room = (await refreshRoomParticipants(ctx, room)).room;
        if (room.status !== "results") {
            throw new ConvexError("NOT_AVAILABLE");
        }

        if (room.pendingAction) {
            throw new ConvexError("ACTION_PENDING");
        }

        const delayMs = clampDelay(args.delayMs);
        const executeAt = Date.now() + delayMs;

        if (!participant.isHost) {
            await ctx.db.insert("liveMatchLogs", {
                roomId: room._id,
                type: "lobby_request",
                payload: {
                    participantId: participant._id,
                    userId: participant.userId ?? null,
                    nickname: participant.nickname,
                    delayMs,
                },
                createdAt: Date.now(),
            });
            return;
        }

        await ctx.db.patch(room._id, {
            pendingAction: {
                type: "toLobby",
                executeAt,
                delayMs,
                createdAt: Date.now(),
                initiatedBy: participant.userId ?? room.hostId ?? undefined,
                initiatedIdentity: participant.identityId,
                label: "대기실로",
            },
            version: (room.version ?? 0) + 1,
        });
    },
});

export const rematch = mutation({
    args: {
        roomId: v.id("liveMatchRooms"),
        delayMs: v.optional(v.number()),
        guestKey: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        let room = await ensureActiveRoom(ctx, await loadRoom(ctx, args.roomId));
        if (!room) {
            return;
        }
        room = (await refreshRoomParticipants(ctx, room)).room;
        const hostParticipant = await resolveHostParticipant(ctx, room, args.guestKey);
        if (room.status !== "results" && room.status !== "lobby") {
            throw new ConvexError("INVALID_STATE");
        }

        if (room.pendingAction) {
            throw new ConvexError("ACTION_PENDING");
        }

        const delayMs = clampDelay(args.delayMs);
        const executeAt = Date.now() + delayMs;

        await ctx.db.patch(room._id, {
            pendingAction: {
                type: "rematch",
                executeAt,
                delayMs,
                createdAt: Date.now(),
                initiatedBy: hostParticipant.userId ?? room.hostId ?? undefined,
                initiatedIdentity: hostParticipant.identityId,
                label: "리매치",
            },
            version: (room.version ?? 0) + 1,
        });
    },
});

export const getLobby = query({
    args: {
        code: v.string(),
    },
    handler: async (ctx, args) => {
        const room = await ctx.db
            .query("liveMatchRooms")
            .withIndex("by_code", (q) => q.eq("code", args.code.trim().toUpperCase()))
            .unique();
        if (!room) {
            return null;
        }

        const normalizedRoom =
            room.status === "results"
                ? { ...room, status: "lobby", currentRound: 0, phaseEndsAt: undefined }
                : room;

        const deckDoc = room.deckId ? await ctx.db.get(room.deckId) : null;
        const deckMeta = deckDoc
            ? {
                id: deckDoc._id,
                slug: deckDoc.slug,
                title: deckDoc.title,
                emoji: deckDoc.emoji,
                description: deckDoc.description,
                questionCount: deckDoc.totalQuestions,
            }
            : null;

        const participants = await ctx.db
            .query("liveMatchParticipants")
            .withIndex("by_room", (q) => q.eq("roomId", room._id))
            .collect();

        const activeParticipants = participants
            .filter((participant) => !participant.removedAt)
            .sort((a, b) => a.joinedAt - b.joinedAt);
        const now = Date.now();

        const userIds = activeParticipants
            .map((p) => p.userId)
            .filter((id): id is Id<"users"> => id !== undefined);

        const users =
            userIds.length > 0
                ? await Promise.all(userIds.map((id) => ctx.db.get(id)))
                : [];

        const usersById = new Map(
            users
                .filter((u): u is Doc<"users"> => u !== null)
                .map((u) => [u._id, u])
        );

        return {
            room: normalizedRoom,
            deck: deckMeta,
            participants: activeParticipants.map((p) => {
                const user = p.userId ? usersById.get(p.userId) : undefined;
                return {
                    participantId: p._id,
                    userId: p.userId ?? null,
                    avatarUrl: user?.avatarUrl ?? null,
                    isGuest: p.isGuest,
                    guestAvatarId: getParticipantGuestAvatarId(p),
                    nickname: p.nickname,
                    isHost: p.isHost,
                    isReady: p.isReady ?? false,
                    joinedAt: p.joinedAt,
                    isConnected: isParticipantConnected(p, now),
                }
            }),
            now: Date.now(),
        };
    },
});

type ClientRoomParticipant = {
    participantId: Id<"liveMatchParticipants">;
    userId: Id<"users"> | null;
    avatarUrl: string | null;
    isGuest: boolean;
    guestAvatarId: number | null;
    nickname: string;
    totalScore: number;
    isHost: boolean;
    answers: number;
    avgResponseMs: number;
    rank: number;
    isConnected: boolean;
    joinedAt: number;
    isReady: boolean;
    lastSeenAt: number;
    disconnectedAt: number | null;
};

type ClientRoomOkState = {
    status: "ok";
    room: RoomDoc;
    deck: {
        id: Id<"liveMatchDecks">;
        slug: string;
        title: string;
        emoji: string;
        description: string;
        questionCount: number;
    } | null;
    me: {
        participantId: Id<"liveMatchParticipants">;
        userId: Id<"users"> | null;
        isGuest: boolean;
        nickname: string;
        totalScore: number;
        isHost: boolean;
        answers: number;
        avgResponseMs: number;
        lastSeenAt: number;
        disconnectedAt: number | null;
    };
    participants: ClientRoomParticipant[];
    currentRound?: {
        index: number;
        question: {
            id: Id<"questions">;
            prompt: string;
            explanation?: string | null;
            choices: { id: string; text: string }[];
        };
        myAnswer?: {
            choiceIndex: number;
            isCorrect: boolean;
            scoreDelta: number;
        };
        reveal?: {
            correctChoice: number;
            distribution: number[];
        };
        leaderboard?: {
            top: {
                participantId: Id<"liveMatchParticipants">;
                userId: Id<"users"> | null;
                avatarUrl: string | null;
                guestAvatarId: number | null;
                nickname: string;
                totalScore: number;
                rank: number;
            }[];
            me?: {
                participantId: Id<"liveMatchParticipants">;
                userId: Id<"users"> | null;
                avatarUrl: string | null;
                guestAvatarId: number | null;
                nickname: string;
                totalScore: number;
                rank: number;
            };
        };
    };
    now: number;
};

export type ClientRoomState =
    | {
        status: "not_in_room";
    }
    | ClientRoomOkState;

export const getRoomState = query({
    args: {
        roomId: v.id("liveMatchRooms"),
        guestKey: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<ClientRoomState> => {
        const room = await loadRoom(ctx, args.roomId);
        const deckDoc = room.deckId ? await ctx.db.get(room.deckId) : null;
        const deckMeta = deckDoc
            ? {
                id: deckDoc._id,
                slug: deckDoc.slug,
                title: deckDoc.title,
                emoji: deckDoc.emoji,
                description: deckDoc.description,
                questionCount: deckDoc.totalQuestions,
            }
            : null;

        const authed = await getOptionalAuthedUser(ctx);
        const guestKey = normalizeGuestKey(args.guestKey);

        let meRecord: ParticipantDoc | null = null;
        if (authed) {
            meRecord = await ctx.db
                .query("liveMatchParticipants")
                .withIndex("by_room_user", (q) => q.eq("roomId", room._id).eq("userId", authed.user._id))
                .first();
        } else if (guestKey) {
            meRecord = await ctx.db
                .query("liveMatchParticipants")
                .withIndex("by_room_identity", (q) => q.eq("roomId", room._id).eq("identityId", guestIdentity(guestKey)))
                .first();
        } else {
            return { status: "not_in_room" };
        }

        if (!meRecord || meRecord.removedAt) {
            return { status: "not_in_room" };
        }
        const me = meRecord;

        const participants = (await ctx.db
            .query("liveMatchParticipants")
            .withIndex("by_room", (q) => q.eq("roomId", room._id))
            .collect()).filter((participant) => !participant.removedAt);

        const now = Date.now();
        participants.sort((a, b) => b.totalScore - a.totalScore || a.avgResponseMs - b.avgResponseMs);
        const rankedParticipants = attachRanks(participants);

        const participantUserIds = rankedParticipants
            .map((p) => p.userId)
            .filter((id): id is Id<"users"> => !!id);
        const participantUsers =
            participantUserIds.length > 0
                ? await Promise.all(participantUserIds.map((id) => ctx.db.get(id)))
                : [];
        const usersById = new Map(
            participantUsers
                .filter((u): u is Doc<"users"> => u !== null)
                .map((u) => [u._id, u])
        );

        const round = await loadRound(ctx, room._id, room.currentRound);

        let currentRound: ClientRoomOkState["currentRound"];
        if (round) {
            const question = await ctx.db.get(round.questionId);
            if (!question) {
                throw new ConvexError("QUESTION_NOT_FOUND");
            }

            const answers = await ctx.db
                .query("liveMatchAnswers")
                .withIndex("by_room_round", (q) => q.eq("roomId", room._id).eq("roundIndex", round.index))
                .collect();

            const myAnswer = answers.find((ans) => ans.participantId === me._id);
            const reveal = room.status === "reveal" || room.status === "results"
                ? (() => {
                    const distribution = new Array(question.choices.length).fill(0);
                    answers.forEach((ans) => {
                        if (ans.choiceIndex >= 0 && ans.choiceIndex < distribution.length) {
                            distribution[ans.choiceIndex] += 1;
                        }
                    });
                    return {
                        correctChoice: question.answerIndex,
                        distribution,
                    };
                })()
                : undefined;

            const leaderboard = (() => {
                const top = rankedParticipants.map((p) => {
                    const user = p.userId ? usersById.get(p.userId) : null;
                    return {
                        participantId: p._id,
                        userId: p.userId ?? null,
                        avatarUrl: user?.avatarUrl ?? null,
                        guestAvatarId: getParticipantGuestAvatarId(p),
                        nickname: p.nickname,
                        totalScore: p.totalScore,
                        rank: p.rank,
                    };
                });
                const meEntrySource = rankedParticipants.find((p) => p._id === me._id);
                const meEntry = meEntrySource
                    ? {
                        participantId: meEntrySource._id,
                        userId: meEntrySource.userId ?? null,
                        avatarUrl: meEntrySource.userId ? usersById.get(meEntrySource.userId)?.avatarUrl ?? null : null,
                        guestAvatarId: getParticipantGuestAvatarId(meEntrySource),
                        nickname: meEntrySource.nickname,
                        totalScore: meEntrySource.totalScore,
                        rank: meEntrySource.rank,
                    }
                    : undefined;
                return { top, me: meEntry };
            })();

            currentRound = {
                index: round.index,
                question: {
                    id: question._id,
                    prompt: question.prompt,
                    explanation: question.explanation ?? null,
                    choices: question.choices.map((choice, idx) => ({
                        id: choice.id ?? `${question._id}-${idx}`,
                        text: choice.text,
                    })),
                },
                myAnswer: myAnswer
                    ? {
                        choiceIndex: myAnswer.choiceIndex,
                        isCorrect: myAnswer.isCorrect,
                        scoreDelta: myAnswer.scoreDelta,
                    }
                    : undefined,
                reveal,
                leaderboard,
            };
        }

        return {
            status: "ok",
            room,
            deck: deckMeta,
            me: {
                participantId: me._id,
                userId: me.userId ?? null,
                isGuest: me.isGuest,
                nickname: me.nickname,
                totalScore: me.totalScore,
                isHost: me.isHost,
                answers: me.answers,
                avgResponseMs: me.avgResponseMs,
                lastSeenAt: me.lastSeenAt,
                disconnectedAt: me.disconnectedAt ?? null,
            },
            participants: rankedParticipants.map((p) => {
                const user = p.userId ? usersById.get(p.userId) : null;
                return {
                    participantId: p._id,
                    userId: p.userId ?? null,
                    avatarUrl: user?.avatarUrl ?? null,
                    isGuest: p.isGuest,
                    guestAvatarId: getParticipantGuestAvatarId(p),
                    nickname: p.nickname,
                    joinedAt: p.joinedAt,
                    totalScore: p.totalScore,
                    isHost: p.isHost,
                    answers: p.answers,
                    avgResponseMs: p.avgResponseMs,
                    rank: p.rank,
                    isReady: p.isReady ?? false,
                    isConnected: isParticipantConnected(p, now),
                    lastSeenAt: p.lastSeenAt,
                    disconnectedAt: p.disconnectedAt ?? null,
                };
            }),
            currentRound,
            now: Date.now(),
        };
    },
});
