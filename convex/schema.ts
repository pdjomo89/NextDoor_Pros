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

    // Marketing-only "Starting at $X" price shown on cards/profile.
    // Stored in CAD cents. Not used for charging — booking flow uses
    // the priced services catalog (contractorServices table).
    startingAtPriceCents: v.optional(v.number()),

    // Product / work photos uploaded by the pro (Convex file-storage ids).
    photos: v.optional(v.array(v.id('_storage'))),

    published: v.boolean(),

    // Denormalised review aggregates (kept in sync by convex/reviews.ts).
    ratingCount: v.optional(v.number()),
    ratingSum: v.optional(v.number()),

    // Stripe Connect (Express) — set when the pro begins payments onboarding.
    // `stripeOnboardingComplete` mirrors `charges_enabled && payouts_enabled`
    // from the Stripe account.updated webhook.
    stripeAccountId: v.optional(v.string()),
    stripeOnboardingComplete: v.optional(v.boolean()),
  })
    .index('by_owner', ['ownerId'])
    .index('by_city_published', ['citySlug', 'published'])
    .index('by_stripeAccount', ['stripeAccountId']),

  // Priced offerings a contractor sells (e.g. "Hair treatment $80").
  contractorServices: defineTable({
    contractorId: v.id('contractors'),
    title: v.string(),
    description: v.optional(v.string()),
    priceCents: v.number(), // CAD cents
    currency: v.string(), // 'cad'
    active: v.boolean(),
  }).index('by_contractor', ['contractorId']),

  // Customer payments. Written once on Checkout Session creation
  // and patched by the Stripe webhook handler.
  payments: defineTable({
    contractorId: v.id('contractors'),
    contractorServiceId: v.optional(v.id('contractorServices')),

    customerEmail: v.string(),
    customerName: v.optional(v.string()),
    customerCitySlug: v.optional(v.string()),
    note: v.optional(v.string()),

    amountCents: v.number(),
    applicationFeeCents: v.number(),
    currency: v.string(),

    stripeCheckoutSessionId: v.string(),
    stripePaymentIntentId: v.optional(v.string()),
    stripeChargeId: v.optional(v.string()),

    // 'pending' | 'paid' | 'failed' | 'refunded' | 'disputed'
    status: v.string(),
    errorMessage: v.optional(v.string()),
  })
    .index('by_contractor', ['contractorId'])
    .index('by_session', ['stripeCheckoutSessionId'])
    .index('by_status', ['status']),

  // Idempotency log for incoming Stripe webhook events.
  stripeEvents: defineTable({
    eventId: v.string(),
    type: v.string(),
  }).index('by_eventId', ['eventId']),

  reviews: defineTable({
    contractorId: v.id('contractors'),
    authorId: v.id('users'),
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

    // ─── Payment fields (only set on paid jobs — i.e. budget attached) ───
    //
    // Lifecycle:
    //   undefined / 'none'   — free post (legacy or no budget attached)
    //   'pending'            — Checkout Session created, waiting for payment
    //   'funded'             — Customer paid; funds in platform balance
    //   'released'           — Customer marked complete; funds transferred to pro
    //   'refunded'           — Customer cancelled; funds returned
    //   'failed'             — Checkout failed (timeout, decline, etc.)
    paymentStatus: v.optional(v.string()),

    budgetCents: v.optional(v.number()),
    currency: v.optional(v.string()),
    applicationFeeCents: v.optional(v.number()),

    customerEmail: v.optional(v.string()),
    customerName: v.optional(v.string()),

    stripeCheckoutSessionId: v.optional(v.string()),
    stripePaymentIntentId: v.optional(v.string()),
    stripeChargeId: v.optional(v.string()),
    stripeTransferId: v.optional(v.string()),
    stripeRefundId: v.optional(v.string()),

    selectedContractorId: v.optional(v.id('contractors')),
    completedAt: v.optional(v.number()),
  })
    .index('by_poster', ['posterId'])
    .index('by_status', ['status'])
    .index('by_session', ['stripeCheckoutSessionId'])
    .index('by_paymentIntent', ['stripePaymentIntentId']),

  // A pro's application to a paid job.
  jobApplications: defineTable({
    jobId: v.id('jobs'),
    contractorId: v.id('contractors'),
    posterId: v.id('users'), // denormalised so we can authz "is this my job?" without an extra lookup
    message: v.optional(v.string()),
    // 'pending' | 'accepted' | 'rejected' | 'withdrawn'
    status: v.string(),
  })
    .index('by_job', ['jobId'])
    .index('by_contractor', ['contractorId'])
    .index('by_job_contractor', ['jobId', 'contractorId']),
});
