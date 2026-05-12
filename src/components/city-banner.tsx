'use client';

import { useTranslations } from 'next-intl';
import { MapPin } from 'lucide-react';
import { useCity } from '@/components/city-picker-context';
import { CityPicker } from '@/components/city-picker';
import type { Locale } from '@/i18n/routing';

export function CityBanner({ locale }: { locale: Locale }) {
  const t = useTranslations('Home');
  const { city } = useCity();

  if (city) {
    return (
      <div className="rounded-xl border border-forest/20 bg-forest/5 p-5">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 text-forest" />
            <div>
              <p className="font-semibold text-navy">
                {t('cityBanner.title', { city: `${city.name}, ${city.province}` })}
              </p>
              <p className="text-sm text-navy/70">{t('cityBanner.subtitle')}</p>
            </div>
          </div>
          <CityPicker locale={locale} />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-navy/20 bg-navy text-white p-6">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-lg font-semibold">{t('noCityBanner.title')}</p>
          <p className="text-sm text-white/80">{t('noCityBanner.subtitle')}</p>
        </div>
        <CityPicker locale={locale} variant="large" className="md:w-80" />
      </div>
    </div>
  );
}
