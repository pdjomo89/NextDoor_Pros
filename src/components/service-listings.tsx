'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from 'convex/react';
import { Loader2, MapPin } from 'lucide-react';
import { useCity } from '@/components/city-picker-context';
import { CityPicker } from '@/components/city-picker';
import { ContractorCard } from '@/components/contractor-card';
import { getConvexEnv } from '@/lib/convex-env';
import { api } from '../../convex/_generated/api';
import type { Locale } from '@/i18n/routing';
import type { ServiceKey } from '@/lib/services';
import type { ContractorDoc } from '@/lib/contractor-types';

export function ServiceListings({ serviceKey }: { serviceKey: ServiceKey }) {
  const t = useTranslations('Services.listings');
  const locale = useLocale() as Locale;
  const { city } = useCity();

  // A city is required: don't fetch (or show) listings until one is chosen.
  const contractors = useQuery(
    api.contractors.listByService,
    getConvexEnv().configured && city
      ? { serviceKey, citySlug: city.slug }
      : 'skip',
  );

  if (!getConvexEnv().configured) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="font-semibold">Listings backend not configured.</p>
        <p className="mt-1">
          See <code>CONVEX_SETUP.md</code> to enable contractor listings.
        </p>
      </div>
    );
  }

  // No city picked yet — prompt the visitor to choose one.
  if (!city) {
    return (
      <div className="rounded-xl border border-navy/10 bg-navy/5 p-8 text-center">
        <MapPin className="mx-auto h-8 w-8 text-forest" />
        <p className="mt-3 text-lg font-semibold text-navy">{t('pickCityTitle')}</p>
        <p className="mt-1 text-sm text-navy/70">{t('pickCityBody')}</p>
        <div className="mt-4 flex justify-center">
          <CityPicker locale={locale} variant="large" className="md:w-80" />
        </div>
      </div>
    );
  }

  if (contractors === undefined) {
    return (
      <div className="flex items-center justify-center py-16 text-navy/60">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="ml-2 text-sm">{t('loading')}</span>
      </div>
    );
  }

  const list = contractors as unknown as ContractorDoc[];
  if (list.length === 0) {
    return (
      <div className="rounded-xl border border-navy/10 bg-navy/5 p-8 text-center">
        <p className="text-lg font-semibold text-navy">
          {t('emptyInCity', { city: city.name })}
        </p>
        <p className="mt-2 text-sm text-navy/70">{t('emptyHelp')}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {list.map((c) => (
        <ContractorCard key={c._id} contractor={c} />
      ))}
    </div>
  );
}
