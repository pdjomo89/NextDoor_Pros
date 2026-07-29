import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';
import { mutation, query } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { countryOfCity, currencyForCountry } from './markets';

// ──────────────────────────────────────────────────────────────────────────
// Service catalog — CRUD over the contractorServices table.
//
// A contractor's priced offerings (e.g. "Hair treatment $80"). Shown as an
// informational price list on the public profile; there is no online payment.
// ──────────────────────────────────────────────────────────────────────────

export const listMyServices = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const contractor = await ctx.db
      .query('contractors')
      .withIndex('by_owner', (q) => q.eq('ownerId', userId))
      .unique();
    if (!contractor) return [];
    return await ctx.db
      .query('contractorServices')
      .withIndex('by_contractor', (q) => q.eq('contractorId', contractor._id))
      .collect();
  },
});

export const listPublicServices = query({
  args: { contractorId: v.id('contractors') },
  handler: async (ctx, { contractorId }) => {
    const rows = await ctx.db
      .query('contractorServices')
      .withIndex('by_contractor', (q) => q.eq('contractorId', contractorId))
      .collect();
    return rows.filter((s) => s.active);
  },
});

export const upsertService = mutation({
  args: {
    id: v.optional(v.id('contractorServices')),
    title: v.string(),
    description: v.optional(v.string()),
    priceCents: v.number(),
    active: v.boolean(),
  },
  handler: async (ctx, { id, title, description, priceCents, active }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('UNAUTHENTICATED');

    const contractor = await ctx.db
      .query('contractors')
      .withIndex('by_owner', (q) => q.eq('ownerId', userId))
      .unique();
    if (!contractor) throw new Error('NO_CONTRACTOR_PROFILE');

    const cleanTitle = title.trim().slice(0, 120);
    const cleanDescription = description?.trim().slice(0, 600) || undefined;
    if (!cleanTitle) throw new Error('TITLE_REQUIRED');
    if (!Number.isInteger(priceCents) || priceCents < 100 || priceCents > 50_000_000) {
      // Bounds are in the currency's MINOR UNIT (XAF → whole francs, CAD →
      // cents), so 100–50,000,000 minor units. The `priceCents` name is
      // historical (XAF has no minor units).
      throw new Error('INVALID_PRICE');
    }

    // Price is denominated in the contractor's market currency.
    const currency = currencyForCountry(
      contractor.country ?? countryOfCity(contractor.citySlug),
    ).toLowerCase();

    if (id) {
      const existing = await ctx.db.get(id);
      if (!existing || existing.contractorId !== contractor._id) {
        throw new Error('NOT_FOUND');
      }
      await ctx.db.patch(id, {
        title: cleanTitle,
        description: cleanDescription,
        priceCents,
        currency,
        active,
      });
      return id;
    }

    return await ctx.db.insert('contractorServices', {
      contractorId: contractor._id,
      title: cleanTitle,
      description: cleanDescription,
      priceCents,
      currency,
      active,
    });
  },
});

export const deleteService = mutation({
  args: { id: v.id('contractorServices') },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('UNAUTHENTICATED');

    const row = await ctx.db.get(id);
    if (!row) return;

    const contractor = await ctx.db.get(row.contractorId);
    if (!contractor || contractor.ownerId !== userId) {
      throw new Error('FORBIDDEN');
    }

    await ctx.db.delete(id);
  },
});

// Re-export the Id type so the UI can type-check `contractorServices` ids.
export type ContractorServiceId = Id<'contractorServices'>;
