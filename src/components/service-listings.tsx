'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from 'convex/react';
import { Loader2 } from 'lucide-react';
import { useCity } from '@/components/city-picker-context';
import { ContractorCard } from '@/components/contractor-card';
import { getConvexEnv } from '@/lib/convex-env';
import { api } from '../../convex/_generated/api';
import type { ServiceKey } from '@/lib/services';
import type { ContractorDoc } from '@/lib/contractor-types';

export function ServiceListings({ serviceKey }: { serviceKey: ServiceKey }) {
  const t = useTranslations('Services.listings');
  const { city } = useCity();

  const contractors = useQuery(
    api.contractors.listByService,
    getConvexEnv().configured
      ? { serviceKey, citySlug: city?.slug }
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
          {city ? t('emptyInCity', { city: city.name }) : t('emptyAnywhere')}
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
