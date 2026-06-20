import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';
import { mutation, query, type MutationCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';

function clampRating(n: number) {
  return Math.max(1, Math.min(5, Math.round(n)));
}

/** Recompute and store ratingCount / ratingSum on a contractor. */
async function recompute(ctx: MutationCtx, contractorId: Id<'contractors'>) {
  const reviews = await ctx.db
    .query('reviews')
    .withIndex('by_contractor', (q) => q.eq('contractorId', contractorId))
    .collect();
  const ratingCount = reviews.length;
  const ratingSum = reviews.reduce((s, r) => s + r.rating, 0);
  await ctx.db.patch(contractorId, { ratingCount, ratingSum });
}

/** Public: reviews for a contractor, newest first, with the author's display name. */
export const listForContractor = query({
  args: { contractorId: v.id('contractors') },
  handler: async (ctx, { contractorId }) => {
    const reviews = await ctx.db
      .query('reviews')
      .withIndex('by_contractor', (q) => q.eq('contractorId', contractorId))
      .collect();
    reviews.sort((a, b) => b._creationTime - a._creationTime);
    return await Promise.all(
      reviews.map(async (r) => {
        const author = r.authorId ? await ctx.db.get(r.authorId) : null;
        const email = (author as { email?: string } | null)?.email ?? null;
        const name = (author as { name?: string } | null)?.name ?? null;
        return {
          _id: r._id,
          _creationTime: r._creationTime,
          contractorId: r.contractorId,
          authorId: r.authorId ?? null,
          rating: r.rating,
          comment: r.comment,
          authorName: name ?? (email ? email.split('@')[0] : null) ?? r.guestName ?? null,
        };
      }),
    );
  },
});

/** The signed-in user's review for a contractor (or null). */
export const myReviewFor = query({
  args: { contractorId: v.id('contractors') },
  handler: async (ctx, { contractorId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const existing = await ctx.db
      .query('reviews')
      .withIndex('by_contractor_author', (q) =>
        q.eq('contractorId', contractorId).eq('authorId', userId),
      )
      .unique();
    if (!existing) return null;
    return { rating: existing.rating, comment: existing.comment };
  },
});

/** Create or update the signed-in user's review for a contractor. */
export const submit = mutation({
  args: {
    contractorId: v.id('contractors'),
    rating: v.number(),
    comment: v.string(),
  },
  handler: async (ctx, { contractorId, rating, comment }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not signed in');

    const contractor = await ctx.db.get(contractorId);
    if (!contractor) throw new Error('Listing not found');
    if (contractor.ownerId === userId) throw new Error('You cannot review your own listing');

    const r = clampRating(rating);
    const text = comment.trim().slice(0, 2000);

    const existing = await ctx.db
      .query('reviews')
      .withIndex('by_contractor_author', (q) =>
        q.eq('contractorId', contractorId).eq('authorId', userId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { rating: r, comment: text });
    } else {
      await ctx.db.insert('reviews', { contractorId, authorId: userId, rating: r, comment: text });
    }
    await recompute(ctx, contractorId);
  },
});

/**
 * Create a review from a logged-out (guest) customer. Guests are identified
 * only by the name they type, so these are never deduplicated or editable.
 */
export const submitGuest = mutation({
  args: {
    contractorId: v.id('contractors'),
    rating: v.number(),
    comment: v.string(),
    name: v.string(),
    honeypot: v.optional(v.string()),
  },
  handler: async (ctx, { contractorId, rating, comment, name, honeypot }) => {
    // Bots fill hidden fields; humans never see them. Pretend success.
    if (honeypot && honeypot.trim().length > 0) return;

    const contractor = await ctx.db.get(contractorId);
    if (!contractor) throw new Error('Listing not found');

    const guestName = name.trim().slice(0, 80);
    if (!guestName) throw new Error('Please enter your name');

    await ctx.db.insert('reviews', {
      contractorId,
      guestName,
      rating: clampRating(rating),
      comment: comment.trim().slice(0, 2000),
    });
    await recompute(ctx, contractorId);
  },
});

/** Delete the signed-in user's review for a contractor. */
export const removeMine = mutation({
  args: { contractorId: v.id('contractors') },
  handler: async (ctx, { contractorId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not signed in');
    const existing = await ctx.db
      .query('reviews')
      .withIndex('by_contractor_author', (q) =>
        q.eq('contractorId', contractorId).eq('authorId', userId),
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      await recompute(ctx, contractorId);
    }
  },
});
