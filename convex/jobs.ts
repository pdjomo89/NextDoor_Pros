import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';
import { mutation, query } from './_generated/server';
import { countryOfCity, monetizationModel } from './markets';
import { assertMembershipQuota } from './memberships';

// ──────────────────────────────────────────────────────────────────────────
// Public read queries
// ──────────────────────────────────────────────────────────────────────────

/**
 * Public list of open jobs. Optionally scope by country (market isolation),
 * and filter by city slug and/or category.
 */
export const list = query({
  args: {
    country: v.optional(v.string()),
    citySlug: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, { country, citySlug, category }) => {
    // Country-scoped browse uses the by_country_status index; otherwise fall
    // back to all open jobs. (No second market exists yet, so callers don't
    // pass `country` today — the path is here + indexed for when one launches.)
    const rows = country
      ? await ctx.db
          .query('jobs')
          .withIndex('by_country_status', (q) =>
            q.eq('country', country).eq('status', 'open'),
          )
          .order('desc')
          .collect()
      : await ctx.db
          .query('jobs')
          .withIndex('by_status', (q) => q.eq('status', 'open'))
          .order('desc')
          .collect();
    return rows.filter((j) => {
      if (citySlug && j.citySlug !== citySlug) return false;
      if (category && j.category !== category) return false;
      return true;
    });
  },
});

/** Single job by id. */
export const get = query({
  args: { id: v.id('jobs') },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

/** Jobs posted by the signed-in user. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query('jobs')
      .withIndex('by_poster', (q) => q.eq('posterId', userId))
      .order('desc')
      .collect();
  },
});

// ──────────────────────────────────────────────────────────────────────────
// Posting
// ──────────────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    category: v.string(),
    citySlug: v.string(),
    province: v.string(),
    budget: v.optional(v.string()),
    timing: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not signed in');

    if (args.title.trim() === '' || args.description.trim() === '') {
      throw new Error('Title and description are required.');
    }

    const country = countryOfCity(args.citySlug);
    // Subscription markets (Canada): posting consumes the poster's membership
    // quota — require an active membership with quota left. Pay-as-you-go markets
    // (Cameroon) post for free.
    if (monetizationModel(country) === 'subscription') {
      await assertMembershipQuota(ctx, userId, 'poster', country);
    }

    return await ctx.db.insert('jobs', {
      posterId: userId,
      status: 'open',
      country,
      ...args,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id('jobs'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    citySlug: v.optional(v.string()),
    province: v.optional(v.string()),
    budget: v.optional(v.string()),
    timing: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not signed in');

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error('Job not found');
    if (existing.posterId !== userId) throw new Error('Not your job');

    // Keep country in lock-step with the city if the city changes.
    const next =
      patch.citySlug !== undefined
        ? { ...patch, country: countryOfCity(patch.citySlug) }
        : patch;
    await ctx.db.patch(id, next);
  },
});

export const deleteMine = mutation({
  args: { id: v.id('jobs') },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not signed in');

    const existing = await ctx.db.get(id);
    if (!existing) return;
    if (existing.posterId !== userId) throw new Error('Not your job');

    await ctx.db.delete(id);
  },
});
