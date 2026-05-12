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
  phone?: string;
  email?: string;
  whatsapp?: string;
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
