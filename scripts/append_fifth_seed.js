#!/usr/bin/env node
/**
 * Append batch JSON files into fifth_seed_merged.json via merge_fifth_seed.js.
 *
 * Usage:
 *   node scripts/append_fifth_seed.js <fileOrDir> [moreFilesOrDirs...] [--strict]
 *   node scripts/append_fifth_seed.js --out <outFile> <fileOrDir>... [--strict]
 */

const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const DEFAULT_OUT = "assets/data/fifth/merged/fifth_seed_merged.json";

function isJsonFile(name) {
  return name.toLowerCase().endsWith(".json");
}

function resolveInputs(inputs) {
  const files = [];
  inputs.forEach((input) => {
    const full = path.resolve(process.cwd(), input);
    if (!fs.existsSync(full)) {
      throw new Error(`Input not found: ${input}`);
    }
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      const dirFiles = fs
        .readdirSync(full)
        .filter(isJsonFile)
        .map((name) => path.join(full, name));
      files.push(...dirFiles);
      return;
    }
    if (!stat.isFile() || !isJsonFile(full)) {
      throw new Error(`Input must be a .json file or directory: ${input}`);
    }
    files.push(full);
  });
  return files;
}

function copyInputsToTemp(tempDir, files, existingMerged) {
  let index = 0;
  if (existingMerged && fs.existsSync(existingMerged)) {
    const dest = path.join(tempDir, "existing_merged.json");
    fs.copyFileSync(existingMerged, dest);
  }
  files.forEach((file) => {
    const base = path.basename(file);
    const dest = path.join(tempDir, `input_${index++}_${base}`);
    fs.copyFileSync(file, dest);
  });
}

function main() {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");
  const filtered = args.filter((arg) => arg !== "--strict");

  let outFile = DEFAULT_OUT;
  let inputs = filtered;
  const outIndex = filtered.findIndex((arg) => arg === "--out" || arg === "-o");
  if (outIndex !== -1) {
    outFile = filtered[outIndex + 1];
    if (!outFile) {
      console.error("Missing output path after --out");
      process.exit(1);
    }
    inputs = filtered.slice(0, outIndex).concat(filtered.slice(outIndex + 2));
  }

  if (inputs.length === 0) {
    console.error(
      "Usage: node scripts/append_fifth_seed.js <fileOrDir>... [--strict] [--out <outFile>]"
    );
    process.exit(1);
  }

  const files = resolveInputs(inputs);
  if (files.length === 0) {
    console.error("No .json files found in inputs.");
    process.exit(1);
  }

  const absOut = path.resolve(process.cwd(), outFile);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fifth-merge-"));

  try {
    copyInputsToTemp(tempDir, files, absOut);
    const mergeArgs = [
      path.resolve(process.cwd(), "scripts/merge_fifth_seed.js"),
      tempDir,
      absOut,
    ];
    if (strict) mergeArgs.push("--strict");
    const result = childProcess.spawnSync("node", mergeArgs, { stdio: "inherit" });
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main();
