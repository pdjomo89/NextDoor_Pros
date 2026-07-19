import { internalMutation } from './_generated/server';
import { countryOfCity } from './markets';

// ──────────────────────────────────────────────────────────────────────────
// One-off data migrations. Run with:  npx convex run migrations:<name>
//
// Safe to re-run (idempotent): each only writes rows still missing the field.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Backfill `country` on contractors + jobs from each row's `citySlug`.
 * After this runs and no un-backfilled rows remain, `country` can be tightened
 * to required in the schema.
 */
export const backfillCountry = internalMutation({
  args: {},
  handler: async (ctx) => {
    let contractorsUpdated = 0;
    for (const row of await ctx.db.query('contractors').collect()) {
      if (row.country === undefined) {
        await ctx.db.patch(row._id, { country: countryOfCity(row.citySlug) });
        contractorsUpdated++;
      }
    }

    let jobsUpdated = 0;
    for (const row of await ctx.db.query('jobs').collect()) {
      if (row.country === undefined) {
        await ctx.db.patch(row._id, { country: countryOfCity(row.citySlug) });
        jobsUpdated++;
      }
    }

    return { contractorsUpdated, jobsUpdated };
  },
});
