#!/usr/bin/env node

/**
 * Import Convex snapshot JSONL into Supabase via supabase-js (HTTPS, no 5432).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SECRET_API_KEY=... \
 *   node scripts/import-with-supabase.js [snapshotDir]
 *
 * Defaults:
 *   snapshotDir: snapshot_shiny-puma-615_1764836130755192515
 *
 * Notes:
 * - Uses secret api key, so run only in trusted environments.
 * - Upserts on `id` to keep the operation idempotent.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const SNAPSHOT_DIR = process.argv[2] || 'snapshot_shiny-puma-615_1764836130755192515';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_API_KEY = process.env.SUPABASE_SECRET_API_KEY;
const CHUNK_SIZE = 500;
const UUID_NAMESPACE = 'quizroom-convex-export';

if (!SUPABASE_URL || !SUPABASE_SECRET_API_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_API_KEY environment variables.');
  process.exit(1);
}

const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_API_KEY);
const idCache = new Map();

function toInt(val, fallback = null) {
  if (val === undefined || val === null) return fallback;
  const num = Number(val);
  if (Number.isNaN(num)) return fallback;
  return Math.round(num);
}

function uuidFromString(input) {
  const hash = crypto.createHash('sha1');
  hash.update(UUID_NAMESPACE);
  hash.update(String(input));
  const bytes = hash.digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

function ensureUuid(convexId) {
  if (idCache.has(convexId)) return idCache.get(convexId);
  const uuid = uuidFromString(convexId);
  idCache.set(convexId, uuid);
  return uuid;
}

function ensureMs(ts) {
  if (ts === undefined || ts === null) return null;
  return ts < 1e12 ? ts * 1000 : ts;
}

function toIso(ts) {
  const fixed = ensureMs(ts);
  if (fixed === null) return null;
  const d = new Date(fixed);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function readJsonl(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function batchUpsert(table, rows, onConflict = 'id') {
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) {
      console.error(`\nFailed at ${table} chunk starting ${i}:`, error);
      throw error;
    }
    process.stdout.write('.');
  }
  process.stdout.write(` ${table} (${rows.length})\n`);
}

// Convex collection -> Supabase table mapping with row transformers
const COLLECTION_MAPPINGS = {
  users: {
    table: 'users',
    map: (doc) => ({
      id: ensureUuid(doc._id),
      identity_id: doc.identityId,
      provider: doc.provider,
      handle: doc.handle,
      avatar_url: doc.avatarUrl ?? null,
      interests: doc.interests ?? [],
      streak: doc.streak ?? 0,
      last_streak_date: null,
      xp: doc.xp ?? 0,
      total_correct: doc.totalCorrect ?? 0,
      total_played: doc.totalPlayed ?? 0,
      cosmetics: doc.cosmetics ?? [],
      skill: doc.skill ?? { global: 1200, tags: [] },
      session_pref: doc.sessionPref ?? null,
      created_at: toIso(doc.createdAt ?? doc._creationTime),
    }),
  },
  decks: {
    table: 'decks',
    map: (doc) => ({
      id: ensureUuid(doc._id),
      slug: doc.slug,
      title: doc.title,
      description: doc.description ?? '',
      tags: doc.tags ?? [],
      author_id: doc.authorId ? ensureUuid(doc.authorId) : null,
      visibility: doc.visibility ?? 'public',
      language: doc.language ?? 'ko',
      plays: doc.plays ?? 0,
      likes: doc.likes ?? 0,
      status: doc.status ?? 'draft',
      created_at: toIso(doc.createdAt ?? doc._creationTime),
      updated_at: toIso(doc.updatedAt ?? doc._creationTime),
    }),
  },
  questions: {
    table: 'questions',
    map: (doc) => ({
      id: ensureUuid(doc._id),
      deck_id: doc.deckId ? ensureUuid(doc.deckId) : null,
      category: doc.category,
      type: doc.type ?? 'mcq',
      prompt: doc.prompt,
      prompt_hash: doc.promptHash,
      media_url: doc.mediaUrl ?? null,
      media_meta: doc.mediaMeta ?? null,
      tags: doc.tags ?? [],
      choices: doc.choices ?? [],
      answer_index: toInt(doc.answerIndex),
      explanation: doc.explanation ?? null,
      difficulty: doc.difficulty ?? 0.5,
      quality_score: doc.qualityScore ?? 0.5,
      elo: toInt(doc.elo, 1200),
      choice_shuffle_seed: toInt(doc.choiceShuffleSeed),
      created_at: toIso(doc.createdAt ?? doc._creationTime),
    }),
  },
  liveMatchDecks: {
    table: 'live_match_decks',
    map: (doc) => ({
      id: ensureUuid(doc._id),
      slug: doc.slug,
      title: doc.title,
      emoji: doc.emoji,
      description: doc.description ?? '',
      source_categories: doc.sourceCategories ?? [],
      question_ids: Array.isArray(doc.questionIds) ? doc.questionIds.map(ensureUuid) : [],
      total_questions: doc.totalQuestions ?? (doc.questionIds?.length ?? 0),
      is_active: doc.isActive ?? true,
      created_at: toIso(doc.createdAt ?? doc._creationTime),
      updated_at: toIso(doc.updatedAt ?? doc._creationTime),
    }),
  },
  liveMatchRooms: {
    table: 'live_match_rooms',
    map: (doc) => ({
      id: ensureUuid(doc._id),
      code: doc.code,
      host_id: doc.hostId ? ensureUuid(doc.hostId) : null,
      host_identity: doc.hostIdentity,
      status: doc.status ?? 'lobby',
      deck_id: doc.deckId ? ensureUuid(doc.deckId) : null,
      rules: doc.rules ?? null,
      current_round: doc.currentRound ?? 0,
      total_rounds: doc.totalRounds ?? doc.rules?.rounds ?? 10,
      server_now: doc.serverNow ?? null,
      phase_ends_at: doc.phaseEndsAt ?? null,
      expires_at: doc.expiresAt ?? null,
      version: doc.version ?? 1,
      pending_action: doc.pendingAction ?? null,
      pause_state: doc.pauseState ?? null,
      created_at: toIso(doc.createdAt ?? doc._creationTime),
    }),
  },
  liveMatchParticipants: {
    table: 'live_match_participants',
    map: (doc) => ({
      id: ensureUuid(doc._id),
      room_id: doc.roomId ? ensureUuid(doc.roomId) : null,
      user_id: doc.userId ? ensureUuid(doc.userId) : null,
      identity_id: doc.identityId,
      is_guest: doc.isGuest ?? false,
      guest_avatar_id: doc.guestAvatarId ?? null,
      nickname: doc.nickname,
      is_host: doc.isHost ?? false,
      is_ready: doc.isReady ?? false,
      joined_at: toIso(doc.joinedAt ?? doc._creationTime),
      last_seen_at: toIso(doc.lastSeenAt ?? doc._creationTime),
      total_score: doc.totalScore ?? 0,
      avg_response_ms: doc.avgResponseMs ?? 0,
      answers: doc.answers ?? 0,
      current_streak: doc.currentStreak ?? 0,
      max_streak: doc.maxStreak ?? 0,
      removed_at: doc.removedAt ? toIso(doc.removedAt) : null,
      disconnected_at: doc.disconnectedAt ? toIso(doc.disconnectedAt) : null,
    }),
  },
  liveMatchRounds: {
    table: 'live_match_rounds',
    map: (doc) => ({
      id: ensureUuid(doc._id),
      room_id: doc.roomId ? ensureUuid(doc.roomId) : null,
      index: doc.index,
      question_id: doc.questionId ? ensureUuid(doc.questionId) : null,
      started_at: doc.startedAt ?? 0,
      closed_at: doc.closedAt ?? null,
      reveal_at: doc.revealAt ?? null,
    }),
  },
  liveMatchAnswers: {
    table: 'live_match_answers',
    map: (doc) => ({
      id: ensureUuid(doc._id),
      room_id: doc.roomId ? ensureUuid(doc.roomId) : null,
      round_index: doc.roundIndex,
      participant_id: doc.participantId ? ensureUuid(doc.participantId) : null,
      choice_index: doc.choiceIndex,
      received_at: doc.receivedAt ?? 0,
      is_correct: doc.isCorrect ?? false,
      score_delta: doc.scoreDelta ?? 0,
    }),
  },
  liveMatchReactions: {
    table: 'live_match_reactions',
    map: (doc) => ({
      id: ensureUuid(doc._id),
      room_id: doc.roomId ? ensureUuid(doc.roomId) : null,
      round_index: doc.roundIndex ?? null,
      participant_id: doc.participantId ? ensureUuid(doc.participantId) : null,
      emoji: doc.emoji,
      created_at: toIso(doc.createdAt ?? doc._creationTime),
    }),
  },
  reports: {
    table: 'reports',
    map: (doc) => ({
      id: ensureUuid(doc._id),
      reporter_id: doc.reporterId ? ensureUuid(doc.reporterId) : null,
      deck_id: doc.deckId ? ensureUuid(doc.deckId) : null,
      question_id: doc.questionId ? ensureUuid(doc.questionId) : null,
      reason: doc.reason,
      note: doc.note ?? null,
      resolved: doc.resolved ?? false,
      created_at: toIso(doc.createdAt ?? doc._creationTime),
    }),
  },
  guestReports: {
    table: 'guest_reports',
    map: (doc) => ({
      id: ensureUuid(doc._id),
      deck_slug: doc.deckSlug,
      category: doc.category,
      prompt: doc.prompt,
      reason: doc.reason,
      note: doc.note ?? null,
      choice_id: doc.choiceId ?? null,
      metadata: doc.metadata ?? null,
      created_at: toIso(doc.createdAt ?? doc._creationTime),
    }),
  },
  guestSwipeAnswers: {
    table: 'guest_swipe_answers',
    map: (doc) => ({
      id: ensureUuid(doc._id),
      session_key: doc.sessionKey,
      question_id: doc.questionId,
      deck_slug: doc.deckSlug,
      category: doc.category,
      prompt: doc.prompt,
      choice_id: doc.choiceId,
      is_correct: doc.isCorrect ?? false,
      time_ms: doc.timeMs ?? null,
      tags: doc.tags ?? [],
      difficulty: doc.difficulty ?? null,
      metadata: doc.metadata ?? null,
      created_at: toIso(doc.createdAt ?? doc._creationTime),
    }),
  },
  quizHistory: {
    table: 'quiz_history',
    map: (doc) => ({
      id: ensureUuid(doc._id),
      user_id: doc.userId ? ensureUuid(doc.userId) : null,
      session_id: doc.sessionId,
      mode: doc.mode,
      payload: doc.payload ?? null,
      created_at: toIso(doc.createdAt ?? doc._creationTime),
    }),
  },
  dailyQuizzes: {
    table: 'daily_quizzes',
    map: (doc) => ({
      id: ensureUuid(doc._id),
      available_date: doc.availableDate,
      category: doc.category,
      questions: doc.questions ?? [],
      share_template: doc.shareTemplate ?? null,
      created_at: toIso(doc.createdAt ?? doc._creationTime),
    }),
  },
  bookmarks: {
    table: 'bookmarks',
    map: (doc) => ({
      id: ensureUuid(doc._id),
      user_id: doc.userId ? ensureUuid(doc.userId) : null,
      question_id: doc.questionId ? ensureUuid(doc.questionId) : null,
      created_at: toIso(doc.createdAt ?? doc._creationTime),
    }),
  },
  answers: {
    table: 'answers',
    map: (doc) => ({
      id: ensureUuid(doc._id),
      user_id: doc.userId ? ensureUuid(doc.userId) : null,
      question_id: doc.questionId ? ensureUuid(doc.questionId) : null,
      answer_token: doc.answerToken,
      category: doc.category,
      choice_id: doc.choiceId,
      is_correct: doc.isCorrect ?? false,
      time_ms: doc.timeMs ?? 0,
      tags: doc.tags ?? [],
      created_at: toIso(doc.createdAt ?? doc._creationTime),
    }),
  },
};

const TABLE_ORDER = [
  'users',
  'decks',
  'questions',
  'live_match_decks',
  'live_match_rooms',
  'live_match_participants',
  'live_match_rounds',
  'live_match_answers',
  'live_match_reactions',
  'daily_quizzes',
  'reports',
  'guest_reports',
  'guest_swipe_answers',
  'quiz_history',
  'bookmarks',
  'answers',
];

async function main() {
  if (!fs.existsSync(SNAPSHOT_DIR)) {
    console.error(`Snapshot directory not found: ${SNAPSHOT_DIR}`);
    process.exit(1);
  }

  for (const [collection, { table, map }] of Object.entries(COLLECTION_MAPPINGS)) {
    const docPath = path.join(SNAPSHOT_DIR, collection, 'documents.jsonl');
    if (!fs.existsSync(docPath)) {
      console.warn(`Skip ${collection}: ${docPath} not found`);
      continue;
    }
    const docs = readJsonl(docPath);
    const rows = docs.map(map).filter(Boolean);
    COLLECTION_MAPPINGS[collection].rows = rows; // stash for ordering
  }

  const ordered = [
    ...TABLE_ORDER,
    ...Object.keys(COLLECTION_MAPPINGS).filter((c) => !TABLE_ORDER.includes(COLLECTION_MAPPINGS[c].table)),
  ];

  // Guard against orphaned rows that violate FKs (e.g., reactions without a room).
  const liveMatchRoomIds = new Set(COLLECTION_MAPPINGS.liveMatchRooms?.rows?.map((r) => r.id) ?? []);
  if (COLLECTION_MAPPINGS.liveMatchReactions?.rows) {
    COLLECTION_MAPPINGS.liveMatchReactions.rows = COLLECTION_MAPPINGS.liveMatchReactions.rows.filter(
      (r) => !r.room_id || liveMatchRoomIds.has(r.room_id)
    );
  }

  for (const collection of ordered) {
    const mapping = Object.values(COLLECTION_MAPPINGS).find((m) => m.table === collection);
    if (!mapping?.rows || mapping.rows.length === 0) continue;
    await batchUpsert(mapping.table, mapping.rows);
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
