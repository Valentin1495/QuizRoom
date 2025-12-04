#!/usr/bin/env node

/**
 * Convex JSON snapshot -> Supabase SQL converter.
 *
 * Usage:
 *   node scripts/convert-convex-to-sql.js <snapshotDir> <outputFile>
 * Defaults:
 *   snapshotDir: snapshot_shiny-puma-615_1764836130755192515
 *   outputFile: supabase/migrations/00003_convex_data.sql
 *
 * Only collections with an explicit mapping will be converted.
 * Add more mappings in COLLECTION_MAPPINGS as you work through tables.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DEFAULT_SNAPSHOT_DIR = 'snapshot_shiny-puma-615_1764836130755192515';
const DEFAULT_OUTPUT = 'supabase/migrations/00003_convex_data.sql';

// Deterministic namespace so UUIDs stay stable across runs.
const UUID_NAMESPACE = 'quizroom-convex-export';
const idCache = new Map();

function uuidFromString(input) {
  const hash = crypto.createHash('sha1');
  hash.update(UUID_NAMESPACE);
  hash.update(String(input));
  const bytes = hash.digest();
  // v5 UUID layout
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
  // Heuristic: Convex sometimes stores seconds; if it's too small, treat as seconds.
  return ts < 1e12 ? ts * 1000 : ts;
}

function toIso(ts) {
  if (ts === undefined || ts === null) return null;
  const d = new Date(ensureMs(ts));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function escapeString(val) {
  return String(val).replace(/'/g, "''");
}

function arrayLiteral(arr) {
  if (!arr || arr.length === 0) return "'{}'::text[]";
  const escaped = arr
    .map((item) =>
      `"${String(item)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/'/g, "''")}"`
    )
    .join(',');
  return "'{" + escaped + "}'::text[]";
}

function formatValue(val) {
  if (val === undefined || val === null) return 'NULL';
  if (typeof val === 'number' || typeof val === 'bigint') return String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (Array.isArray(val)) {
    // If the array holds objects (e.g., choices) emit JSONB to match jsonb columns.
    const hasObject = val.some((v) => v && typeof v === 'object');
    return hasObject ? `'${escapeString(JSON.stringify(val))}'::jsonb` : arrayLiteral(val);
  }
  if (val instanceof Date) return `'${val.toISOString()}'`;
  if (typeof val === 'object') {
    return `'${escapeString(JSON.stringify(val))}'::jsonb`;
  }
  return `'${escapeString(val)}'`;
}

function buildInsert(table, rows) {
  if (!rows.length) return '';
  const columns = Object.keys(rows[0]);
  const values = rows
    .map((row) => {
      const formatted = columns.map((col) => formatValue(row[col]));
      return `(${formatted.join(', ')})`;
    })
    .join(',\n');
  return `-- ${table}\nINSERT INTO ${table} (${columns.join(', ')}) VALUES\n${values};\n\n`;
}

function readJsonl(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

// Map Convex collection -> Supabase table + row mapper.
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
      answer_index: doc.answerIndex,
      explanation: doc.explanation ?? null,
      difficulty: doc.difficulty ?? 0.5,
      quality_score: doc.qualityScore ?? 0.5,
      elo: doc.elo ?? 1200,
      choice_shuffle_seed: doc.choiceShuffleSeed ?? null,
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
      resolved_at: doc.resolvedAt ? toIso(doc.resolvedAt) : null,
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
  bookmarks: {
    table: 'bookmarks',
    map: (doc) => ({
      id: ensureUuid(doc._id),
      user_id: doc.userId ? ensureUuid(doc.userId) : null,
      question_id: doc.questionId ? ensureUuid(doc.questionId) : null,
      created_at: toIso(doc.createdAt ?? doc._creationTime),
    }),
  },
  // Add more collections here as you map them:
  // liveMatchLogs: { table: 'live_match_logs', map: (doc) => ({ ... }) },
};

function main() {
  const snapshotDir = process.argv[2] || DEFAULT_SNAPSHOT_DIR;
  const outputFile = process.argv[3] || DEFAULT_OUTPUT;

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

  if (!fs.existsSync(snapshotDir)) {
    console.error(`Snapshot directory not found: ${snapshotDir}`);
    process.exit(1);
  }

  const entries = fs.readdirSync(snapshotDir, { withFileTypes: true });
  const tableRows = {};
  const skipped = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('_')) continue; // skip meta folders

    const mapping = COLLECTION_MAPPINGS[entry.name];
    if (!mapping) {
      skipped.push(entry.name);
      continue;
    }

    const docPath = path.join(snapshotDir, entry.name, 'documents.jsonl');
    if (!fs.existsSync(docPath)) {
      console.warn(`No documents.jsonl for ${entry.name}, skipping.`);
      continue;
    }

    const docs = readJsonl(docPath);
    const rows = docs.map(mapping.map).filter(Boolean);
    if (!rows.length) continue;

    tableRows[mapping.table] = (tableRows[mapping.table] ?? []).concat(rows);
    console.log(`Mapped ${rows.length} rows from ${entry.name} -> ${mapping.table}`);
  }

  const orderedTables = [
    ...TABLE_ORDER,
    ...Object.keys(tableRows).filter((t) => !TABLE_ORDER.includes(t)).sort(),
  ];

  const sqlParts = orderedTables
    .map((table) => (tableRows[table] ? buildInsert(table, tableRows[table]) : ''))
    .filter(Boolean);
  const sql = sqlParts.filter(Boolean).join('');

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, sql, 'utf8');
  console.log(`\nWrote SQL to ${outputFile}`);

  if (skipped.length) {
    console.log(`Skipped collections (add mappings to include): ${skipped.join(', ')}`);
  }
}

main();
