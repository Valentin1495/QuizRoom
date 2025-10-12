import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { ensureAuthedUser, getAuthedUser } from "./lib/auth";

type CtxWithDb = Pick<MutationCtx, "db"> | Pick<QueryCtx, "db">;

type PendingActionType = "start" | "rematch" | "toLobby";

type SchedulePendingActionOptions = {
    type: PendingActionType;
    delayMs?: number;
    initiatedBy: Id<"users">;
    label: string;
    patch?: Partial<RoomDoc>;
};

type RoomDoc = Doc<"partyRooms">;
type ParticipantDoc = Doc<"partyParticipants">;

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const DEFAULT_RULES = {
    rounds: 10,
    readSeconds: 3,
    answerSeconds: 10,
    graceSeconds: 2,
    revealSeconds: 6,
    leaderboardSeconds: 5,
};

const LOBBY_EXPIRES_MS = 1000 * 60 * 10;
const ACTION_DELAY_MIN_MS = 2000;
const ACTION_DELAY_MAX_MS = 10000;
const ACTION_DELAY_DEFAULT_MS = 3000;
const PARTICIPANT_LIMIT = 10;
const PARTICIPANT_TIMEOUT_MS = 30 * 1000;

type PartyRules = typeof DEFAULT_RULES;

export const cancelPendingAction = mutation({
    args: {
        roomId: v.id("partyRooms"),
    },
    handler: async (ctx, args) => {
        const { user } = await ensureAuthedUser(ctx);
        let room = await loadRoom(ctx, args.roomId);
        room = (await refreshRoomParticipants(ctx, room)).room;
        if (!room.pendingAction) {
            return;
        }
        if (room.hostId !== user._id) {
            throw new ConvexError("NOT_AUTHORIZED");
        }

        await ctx.db.patch(room._id, {
            pendingAction: undefined,
            version: (room.version ?? 0) + 1,
        });

        await ctx.db.insert("partyLogs", {
            roomId: room._id,
            type: "action_cancelled",
            payload: {
                type: room.pendingAction.type,
                cancelledAt: Date.now(),
                initiatedBy: room.pendingAction.initiatedBy,
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
            .query("partyRooms")
            .withIndex("by_code", (q) => q.eq("code", code))
            .first();
        if (!existing) {
            return code;
        }
    }
    throw new ConvexError("FAILED_TO_ALLOCATE_CODE");
}

async function resolveDeck(ctx: MutationCtx, deckId?: Id<"decks">) {
    if (deckId) {
        const deck = await ctx.db.get(deckId);
        if (!deck || deck.status !== "published") {
            throw new ConvexError("DECK_NOT_AVAILABLE");
        }
        return deck;
    }
    const deck = await ctx.db
        .query("decks")
        .withIndex("by_status", (q) => q.eq("status", "published"))
        .first();
    if (!deck) {
        throw new ConvexError("NO_DECK_AVAILABLE");
    }
    return deck;
}

async function loadRoom(ctx: CtxWithDb, roomId: Id<"partyRooms">) {
    const room = await ctx.db.get(roomId);
    if (!room) {
        throw new ConvexError("ROOM_NOT_FOUND");
    }
    return room;
}

async function resetRoomState(ctx: MutationCtx, room: RoomDoc) {
    const participants = await ctx.db
        .query("partyParticipants")
        .withIndex("by_room", (q) => q.eq("roomId", room._id))
        .collect();
    await Promise.all(
        participants.map((participant) =>
            ctx.db.patch(participant._id, {
                totalScore: 0,
                answers: 0,
                avgResponseMs: 0,
            })
        )
    );

    const rounds = await ctx.db
        .query("partyRounds")
        .withIndex("by_room", (q) => q.eq("roomId", room._id))
        .collect();
    await Promise.all(
        rounds.map((round) =>
            ctx.db.patch(round._id, {
                startedAt: 0,
                closedAt: undefined,
                revealAt: undefined,
            })
        )
    );

    const answers = await ctx.db
        .query("partyAnswers")
        .withIndex("by_room_round", (q) => q.eq("roomId", room._id))
        .collect();
    await Promise.all(answers.map((answer) => ctx.db.delete(answer._id)));
}

async function loadParticipant(
    ctx: CtxWithDb,
    roomId: Id<"partyRooms">,
    userId: Id<"users">
) {
    return ctx.db
        .query("partyParticipants")
        .withIndex("by_room_user", (q) => q.eq("roomId", roomId).eq("userId", userId))
        .first();
}

async function loadRound(
    ctx: CtxWithDb,
    roomId: Id<"partyRooms">,
    index: number
) {
    return ctx.db
        .query("partyRounds")
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
        .query("partyParticipants")
        .withIndex("by_room", (q) => q.eq("roomId", room._id))
        .collect();
    const now = Date.now();

    const inactiveParticipants = participants.filter((participant) => !isParticipantConnected(participant, now));
    if (inactiveParticipants.length > 0) {
        await Promise.all(inactiveParticipants.map((participant) => ctx.db.delete(participant._id)));
    }

    let activeParticipants = participants
        .filter((participant) => isParticipantConnected(participant, now))
        .sort((a, b) => a.joinedAt - b.joinedAt);

    let updatedRoom = room;
    if (activeParticipants.length > 0 && !activeParticipants.some((participant) => participant.userId === room.hostId)) {
        const newHost = activeParticipants[0];
        await ctx.db.patch(room._id, {
            hostId: newHost.userId,
            version: (room.version ?? 0) + 1,
        });
        await ctx.db.patch(newHost._id, { isHost: true });
        await Promise.all(
            activeParticipants
                .filter((participant) => participant._id !== newHost._id && participant.isHost)
                .map((participant) => ctx.db.patch(participant._id, { isHost: false }))
        );
        await ctx.db.insert("partyLogs", {
            roomId: room._id,
            type: "host_transferred",
            payload: {
                previousHost: room.hostId,
                newHost: newHost.userId,
                transferredAt: now,
            },
            createdAt: now,
        });
        updatedRoom = {
            ...room,
            hostId: newHost.userId,
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

    const hostParticipant = await loadParticipant(ctx, room._id, room.hostId);
    if (!hostParticipant) {
        await ctx.db.patch(room._id, {
            pendingAction: undefined,
            version: (room.version ?? 0) + 1,
        });
        await ctx.db.insert("partyLogs", {
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
                await ctx.db.insert("partyLogs", {
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
                .query("partyRounds")
                .withIndex("by_room", (q) => q.eq("roomId", room._id))
                .collect();
            if (existingRounds.length === 0) {
                const questions = await selectQuestions(ctx, deckId, room.totalRounds);
                for (let index = 0; index < questions.length; index += 1) {
                    await ctx.db.insert("partyRounds", {
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
                await ctx.db.insert("partyLogs", {
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
            await resetRoomState(ctx, room);
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
        case "toLobby": {
            if (room.status !== "results") {
                await ctx.db.patch(room._id, {
                    pendingAction: undefined,
                    version: (room.version ?? 0) + 1,
                });
                await ctx.db.insert("partyLogs", {
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
            await resetRoomState(ctx, room);
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
            initiatedBy: options.initiatedBy,
            label: options.label,
        },
        version: (room.version ?? 0) + 1,
    };
    await ctx.db.patch(room._id, patch);
    return { executeAt, delayMs };
}

async function loadPendingRoom(ctx: MutationCtx, roomId: Id<"partyRooms">) {
    const room = await ctx.db.get(roomId);
    if (!room) {
        throw new ConvexError("ROOM_NOT_FOUND");
    }
    return room;
}

function computeScoreDelta(isCorrect: boolean, elapsedMs: number, rules: PartyRules) {
    if (!isCorrect) return 0;
    const base = 100;
    const remainingSeconds = Math.max(0, rules.answerSeconds - elapsedMs / 1000);
    const bonus = Math.ceil((remainingSeconds / rules.answerSeconds) * 50);
    return base + bonus;
}

async function selectQuestions(
    ctx: MutationCtx,
    deckId: Id<"decks">,
    rounds: number
) {
    const questions = await ctx.db
        .query("questions")
        .withIndex("by_deck", (q) => q.eq("deckId", deckId))
        .collect();
    if (questions.length === 0) {
        throw new ConvexError("NO_QUESTIONS_AVAILABLE");
    }
    const shuffled = [...questions];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, rounds);
}

function sanitizeNickname(nickname?: string | null, fallback?: string) {
    const trimmed = nickname?.trim();
    if (trimmed && trimmed.length > 0) {
        return trimmed.slice(0, 24);
    }
    return fallback ?? "player";
}

export const create = mutation({
    args: {
        deckId: v.optional(v.id("decks")),
        nickname: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { user, auth } = await ensureAuthedUser(ctx);
        const deck = await resolveDeck(ctx, args.deckId);
        const code = await generateUniqueCode(ctx);
        const now = Date.now();

        const roomId = await ctx.db.insert("partyRooms", {
            code,
            hostId: user._id,
            status: "lobby",
            deckId: deck._id,
            rules: DEFAULT_RULES,
            currentRound: 0,
            totalRounds: DEFAULT_RULES.rounds,
            serverNow: now,
            phaseEndsAt: undefined,
            expiresAt: now + LOBBY_EXPIRES_MS,
            version: 1,
            createdAt: now,
        });

        await ctx.db.insert("partyParticipants", {
            roomId,
            userId: user._id,
            identityId: auth.identityId,
            nickname: sanitizeNickname(args.nickname, user.handle),
            isHost: true,
            joinedAt: now,
            lastSeenAt: now,
            totalScore: 0,
            avgResponseMs: 0,
            answers: 0,
        });

        return { roomId, code, pendingAction: null };
    },
});

export const join = mutation({
    args: {
        code: v.string(),
        nickname: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { user, auth } = await ensureAuthedUser(ctx);
        const code = args.code.trim().toUpperCase();
        let room = await ctx.db
            .query("partyRooms")
            .withIndex("by_code", (q) => q.eq("code", code))
            .unique();
        if (!room) {
            throw new ConvexError("ROOM_NOT_FOUND");
        }

        const refreshResult = await refreshRoomParticipants(ctx, room);
        room = refreshResult.room;
        const participants = refreshResult.participants;
        const existing = participants.find((p) => p.userId === user._id) ?? null;
        const nickname = sanitizeNickname(args.nickname, user.handle);
        const now = Date.now();

        if (!existing) {
            if (participants.length >= PARTICIPANT_LIMIT) {
                throw new ConvexError("ROOM_FULL");
            }
        }

        if (!existing) {
            await ctx.db.insert("partyParticipants", {
                roomId: room._id,
                userId: user._id,
                identityId: auth.identityId,
                nickname,
                isHost: user._id === room.hostId,
                joinedAt: now,
                lastSeenAt: now,
                totalScore: 0,
                avgResponseMs: 0,
                answers: 0,
            });
        } else {
            await ctx.db.patch(existing._id, {
                nickname,
                lastSeenAt: now,
            });
        }

        return {
            roomId: room._id,
            pendingAction: room.pendingAction ?? null,
        };
    },
});

export const heartbeat = mutation({
    args: {
        roomId: v.id("partyRooms"),
    },
    handler: async (ctx, args) => {
        const { user } = await ensureAuthedUser(ctx);
        const participant = await loadParticipant(ctx, args.roomId, user._id);
        if (!participant) {
            throw new ConvexError("NOT_IN_ROOM");
        }
        await ctx.db.patch(participant._id, { lastSeenAt: Date.now() });

        const roomDoc = await ctx.db.get(args.roomId);
        if (!roomDoc) {
            return;
        }
        const refreshed = await refreshRoomParticipants(ctx, roomDoc as RoomDoc);
        const room = refreshed.room;

        if (room.pendingAction && room.pendingAction.executeAt <= Date.now()) {
            await performPendingAction(ctx, room);
        }
    },
});

export const start = mutation({
    args: {
        roomId: v.id("partyRooms"),
        delayMs: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const { user } = await ensureAuthedUser(ctx);
        let room = await loadRoom(ctx, args.roomId);
        room = (await refreshRoomParticipants(ctx, room)).room;
        if (room.hostId !== user._id) {
            throw new ConvexError("NOT_AUTHORIZED");
        }
        if (room.status !== "lobby") {
            throw new ConvexError("ROOM_ALREADY_STARTED");
        }
        if (room.pendingAction) {
            throw new ConvexError("ACTION_PENDING");
        }
        const deckId = room.deckId;
        if (!deckId) {
            throw new ConvexError("DECK_NOT_SELECTED");
        }

        const existingRounds = await ctx.db
            .query("partyRounds")
            .withIndex("by_room", (q) => q.eq("roomId", room._id))
            .collect();
        let totalRounds = existingRounds.length;
        if (existingRounds.length === 0) {
            const questions = await selectQuestions(ctx, deckId, room.totalRounds);
            totalRounds = questions.length;
            for (let index = 0; index < questions.length; index += 1) {
                await ctx.db.insert("partyRounds", {
                    roomId: room._id,
                    index,
                    questionId: questions[index]._id,
                    startedAt: 0,
                    closedAt: undefined,
                    revealAt: undefined,
                });
            }
        }

        if (totalRounds === 0) {
            throw new ConvexError("NO_ROUNDS_AVAILABLE");
        }

        const delayMs = clampDelay(args.delayMs);
        const executeAt = Date.now() + delayMs;

        await ctx.db.patch(room._id, {
            totalRounds,
            pendingAction: {
                type: "start",
                executeAt,
                delayMs,
                createdAt: Date.now(),
                initiatedBy: user._id,
                label: "게임 시작",
            },
            version: room.version + 1,
        });
    },
});

export const progress = mutation({
    args: {
        roomId: v.id("partyRooms"),
    },
    handler: async (ctx, args) => {
        const { user } = await ensureAuthedUser(ctx);
        let room = await loadRoom(ctx, args.roomId);
        room = (await refreshRoomParticipants(ctx, room)).room;
        if (room.hostId !== user._id) {
            throw new ConvexError("NOT_AUTHORIZED");
        }

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
        roomId: v.id("partyRooms"),
    },
    handler: async (ctx, args) => {
        const { user } = await ensureAuthedUser(ctx);
        let room = await loadRoom(ctx, args.roomId);
        room = (await refreshRoomParticipants(ctx, room)).room;
        if (room.hostId !== user._id) {
            throw new ConvexError("NOT_AUTHORIZED");
        }
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
        roomId: v.id("partyRooms"),
    },
    handler: async (ctx, args) => {
        const { user } = await ensureAuthedUser(ctx);
        let room = await loadRoom(ctx, args.roomId);
        room = (await refreshRoomParticipants(ctx, room)).room;
        if (room.hostId !== user._id) {
            throw new ConvexError("NOT_AUTHORIZED");
        }
        if (room.status !== "paused" || !room.pauseState) {
            throw new ConvexError("INVALID_STATE");
        }
        const previousStatus = room.pauseState.previousStatus;
        if (previousStatus === "paused") {
            throw new ConvexError("INVALID_STATE");
        }

        const now = Date.now();
        const remainingMs = room.pauseState.remainingMs;

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
        roomId: v.id("partyRooms"),
        choiceIndex: v.number(),
        clientTs: v.number(),
    },
    handler: async (ctx, args) => {
        const { user } = await ensureAuthedUser(ctx);
        const room = await loadRoom(ctx, args.roomId);
        if (room.status !== "question") {
            throw new ConvexError("ROUND_NOT_ACTIVE");
        }

        const participant = await loadParticipant(ctx, room._id, user._id);
        if (!participant) {
            throw new ConvexError("NOT_IN_ROOM");
        }

        const round = await loadRound(ctx, room._id, room.currentRound);
        if (!round) {
            throw new ConvexError("ROUND_NOT_FOUND");
        }

        const question = await ctx.db.get(round.questionId);
        if (!question) {
            throw new ConvexError("QUESTION_NOT_FOUND");
        }

        const existing = await ctx.db
            .query("partyAnswers")
            .withIndex("by_room_user_round", (q) =>
                q
                    .eq("roomId", room._id)
                    .eq("userId", user._id)
                    .eq("roundIndex", room.currentRound)
            )
            .unique();
        if (existing) {
            return;
        }

        const now = Date.now();
        const elapsed = Math.max(0, now - (round.startedAt || now));
        const isCorrect = question.answerIndex === args.choiceIndex;
        const delta = computeScoreDelta(isCorrect, elapsed, DEFAULT_RULES);

        await ctx.db.insert("partyAnswers", {
            roomId: room._id,
            roundIndex: room.currentRound,
            userId: user._id,
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
        roomId: v.id("partyRooms"),
    },
    handler: async (ctx, args) => {
        const { user } = await ensureAuthedUser(ctx);
        let room = await loadRoom(ctx, args.roomId);
        room = (await refreshRoomParticipants(ctx, room)).room;
        if (room.hostId !== user._id) {
            throw new ConvexError("NOT_AUTHORIZED");
        }
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
        roomId: v.id("partyRooms"),
    },
    handler: async (ctx, args) => {
        const { user } = await ensureAuthedUser(ctx);
        let room = await loadRoom(ctx, args.roomId);
        room = (await refreshRoomParticipants(ctx, room)).room;

        if (room.hostId !== user._id) {
            throw new ConvexError("NOT_AUTHORIZED");
        }

        if (room.status !== "results" && room.status !== "lobby") {
            throw new ConvexError("INVALID_STATE");
        }

        const now = Date.now();

        if (room.status === "results") {
            await resetRoomState(ctx, room);
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
        });
    },
});

export const requestLobby = mutation({
    args: {
        roomId: v.id("partyRooms"),
        delayMs: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const { user } = await ensureAuthedUser(ctx);
        let room = await loadRoom(ctx, args.roomId);
        room = (await refreshRoomParticipants(ctx, room)).room;
        if (room.status !== "results") {
            throw new ConvexError("NOT_AVAILABLE");
        }

        if (room.pendingAction) {
            throw new ConvexError("ACTION_PENDING");
        }

        const delayMs = clampDelay(args.delayMs);
        const executeAt = Date.now() + delayMs;

        if (room.hostId !== user._id) {
            await ctx.db.insert("partyLogs", {
                roomId: room._id,
                type: "lobby_request",
                payload: {
                    userId: user._id,
                    nickname: sanitizeNickname(undefined, user.handle),
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
                initiatedBy: user._id,
                label: "대기실로",
            },
            version: (room.version ?? 0) + 1,
        });
    },
});

export const rematch = mutation({
    args: {
        roomId: v.id("partyRooms"),
        delayMs: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const { user } = await ensureAuthedUser(ctx);
        let room = await loadRoom(ctx, args.roomId);
        room = (await refreshRoomParticipants(ctx, room)).room;
        if (room.hostId !== user._id) {
            throw new ConvexError("NOT_AUTHORIZED");
        }
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
                initiatedBy: user._id,
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
            .query("partyRooms")
            .withIndex("by_code", (q) => q.eq("code", args.code.trim().toUpperCase()))
            .unique();
        if (!room) {
            return null;
        }

        const normalizedRoom =
            room.status === "results"
                ? { ...room, status: "lobby", currentRound: 0, phaseEndsAt: undefined }
                : room;

        const participants = await ctx.db
            .query("partyParticipants")
            .withIndex("by_room", (q) => q.eq("roomId", room._id))
            .collect();

        participants.sort((a, b) => a.joinedAt - b.joinedAt);
        const now = Date.now();

        return {
            room: normalizedRoom,
            participants: participants.map((p) => ({
                userId: p.userId,
                nickname: p.nickname,
                isHost: p.isHost,
                joinedAt: p.joinedAt,
                isConnected: isParticipantConnected(p, now),
            })),
            now: Date.now(),
        };
    },
});

export type ClientRoomState = {
    room: RoomDoc;
    me: ParticipantDoc;
    participants: {
        userId: Id<"users">;
        nickname: string;
        totalScore: number;
        isHost: boolean;
        answers: number;
        avgResponseMs: number;
        rank: number;
        isConnected: boolean;
    }[];
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
                userId: Id<"users">;
                nickname: string;
                totalScore: number;
                rank: number;
            }[];
            me?: {
                userId: Id<"users">;
                nickname: string;
                totalScore: number;
                rank: number;
            };
        };
    };
    now: number;
};

export const getRoomState = query({
    args: {
        roomId: v.id("partyRooms"),
    },
    handler: async (ctx, args): Promise<ClientRoomState> => {
        const { user } = await getAuthedUser(ctx);
        const room = await loadRoom(ctx, args.roomId);

        const me = await ctx.db
            .query("partyParticipants")
            .withIndex("by_room_user", (q) => q.eq("roomId", room._id).eq("userId", user._id))
            .first();
        if (!me) {
            throw new ConvexError("NOT_IN_ROOM");
        }

        const participants = await ctx.db
            .query("partyParticipants")
            .withIndex("by_room", (q) => q.eq("roomId", room._id))
            .collect();

        const now = Date.now();
        participants.sort((a, b) => b.totalScore - a.totalScore || a.avgResponseMs - b.avgResponseMs);
        const rankedParticipants = attachRanks(participants);

        const round = await loadRound(ctx, room._id, room.currentRound);

        let currentRound: ClientRoomState["currentRound"];
        if (round) {
            const question = await ctx.db.get(round.questionId);
            if (!question) {
                throw new ConvexError("QUESTION_NOT_FOUND");
            }

            const answers = await ctx.db
                .query("partyAnswers")
                .withIndex("by_room_round", (q) => q.eq("roomId", room._id).eq("roundIndex", round.index))
                .collect();

            const myAnswer = answers.find((ans) => ans.userId === user._id);
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
                const top = rankedParticipants.slice(0, 3).map((p) => ({
                    userId: p.userId,
                    nickname: p.nickname,
                    totalScore: p.totalScore,
                    rank: p.rank,
                }));
                const meEntrySource = rankedParticipants.find((p) => p.userId === user._id);
                const meEntry = meEntrySource
                    ? {
                        userId: meEntrySource.userId,
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
            room,
            me,
            participants: rankedParticipants.map((p) => ({
                userId: p.userId,
                nickname: p.nickname,
                totalScore: p.totalScore,
                isHost: p.isHost,
                answers: p.answers,
                avgResponseMs: p.avgResponseMs,
                rank: p.rank,
                isConnected: isParticipantConnected(p, now),
            })),
            currentRound,
            now: Date.now(),
        };
    },
});
