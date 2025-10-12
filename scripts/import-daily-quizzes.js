#!/usr/bin/env node

require("dotenv/config");

const path = require("node:path");
const { readFile } = require("node:fs/promises");

const { ConvexHttpClient } = require("convex/browser");
const { api } = require("../convex/_generated/api.js");

async function loadQuizzes(relativeFilePath) {
  const filePath = path.resolve(process.cwd(), relativeFilePath);
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected array in ${filePath}`);
  }
  return parsed;
}

async function main() {
  const deploymentUrl = process.env.CONVEX_URL ?? process.env.EXPO_PUBLIC_CONVEX_URL;
  if (!deploymentUrl) {
    throw new Error("Set CONVEX_URL or EXPO_PUBLIC_CONVEX_URL to your Convex deployment URL.");
  }

  const targetFile = process.argv[2];
  if (!targetFile) {
    throw new Error("Usage: node scripts/import-daily-quizzes.js <path-to-json>");
  }

  const client = new ConvexHttpClient(deploymentUrl);
  const quizzes = await loadQuizzes(targetFile);

  for (const quiz of quizzes) {
    await client.mutation(api.daily.upsertQuiz, quiz);
    console.log(`Imported quiz for ${quiz.availableDate}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
