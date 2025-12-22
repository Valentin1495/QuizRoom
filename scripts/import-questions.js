#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

const LOCAL_ENV = path.resolve(process.cwd(), ".env.local");
dotenv.config({ path: LOCAL_ENV });
dotenv.config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SECRET_API_KEY = process.env.SUPABASE_SECRET_API_KEY;
const CHUNK_SIZE = 200;

if (!SUPABASE_URL || !SUPABASE_SECRET_API_KEY) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SECRET_API_KEY.");
  process.exit(1);
}

function normalizePrompt(prompt) {
  return String(prompt).trim().replace(/\s+/g, " ").toLowerCase();
}

function hashPrompt(prompt) {
  return crypto.createHash("sha256").update(normalizePrompt(prompt)).digest("hex");
}

function toIso(ts) {
  if (ts === undefined || ts === null) return null;
  const ms = ts < 1e12 ? ts * 1000 : ts;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function loadItems(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected array in ${filePath}`);
  }
  return parsed;
}

async function fetchDeckId(supabase, slug) {
  const { data, error } = await supabase.from("decks").select("id").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!data?.id) {
    throw new Error(`Deck not found for slug "${slug}". Create it first or check the slug.`);
  }
  return data.id;
}

async function fetchExistingHashes(supabase, deckId, hashes) {
  const existing = new Set();
  for (let i = 0; i < hashes.length; i += CHUNK_SIZE) {
    const chunk = hashes.slice(i, i + CHUNK_SIZE);
    if (chunk.length === 0) continue;
    const { data, error } = await supabase
      .from("questions")
      .select("prompt_hash")
      .eq("deck_id", deckId)
      .in("prompt_hash", chunk);
    if (error) throw error;
    for (const row of data ?? []) {
      existing.add(row.prompt_hash);
    }
  }
  return existing;
}

async function insertQuestions(supabase, rows) {
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from("questions").insert(chunk);
    if (error) throw error;
    process.stdout.write(".");
  }
  process.stdout.write(` ${rows.length} inserted\n`);
}

async function main() {
  const targetFile = process.argv[2];
  if (!targetFile) {
    console.error("Usage: node scripts/import-swipe-questions.js <path-to-json>");
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), targetFile);
  const items = await loadItems(filePath);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_API_KEY);

  const deckIds = new Map();
  for (const item of items) {
    if (!item?.deckSlug) continue;
    if (!deckIds.has(item.deckSlug)) {
      deckIds.set(item.deckSlug, await fetchDeckId(supabase, item.deckSlug));
    }
  }

  const rows = [];
  const seen = new Set();

  for (const item of items) {
    if (!item?.deckSlug || !item?.category || !item?.prompt || !Array.isArray(item?.choices)) {
      continue;
    }

    const prompt = String(item.prompt).trim();
    const promptHash = hashPrompt(prompt);
    const dedupeKey = `${item.deckSlug}:${promptHash}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const deckId = deckIds.get(item.deckSlug);
    if (!deckId) continue;

    const difficulty = typeof item.difficulty === "number" ? item.difficulty : 0.5;
    const elo =
      typeof item.elo === "number" ? item.elo : Math.round(1200 + (difficulty - 0.5) * 800);

    const row = {
      deck_id: deckId,
      category: item.category,
      type: item.type ?? "mcq",
      prompt,
      prompt_hash: promptHash,
      tags: Array.isArray(item.tags) ? item.tags : [],
      choices: item.choices,
      answer_index: Number.isFinite(item.answerIndex) ? Math.round(item.answerIndex) : 0,
      explanation: item.explanation ?? null,
      difficulty,
      quality_score: typeof item.qualityScore === "number" ? item.qualityScore : 0.5,
      elo,
      choice_shuffle_seed:
        typeof item.choiceShuffleSeed === "number" ? Math.round(item.choiceShuffleSeed) : null,
    };

    const createdAt = toIso(item.createdAt);
    if (createdAt) row.created_at = createdAt;

    rows.push(row);
  }

  if (rows.length === 0) {
    console.log("No valid rows to insert.");
    return;
  }

  const hashesByDeck = new Map();
  for (const row of rows) {
    if (!hashesByDeck.has(row.deck_id)) hashesByDeck.set(row.deck_id, []);
    hashesByDeck.get(row.deck_id).push(row.prompt_hash);
  }

  const existingByDeck = new Map();
  for (const [deckId, hashes] of hashesByDeck.entries()) {
    const uniqueHashes = Array.from(new Set(hashes));
    existingByDeck.set(deckId, await fetchExistingHashes(supabase, deckId, uniqueHashes));
  }

  const toInsert = rows.filter((row) => !existingByDeck.get(row.deck_id)?.has(row.prompt_hash));
  if (toInsert.length === 0) {
    console.log("All prompts already exist. Nothing to insert.");
    return;
  }

  await insertQuestions(supabase, toInsert);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
