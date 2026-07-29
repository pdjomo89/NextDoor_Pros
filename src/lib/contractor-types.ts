import type { ServiceKey } from '@/lib/services';

/**
 * Shape of a contractor document returned from Convex.
 * Mirrors `convex/schema.ts` contractors table.
 */
export type ContractorDoc = {
  _id: string;
  _creationTime: number;
  ownerId: string;
  businessName: string;
  description: string;
  services: ServiceKey[];
  citySlug: string;
  province: string;
  /** ISO 3166-1 alpha-2 market (derived from citySlug); drives the currency. */
  country?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  /**
   * "Starting at X" — marketing display only. Stored in the MINOR UNIT of the
   * contractor's market currency (XAF → whole francs, CAD → cents). Format with
   * `formatMoney` using the market from `country`.
   */
  startingAtPriceCents?: number;
  /** File-storage ids of uploaded photos (present on `getMine`). */
  photos?: string[];
  /** Resolved photo URLs (present on `getPublic`). */
  photoUrls?: string[];
  published: boolean;
  ratingCount?: number;
  ratingSum?: number;
};

/** Average star rating (0 if no reviews) and review count for a contractor. */
export function ratingOf(c: Pick<ContractorDoc, 'ratingCount' | 'ratingSum'>) {
  const count = c.ratingCount ?? 0;
  const sum = c.ratingSum ?? 0;
  return { count, average: count > 0 ? sum / count : 0 };
}
