'use client';

import { useTranslations } from 'next-intl';
import { useCity } from '@/components/city-picker-context';

export function FeaturedTitle() {
  const t = useTranslations('Home');
  const { city } = useCity();
  return (
    <h2 className="text-balance text-3xl font-bold tracking-tight text-navy sm:text-4xl">
      {city
        ? t('featuredTitle', { city: city.name })
        : t('featuredTitleNoCity')}
    </h2>
  );
}
