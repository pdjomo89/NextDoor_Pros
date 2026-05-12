'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import {
  ArrowRight,
  Hammer,
  Sparkles,
  Trees,
  Truck,
  Snowflake,
  Wrench,
  HeartPulse,
  Layers,
  PaintBucket,
  Car,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import { Link } from '@/i18n/routing';
import type { ServiceCategory, ServiceKey } from '@/lib/services';
import { useCity } from '@/components/city-picker-context';
import { cn } from '@/lib/utils';

const ICONS: Record<ServiceKey, LucideIcon> = {
  home: Hammer,
  beauty: Sparkles,
  outdoor: Trees,
  moving: Truck,
  seasonal: Snowflake,
  handyman: Wrench,
  wellness: HeartPulse,
  flooring: Layers,
  painting: PaintBucket,
  carwash: Car,
  catering: UtensilsCrossed,
};

export function ServiceCard({ category }: { category: ServiceCategory }) {
  const t = useTranslations('Services');
  const { city } = useCity();
  const Icon = ICONS[category.key];
  const accentRing = category.accent === 'navy' ? 'group-hover:ring-navy/30' : 'group-hover:ring-forest/30';

  return (
    <Link
      href={`/services/${category.slug}`}
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-xl border border-navy/10 bg-white transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-2 ring-transparent',
        accentRing,
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-navy/5">
        <Image
          src={category.image}
          alt={t(`categories.${category.key}.title`)}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute bottom-3 left-3 grid h-10 w-10 place-items-center rounded-lg bg-white/90 shadow-sm backdrop-blur">
          <Icon className={cn('h-5 w-5', category.accent === 'navy' ? 'text-navy' : 'text-forest')} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-lg font-semibold text-navy">
          {t(`categories.${category.key}.title`)}
        </h3>
        <p className="mt-2 flex-1 text-sm text-navy/70">
          {t(`categories.${category.key}.description`)}
        </p>
        <div className="mt-4 flex items-center justify-between text-sm font-medium">
          <span className="text-forest">
            {city ? t('viewPros') : t('viewAll')}
          </span>
          <ArrowRight className="h-4 w-4 text-forest transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}
