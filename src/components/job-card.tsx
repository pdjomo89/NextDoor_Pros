'use client';

import { useTranslations } from 'next-intl';
import { MapPin, Clock, DollarSign, ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { getCityBySlug } from '@/data/canadian-cities';
import { SERVICE_CATEGORIES } from '@/lib/services';
import type { JobDoc } from '@/lib/job-types';

export function JobCard({ job }: { job: JobDoc }) {
  const t = useTranslations('Jobs');
  const tCat = useTranslations('Services.categories');
  const city = getCityBySlug(job.citySlug);
  const cat = SERVICE_CATEGORIES.find((c) => c.key === job.category);
  const categoryLabel = cat ? tCat(`${cat.key}.title`) : t('categoryOther');

  return (
    <Link
      href={`/jobs/${job._id}`}
      className="group flex h-full flex-col rounded-xl border border-navy/10 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-navy">{job.title}</h3>
        <span className="shrink-0 rounded-full bg-forest/10 px-2.5 py-0.5 text-[11px] font-medium text-forest">
          {categoryLabel}
        </span>
      </div>

      <p className="mt-2 line-clamp-3 flex-1 text-sm text-navy/70">{job.description}</p>

      <dl className="mt-4 space-y-1 text-xs text-navy/70">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-forest" />
          <span>{city ? `${city.name}, ${city.province}` : job.citySlug}</span>
        </div>
        {job.budget && (
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-forest" />
            <span>{job.budget}</span>
          </div>
        )}
        {job.timing && (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-forest" />
            <span>{job.timing}</span>
          </div>
        )}
      </dl>

      <div className="mt-4 flex items-center justify-end text-sm font-medium text-forest">
        {t('viewJob')}
        <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
