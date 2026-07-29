import type { ServiceKey } from '@/lib/services';

export type JobCategory = ServiceKey | 'other';

export type JobDoc = {
  _id: string;
  _creationTime: number;
  posterId: string;
  title: string;
  description: string;
  category: JobCategory;
  citySlug: string;
  province: string;
  /** ISO 3166-1 alpha-2 market (derived from the city); optional during rollout. */
  country?: string;
  budget?: string;
  timing?: string;
  status: 'open' | 'closed' | 'filled';
};
