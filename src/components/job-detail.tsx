'use client';

import { useTranslations } from 'next-intl';
import { useMutation, useQuery } from 'convex/react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  DollarSign,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { getCityBySlug } from '@/data/canadian-cities';
import { SERVICE_CATEGORIES } from '@/lib/services';
import { api } from '../../convex/_generated/api';
import type { JobDoc } from '@/lib/job-types';
import type { Locale } from '@/i18n/routing';

function digits(n: string) {
  return n.replace(/[^\d]/g, '');
}

export function JobDetail({ locale: _, id }: { locale: Locale; id: string }) {
  const t = useTranslations('Jobs');
  const tCat = useTranslations('Services.categories');

  const job = useQuery(api.jobs.get, { id: id as never }) as
    | JobDoc
    | null
    | undefined;
  const viewer = useQuery(api.contractors.viewer) as
    | { _id: string; email: string | null }
    | null
    | undefined;
  const closeJob = useMutation(api.jobs.update);
  const deleteJob = useMutation(api.jobs.deleteMine);

  if (job === undefined) {
    return (
      <div className="flex items-center justify-center py-16 text-navy/60">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (job === null) {
    return (
      <div className="rounded-xl border border-navy/10 bg-white p-8 text-center">
        <p className="font-semibold text-navy">{t('notFound')}</p>
        <Button asChild variant="ghost" size="sm" className="mt-3">
          <Link href="/jobs">
            <ArrowLeft className="h-4 w-4" />
            {t('backToJobs')}
          </Link>
        </Button>
      </div>
    );
  }

  const city = getCityBySlug(job.citySlug);
  const cat = SERVICE_CATEGORIES.find((c) => c.key === job.category);
  const categoryLabel = cat ? tCat(`${cat.key}.title`) : t('categoryOther');
  const isOwner = viewer?._id === job.posterId;
  const postedAt = new Date(job._creationTime).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  async function onClose() {
    if (!job) return;
    if (!confirm(t('confirmClose'))) return;
    await closeJob({ id: job._id as never, status: 'closed' });
  }

  async function onDelete() {
    if (!job) return;
    if (!confirm(t('confirmDelete'))) return;
    await deleteJob({ id: job._id as never });
    window.location.href = '/jobs';
  }

  return (
    <article className="rounded-2xl border border-navy/10 bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-balance text-3xl font-bold text-navy">
            {job.title}
          </h1>
          <span className="rounded-full bg-forest/10 px-3 py-1 text-xs font-medium text-forest">
            {categoryLabel}
          </span>
        </div>

        {job.status !== 'open' && (
          <p className="mt-3 inline-block rounded-full bg-navy/10 px-3 py-1 text-xs font-medium text-navy">
            {job.status === 'closed' ? t('statusClosed') : t('statusFilled')}
          </p>
        )}

        <dl className="mt-5 grid gap-2 text-sm text-navy/70 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-forest" />
            {city ? `${city.name}, ${city.province}` : job.citySlug}
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-forest" />
            {t('postedOn', { date: postedAt })}
          </div>
          {job.budget && (
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-forest" />
              <span>
                <strong className="text-navy">{t('budget')}:</strong> {job.budget}
              </span>
            </div>
          )}
          {job.timing && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-forest" />
              <span>
                <strong className="text-navy">{t('timing')}:</strong> {job.timing}
              </span>
            </div>
          )}
        </dl>

        <div className="mt-6 whitespace-pre-line text-navy/90">
          {job.description}
        </div>

        {job.status === 'open' && (
          <div className="mt-8 rounded-xl border border-navy/10 bg-navy/5 p-5">
            <h2 className="font-semibold text-navy">{t('contactSection')}</h2>
            <p className="mt-1 text-sm text-navy/70">{t('contactHelp')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {job.contactPhone && (
                <Button asChild variant="primary" size="sm">
                  <a href={`tel:${digits(job.contactPhone)}`}>
                    <Phone className="h-4 w-4" />
                    {t('call')}
                  </a>
                </Button>
              )}
              {job.contactEmail && (
                <Button asChild variant="secondary" size="sm">
                  <a href={`mailto:${job.contactEmail}?subject=${encodeURIComponent(job.title)}`}>
                    <Mail className="h-4 w-4" />
                    {t('emailAction')}
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}

        {isOwner && (
          <div className="mt-6 flex flex-wrap gap-2 border-t border-navy/10 pt-5">
            {job.status === 'open' && (
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                <XCircle className="h-4 w-4" />
                {t('closeJob')}
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
              {t('deleteJob')}
            </Button>
          </div>
        )}
    </article>
  );
}
