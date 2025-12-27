#!/usr/bin/env node
/**
 * Validate fifth-grader seed JSON.
 * Usage:
 *   node validate_fifth_seed.js ./seed_fifth.json
 *
 * Expected input:
 * - Either an array of question objects
 * - Or a single question object
 */

const fs = require("fs");
const path = require("path");

const ALLOWED_SUBJECTS = new Set([
    "korean",
    "math",
    "science",
    "social",
    "english",
    "life",
]);

const ALLOWED_EDU_LEVELS = new Set(["elem_low", "elem_high"]);

const REQUIRED_FIELDS = [
    "deckSlug",
    "prompt",
    "choices",
    "answerIndex",
    "category",
    "type",
    "tags",
    "explanation",
    "grade",
    "subject",
    "eduLevel",
    "hint",
    "lifelineMeta",
    "createdAt",
];

const CHOICE_IDS = ["a", "b", "c", "d"];

function fail(errors, idx, msg) {
    errors.push(idx == null ? msg : `[item ${idx}] ${msg}`);
}

function isPlainObject(v) {
    return v != null && typeof v === "object" && !Array.isArray(v);
}

function hasTag(tags, prefixOrExact) {
    return tags.some((t) => t === prefixOrExact || t.startsWith(prefixOrExact));
}

function expectedEduLevelFromGrade(grade) {
    return grade >= 1 && grade <= 3 ? "elem_low" : "elem_high";
}

function normalizeKo(s) {
    return String(s)
        .toLowerCase()
        .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width 제거
        .replace(/[\s"'“”‘’.,!?(){}\[\]-]/g, "");
}

function tokenizeKo(s) {
    return String(s)
        .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width 제거
        .replace(/["'“”‘’.,!?(){}\[\]\-]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .split(" ")
        .filter(Boolean);
}

function hintLeaksAnswer(hint, answerText) {
    const hNorm = normalizeKo(hint);
    const aRaw = String(answerText ?? "").trim();
    const aNorm = normalizeKo(aRaw);

    if (!aRaw || !aNorm) return false;

    // 2글자 이상: 포함 검사
    if (aNorm.length >= 2) return hNorm.includes(aNorm);

    // 1글자: 토큰으로 등장하면 누설로 판단 (오탐 최소화)
    const tokens = tokenizeKo(hint);
    return tokens.includes(aRaw);
}

function validateOne(q, idx, errors) {
    if (!isPlainObject(q)) {
        fail(errors, idx, `Item is not an object`);
        return;
    }

    // Required fields present
    for (const f of REQUIRED_FIELDS) {
        if (!(f in q)) fail(errors, idx, `Missing field: ${f}`);
    }
    if (errors.length) return;

    // Basic type checks
    if (typeof q.deckSlug !== "string" || q.deckSlug.trim() === "")
        fail(errors, idx, `deckSlug must be a non-empty string`);

    if (typeof q.prompt !== "string" || q.prompt.trim() === "")
        fail(errors, idx, `prompt must be a non-empty string`);

    if (q.category !== "education")
        fail(errors, idx, `category must be "education"`);

    if (q.type !== "mcq") fail(errors, idx, `type must be "mcq"`);

    if (!Array.isArray(q.tags))
        fail(errors, idx, `tags must be an array of strings`);
    else if (!q.tags.every((t) => typeof t === "string"))
        fail(errors, idx, `tags must contain only strings`);

    if (typeof q.explanation !== "string" || q.explanation.trim() === "")
        fail(errors, idx, `explanation must be a non-empty string`);

    if (typeof q.hint !== "string" || q.hint.trim() === "")
        fail(errors, idx, `hint must be a non-empty string`);

    // Grade / Subject / EduLevel
    if (!Number.isInteger(q.grade) || q.grade < 1 || q.grade > 6)
        fail(errors, idx, `grade must be an integer 1..6`);

    if (typeof q.subject !== "string" || !ALLOWED_SUBJECTS.has(q.subject))
        fail(errors, idx, `subject must be one of ${Array.from(ALLOWED_SUBJECTS).join(", ")}`);

    if (typeof q.eduLevel !== "string" || !ALLOWED_EDU_LEVELS.has(q.eduLevel))
        fail(errors, idx, `eduLevel must be "elem_low" or "elem_high"`);

    if (Number.isInteger(q.grade)) {
        const expected = expectedEduLevelFromGrade(q.grade);
        if (q.eduLevel !== expected) {
            fail(
                errors,
                idx,
                `eduLevel mismatch: grade ${q.grade} expects "${expected}", got "${q.eduLevel}"`
            );
        }
    }

    // createdAt: unix seconds (rough range check)
    if (!Number.isInteger(q.createdAt))
        fail(errors, idx, `createdAt must be an integer (unix seconds)`);
    else {
        // Rough sanity: between 2000-01-01 and 2100-01-01 (seconds)
        const min = 946684800;  // 2000-01-01
        const max = 4102444800; // 2100-01-01
        if (q.createdAt < min || q.createdAt > max) {
            fail(errors, idx, `createdAt out of expected unix-seconds range: ${q.createdAt}`);
        }
    }

    // Tags rules
    if (Array.isArray(q.tags)) {
        if (!q.tags.includes("mode:fifth_grader"))
            fail(errors, idx, `tags must include "mode:fifth_grader"`);

        if (!hasTag(q.tags, "subject:"))
            fail(errors, idx, `tags must include "subject:<subject>"`);

        if (!hasTag(q.tags, "grade:"))
            fail(errors, idx, `tags must include "grade:<n>"`);

        // Optional: Ensure subject tag matches q.subject if present
        const subjTag = q.tags.find((t) => t.startsWith("subject:"));
        if (subjTag && subjTag !== `subject:${q.subject}`) {
            fail(errors, idx, `subject tag mismatch: ${subjTag} vs subject:${q.subject}`);
        }

        const gradeTag = q.tags.find((t) => t.startsWith("grade:"));
        if (gradeTag && gradeTag !== `grade:${q.grade}`) {
            fail(errors, idx, `grade tag mismatch: ${gradeTag} vs grade:${q.grade}`);
        }
    }

    // Choices validation
    if (!Array.isArray(q.choices)) {
        fail(errors, idx, `choices must be an array`);
        return;
    }
    if (q.choices.length !== 4) {
        fail(errors, idx, `choices must have exactly 4 items`);
        return;
    }

    const ids = [];
    const texts = [];
    for (const [i, c] of q.choices.entries()) {
        if (!isPlainObject(c)) {
            fail(errors, idx, `choices[${i}] must be an object`);
            continue;
        }
        if (!CHOICE_IDS.includes(c.id))
            fail(errors, idx, `choices[${i}].id must be one of a|b|c|d`);
        if (typeof c.text !== "string" || c.text.trim() === "")
            fail(errors, idx, `choices[${i}].text must be a non-empty string`);
        ids.push(c.id);
        texts.push(c.text);
    }

    // Ensure ids cover a,b,c,d uniquely (no duplicates)
    const idSet = new Set(ids);
    if (idSet.size !== 4) fail(errors, idx, `choices ids must be unique`);
    for (const cid of CHOICE_IDS) {
        if (!idSet.has(cid)) fail(errors, idx, `choices must include id "${cid}"`);
    }

    // answerIndex
    if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex > 3) {
        fail(errors, idx, `answerIndex must be an integer 0..3`);
    } else {
        const correctChoice = q.choices[q.answerIndex];
        if (!correctChoice || typeof correctChoice.text !== "string") {
            fail(errors, idx, `answerIndex points to invalid choice`);
        }
    }

    // Hint must NOT mention the correct choice text
    if (
        typeof q.hint === "string" &&
        Number.isInteger(q.answerIndex) &&
        q.answerIndex >= 0 &&
        q.answerIndex <= 3
    ) {
        const answerText = q.choices[q.answerIndex]?.text;
        if (typeof answerText === "string" && hintLeaksAnswer(q.hint, answerText)) {
            fail(errors, idx, `hint leaks the correct answer text: "${answerText}"`);
        }
    }

    // lifelineMeta validation
    if (!isPlainObject(q.lifelineMeta)) {
        fail(errors, idx, `lifelineMeta must be an object`);
    } else {
        const ff = q.lifelineMeta.fifty_fifty;
        if (!isPlainObject(ff)) {
            fail(errors, idx, `lifelineMeta.fifty_fifty must be an object`);
        } else {
            const pei = ff.preferredEliminateIds;
            if (!Array.isArray(pei)) {
                fail(errors, idx, `preferredEliminateIds must be an array`);
            } else {
                if (pei.length !== 2)
                    fail(errors, idx, `preferredEliminateIds must have exactly 2 ids`);
                const peiSet = new Set(pei);
                if (peiSet.size !== pei.length)
                    fail(errors, idx, `preferredEliminateIds must not contain duplicates`);

                // Must be valid ids
                for (const id of pei) {
                    if (!CHOICE_IDS.includes(id))
                        fail(errors, idx, `preferredEliminateIds contains invalid id: ${id}`);
                }

                // Must not include correct answer id
                if (Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex <= 3) {
                    const correctId = q.choices[q.answerIndex]?.id;
                    if (correctId && pei.includes(correctId)) {
                        fail(errors, idx, `preferredEliminateIds must not include correct choice id "${correctId}"`);
                    }
                }

                // Must reference existing choice ids
                const choiceIdSet = new Set(ids);
                for (const id of pei) {
                    if (!choiceIdSet.has(id))
                        fail(errors, idx, `preferredEliminateIds references missing choice id: ${id}`);
                }
            }
        }
    }
}

function main() {
    const file = process.argv[2];
    if (!file) {
        console.error("Usage: node validate_fifth_seed.js <path/to/seed.json>");
        process.exit(1);
    }

    const fullPath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(fullPath)) {
        console.error(`File not found: ${fullPath}`);
        process.exit(1);
    }

    let parsed;
    try {
        const raw = fs.readFileSync(fullPath, "utf8");
        parsed = JSON.parse(raw); // JSON lint happens here
    } catch (e) {
        console.error("❌ Invalid JSON:", e.message);
        process.exit(1);
    }

    const items = Array.isArray(parsed) ? parsed : [parsed];

    const errors = [];
    items.forEach((q, idx) => validateOne(q, idx, errors));

    if (errors.length) {
        console.error(`❌ Validation failed: ${errors.length} issue(s)\n`);
        for (const err of errors.slice(0, 200)) console.error("-", err);
        if (errors.length > 200) console.error(`... and ${errors.length - 200} more`);
        process.exit(1);
    }

    console.log(`✅ Validation OK: ${items.length} item(s)`);
}

main();
