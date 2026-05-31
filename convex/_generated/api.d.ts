/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as contactMessages from "../contactMessages.js";
import type * as contractors from "../contractors.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as jobs from "../jobs.js";
import type * as membership from "../membership.js";
import type * as messaging from "../messaging.js";
import type * as payments from "../payments.js";
import type * as reviews from "../reviews.js";
import type * as stripeWebhook from "../stripeWebhook.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  contactMessages: typeof contactMessages;
  contractors: typeof contractors;
  crons: typeof crons;
  http: typeof http;
  jobs: typeof jobs;
  membership: typeof membership;
  messaging: typeof messaging;
  payments: typeof payments;
  reviews: typeof reviews;
  stripeWebhook: typeof stripeWebhook;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
