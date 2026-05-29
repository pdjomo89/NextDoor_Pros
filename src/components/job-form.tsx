'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery } from 'convex/react';
import { Loader2, Send, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { CityPicker } from '@/components/city-picker';
import { useCity } from '@/components/city-picker-context';
import { SERVICE_CATEGORIES } from '@/lib/services';
import { api } from '../../convex/_generated/api';
import type { JobCategory } from '@/lib/job-types';
import type { Locale } from '@/i18n/routing';

export function JobForm({ locale }: { locale: Locale }) {
  const t = useTranslations('Jobs.form');
  const tCat = useTranslations('Services.categories');
  const tJobs = useTranslations('Jobs');
  const router = useRouter();
  const { city } = useCity();
  const create = useMutation(api.jobs.create);

  const membership = useQuery(api.membership.myMembership) as
    | { status: string; plan: string | null; currentPeriodEnd: number | null }
    | null
    | undefined;

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [category, setCategory] = React.useState<JobCategory>('home');
  const [timing, setTiming] = React.useState('');
  const [budget, setBudget] = React.useState('');

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!city) return setError(t('errCityRequired'));

    setSubmitting(true);
    try {
      const id = await create({
        title: title.trim(),
        description: description.trim(),
        category,
        citySlug: city.slug,
        province: city.province,
        budget: budget.trim() || undefined,
        timing: timing.trim() || undefined,
      });
      router.push(`/${locale}/jobs/${id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  // Posting requires an active subscription.
  if (membership === undefined) {
    return (
      <div className="flex items-center justify-center py-16 text-navy/60">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!membership || membership.status !== 'active') {
    return (
      <div className="rounded-2xl border border-forest/30 bg-forest/[0.04] p-8 text-center">
        <Sparkles className="mx-auto h-10 w-10 text-forest" />
        <h2 className="mt-3 text-xl font-semibold text-navy">{t('gateTitle')}</h2>
        <p className="mx-auto mt-2 max-w-md text-navy/70">{t('gateBody')}</p>
        <Button asChild variant="secondary" size="lg" className="mt-5">
          <Link href={`/membership?returnTo=${encodeURIComponent('/jobs/new')}`}>
            <Sparkles className="h-4 w-4" />
            {t('gateCta')}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-6 rounded-2xl border border-navy/10 bg-white p-6"
    >
      <Field label={t('jobTitle')} required>
        <input
          required
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('jobTitlePlaceholder')}
          className="form-input"
        />
      </Field>

      <Field label={t('category')} required>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as JobCategory)}
          className="form-input"
        >
          {SERVICE_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {tCat(`${c.key}.title`)}
            </option>
          ))}
          <option value="other">{tJobs('categoryOther')}</option>
        </select>
      </Field>

      <Field label={t('description')} required>
        <textarea
          required
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('descriptionPlaceholder')}
          className="form-input resize-y"
        />
      </Field>

      <Field label={t('city')} required>
        <CityPicker locale={locale} variant="large" />
      </Field>

      <Field label={t('budget')}>
        <input
          type="text"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          placeholder={t('budgetPlaceholder')}
          className="form-input"
        />
      </Field>

      <Field label={t('timing')}>
        <input
          type="text"
          value={timing}
          onChange={(e) => setTiming(e.target.value)}
          placeholder={t('timingPlaceholder')}
          className="form-input"
        />
      </Field>

      <div className="rounded-xl border border-forest/30 bg-forest/[0.04] p-4 text-sm text-navy/70">
        {t('contactPrivacyNote')}
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="secondary"
        size="lg"
        disabled={submitting}
        className="w-full sm:w-auto"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {submitting ? t('posting') : t('postJob')}
      </Button>

      <style jsx>{`
        :global(.form-input) {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid hsl(215 20% 88%);
          background: white;
          padding: 0.625rem 0.75rem;
          font-size: 0.875rem;
          color: hsl(215 60% 12%);
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        :global(.form-input:focus) {
          border-color: #1f8a3b;
          box-shadow: 0 0 0 3px rgba(31, 138, 59, 0.15);
        }
      `}</style>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-navy">
        {label}
        {required && <span className="ml-0.5 text-forest">*</span>}
      </span>
      {children}
    </label>
  );
}
