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
  budget?: string;
  timing?: string;
  contactEmail?: string;
  contactPhone?: string;
  status: 'open' | 'closed' | 'filled';
};
