import { ConvexError, v } from "convex/values";

import { categories as CATEGORY_METADATA } from "../constants/categories";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { ensureAuthedUser, getAuthedUser } from "./lib/auth";

const DEFAULT_FEED_LIMIT = 20;
const MAX_FEED_LIMIT = 50;
const MIN_ELO = 600;
const MAX_ELO = 2400;
const DEFAULT_USER_ELO = 1200;
const USER_K = 24;
const QUESTION_K = 16;
const GLOBAL_TAG = "__global";
const MAX_RECENT_EXCLUDE = 20;
const MAX_RECENT_HISTORY = 50;
const FEED_RESET_MS = 24 * 60 * 60 * 1000;
const PRIMARY_CATEGORY_WEIGHT = 0.75;
const SECONDARY_CATEGORY_WEIGHTS = [0.15, 0.1];
const FALLBACK_CATEGORY_WEIGHT = 0.05;
const FALLBACK_CATEGORY_SLUG = "general_knowledge";
const NOVELTY_BONUS = 0.2;
const MIN_WEIGHT = 0.0001;
const RECENT_ANSWERS_LOOKBACK = 120;
const TOKEN_VERSION = "v1";
const TOKEN_TTL_MS = 1000 * 60 * 10;
const ANSWER_TOKEN_SECRET =
  process.env.ANSWER_TOKEN_SECRET ?? "quizroom-dev-secret";
type QuestionDoc = Doc<"questions">;
type SkillState = NonNullable<Doc<"users">["skill"]>;
type DbContext = Pick<QueryCtx, "db">;

type WeightedQuestion = {
  question: QuestionDoc;
  weight: number;
};

const normalizeTag = (tag: string) => tag.trim().toLowerCase();

const CATEGORY_SLUG_SET = new Set(
  CATEGORY_METADATA.map((category) => normalizeTag(category.slug))
);

const CATEGORY_ADJACENCY = CATEGORY_METADATA.reduce<
  Record<string, { slug: string; weight: number }[]>
>((acc, category) => {
  const normalizedSlug = normalizeTag(category.slug);
  acc[normalizedSlug] =
    category.neighbors?.map((neighbor) => ({
      slug: normalizeTag(neighbor.slug),
      weight: neighbor.weight,
    })) ?? [];
  return acc;
}, {});

const CATEGORY_MAP = CATEGORY_METADATA.reduce<Map<string, (typeof CATEGORY_METADATA)[number]>>(
  (map, category) => map.set(normalizeTag(category.slug), category),
  new Map()
);

const timingSafeEquals = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
};

const hashWithSeed = (input: string, seed: number) => {
  let hash = seed >>> 0;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x9e3779b1);
    hash = (hash << 13) | (hash >>> 19);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const computeSignature = (...parts: string[]) => {
  const base = parts.join(":");
  const withSecret = `${base}:${ANSWER_TOKEN_SECRET}`;
  const h1 = hashWithSeed(withSecret, 0x811c9dc5);
  const h2 = hashWithSeed(withSecret.split("").reverse().join(""), 0x1b873593);
  const h3 = hashWithSeed(`${withSecret}:${withSecret.length}`, 0x85ebca6b);
  return `${h1}${h2}${h3}`;
};

const generateAnswerToken = (
  questionId: Id<"questions">,
  userId: Id<"users">,
  seed: number,
  categorySlug: string
) => {
  const issuedAt = Date.now();
  const normalizedCategory = normalizeTag(categorySlug);
  const payload = `${questionId}:${seed}:${normalizedCategory}:${issuedAt}`;
  const signature = computeSignature(TOKEN_VERSION, payload, userId);
  return `${TOKEN_VERSION}:${payload}:${signature}`;
};

const parseAnswerToken = (
  token: string,
  expectedQuestionId: Id<"questions">,
  userId: Id<"users">
) => {
  const parts = token.split(":");
  if (parts.length !== 6) {
    throw new ConvexError("INVALID_TOKEN");
  }
  const [version, questionId, seedStr, categorySlug, issuedAtStr, signature] = parts;
  if (version !== TOKEN_VERSION) {
    throw new ConvexError("INVALID_TOKEN");
  }
  if (questionId !== expectedQuestionId) {
    throw new ConvexError("INVALID_TOKEN");
  }
  const seed = Number(seedStr);
  const issuedAt = Number(issuedAtStr);
  if (!Number.isSafeInteger(seed) || !Number.isSafeInteger(issuedAt)) {
    throw new ConvexError("INVALID_TOKEN");
  }
  const expectedSignature = computeSignature(
    version,
    `${questionId}:${seed}:${categorySlug}:${issuedAt}`,
    userId
  );
  if (!timingSafeEquals(signature, expectedSignature)) {
    throw new ConvexError("INVALID_TOKEN");
  }
  if (Date.now() - issuedAt > TOKEN_TTL_MS) {
    throw new ConvexError("TOKEN_EXPIRED");
  }
  return {
    seed,
    categorySlug: normalizeTag(categorySlug),
    issuedAt,
  };
};

const mulberry32 = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), value | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

type ShuffledChoice = {
  choice: QuestionDoc["choices"][number];
  originalIndex: number;
};

const shuffleChoices = (
  choices: QuestionDoc["choices"],
  seed: number
): ShuffledChoice[] => {
  const rng = mulberry32(seed);
  const entries = choices.map((choice, index) => ({ choice, originalIndex: index }));
  for (let index = entries.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [entries[index], entries[swapIndex]] = [entries[swapIndex], entries[index]];
  }
  return entries;
};

const buildCategoryPreference = (
  primaryCategory: string | null,
  secondarySeeds: string[],
  interestSeeds: string[]
) => {
  const weights = new Map<string, number>();
  if (primaryCategory) {
    const normalizedPrimary = normalizeTag(primaryCategory);
    if (normalizedPrimary && CATEGORY_SLUG_SET.has(normalizedPrimary)) {
      weights.set(normalizedPrimary, PRIMARY_CATEGORY_WEIGHT);
      const adjacency = CATEGORY_ADJACENCY[normalizedPrimary] ?? [];
      adjacency.forEach(({ slug, weight }) => {
        const normalized = normalizeTag(slug);
        if (!normalized || !CATEGORY_SLUG_SET.has(normalized)) {
          return;
        }
        const current = weights.get(normalized);
        if (current === undefined || weight > current) {
          weights.set(normalized, weight);
        }
      });
    }
  }

  secondarySeeds.slice(0, SECONDARY_CATEGORY_WEIGHTS.length).forEach((category, index) => {
    const normalized = normalizeTag(category);
    if (!normalized || !CATEGORY_SLUG_SET.has(normalized)) {
      return;
    }
    const weight = SECONDARY_CATEGORY_WEIGHTS[index];
    const current = weights.get(normalized);
    if (current === undefined || weight > current) {
      weights.set(normalized, weight);
    }
  });

  interestSeeds.forEach((interest, index) => {
    const normalized = normalizeTag(interest);
    if (!normalized || !CATEGORY_SLUG_SET.has(normalized)) {
      return;
    }
    if (weights.has(normalized)) {
      return;
    }
    const weight = index === 0 ? 0.12 : 0.08;
    weights.set(normalized, weight);
  });

  if (!weights.has(FALLBACK_CATEGORY_SLUG)) {
    weights.set(FALLBACK_CATEGORY_SLUG, FALLBACK_CATEGORY_WEIGHT);
  }

  return weights;
};

const resolveCategoryWeight = (preference: Map<string, number>, normalizedTags: string[]) => {
  if (!normalizedTags.length) {
    return preference.get(FALLBACK_CATEGORY_SLUG) ?? FALLBACK_CATEGORY_WEIGHT;
  }
  let best = 0;
  normalizedTags.forEach((tag) => {
    const candidate = preference.get(tag);
    if (candidate !== undefined && candidate > best) {
      best = candidate;
    }
  });
  if (best > 0) {
    return best;
  }
  return preference.get(FALLBACK_CATEGORY_SLUG) ?? FALLBACK_CATEGORY_WEIGHT;
};

const computeTagAccuracy = async (ctx: DbContext, userId: Id<"users">) => {
  const answers = await ctx.db
    .query("answers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(RECENT_ANSWERS_LOOKBACK);

  const stats = new Map<string, { correct: number; total: number }>();
  const questionCache = new Map<string, QuestionDoc | null>();

  for (const answer of answers) {
    const key = answer.questionId.toString();
    let question = questionCache.get(key);
    if (question === undefined) {
      question = await ctx.db.get(answer.questionId);
      questionCache.set(key, question ?? null);
    }
    if (!question?.tags?.length) {
      continue;
    }
    question.tags.forEach((tag) => {
      const normalized = normalizeTag(tag);
      if (!normalized) {
        return;
      }
      const entry = stats.get(normalized) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (answer.isCorrect) {
        entry.correct += 1;
      }
      stats.set(normalized, entry);
    });
  }

  const accuracy = new Map<string, number>();
  stats.forEach((value, key) => {
    accuracy.set(key, value.total > 0 ? value.correct / value.total : 0.5);
  });
  return accuracy;
};

const computeTagWeight = (
  rawTags: string[],
  normalizedTags: string[],
  skill: SkillState,
  questionElo: number,
  accuracy: Map<string, number>
) => {
  if (!rawTags.length) {
    return 0.4;
  }
  const skillAlignment =
    rawTags.reduce((acc, tag) => {
      const rating = getTagRating(skill, tag);
      const diff = Math.abs(rating - questionElo);
      return acc + (1 - clamp(diff / 500, 0, 1));
    }, 0) / rawTags.length;

  const exploration =
    normalizedTags.reduce((acc, tag) => {
      const rate = accuracy.get(tag);
      if (rate === undefined) {
        return acc + 1;
      }
      return acc + (1 - rate);
    }, 0) / normalizedTags.length;

  const novelty = normalizedTags.some((tag) => !accuracy.has(tag)) ? NOVELTY_BONUS : 0;

  return clamp(0.6 * skillAlignment + 0.3 * exploration + 0.1 * novelty, 0, 1);
};

const computeDifficultyWeight = (questionElo: number, userElo: number) => {
  const diff = questionElo - userElo;
  if (diff < -100) {
    const distance = clamp((userElo - 100 - questionElo) / 300, 0, 1);
    return 0.15 * (1 - distance * 0.4);
  }
  if (diff > 100) {
    const distance = clamp((questionElo - (userElo + 100)) / 300, 0, 1);
    return 0.15 * (1 - distance * 0.4);
  }
  const closeness = clamp(1 - Math.abs(diff) / 100, 0, 1);
  return 0.7 * (0.6 + 0.4 * closeness);
};

const weightedSample = (items: WeightedQuestion[], count: number) => {
  const pool = [...items];
  const selected: WeightedQuestion[] = [];
  while (selected.length < count && pool.length > 0) {
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight <= 0) {
      break;
    }
    let cursor = Math.random() * totalWeight;
    let pickedIndex = 0;
    for (let index = 0; index < pool.length; index += 1) {
      cursor -= pool[index].weight;
      if (cursor <= 0) {
        pickedIndex = index;
        break;
      }
    }
    const [picked] = pool.splice(pickedIndex, 1);
    selected.push(picked);
  }
  return selected;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const mapDifficultyToElo = (difficulty?: number | null) => {
  const normalized = difficulty ?? 0.5;
  const elo = Math.round(1200 + (normalized - 0.5) * 800);
  return clamp(elo, MIN_ELO, MAX_ELO);
};

const expectedScore = (playerElo: number, opponentElo: number) => {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
};

const ensureSkillState = (skill?: SkillState | null): SkillState => {
  if (!skill) {
    return {
      global: DEFAULT_USER_ELO,
      tags: [],
    };
  }
  return {
    global: skill.global ?? DEFAULT_USER_ELO,
    tags: skill.tags ?? [],
  };
};

const getTagRating = (skill: SkillState, tag: string) => {
  const match = skill.tags.find((candidate) => candidate.tag === tag);
  return match?.rating ?? skill.global;
};

const setTagRating = (skill: SkillState, tag: string, rating: number): SkillState => {
  const tags = [...skill.tags];
  const existingIndex = tags.findIndex((candidate) => candidate.tag === tag);
  if (existingIndex >= 0) {
    tags[existingIndex] = { tag, rating };
  } else {
    tags.push({ tag, rating });
  }
  return {
    ...skill,
    tags,
  };
};

const estimateUserSkill = (skill: SkillState, tags: string[]) => {
  if (!tags.length) {
    return skill.global;
  }
  const sum = tags.reduce((acc, tag) => acc + getTagRating(skill, tag), 0);
  return sum / tags.length;
};

const updateUserSkill = (
  skill: SkillState,
  tags: string[],
  questionElo: number,
  result: number
) => {
  const baseline = ensureSkillState(skill);
  const tagList = tags.length ? [GLOBAL_TAG, ...tags] : [GLOBAL_TAG];
  let nextState: SkillState = {
    global: baseline.global,
    tags: [...baseline.tags],
  };

  tagList.forEach((tag) => {
    const current =
      tag === GLOBAL_TAG ? baseline.global : getTagRating(baseline, tag);
    const expected = expectedScore(current, questionElo);
    const updated = clamp(current + USER_K * (result - expected), MIN_ELO, MAX_ELO);
    if (tag === GLOBAL_TAG) {
      nextState = {
        ...nextState,
        global: updated,
      };
    } else {
      nextState = setTagRating(nextState, tag, updated);
    }
  });

  return nextState;
};

const computeRecencyWeight = (createdAt: number) => {
  const ageMs = Date.now() - createdAt;
  const ageHours = ageMs / (1000 * 60 * 60);
  const weight = Math.exp(-ageHours / 72);
  return clamp(weight, 0, 1);
};

const buildFeedItem = (
  question: QuestionDoc,
  shuffled: ShuffledChoice[],
  answerToken: string,
  categorySlug: string
) => {
  const correctEntry =
    shuffled.find((entry) => entry.originalIndex === question.answerIndex) ?? null;
  const fallbackCorrectId =
    question.choices[question.answerIndex]?.id ?? shuffled[0]?.choice.id ?? '';
  return {
    id: question._id,
    prompt: question.prompt,
    mediaUrl: question.mediaUrl ?? null,
    deckId: question.deckId,
    type: question.type,
    difficulty: question.difficulty,
    createdAt: question.createdAt,
    tags: question.tags ?? [],
    qualityScore: question.qualityScore ?? 0.5,
    elo: question.elo ?? mapDifficultyToElo(question.difficulty),
    answerToken,
    category: categorySlug,
    correctChoiceId: correctEntry?.choice.id ?? fallbackCorrectId,
    choices: shuffled.map(({ choice }) => ({
      id: choice.id,
      text: choice.text,
    })),
  };
};

export const getSwipeFeed = query({
  args: {
    category: v.string(),
    cursor: v.optional(v.number()),
    limit: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    excludeIds: v.optional(v.array(v.id("questions"))),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthedUser(ctx);
    const limit = clamp(args.limit ?? DEFAULT_FEED_LIMIT, 1, MAX_FEED_LIMIT);
    const categorySlug = normalizeTag(args.category);
    if (!CATEGORY_MAP.has(categorySlug)) {
      throw new ConvexError("INVALID_CATEGORY");
    }
    const excludeSet = new Set<string>(
      (args.excludeIds ?? []).map((id) => id.toString())
    );
    const swipePref = user.sessionPref?.swipe;
    const now = Date.now();
    const lastResetAt = swipePref?.lastResetAt ?? 0;
    const feedExpired = lastResetAt === 0 || now - lastResetAt > FEED_RESET_MS;

    // 클라이언트가 excludeIds를 보낸 경우, 서버의 recentHistory는 사용하지 않음
    // (클라이언트가 이미 모든 본 문항을 추적하고 있음)
    const useServerHistory = !args.excludeIds || args.excludeIds.length === 0;

    if (useServerHistory && !feedExpired) {
      const recentHistory = swipePref?.recentQuestionIds ?? [];
      const recentExcludes = swipePref?.excludeIds ?? [];
      recentExcludes.forEach((id) => excludeSet.add(id.toString()));
      recentHistory.forEach((id) => excludeSet.add(id.toString()));
    }

    const rawFilterTags = args.tags ?? [];
    const normalizedFilterTags = rawFilterTags
      .map((tag) => normalizeTag(tag))
      .filter(Boolean);
    const cursor = args.cursor;

    const allowedCategories = new Set([
      categorySlug,
      ...(CATEGORY_ADJACENCY[categorySlug] ?? []).map((entry) => entry.slug),
    ]);

    const filterSet = new Set<string>([categorySlug, ...normalizedFilterTags]);

    const PAGE_SIZE = Math.max(limit * 3, 60);
    const MAX_PAGES = 8;
    const candidates: QuestionDoc[] = [];
    let pageCursor: number | undefined = cursor ?? undefined;
    let pagesFetched = 0;
    let lastFetchedCursor: number | null = null;
    let moreCandidatesAvailable = true;

    const skill = ensureSkillState(user.skill);
    const sortedSkillTags = [...skill.tags].sort((a, b) => b.rating - a.rating);
    const skillTagSeeds = sortedSkillTags.map((entry) => entry.tag);
    const normalizedSkillSeeds = skillTagSeeds
      .map((tag) => normalizeTag(tag))
      .filter(Boolean);
    const interestSeeds = (user.interests ?? [])
      .map((interest) => normalizeTag(interest))
      .filter(Boolean);

    const secondarySeeds = Array.from(
      new Set([
        ...normalizedFilterTags.filter((tag) => tag !== categorySlug),
        ...normalizedSkillSeeds.filter((tag) => tag !== categorySlug),
        ...interestSeeds.filter((tag) => tag !== categorySlug),
      ])
    );

    const categoryPreference = buildCategoryPreference(
      categorySlug,
      secondarySeeds,
      interestSeeds
    );
    const tagAccuracy = await computeTagAccuracy(ctx, user._id);
    const preferenceKeys = new Set(
      Array.from(categoryPreference.keys()).filter(
        (key) => key !== FALLBACK_CATEGORY_SLUG
      )
    );

    const weighted: WeightedQuestion[] = [];

    while (pagesFetched < MAX_PAGES && weighted.length < limit && moreCandidatesAvailable) {
      const page = await ctx.db
        .query("questions")
        .withIndex("by_createdAt", (q) => (pageCursor ? q.lt("createdAt", pageCursor) : q))
        .order("desc")
        .take(PAGE_SIZE);

      if (page.length === 0) {
        moreCandidatesAvailable = false;
        break;
      }

      const scoredPage = page
        .map((question) => {
          if (excludeSet.has(question._id.toString())) {
            return null;
          }
          const rawTags = question.tags ?? [];
          const normalizedTags = rawTags.map((tag) => normalizeTag(tag)).filter(Boolean);
          const questionCategorySlug = question.category ? normalizeTag(question.category) : null;
          if (questionCategorySlug) {
            normalizedTags.push(questionCategorySlug);
          }

          const matchesAllowed =
            normalizedTags.length === 0
              ? allowedCategories.has(categorySlug)
              : (questionCategorySlug && allowedCategories.has(questionCategorySlug)) ||
              normalizedTags.some((tag) => allowedCategories.has(tag));
          if (!matchesAllowed) {
            return null;
          }

          const categoryWeight = resolveCategoryWeight(categoryPreference, normalizedTags);
          const questionElo = question.elo ?? mapDifficultyToElo(question.difficulty);
          const userTagSkill = estimateUserSkill(skill, rawTags);
          const tagWeight = computeTagWeight(
            rawTags,
            normalizedTags,
            skill,
            questionElo,
            tagAccuracy,
          );
          const difficultyWeight = computeDifficultyWeight(questionElo, userTagSkill);
          const recency = computeRecencyWeight(question.createdAt);
          const quality = clamp(question.qualityScore ?? 0.5, 0, 1);
          const baseScore =
            0.35 * categoryWeight +
            0.3 * tagWeight +
            0.25 * difficultyWeight +
            0.05 * recency +
            0.05 * quality;
          const variance = 0.85 + Math.random() * 0.3;
          const weight = Math.max(MIN_WEIGHT, baseScore * variance);
          return { question, weight };
        })
        .filter((entry): entry is WeightedQuestion => entry !== null);

      weighted.push(...scoredPage);

      pagesFetched += 1;
      lastFetchedCursor = page[page.length - 1].createdAt;
      pageCursor = lastFetchedCursor;
      moreCandidatesAvailable = page.length === PAGE_SIZE;
    }

    const selected = weightedSample(weighted, limit);
    const feedItems = selected.map(({ question }) => {
      const seed = Math.floor(Math.random() * 0xffffffff);
      const shuffled = shuffleChoices(question.choices, seed);
      const answerToken = generateAnswerToken(
        question._id,
        user._id,
        seed,
        categorySlug
      );
      return {
        createdAt: question.createdAt,
        item: buildFeedItem(question, shuffled, answerToken, categorySlug),
      };
    });
    feedItems.sort((a, b) => b.createdAt - a.createdAt);

    const hasMoreFeed =
      feedItems.length === limit && moreCandidatesAvailable && lastFetchedCursor !== null;
    const nextCursor = hasMoreFeed && lastFetchedCursor !== null ? lastFetchedCursor : null;

    return {
      items: feedItems.map(({ item }) => item),
      nextCursor,
      hasMore: hasMoreFeed,
    };
  },
});

export const submitAnswer = mutation({
  args: {
    questionId: v.id("questions"),
    choiceId: v.string(),
    answerToken: v.string(),
    timeMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await ensureAuthedUser(ctx);
    const token = parseAnswerToken(args.answerToken, args.questionId, user._id);
    const question = await ctx.db.get(args.questionId);
    if (!question) {
      throw new ConvexError("QUESTION_NOT_FOUND");
    }

    const shuffled = shuffleChoices(question.choices, token.seed);
    const correctEntry = shuffled.find(
      (entry) => entry.originalIndex === question.answerIndex
    );
    if (!correctEntry) {
      throw new ConvexError("CORRUPTED_QUESTION");
    }
    const selectedEntry = shuffled.find(
      (entry) => entry.choice.id === args.choiceId
    );
    if (!selectedEntry) {
      throw new ConvexError("INVALID_CHOICE");
    }

    const isCorrect = correctEntry.choice.id === args.choiceId;
    const result = isCorrect ? 1 : 0;
    const now = Date.now();
    const timeMs = Math.max(0, args.timeMs ?? 0);
    const categorySlug = normalizeTag(
      token.categorySlug ?? FALLBACK_CATEGORY_SLUG
    );
    const relevantTags = question.tags ?? [];

    await ctx.db.insert("answers", {
      userId: user._id,
      questionId: args.questionId,
      category: categorySlug,
      tags: relevantTags,
      choiceId: args.choiceId,
      answerToken: args.answerToken,
      isCorrect,
      timeMs,
      createdAt: now,
    });

    const questionElo =
      question.elo ?? mapDifficultyToElo(question.difficulty);
    const skill = ensureSkillState(user.skill);
    const userSkill = estimateUserSkill(skill, relevantTags);
    const expected = expectedScore(userSkill, questionElo);
    const updatedSkill = updateUserSkill(
      skill,
      relevantTags,
      questionElo,
      result
    );
    const updatedQuestionElo = clamp(
      questionElo + QUESTION_K * (expected - result),
      MIN_ELO,
      MAX_ELO
    );

    const swipePref = user.sessionPref?.swipe;
    const existingExclude = swipePref?.excludeIds ?? [];
    const combined = [...existingExclude, args.questionId];
    const unique = Array.from(
      new Map(combined.map((id) => [id.toString(), id])).values()
    );
    const updatedExclude = unique.slice(-MAX_RECENT_EXCLUDE);
    const lastResetAt = swipePref?.lastResetAt ?? 0;
    const resetExpired = lastResetAt === 0 || now - lastResetAt > FEED_RESET_MS;
    const priorRecent = resetExpired ? [] : swipePref?.recentQuestionIds ?? [];
    const updatedRecent = Array.from(
      new Map(
        [...priorRecent, args.questionId].map((id) => [id.toString(), id])
      ).values()
    ).slice(-MAX_RECENT_HISTORY);
    const nextLastResetAt = resetExpired ? now : lastResetAt || now;

    const existingSwipe = swipePref ?? {};
    await ctx.db.patch(user._id, {
      skill: updatedSkill,
      streak: isCorrect ? user.streak + 1 : 0,
      xp: user.xp + (isCorrect ? 15 : 5),
      totalPlayed: user.totalPlayed + 1,
      totalCorrect: user.totalCorrect + (isCorrect ? 1 : 0),
      sessionPref: {
        ...user.sessionPref,
        swipe: {
          ...existingSwipe,
          lastCursor: question.createdAt,
          excludeIds: updatedExclude,
          updatedAt: now,
          category: categorySlug,
          recentQuestionIds: updatedRecent,
          lastResetAt: nextLastResetAt,
        },
      },
    });

    await ctx.db.patch(question._id, {
      elo: updatedQuestionElo,
    });

    const scoreDelta = Math.round((result - expected) * 100);

    return {
      isCorrect,
      correctChoiceId: correctEntry.choice.id,
      explanation: question.explanation ?? null,
      scoreDelta,
      streak: isCorrect ? user.streak + 1 : 0,
      nextQuestionElo: updatedQuestionElo,
      expected,
      timeMs,
    };
  },
});

export const createReport = mutation({
  args: {
    questionId: v.optional(v.id("questions")),
    reason: v.string(),
    note: v.optional(v.string()),
    guest: v.optional(
      v.object({
        deckSlug: v.string(),
        category: v.string(),
        prompt: v.string(),
        choiceId: v.optional(v.string()),
        explanation: v.optional(v.string()),
        choices: v.optional(
          v.array(
            v.object({
              id: v.string(),
              text: v.string(),
            })
          )
        ),
        metadata: v.optional(v.any()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const note = args.note?.trim() ?? undefined;
    const now = Date.now();

    if (identity) {
      const { user } = await ensureAuthedUser(ctx);
      if (!args.questionId) {
        throw new ConvexError("QUESTION_ID_REQUIRED");
      }
      const question = await ctx.db.get(args.questionId);
      if (!question) {
        throw new ConvexError("QUESTION_NOT_FOUND");
      }

      await ctx.db.insert("reports", {
        deckId: question.deckId,
        questionId: question._id,
        reporterId: user._id,
        reason: args.reason,
        note,
        createdAt: now,
        resolved: false,
      });
      return { ok: true };
    }

    const guest = args.guest;
    if (!guest) {
      throw new ConvexError("GUEST_CONTEXT_REQUIRED");
    }

    const normalizedCategory = guest.category?.trim().toLowerCase() ?? "unknown";
    await ctx.db.insert("guestReports", {
      deckSlug: guest.deckSlug,
      category: normalizedCategory,
      prompt: guest.prompt,
      reason: args.reason,
      note,
      choiceId: guest.choiceId,
      createdAt: now,
      metadata: {
        explanation: guest.explanation ?? null,
        choices: guest.choices ?? null,
        originalQuestionId: args.questionId ?? null,
        extra: guest.metadata ?? null,
      },
    });

    return { ok: true };
  },
});

export const logGuestAnswer = mutation({
  args: {
    sessionKey: v.string(),
    questionId: v.string(),
    deckSlug: v.string(),
    category: v.string(),
    prompt: v.string(),
    choiceId: v.string(),
    isCorrect: v.boolean(),
    timeMs: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    difficulty: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("guestSwipeAnswers", {
      sessionKey: args.sessionKey,
      questionId: args.questionId,
      deckSlug: args.deckSlug,
      category: args.category,
      prompt: args.prompt,
      choiceId: args.choiceId,
      isCorrect: args.isCorrect,
      timeMs: args.timeMs,
      tags: args.tags,
      difficulty: args.difficulty,
      metadata: args.metadata,
      createdAt: Date.now(),
    });
  },
});

export const toggleBookmark = mutation({
  args: {
    questionId: v.id("questions"),
  },
  handler: async (ctx, args) => {
    const { user } = await ensureAuthedUser(ctx);
    const question = await ctx.db.get(args.questionId);
    if (!question) {
      throw new ConvexError("QUESTION_NOT_FOUND");
    }

    const existing = await ctx.db
      .query("bookmarks")
      .withIndex("by_user_question", (q) =>
        q.eq("userId", user._id).eq("questionId", args.questionId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { bookmarked: false };
    }

    await ctx.db.insert("bookmarks", {
      userId: user._id,
      questionId: args.questionId,
      createdAt: Date.now(),
    });

    return { bookmarked: true };
  },
});

export const resetSession = mutation({
  args: {},
  handler: async (ctx) => {
    const { user } = await ensureAuthedUser(ctx);

    await ctx.db.patch(user._id, {
      sessionPref: {
        ...user.sessionPref,
        swipe: {
          lastCursor: undefined,
          excludeIds: [],
          recentQuestionIds: [],
          lastResetAt: Date.now(),
          updatedAt: Date.now(),
          category: user.sessionPref?.swipe?.category,
        },
      },
    });

    return { success: true };
  },
});
