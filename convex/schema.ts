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

    // Product / work photos uploaded by the pro (Convex file-storage ids).
    photos: v.optional(v.array(v.id('_storage'))),

    published: v.boolean(),

    // Denormalised review aggregates (kept in sync by convex/reviews.ts).
    ratingCount: v.optional(v.number()),
    ratingSum: v.optional(v.number()),
  })
    .index('by_owner', ['ownerId'])
    .index('by_city_published', ['citySlug', 'published']),

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
  })
    .index('by_poster', ['posterId'])
    .index('by_status', ['status']),
});
