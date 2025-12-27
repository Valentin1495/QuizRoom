#!/usr/bin/env node
/**
 * Merge fifth-grader seed batch json files into one file + print stats.
 * Dedupe rule: prompt + choices.text (normalized)
 *
 * Usage:
 *   node merge_fifth_seed.js <inputDir> <outFile> [--strict]
 *
 * Examples:
 *   node merge_fifth_seed.js seed/fifth/batches seed/fifth/merged/fifth_seed_merged.json
 *   node merge_fifth_seed.js seed/fifth/batches seed/fifth/merged/fifth_seed_merged.json --strict
 */

const fs = require("fs");
const path = require("path");

const SUBJECTS = ["korean", "math", "science", "social", "english", "life"];
const GRADES = [1, 2, 3, 4, 5, 6];

function isJsonFile(name) {
    return name.toLowerCase().endsWith(".json");
}

function readJson(p) {
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw);
}

function normalizeToArray(x) {
    return Array.isArray(x) ? x : [x];
}

function inc(map, key, by = 1) {
    map.set(key, (map.get(key) ?? 0) + by);
}

function printMap(title, map, keyOrder = null) {
    console.log(`\n=== ${title} ===`);
    const entries = Array.from(map.entries());

    if (keyOrder) {
        const extras = new Set(entries.map(([k]) => k));
        for (const k of keyOrder) {
            if (map.has(k)) {
                console.log(`${k}: ${map.get(k)}`);
                extras.delete(k);
            } else {
                console.log(`${k}: 0`);
            }
        }
        for (const k of Array.from(extras).sort()) {
            console.log(`${k}: ${map.get(k)}`);
        }
        return;
    }

    entries.sort((a, b) => (b[1] - a[1]) || String(a[0]).localeCompare(String(b[0])));
    for (const [k, v] of entries) console.log(`${k}: ${v}`);
}

function printSubjectGradeGrid(subjectGradeMap) {
    console.log(`\n=== Count by subject × grade ===`);
    const header = ["subject\\grade", ...GRADES.map(String)];
    console.log(header.join("\t"));

    for (const s of SUBJECTS) {
        const row = [s];
        for (const g of GRADES) {
            const key = `${s}|${g}`;
            row.push(String(subjectGradeMap.get(key) ?? 0));
        }
        console.log(row.join("\t"));
    }

    const unexpected = [];
    for (const [key, count] of subjectGradeMap.entries()) {
        const [s, gStr] = key.split("|");
        const g = Number(gStr);
        if (!SUBJECTS.includes(s) || !GRADES.includes(g)) {
            unexpected.push([key, count]);
        }
    }
    if (unexpected.length) {
        console.log(`\n⚠️ Unexpected (subject|grade) keys found:`);
        unexpected
            .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
            .slice(0, 50)
            .forEach(([k, v]) => console.log(`${k}: ${v}`));
        if (unexpected.length > 50) console.log(`... and ${unexpected.length - 50} more`);
    }
}

// Normalize for dedupe key: lower + remove spaces/punct + remove zero-width
function normKey(s) {
    return String(s ?? "")
        .toLowerCase()
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/[\s"'“”‘’.,!?(){}\[\]\-]/g, "")
        .trim();
}

// Build dedupe key: prompt + sorted choices texts (normalized)
function buildDedupeKey(item) {
    const prompt = normKey(item?.prompt);

    const choices = Array.isArray(item?.choices) ? item.choices : [];
    const choiceTexts = choices
        .map((c) => normKey(c?.text))
        .filter(Boolean)
        .sort(); // sort to ignore order differences

    return `${prompt}||${choiceTexts.join("|")}`;
}

function main() {
    const inputDir = process.argv[2];
    const outFile = process.argv[3];
    const strict = process.argv.includes("--strict");

    if (!inputDir || !outFile) {
        console.error("Usage: node merge_fifth_seed.js <inputDir> <outFile> [--strict]");
        process.exit(1);
    }

    const absIn = path.resolve(process.cwd(), inputDir);
    const absOut = path.resolve(process.cwd(), outFile);

    if (!fs.existsSync(absIn) || !fs.statSync(absIn).isDirectory()) {
        console.error(`Input dir not found: ${absIn}`);
        process.exit(1);
    }

    const files = fs
        .readdirSync(absIn)
        .filter(isJsonFile)
        .map((f) => path.join(absIn, f))
        .sort();

    if (files.length === 0) {
        console.error(`No .json files found in: ${absIn}`);
        process.exit(1);
    }

    const merged = [];

    // Dedupe tracking: key -> {file, idx, prompt}
    const seen = new Map();
    const duplicates = [];

    // Stats
    const bySubject = new Map();
    const byGrade = new Map();
    const bySubjectGrade = new Map();
    const byDeckSlug = new Map();

    for (const file of files) {
        let parsed;
        try {
            parsed = readJson(file);
        } catch (e) {
            console.error(`❌ Invalid JSON in ${file}: ${e.message}`);
            process.exit(1);
        }

        const arr = normalizeToArray(parsed);

        arr.forEach((item, idx) => {
            merged.push(item);

            // Dedupe: prompt + choices texts
            const key = buildDedupeKey(item);
            if (key !== "||") {
                if (seen.has(key)) {
                    const first = seen.get(key);
                    duplicates.push({
                        key,
                        prompt: item?.prompt ?? "",
                        first,
                        second: { file, idx },
                    });
                } else {
                    seen.set(key, { file, idx, prompt: item?.prompt ?? "" });
                }
            }

            // Stats
            const subject = typeof item?.subject === "string" ? item.subject : "unknown";
            const grade = Number.isInteger(item?.grade) ? item.grade : "unknown";
            const deckSlug = typeof item?.deckSlug === "string" ? item.deckSlug : "unknown";

            inc(bySubject, subject, 1);
            inc(byGrade, String(grade), 1);
            inc(byDeckSlug, deckSlug, 1);

            if (subject !== "unknown" && grade !== "unknown") {
                inc(bySubjectGrade, `${subject}|${grade}`, 1);
            }
        });
    }

    // Write output
    fs.mkdirSync(path.dirname(absOut), { recursive: true });
    fs.writeFileSync(absOut, JSON.stringify(merged, null, 2), "utf8");

    console.log(`✅ Merged ${files.length} file(s) into: ${absOut}`);
    console.log(`✅ Total items: ${merged.length}`);
    console.log(`Mode: ${strict ? "STRICT (duplicates fail)" : "WARNING (duplicates allowed)"}`);

    // Print stats
    printMap("Count by deckSlug", byDeckSlug);
    printMap("Count by subject", bySubject, SUBJECTS);
    printMap("Count by grade", byGrade, GRADES.map(String));
    printSubjectGradeGrid(bySubjectGrade);

    // Target check (optional): expecting 10 per subject×grade
    const targetPerCell = 10;
    let missingCells = 0;
    let wrongCells = 0;

    for (const s of SUBJECTS) {
        for (const g of GRADES) {
            const k = `${s}|${g}`;
            const count = bySubjectGrade.get(k) ?? 0;
            if (count === 0) missingCells++;
            if (count !== 0 && count !== targetPerCell) wrongCells++;
        }
    }
    console.log(`\n=== Target check (subject×grade should be ${targetPerCell} each) ===`);
    console.log(`Missing cells (0 count): ${missingCells}`);
    console.log(`Non-target cells (not ${targetPerCell}): ${wrongCells}`);

    // Duplicate report
    if (duplicates.length) {
        console.log(`\n⚠️ Found duplicates by (prompt + choices): ${duplicates.length}`);
        duplicates.slice(0, 30).forEach((d, i) => {
            console.log(`  [${i + 1}] prompt: "${d.prompt}"`);
            console.log(`      first:  ${d.first.file} @ item ${d.first.idx}`);
            console.log(`      second: ${d.second.file} @ item ${d.second.idx}`);
        });
        if (duplicates.length > 30) console.log(`... and ${duplicates.length - 30} more`);

        if (strict) {
            console.log("\n→ Strict mode: duplicates are not allowed. Exiting with code 2.");
            process.exit(2);
        } else {
            console.log("\n→ Warning mode: continuing (exit code 0).");
        }
    }
}

main();
