'use client';

import { useQuery } from 'convex/react';
import { CheckCircle2, Circle, Edit3, Eye, Loader2 } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { SignOutButton } from '@/components/sign-out-button';
import { StarRating } from '@/components/star-rating';
import { getCityBySlug } from '@/data/canadian-cities';
import { SERVICE_CATEGORIES, type ServiceKey } from '@/lib/services';
import { ratingOf } from '@/lib/contractor-types';
import { useTranslations } from 'next-intl';
import { api } from '../../convex/_generated/api';
import type { ContractorDoc } from '@/lib/contractor-types';
import type { Locale } from '@/i18n/routing';

type Labels = {
  title: string;
  noListingTitle: string;
  noListingBody: string;
  createListing: string;
  edit: string;
  viewPublic: string;
  published: string;
  draft: string;
  publishedHelp: string;
  draftHelp: string;
  phone: string;
  email: string;
  whatsapp: string;
};

export function DashboardClient({
  locale,
  labels: l,
}: {
  locale: Locale;
  labels: Labels;
}) {
  const tCat = useTranslations('Services.categories');
  const viewer = useQuery(api.contractors.viewer) as
    | { _id: string; email: string | null }
    | null
    | undefined;
  const contractor = useQuery(api.contractors.getMine) as
    | ContractorDoc
    | null
    | undefined;

  const loading = viewer === undefined || contractor === undefined;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-navy/60">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const city = contractor?.citySlug ? getCityBySlug(contractor.citySlug) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {viewer?.email ? (
          <p className="text-sm text-navy/60">{viewer.email}</p>
        ) : (
          <span />
        )}
        <SignOutButton />
      </div>

      {!contractor ? (
        <div className="rounded-2xl border border-navy/10 bg-white p-8 text-center">
          <h2 className="text-xl font-semibold text-navy">{l.noListingTitle}</h2>
          <p className="mt-2 text-navy/70">{l.noListingBody}</p>
          <Button asChild variant="secondary" size="lg" className="mt-6">
            <Link href="/pros/onboard">{l.createListing}</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-xl border border-navy/10 bg-white p-5">
            <div className="flex items-center gap-3">
              {contractor.published ? (
                <CheckCircle2 className="h-6 w-6 text-forest" />
              ) : (
                <Circle className="h-6 w-6 text-navy/40" />
              )}
              <div>
                <p className="font-semibold text-navy">
                  {contractor.published ? l.published : l.draft}
                </p>
                <p className="text-sm text-navy/60">
                  {contractor.published ? l.publishedHelp : l.draftHelp}
                </p>
              </div>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/pros/onboard">
                <Edit3 className="h-4 w-4" />
                {l.edit}
              </Link>
            </Button>
          </div>

          <article className="rounded-2xl border border-navy/10 bg-white p-6">
            <h2 className="text-xl font-semibold text-navy">
              {contractor.businessName}
            </h2>
            <p className="mt-1 text-sm text-navy/60">
              {city ? `${city.name}, ${city.province}` : contractor.citySlug}
            </p>
            {(() => {
              const { count, average } = ratingOf(contractor);
              return count > 0 ? (
                <div className="mt-2">
                  <StarRating value={average} count={count} />
                </div>
              ) : null;
            })()}
            <p className="mt-4 text-navy/80">{contractor.description}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {contractor.services.map((s: ServiceKey) => {
                const cat = SERVICE_CATEGORIES.find((c) => c.key === s);
                if (!cat) return null;
                return (
                  <span
                    key={s}
                    className="rounded-full bg-forest/10 px-3 py-1 text-xs font-medium text-forest"
                  >
                    {tCat(`${cat.key}.title`)}
                  </span>
                );
              })}
            </div>

            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
              {contractor.phone && <Detail label={l.phone} value={contractor.phone} />}
              {contractor.email && <Detail label={l.email} value={contractor.email} />}
              {contractor.whatsapp && (
                <Detail label={l.whatsapp} value={contractor.whatsapp} />
              )}
            </dl>

            {contractor.published && (
              <div className="mt-6">
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/pros/${contractor._id}`}>
                    <Eye className="h-4 w-4" />
                    {l.viewPublic}
                  </Link>
                </Button>
              </div>
            )}
          </article>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-navy/10 px-3 py-2">
      <dt className="text-xs font-semibold uppercase tracking-wide text-navy/50">
        {label}
      </dt>
      <dd className="mt-0.5 text-navy">{value}</dd>
    </div>
  );
}
