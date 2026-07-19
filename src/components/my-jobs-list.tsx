'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAction, useQuery } from 'convex/react';
import { Loader2, Plus } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { JobCard } from '@/components/job-card';
import { api } from '../../convex/_generated/api';
import type { JobDoc } from '@/lib/job-types';
import type { Id } from '../../convex/_generated/dataModel';
import type { Locale } from '@/i18n/routing';

export function MyJobsList({ locale: _ }: { locale: Locale }) {
  const t = useTranslations('Jobs');
  const jobs = useQuery(api.jobs.listMine) as JobDoc[] | undefined;

  // When Fapshi redirects the payer back here (?paid=<jobId>), re-check the
  // payment against Fapshi once, in case the webhook was delayed or missed.
  const searchParams = useSearchParams();
  const paidJobId = searchParams.get('paid');
  const refreshJobPayment = useAction(api.jobFees.refreshJobPayment);

  React.useEffect(() => {
    if (!paidJobId) return;
    refreshJobPayment({ jobId: paidJobId as Id<'jobs'> }).catch(() => {
      /* best-effort; the webhook is the source of truth */
    });
  }, [paidJobId, refreshJobPayment]);

  if (jobs === undefined) {
    return (
      <div className="flex items-center justify-center py-16 text-navy/60">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border border-navy/10 bg-navy/5 p-8 text-center">
        <p className="text-lg font-semibold text-navy">{t('myJobsEmpty')}</p>
        <p className="mt-2 text-sm text-navy/70">{t('myJobsEmptyHelp')}</p>
        <Button asChild variant="secondary" size="sm" className="mt-4">
          <Link href="/jobs/new">
            <Plus className="h-4 w-4" />
            {t('postJob')}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {jobs.map((j) => (
        <div key={j._id} className="relative">
          {j.status === 'pending_payment' && (
            <span className="absolute right-3 top-3 z-10 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
              Awaiting payment
            </span>
          )}
          <JobCard job={j} />
        </div>
      ))}
    </div>
  );
}
