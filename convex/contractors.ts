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
 * Includes `photoUrls` (resolved from the stored file ids).
 */
export const getPublic = query({
  args: { id: v.id('contractors') },
  handler: async (ctx, { id }) => {
    const doc = await ctx.db.get(id);
    if (!doc || !doc.published) return null;
    const photoUrls: string[] = [];
    for (const fileId of doc.photos ?? []) {
      const url = await ctx.storage.getUrl(fileId);
      if (url) photoUrls.push(url);
    }
    return { ...doc, photoUrls };
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
    const matched = rows
      .filter((c) => c.services.includes(serviceKey))
      .sort((a, b) => b._creationTime - a._creationTime);

    // Resolve only the hero photo for the card — the rest live on the profile.
    const withPhotos = [];
    for (const c of matched) {
      const heroId = c.photos?.[0];
      const heroUrl = heroId ? await ctx.storage.getUrl(heroId) : null;
      withPhotos.push({ ...c, photoUrls: heroUrl ? [heroUrl] : [] });
    }
    return withPhotos;
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

const MAX_PHOTOS = 8;

/** The signed-in user's listing photos, resolved to URLs (with their storage ids). */
export const myPhotos = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const out: { storageId: string; url: string }[] = [];
    if (!userId) return out;
    const doc = await ctx.db
      .query('contractors')
      .withIndex('by_owner', (q) => q.eq('ownerId', userId))
      .unique();
    for (const id of doc?.photos ?? []) {
      const url = await ctx.storage.getUrl(id);
      if (url) out.push({ storageId: id, url });
    }
    return out;
  },
});

/** Get a short-lived URL the client can POST a file to. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not signed in');
    return await ctx.storage.generateUploadUrl();
  },
});

/** Attach freshly-uploaded file ids to the signed-in user's listing. */
export const addPhotos = mutation({
  args: { storageIds: v.array(v.id('_storage')) },
  handler: async (ctx, { storageIds }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not signed in');
    const doc = await ctx.db
      .query('contractors')
      .withIndex('by_owner', (q) => q.eq('ownerId', userId))
      .unique();
    if (!doc) throw new Error('Create your listing first.');
    const combined = [...(doc.photos ?? []), ...storageIds];
    const next = combined.slice(0, MAX_PHOTOS);
    // Any uploads beyond the cap are orphaned — delete the blobs so they don't linger.
    for (const id of combined.slice(MAX_PHOTOS)) await ctx.storage.delete(id);
    await ctx.db.patch(doc._id, { photos: next });
    return next.length;
  },
});

/** Remove one photo from the signed-in user's listing and delete the blob. */
export const removePhoto = mutation({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, { storageId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not signed in');
    const doc = await ctx.db
      .query('contractors')
      .withIndex('by_owner', (q) => q.eq('ownerId', userId))
      .unique();
    if (!doc || !(doc.photos ?? []).includes(storageId)) return;
    await ctx.db.patch(doc._id, {
      photos: (doc.photos ?? []).filter((id) => id !== storageId),
    });
    await ctx.storage.delete(storageId);
  },
});

/**
 * Delete the signed-in user's listing (and its uploaded photos).
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
    if (existing) {
      for (const id of existing.photos ?? []) await ctx.storage.delete(id);
      await ctx.db.delete(existing._id);
    }
  },
});
