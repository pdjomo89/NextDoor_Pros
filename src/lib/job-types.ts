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

  // Payment fields — set on paid jobs only.
  paymentStatus?: 'pending' | 'funded' | 'released' | 'refunded' | 'failed' | 'none';
  budgetCents?: number;
  currency?: string;
  applicationFeeCents?: number;
  customerEmail?: string;
  customerName?: string;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  stripeTransferId?: string;
  stripeRefundId?: string;
  selectedContractorId?: string;
  completedAt?: number;
};
