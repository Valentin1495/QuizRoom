/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as boosts from "../boosts.js";
import type * as daily from "../daily.js";
import type * as gamification from "../gamification.js";
import type * as inventories from "../inventories.js";
import type * as leaderboards from "../leaderboards.js";
import type * as questions from "../questions.js";
import type * as reports from "../reports.js";
import type * as rewards from "../rewards.js";
import type * as seed from "../seed.js";
import type * as sessions from "../sessions.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  boosts: typeof boosts;
  daily: typeof daily;
  gamification: typeof gamification;
  inventories: typeof inventories;
  leaderboards: typeof leaderboards;
  questions: typeof questions;
  reports: typeof reports;
  rewards: typeof rewards;
  seed: typeof seed;
  sessions: typeof sessions;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
