#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");

const DEFAULT_BATCH_DIR = "assets/data/fifth/batches";
const ELITE_DECK_SLUG = "deck_skill_assessment_elite_v1";
const ELITE_TAG = "mode:elite_round";

function isJsonFile(name) {
  return name.toLowerCase().endsWith(".json");
}

function isEliteBatchFile(name) {
  return isJsonFile(name) && name.includes("elite_round");
}

function resolveInputFiles(inputs) {
  const files = [];

  for (const input of inputs) {
    const full = path.resolve(process.cwd(), input);
    if (!fs.existsSync(full)) {
      throw new Error(`Input not found: ${input}`);
    }

    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      const dirFiles = fs
        .readdirSync(full)
        .filter(isEliteBatchFile)
        .sort()
        .map((name) => path.join(full, name));
      files.push(...dirFiles);
      continue;
    }

    if (!stat.isFile() || !isJsonFile(full)) {
      throw new Error(`Input must be a .json file or directory: ${input}`);
    }

    files.push(full);
  }

  return Array.from(new Set(files));
}

function loadItems(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected array in ${filePath}`);
  }
  return parsed;
}

function validateEliteBatch(filePath) {
  const items = loadItems(filePath);
  if (items.length === 0) {
    throw new Error(`Elite batch is empty: ${filePath}`);
  }

  items.forEach((item, index) => {
    const label = `${path.basename(filePath)}[#${index}]`;
    if (item?.deckSlug !== ELITE_DECK_SLUG) {
      throw new Error(`${label} deckSlug must be "${ELITE_DECK_SLUG}"`);
    }
    if (!Array.isArray(item?.tags) || !item.tags.includes(ELITE_TAG)) {
      throw new Error(`${label} must include tag "${ELITE_TAG}"`);
    }
  });
}

function importFile(filePath) {
  const relativePath = path.relative(process.cwd(), filePath) || filePath;
  console.log(`Importing ${relativePath}`);
  const result = childProcess.spawnSync("node", ["scripts/import-questions.js", relativePath], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main() {
  const args = process.argv.slice(2);
  const showHelp = args.includes("--help") || args.includes("-h");
  if (showHelp) {
    console.log(
      "Usage: node scripts/import-elite-round.js [fileOrDir ...]\n" +
        "Defaults to assets/data/fifth/batches and imports only *elite_round*.json files."
    );
    return;
  }

  const inputs = args.length > 0 ? args : [DEFAULT_BATCH_DIR];
  const files = resolveInputFiles(inputs);
  if (files.length === 0) {
    throw new Error("No elite round JSON files found.");
  }

  files.forEach(validateEliteBatch);
  files.forEach(importFile);
}

main();
