'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from 'convex/react';
import { Loader2 } from 'lucide-react';
import { useCity } from '@/components/city-picker-context';
import { JobCard } from '@/components/job-card';
import { SERVICE_CATEGORIES } from '@/lib/services';
import { api } from '../../convex/_generated/api';
import type { JobDoc, JobCategory } from '@/lib/job-types';
import { cn } from '@/lib/utils';

type FilterCat = JobCategory | 'all';

export function JobsList() {
  const t = useTranslations('Jobs');
  const tCat = useTranslations('Services.categories');
  const { city } = useCity();
  const [filter, setFilter] = React.useState<FilterCat>('all');

  const jobs = useQuery(api.jobs.list, {
    citySlug: city?.slug,
    category: filter === 'all' ? undefined : filter,
  }) as JobDoc[] | undefined;

  const filters: { key: FilterCat; label: string }[] = [
    { key: 'all', label: t('filterAll') },
    ...SERVICE_CATEGORIES.map((c) => ({
      key: c.key as FilterCat,
      label: tCat(`${c.key}.title`),
    })),
    { key: 'other' as FilterCat, label: t('categoryOther') },
  ];

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'border-forest bg-forest text-white'
                  : 'border-navy/15 bg-white text-navy/80 hover:bg-navy/5',
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {jobs === undefined ? (
          <div className="flex items-center justify-center py-16 text-navy/60">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="ml-2 text-sm">{t('loading')}</span>
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-xl border border-navy/10 bg-navy/5 p-8 text-center">
            <p className="text-lg font-semibold text-navy">
              {city ? t('emptyInCity', { city: city.name }) : t('emptyAnywhere')}
            </p>
            <p className="mt-2 text-sm text-navy/70">{t('emptyHelp')}</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {jobs.map((j) => (
              <JobCard key={j._id} job={j} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
