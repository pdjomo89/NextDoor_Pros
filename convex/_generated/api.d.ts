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
import type * as connect from "../connect.js";
import type * as contactMessages from "../contactMessages.js";
import type * as contractors from "../contractors.js";
import type * as crons from "../crons.js";
import type * as fapshiClient from "../fapshiClient.js";
import type * as geo from "../geo.js";
import type * as http from "../http.js";
import type * as inquiryFollowUps from "../inquiryFollowUps.js";
import type * as inquiryUnlocks from "../inquiryUnlocks.js";
import type * as jobEscrow from "../jobEscrow.js";
import type * as jobs from "../jobs.js";
import type * as leadUnlocks from "../leadUnlocks.js";
import type * as markets from "../markets.js";
import type * as marketsConfig from "../marketsConfig.js";
import type * as memberships from "../memberships.js";
import type * as messaging from "../messaging.js";
import type * as migrations from "../migrations.js";
import type * as paymentProviders from "../paymentProviders.js";
import type * as paymentTypes from "../paymentTypes.js";
import type * as payments from "../payments.js";
import type * as reviews from "../reviews.js";
import type * as stripeConnect from "../stripeConnect.js";
import type * as stripeEscrow from "../stripeEscrow.js";
import type * as stripeProvider from "../stripeProvider.js";
import type * as stripeSubscriptions from "../stripeSubscriptions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  connect: typeof connect;
  contactMessages: typeof contactMessages;
  contractors: typeof contractors;
  crons: typeof crons;
  fapshiClient: typeof fapshiClient;
  geo: typeof geo;
  http: typeof http;
  inquiryFollowUps: typeof inquiryFollowUps;
  inquiryUnlocks: typeof inquiryUnlocks;
  jobEscrow: typeof jobEscrow;
  jobs: typeof jobs;
  leadUnlocks: typeof leadUnlocks;
  markets: typeof markets;
  marketsConfig: typeof marketsConfig;
  memberships: typeof memberships;
  messaging: typeof messaging;
  migrations: typeof migrations;
  paymentProviders: typeof paymentProviders;
  paymentTypes: typeof paymentTypes;
  payments: typeof payments;
  reviews: typeof reviews;
  stripeConnect: typeof stripeConnect;
  stripeEscrow: typeof stripeEscrow;
  stripeProvider: typeof stripeProvider;
  stripeSubscriptions: typeof stripeSubscriptions;
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
