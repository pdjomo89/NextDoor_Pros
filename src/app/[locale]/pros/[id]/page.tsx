import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { fetchQuery } from 'convex/nextjs';
import { ArrowLeft, MapPin } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { StarRating } from '@/components/star-rating';
import { ReviewSection } from '@/components/review-section';
import { ContactProButton } from '@/components/contact-pro-button';
import { BookingSection } from '@/components/booking-section';
import { getViewer } from '@/lib/contractors';
import { getConvexEnv } from '@/lib/convex-env';
import { getCityBySlug, getProvinceByCode } from '@/data/canadian-cities';
import { SERVICE_CATEGORIES } from '@/lib/services';
import { ratingOf, type ContractorDoc } from '@/lib/contractor-types';
import type { ReviewDoc } from '@/lib/review-types';
import { SITE_URL, SITE_NAME, pageMetadata, JsonLd } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';
import { api } from '../../../../../convex/_generated/api';

async function getContractor(id: string): Promise<ContractorDoc | null> {
  if (!getConvexEnv().configured) return null;
  try {
    return (await fetchQuery(api.contractors.getPublic, { id: id as never })) as ContractorDoc | null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const c = await getContractor(id);
  if (!c) return { robots: { index: false, follow: false } };
  const t = await getTranslations({ locale, namespace: 'Services' });
  const city = getCityBySlug(c.citySlug);
  const province = getProvinceByCode(city?.province ?? '');
  const cityLabel = city
    ? `${city.name}, ${province ? province.name[locale as 'en' | 'fr'] : city.province}`
    : c.citySlug;
  const services = c.services
    .map((k) => SERVICE_CATEGORIES.find((s) => s.key === k))
    .filter(Boolean)
    .map((s) => t(`categories.${s!.key}.title`))
    .join(', ');
  return pageMetadata({
    locale: locale as Locale,
    path: `/pros/${id}`,
    title: `${c.businessName} — ${services || 'local services'} in ${cityLabel}`,
    description: c.description.slice(0, 200),
  });
}

export default async function ContractorProfilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const contractor = await getContractor(id);
  if (!contractor) notFound();

  const t = await getTranslations('Services');
  const tp = await getTranslations('Pros.profile');
  const tCat = await getTranslations('Services.categories');
  const tBook = await getTranslations('Pros.booking');

  const city = getCityBySlug(contractor.citySlug);
  const province = getProvinceByCode(city?.province ?? '');
  const provinceName = province ? province.name[locale as 'en' | 'fr'] : contractor.province;
  const cityLabel = city ? `${city.name}, ${provinceName}` : contractor.citySlug;
  const { count: ratingCount, average } = ratingOf(contractor);

  const reviews = getConvexEnv().configured
    ? ((await fetchQuery(api.reviews.listForContractor, {
        contractorId: id as never,
      }).catch(() => [])) as ReviewDoc[])
    : [];

  const viewer = (await getViewer()) as { _id: string } | null;
  const isOwner = Boolean(viewer && viewer._id === contractor.ownerId);

  const serviceNames = contractor.services
    .map((k) => SERVICE_CATEGORIES.find((s) => s.key === k))
    .filter(Boolean)
    .map((s) => tCat(`${s!.key}.title`));

  const base = `${SITE_URL}/${locale}`;
  const bizLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: contractor.businessName,
    description: contractor.description,
    url: `${base}/pros/${id}`,
    areaServed: city
      ? {
          '@type': 'City',
          name: city.name,
          containedInPlace: { '@type': 'AdministrativeArea', name: provinceName },
        }
      : provinceName,
  };
  if (ratingCount > 0) {
    bizLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(average.toFixed(1)),
      reviewCount: ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
    bizLd.review = reviews.slice(0, 20).map((r) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: r.authorName ?? 'Customer' },
      datePublished: new Date(r._creationTime).toISOString().slice(0, 10),
      reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      reviewBody: r.comment,
    }));
  }
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: base },
      { '@type': 'ListItem', position: 2, name: t('title'), item: `${base}/services` },
      { '@type': 'ListItem', position: 3, name: contractor.businessName, item: `${base}/pros/${id}` },
    ],
  };

  return (
    <div className="container max-w-3xl py-12">
      <JsonLd data={[bizLd, breadcrumbLd]} />

      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/services">
          <ArrowLeft className="h-4 w-4" />
          {t('backToAll')}
        </Link>
      </Button>

      <article className="mt-4 rounded-2xl border border-navy/10 bg-white p-6 sm:p-8">
        <h1 className="text-balance text-3xl font-bold tracking-tight text-navy">
          {contractor.businessName}
        </h1>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-navy/60">
          <MapPin className="h-4 w-4 text-forest" />
          {cityLabel}
        </p>
        {ratingCount > 0 && (
          <div className="mt-3">
            <StarRating value={average} count={ratingCount} size="md" />
          </div>
        )}

        {contractor.startingAtPriceCents !== undefined && (
          <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-forest/10 px-3 py-1.5 text-sm font-semibold text-forest">
            {t('listings.startingAt')}{' '}
            <span className="text-base">
              {new Intl.NumberFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
                style: 'currency',
                currency: 'CAD',
                maximumFractionDigits: 0,
              }).format(contractor.startingAtPriceCents / 100)}
            </span>
          </p>
        )}

        <p className="mt-5 whitespace-pre-line text-navy/85">{contractor.description}</p>

        {serviceNames.length > 0 && (
          <div className="mt-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-navy/50">
              {tp('servicesTitle')}
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {serviceNames.map((n) => (
                <span
                  key={n}
                  className="rounded-full bg-forest/10 px-3 py-1 text-xs font-medium text-forest"
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
        )}

        {contractor.photoUrls && contractor.photoUrls.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-navy/50">
              {tp('photosTitle')}
            </h2>
            <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {contractor.photoUrls.map((url) => (
                <li
                  key={url}
                  className="aspect-square overflow-hidden rounded-xl border border-navy/10 bg-navy/5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                </li>
              ))}
            </ul>
          </div>
        )}

        <BookingSection
          contractorId={contractor._id as never}
          contractorAcceptsPayments={contractor.stripeOnboardingComplete === true}
          locale={locale as Locale}
          labels={{
            sectionTitle: tBook('sectionTitle'),
            sectionIntro: tBook('sectionIntro'),
            bookButton: tBook('bookButton'),
            modalTitle: tBook('modalTitle'),
            emailLabel: tBook('emailLabel'),
            nameLabel: tBook('nameLabel'),
            nameOptional: tBook('nameOptional'),
            noteLabel: tBook('noteLabel'),
            noteOptional: tBook('noteOptional'),
            notePlaceholder: tBook('notePlaceholder'),
            paySecurely: tBook('paySecurely'),
            redirecting: tBook('redirecting'),
            cancel: tBook('cancel'),
            errorTitle: tBook('errorTitle'),
            feeDisclosure: tBook('feeDisclosure'),
            empty: tBook('empty'),
          }}
        />

        <div className="mt-6 border-t border-navy/10 pt-5">
          <ContactProButton
            contractorId={contractor._id}
            ownerId={contractor.ownerId}
            variant="primary"
            size="sm"
          />
          <p className="mt-2 text-xs text-navy/50">{tp('contactPrivacyNote')}</p>
        </div>
      </article>

      <ReviewSection contractorId={id} isOwner={isOwner} />
    </div>
  );
}
