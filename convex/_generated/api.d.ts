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
import type * as admin_decks from "../admin/decks.js";
import type * as admin_partyDecks from "../admin/partyDecks.js";
import type * as admin_seedQuestionsAction from "../admin/seedQuestionsAction.js";
import type * as admin_upsertMutation from "../admin/upsertMutation.js";
import type * as daily from "../daily.js";
import type * as decks from "../decks.js";
import type * as lib_auth from "../lib/auth.js";
import type * as rooms from "../rooms.js";
import type * as swipe from "../swipe.js";
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
  "admin/decks": typeof admin_decks;
  "admin/partyDecks": typeof admin_partyDecks;
  "admin/seedQuestionsAction": typeof admin_seedQuestionsAction;
  "admin/upsertMutation": typeof admin_upsertMutation;
  daily: typeof daily;
  decks: typeof decks;
  "lib/auth": typeof lib_auth;
  rooms: typeof rooms;
  swipe: typeof swipe;
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
