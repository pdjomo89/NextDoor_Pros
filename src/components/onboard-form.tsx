'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery } from 'convex/react';
import { Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CityPicker } from '@/components/city-picker';
import { useCity } from '@/components/city-picker-context';
import { SERVICE_CATEGORIES, type ServiceKey } from '@/lib/services';
import { api } from '../../convex/_generated/api';
import type { ContractorDoc } from '@/lib/contractor-types';
import type { Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

export function OnboardForm({ locale }: { locale: Locale }) {
  const t = useTranslations('Pros.onboard');
  const tCat = useTranslations('Services.categories');
  const router = useRouter();
  const { city, setCity } = useCity();

  const existing = useQuery(api.contractors.getMine) as
    | ContractorDoc
    | null
    | undefined;
  const membership = useQuery(api.membership.myMembership) as
    | { status: string }
    | null
    | undefined;
  const upsert = useMutation(api.contractors.upsertMine);

  const [businessName, setBusinessName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [services, setServices] = React.useState<ServiceKey[]>([]);
  const [startingAt, setStartingAt] = React.useState('');
  const [published, setPublished] = React.useState(false);

  const [hydrated, setHydrated] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Hydrate form from existing record once loaded.
  React.useEffect(() => {
    if (existing === undefined || hydrated) return;
    if (existing) {
      setBusinessName(existing.businessName);
      setDescription(existing.description);
      setServices(existing.services as ServiceKey[]);
      setStartingAt(
        existing.startingAtPriceCents !== undefined
          ? (existing.startingAtPriceCents / 100).toFixed(2)
          : '',
      );
      setPublished(existing.published);
      if (existing.citySlug && !city) setCity(existing.citySlug);
    }
    setHydrated(true);
  }, [existing, hydrated, city, setCity]);

  if (existing === undefined) {
    return (
      <div className="flex items-center justify-center py-16 text-navy/60">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  function toggleService(key: ServiceKey) {
    setServices((cur) =>
      cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key],
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!city) return setError(t('errCityRequired'));
    if (services.length === 0) return setError(t('errServicesRequired'));

    let startingAtPriceCents: number | undefined;
    const startingAtTrimmed = startingAt.trim().replace(',', '.');
    if (startingAtTrimmed) {
      const cents = Math.round(Number.parseFloat(startingAtTrimmed) * 100);
      if (!Number.isFinite(cents) || cents < 0 || cents > 5_000_000) {
        return setError(t('errStartingAtInvalid'));
      }
      startingAtPriceCents = cents;
    }

    setSubmitting(true);
    try {
      // Publishing requires an active subscription. Without one we save the
      // listing as a draft and send the pro to subscribe.
      const canPublish = membership?.status === 'active';
      await upsert({
        businessName: businessName.trim(),
        description: description.trim(),
        services,
        citySlug: city.slug,
        province: city.province,
        startingAtPriceCents,
        published: published && canPublish,
      });
      const nextPath = canPublish
        ? `/${locale}/pros/dashboard`
        : `/${locale}/pros/onboard/membership`;
      router.push(nextPath);
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
        className="space-y-6 rounded-2xl border border-navy/10 bg-white p-6 shadow-sm sm:p-7"
      >
        <Field label={t('businessName')} required>
          <input
            required
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="form-input"
          />
        </Field>

        <Field label={t('description')} required>
          <textarea
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="form-input resize-y"
            placeholder={t('descriptionPlaceholder')}
          />
        </Field>

        <Field label={t('city')} required>
          <CityPicker locale={locale} variant="large" />
        </Field>

        <Field label={t('services')} required>
          <div className="grid gap-2 sm:grid-cols-2">
            {SERVICE_CATEGORIES.map((c) => {
              const on = services.includes(c.key);
              return (
                <label
                  key={c.slug}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors',
                    on
                      ? 'border-forest bg-forest/5 text-forest'
                      : 'border-navy/15 hover:bg-navy/5',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleService(c.key)}
                    className="h-4 w-4 accent-forest"
                  />
                  <span className="text-sm font-medium">
                    {tCat(`${c.key}.title`)}
                  </span>
                </label>
              );
            })}
          </div>
        </Field>

        <div className="rounded-xl border border-forest/30 bg-forest/[0.04] p-4 text-sm text-navy/70">
          {t('contactPrivacyNote')}
        </div>

        <Field label={t('startingAt')}>
          <div className="relative max-w-xs">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-navy/50">
              $
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              max="50000"
              value={startingAt}
              onChange={(e) => setStartingAt(e.target.value)}
              placeholder="50.00"
              className="form-input pl-7"
            />
          </div>
          <p className="mt-1 text-xs text-navy/60">{t('startingAtHelp')}</p>
        </Field>

        <label className="flex items-center gap-3 rounded-xl border border-navy/10 p-4">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="h-4 w-4 accent-forest"
          />
          <div>
            <p className="font-medium text-navy">{t('publishLabel')}</p>
            <p className="text-xs text-navy/60">{t('publishHelp')}</p>
          </div>
        </label>

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
          <Save className="h-4 w-4" />
          {submitting ? t('saving') : t('save')}
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
