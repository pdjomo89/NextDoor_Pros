'use client';

import { useTranslations } from 'next-intl';
import {
  Phone,
  Mail,
  MessageCircle,
  MapPin,
  ArrowRight,
  Award,
  Sparkles,
} from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { StarRating } from '@/components/star-rating';
import { getCityBySlug } from '@/data/canadian-cities';
import { SERVICE_CATEGORIES } from '@/lib/services';
import { ratingOf, type ContractorDoc } from '@/lib/contractor-types';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function digits(n: string) {
  return n.replace(/[^\d]/g, '');
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
  return letters.toUpperCase() || '·';
}

export function ContractorCard({ contractor }: { contractor: ContractorDoc }) {
  const t = useTranslations('Services.listings');
  const tCat = useTranslations('Services.categories');
  const city = getCityBySlug(contractor.citySlug);
  const { count, average } = ratingOf(contractor);

  const photoUrls = contractor.photoUrls ?? [];
  const hero = photoUrls[0];
  const isTopRated = count >= 3 && average >= 4.5;
  const isNew = Date.now() - contractor._creationTime < THIRTY_DAYS_MS;
  const profileHref = `/pros/${contractor._id}`;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-sm ring-1 ring-transparent transition-all hover:-translate-y-0.5 hover:shadow-xl hover:ring-forest/20">
      <Link href={profileHref} className="relative block aspect-[16/10] overflow-hidden bg-navy/5">
        {hero ? (
          // Convex storage URLs aren't whitelisted in next.config.js images, so use a plain img.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero}
            alt={contractor.businessName}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-forest/15 via-white to-navy/15">
            <span className="grid h-20 w-20 place-items-center rounded-2xl bg-white/90 text-2xl font-bold text-navy shadow-sm ring-1 ring-navy/10">
              {initials(contractor.businessName)}
            </span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-navy/55 to-transparent" />

        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {isTopRated && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/95 px-2.5 py-1 text-[11px] font-semibold text-navy shadow-sm">
              <Award className="h-3.5 w-3.5" />
              {t('topRated')}
            </span>
          )}
          {isNew && !isTopRated && (
            <span className="inline-flex items-center gap-1 rounded-full bg-forest/95 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              {t('newBadge')}
            </span>
          )}
        </div>

      </Link>

      <div className="flex flex-1 flex-col p-5">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold text-navy">
              <Link href={profileHref} className="hover:text-forest hover:underline">
                {contractor.businessName}
              </Link>
            </h3>
            <p className="mt-1 flex items-center gap-1 text-xs text-navy/60">
              <MapPin className="h-3.5 w-3.5 text-forest" />
              {city ? `${city.name}, ${city.province}` : contractor.citySlug}
            </p>
          </div>
          {count > 0 && (
            <div className="shrink-0 rounded-lg bg-navy/5 px-2 py-1">
              <StarRating value={average} count={count} />
            </div>
          )}
        </header>

        <p className="mt-3 line-clamp-4 text-base leading-relaxed text-navy/90">
          {contractor.description}
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {contractor.services.slice(0, 4).map((key) => {
            const cat = SERVICE_CATEGORIES.find((c) => c.key === key);
            if (!cat) return null;
            return (
              <span
                key={key}
                className="rounded-full bg-forest/10 px-2.5 py-0.5 text-[11px] font-medium text-forest"
              >
                {tCat(`${cat.key}.title`)}
              </span>
            );
          })}
          {contractor.services.length > 4 && (
            <span className="rounded-full bg-navy/5 px-2.5 py-0.5 text-[11px] font-medium text-navy/70">
              +{contractor.services.length - 4}
            </span>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-3 pt-5">
          <div className="flex flex-wrap gap-2">
            {contractor.phone && (
              <Button asChild variant="primary" size="sm">
                <a href={`tel:${digits(contractor.phone)}`}>
                  <Phone className="h-4 w-4" />
                  {t('call')}
                </a>
              </Button>
            )}
            {contractor.email && (
              <Button asChild variant="outline" size="sm">
                <a href={`mailto:${contractor.email}`}>
                  <Mail className="h-4 w-4" />
                  {t('emailAction')}
                </a>
              </Button>
            )}
            {contractor.whatsapp && (
              <Button asChild variant="secondary" size="sm">
                <a
                  href={`https://wa.me/${digits(contractor.whatsapp)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
              </Button>
            )}
          </div>

          <Link
            href={profileHref}
            className="inline-flex items-center gap-1 text-sm font-medium text-forest hover:underline"
          >
            {t('viewProfile')}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}
