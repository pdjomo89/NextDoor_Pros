import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { authTables } from '@convex-dev/auth/server';

// ─── Money storage convention (multi-currency foundation) ──────────────────
//
// Every monetary amount is stored as an INTEGER in its currency's minor unit
// (the smallest indivisible amount): XAF → 1 = 1 franc (exponent 0), USD → 100
// = $1.00 (exponent 2). Formatting divides by the right power of ten — see
// src/lib/currency.ts. Because XAF's exponent is 0, all existing whole-franc
// amounts are already valid minor-unit values; adopting this convention needs
// no data migration.
//
// Phase 3 (with the per-listing `country` dimension) will: add a `country`
// field to contractors/jobs, drop the misleading `Cents` suffix from amount
// fields, and make `currency` non-optional where it is implicit today.
export default defineSchema({
  ...authTables,

  contractors: defineTable({
    ownerId: v.id('users'),

    businessName: v.string(),
    description: v.string(),
    // service slugs matching SERVICE_CATEGORIES in src/lib/services.ts
    services: v.array(v.string()),
    citySlug: v.string(),
    province: v.string(),
    // ISO 3166-1 alpha-2 market this listing belongs to (derived from citySlug).
    // Optional during rollout; backfilled to 'CM' then treated as required.
    country: v.optional(v.string()),

    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    whatsapp: v.optional(v.string()),

    // Marketing-only "Starting at X" price shown on cards/profile.
    // Stored as an integer in the currency's MINOR UNIT (see money convention
    // below). Currency is implicitly the contractor's market (XAF today, whose
    // exponent is 0, so the value equals whole francs). Informational only.
    // Phase 3: rename off the `Cents` suffix + add an explicit `country`.
    startingAtPriceCents: v.optional(v.number()),

    // Product / work photos uploaded by the pro (Convex file-storage ids).
    photos: v.optional(v.array(v.id('_storage'))),

    published: v.boolean(),

    // Denormalised review aggregates (kept in sync by convex/reviews.ts).
    ratingCount: v.optional(v.number()),
    ratingSum: v.optional(v.number()),
  })
    .index('by_owner', ['ownerId'])
    .index('by_city_published', ['citySlug', 'published'])
    .index('by_country_published', ['country', 'published']),

  // Priced offerings a contractor lists (e.g. "Hair treatment 25000 FCFA").
  contractorServices: defineTable({
    contractorId: v.id('contractors'),
    title: v.string(),
    description: v.optional(v.string()),
    priceCents: v.number(), // whole FCFA (XAF has no minor units)
    currency: v.string(), // 'xaf'
    active: v.boolean(),
  }).index('by_contractor', ['contractorId']),

  reviews: defineTable({
    contractorId: v.id('contractors'),
    // Set when a signed-in user leaves the review; absent for guest reviews.
    authorId: v.optional(v.id('users')),
    // Display name supplied by a logged-out (guest) reviewer.
    guestName: v.optional(v.string()),
    rating: v.number(), // 1..5
    comment: v.string(),
  })
    .index('by_contractor', ['contractorId'])
    .index('by_contractor_author', ['contractorId', 'authorId']),

  contactMessages: defineTable({
    name: v.string(),
    email: v.string(),
    citySlug: v.optional(v.string()),
    subject: v.string(),
    message: v.string(),
    locale: v.optional(v.string()),

    // 'queued' | 'sent' | 'failed' | 'skipped' (no email integration configured)
    status: v.string(),
    errorMessage: v.optional(v.string()),
  }).index('by_status', ['status']),

  jobs: defineTable({
    posterId: v.id('users'),

    title: v.string(),
    description: v.string(),
    // service slug (matches SERVICE_CATEGORIES) or 'other'
    category: v.string(),
    citySlug: v.string(),
    province: v.string(),
    // ISO 3166-1 alpha-2 market this job belongs to (derived from citySlug).
    // Optional during rollout; backfilled to 'CM' then treated as required.
    country: v.optional(v.string()),

    budget: v.optional(v.string()),
    timing: v.optional(v.string()),

    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),

    // 'open' | 'closed' | 'filled'. Posting is free (Cameroon) or covered by the
    // poster's membership quota (Canada), so jobs go live immediately — there is
    // no 'pending_payment' state. Pros pay per lead unlocked (see leadUnlocks).
    status: v.string(),
  })
    .index('by_poster', ['posterId'])
    .index('by_status', ['status'])
    .index('by_country_status', ['country', 'status']),

  // ─── Platform-mediated messaging ───────────────────────────────────────
  //
  // Customers contact pros without an account: they submit an email + a
  // first message, and a secret `guestToken` authorizes them to view and
  // reply to that one thread via a private link (emailed to them). Pros
  // are signed-in users and use their in-app inbox. Neither side ever sees
  // the other's phone/email — message bodies are run through a contact-info
  // redactor before storage.
  conversations: defineTable({
    // Set for contractor (service) threads; absent for job threads, which are
    // keyed on the job poster (a plain user) via `jobId` + `contractorOwnerId`.
    contractorId: v.optional(v.id('contractors')),
    // The recipient user who owns this inbox — a contractor's owner for service
    // threads, or the job poster for job threads. Drives the pro/poster inbox.
    contractorOwnerId: v.id('users'),

    // Guest customer — identified by email; `guestToken` is the secret that
    // grants access to the thread. Used server-side only (never returned to
    // the pro). All three are optional so pre-guest-era rows still validate.
    customerEmail: v.optional(v.string()),
    customerName: v.optional(v.string()),
    guestToken: v.optional(v.string()),
    // Legacy: retained (optional, unused) for backward compatibility.
    customerId: v.optional(v.id('users')),

    // Optional context the thread was started from.
    jobId: v.optional(v.id('jobs')),

    lastMessageAt: v.number(),
    lastMessagePreview: v.string(),
    lastSenderRole: v.string(), // 'customer' | 'contractor'

    // Per-side unread counters, kept in sync by send/markRead.
    customerUnread: v.number(),
    contractorUnread: v.number(),

    status: v.string(), // 'active' | 'archived'
  })
    .index('by_contractorOwner', ['contractorOwnerId', 'lastMessageAt'])
    .index('by_guestToken', ['guestToken'])
    .index('by_contractor_email', ['contractorId', 'customerEmail'])
    .index('by_job_email', ['jobId', 'customerEmail']),

  messages: defineTable({
    conversationId: v.id('conversations'),
    senderRole: v.string(), // 'customer' | 'contractor'
    // Set for pro (signed-in) messages; absent for guest-customer messages.
    senderId: v.optional(v.id('users')),
    // Already-redacted text — never store raw contact info.
    body: v.string(),
    // True when the redactor stripped something from the original text.
    flagged: v.boolean(),
  }).index('by_conversation', ['conversationId']),

  // ─── Lead unlocks (pay-as-you-go markets, e.g. Cameroon) ─────────────────
  //
  // A pro pays a small fee to unlock ONE job lead — i.e. to open a conversation
  // with that job's poster. One row per (pro, job) unlock attempt; flipped to
  // 'successful' by the provider webhook, after which the pro may contact the
  // poster. In subscription markets (Canada) the same table records a
  // quota-covered unlock (amount 0). See convex/leadUnlocks.ts + convex/http.ts.
  leadUnlocks: defineTable({
    proId: v.id('users'),
    jobId: v.id('jobs'),
    // ISO 3166-1 alpha-2 market of the job (derived from its city).
    country: v.optional(v.string()),
    provider: v.string(), // ProviderName: 'fapshi' | 'stripe'
    transId: v.optional(v.string()), // provider transaction id (set after initiate-pay)
    externalId: v.string(), // idempotency key we send to the provider
    amount: v.number(), // minor units of `currency` (0 for quota-covered unlocks)
    currency: v.string(), // lowercase ISO 4217, e.g. 'xaf'
    // 'created' | 'pending' | 'successful' | 'failed' | 'expired'
    status: v.string(),
    link: v.optional(v.string()), // hosted-checkout URL (payg markets)
  })
    .index('by_transId', ['transId'])
    .index('by_pro_job', ['proId', 'jobId'])
    .index('by_pro', ['proId']),

  // ─── Memberships (subscription markets, e.g. Canada) ─────────────────────
  //
  // A recurring subscription granting a per-billing-period quota of actions
  // (job posts for a poster, lead unlocks for a pro). At most one active row per
  // (user, role). Driven by Stripe subscription webhooks in Phase 2; plan config
  // (prices, quotas) lives in convex/markets.ts. Quota usage is derived by
  // counting jobs / leadUnlocks created within the current period, not stored.
  memberships: defineTable({
    userId: v.id('users'),
    role: v.string(), // MembershipRole: 'poster' | 'pro'
    country: v.optional(v.string()),
    provider: v.string(), // 'stripe'
    plan: v.string(), // 'monthly' | 'yearly'
    // 'incomplete' | 'active' | 'past_due' | 'canceled' | 'expired'
    status: v.string(),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
  })
    .index('by_user_role', ['userId', 'role'])
    .index('by_stripeSubscription', ['stripeSubscriptionId']),

});
