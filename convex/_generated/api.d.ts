/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { ApiFromModules, FilterApi, FunctionReference } from 'convex/server';
import type * as challenges from '../challenges.js';
import type * as daily from '../daily.js';
import type * as gamification from '../gamification.js';
import type * as leaderboard from '../leaderboard.js';
import type * as migrations from '../migrations.js';
import type * as quiz from '../quiz.js';
import type * as quizzes from '../quizzes.js';
import type * as reports from '../reports.js';
import type * as seeds from '../seeds.js';
import type * as users from '../users.js';

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  challenges: typeof challenges;
  daily: typeof daily;
  gamification: typeof gamification;
  leaderboard: typeof leaderboard;
  migrations: typeof migrations;
  quiz: typeof quiz;
  quizzes: typeof quizzes;
  reports: typeof reports;
  seeds: typeof seeds;
  users: typeof users;
}>;
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, 'public'>>;
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, 'internal'>>;
