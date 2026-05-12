'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMutation } from 'convex/react';
import { Send } from 'lucide-react';
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

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [category, setCategory] = React.useState<JobCategory>('home');
  const [budget, setBudget] = React.useState('');
  const [timing, setTiming] = React.useState('');
  const [contactEmail, setContactEmail] = React.useState('');
  const [contactPhone, setContactPhone] = React.useState('');

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!city) return setError(t('errCityRequired'));
    if (!contactEmail && !contactPhone) return setError(t('errContactRequired'));

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
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
      });
      router.push(`/${locale}/jobs/${id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
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

        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>

        <fieldset className="space-y-3 rounded-xl border border-navy/10 p-4">
          <legend className="px-2 text-sm font-semibold text-navy">
            {t('contactSection')}
          </legend>
          <p className="text-xs text-navy/60">{t('contactHelp')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('contactEmail')}>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="you@example.com"
                className="form-input"
              />
            </Field>
            <Field label={t('contactPhone')}>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+1 416 555 1234"
                className="form-input"
              />
            </Field>
          </div>
        </fieldset>

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
          <Send className="h-4 w-4" />
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
    </>
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
