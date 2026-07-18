import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { authTables } from '@convex-dev/auth/server';

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

    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    whatsapp: v.optional(v.string()),

    // Marketing-only "Starting at X" price shown on cards/profile.
    // Stored as whole FCFA (XAF has no minor units, so the `Cents` suffix is a
    // historical misnomer). Informational only — the app takes no payments.
    startingAtPriceCents: v.optional(v.number()),

    // Product / work photos uploaded by the pro (Convex file-storage ids).
    photos: v.optional(v.array(v.id('_storage'))),

    published: v.boolean(),

    // Denormalised review aggregates (kept in sync by convex/reviews.ts).
    ratingCount: v.optional(v.number()),
    ratingSum: v.optional(v.number()),
  })
    .index('by_owner', ['ownerId'])
    .index('by_city_published', ['citySlug', 'published']),

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

    budget: v.optional(v.string()),
    timing: v.optional(v.string()),

    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),

    // 'open' | 'closed' | 'filled'
    status: v.string(),
  })
    .index('by_poster', ['posterId'])
    .index('by_status', ['status']),

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

});
