import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';
import { mutation, query } from './_generated/server';

/**
 * Return the signed-in user's contractor listing (or null).
 */
export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    return await ctx.db
      .query('contractors')
      .withIndex('by_owner', (q) => q.eq('ownerId', userId))
      .unique();
  },
});

/**
 * Return the signed-in user record (or null) — used to gate UI/state.
 */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return { _id: user._id, email: user.email ?? null };
  },
});

/**
 * Public: a single published contractor by id (or null if missing/unpublished).
 */
export const getPublic = query({
  args: { id: v.id('contractors') },
  handler: async (ctx, { id }) => {
    const doc = await ctx.db.get(id);
    if (!doc || !doc.published) return null;
    return doc;
  },
});

/** Public: ids + last-updated of every published listing (used to build the sitemap). */
export const publishedIds = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query('contractors')
      .filter((q) => q.eq(q.field('published'), true))
      .collect();
    return rows.map((r) => ({ id: r._id, updatedAt: r._creationTime }));
  },
});

/**
 * Public listings filtered by service category, optionally by city.
 * Anonymous callers can read this — there is no row-level filter beyond
 * `published = true`.
 */
export const listByService = query({
  args: {
    serviceKey: v.string(),
    citySlug: v.optional(v.string()),
  },
  handler: async (ctx, { serviceKey, citySlug }) => {
    let rows;
    if (citySlug) {
      rows = await ctx.db
        .query('contractors')
        .withIndex('by_city_published', (q) =>
          q.eq('citySlug', citySlug).eq('published', true),
        )
        .collect();
    } else {
      rows = await ctx.db
        .query('contractors')
        .filter((q) => q.eq(q.field('published'), true))
        .collect();
    }
    return rows
      .filter((c) => c.services.includes(serviceKey))
      .sort((a, b) => b._creationTime - a._creationTime);
  },
});

/**
 * Create or update the signed-in user's listing. RLS-equivalent guard is
 * enforced inline: we only ever read/write rows where ownerId == auth user.
 */
export const upsertMine = mutation({
  args: {
    businessName: v.string(),
    description: v.string(),
    services: v.array(v.string()),
    citySlug: v.string(),
    province: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    whatsapp: v.optional(v.string()),
    published: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not signed in');

    if (args.businessName.trim() === '' || args.description.trim() === '') {
      throw new Error('Business name and description are required.');
    }
    if (args.services.length === 0) {
      throw new Error('Select at least one service.');
    }
    if (!args.phone && !args.email && !args.whatsapp) {
      throw new Error('Add at least one contact method.');
    }

    const existing = await ctx.db
      .query('contractors')
      .withIndex('by_owner', (q) => q.eq('ownerId', userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }
    return await ctx.db.insert('contractors', { ownerId: userId, ...args });
  },
});

/**
 * Delete the signed-in user's listing.
 */
export const deleteMine = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not signed in');

    const existing = await ctx.db
      .query('contractors')
      .withIndex('by_owner', (q) => q.eq('ownerId', userId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});
