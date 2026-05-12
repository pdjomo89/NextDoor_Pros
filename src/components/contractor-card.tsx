'use client';

import { useTranslations } from 'next-intl';
import { Phone, Mail, MessageCircle, MapPin, ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { StarRating } from '@/components/star-rating';
import { getCityBySlug } from '@/data/canadian-cities';
import { SERVICE_CATEGORIES } from '@/lib/services';
import { ratingOf, type ContractorDoc } from '@/lib/contractor-types';

function digits(n: string) {
  return n.replace(/[^\d]/g, '');
}

export function ContractorCard({ contractor }: { contractor: ContractorDoc }) {
  const t = useTranslations('Services.listings');
  const tCat = useTranslations('Services.categories');
  const city = getCityBySlug(contractor.citySlug);
  const { count, average } = ratingOf(contractor);

  return (
    <article className="flex h-full flex-col rounded-xl border border-navy/10 bg-white p-6 transition-shadow hover:shadow-md">
      <header>
        <h3 className="text-lg font-semibold text-navy">
          <Link href={`/pros/${contractor._id}`} className="hover:text-forest hover:underline">
            {contractor.businessName}
          </Link>
        </h3>
        <p className="mt-1 flex items-center gap-1 text-xs text-navy/60">
          <MapPin className="h-3.5 w-3.5 text-forest" />
          {city ? `${city.name}, ${city.province}` : contractor.citySlug}
        </p>
        {count > 0 && (
          <div className="mt-1.5">
            <StarRating value={average} count={count} />
          </div>
        )}
      </header>

      <p className="mt-3 flex-1 text-sm text-navy/80">{contractor.description}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {contractor.services.map((key) => {
          const cat = SERVICE_CATEGORIES.find((c) => c.key === key);
          if (!cat) return null;
          return (
            <span
              key={key}
              className="rounded-full bg-navy/5 px-2.5 py-0.5 text-[11px] font-medium text-navy/80"
            >
              {tCat(`${cat.key}.title`)}
            </span>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
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

      <div className="mt-3">
        <Link
          href={`/pros/${contractor._id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-forest hover:underline"
        >
          {t('viewProfile')}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}
