import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, ChevronDown, MapPin } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { ServiceCityListings } from '@/components/service-city-listings';
import { SERVICE_CATEGORIES, type ServiceKey } from '@/lib/services';
import {
  FEATURED_CITY_SLUGS,
  citiesInProvince,
  getCityBySlug,
  getProvinceByCode,
} from '@/data/canadian-cities';
import { SITE_URL, SITE_NAME, pageMetadata, JsonLd } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';

// Pre-render the big-city pages; render (and cache for a day) the long-tail on demand.
export const revalidate = 86400;

export function generateStaticParams() {
  return SERVICE_CATEGORIES.flatMap((c) =>
    FEATURED_CITY_SLUGS.map((city) => ({ slug: c.slug, city })),
  );
}

function resolve(slug: string, citySlug: string) {
  const category = SERVICE_CATEGORIES.find((c) => c.slug === slug);
  const city = getCityBySlug(citySlug);
  if (!category || !city) return null;
  return { category, city };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string; city: string }>;
}): Promise<Metadata> {
  const { locale, slug, city } = await params;
  const r = resolve(slug, city);
  if (!r) return {};
  const t = await getTranslations({ locale, namespace: 'Services' });
  const tc = await getTranslations({ locale, namespace: 'ServiceCity' });
  const province = getProvinceByCode(r.city.province);
  const provinceName = province ? province.name[locale as 'en' | 'fr'] : r.city.province;
  const serviceName = t(`categories.${r.category.key}.title`);
  const vars = { service: serviceName, city: r.city.name, province: provinceName };
  return pageMetadata({
    locale: locale as Locale,
    path: `/services/${slug}/${city}`,
    title: tc('metaTitle', vars),
    description: tc('metaDescription', vars),
    images: [r.category.image, `${SITE_URL}/logo.png`],
  });
}

export default async function ServiceCityPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; city: string }>;
}) {
  const { locale, slug, city } = await params;
  setRequestLocale(locale);
  const r = resolve(slug, city);
  if (!r) notFound();
  const { category, city: cityObj } = r;

  const t = await getTranslations('Services');
  const tc = await getTranslations('ServiceCity');
  const province = getProvinceByCode(cityObj.province);
  const provinceName = province ? province.name[locale as 'en' | 'fr'] : cityObj.province;
  const serviceName = t(`categories.${category.key}.title`);
  const serviceDesc = t(`categories.${category.key}.description`);
  const vars = { service: serviceName, city: cityObj.name, province: provinceName };

  const nearby = citiesInProvince(cityObj.province, cityObj.slug).slice(0, 12);

  const base = `${SITE_URL}/${locale}`;
  const serviceLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `${serviceName} — ${cityObj.name}`,
    description: serviceDesc,
    serviceType: serviceName,
    provider: { '@type': 'Organization', name: SITE_NAME, url: base },
    areaServed: {
      '@type': 'City',
      name: cityObj.name,
      containedInPlace: { '@type': 'AdministrativeArea', name: provinceName },
    },
    url: `${base}/services/${slug}/${city}`,
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: base },
      { '@type': 'ListItem', position: 2, name: t('title'), item: `${base}/services` },
      { '@type': 'ListItem', position: 3, name: serviceName, item: `${base}/services/${slug}` },
      { '@type': 'ListItem', position: 4, name: cityObj.name, item: `${base}/services/${slug}/${city}` },
    ],
  };

  const faqs = [1, 2, 3, 4].map((n) => ({
    q: tc(`q${n}`, vars),
    a: tc(`a${n}`, vars),
  }));
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <div className="container py-12">
      <JsonLd data={[serviceLd, breadcrumbLd, faqLd]} />

      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/services/${category.slug}`}>
          <ArrowLeft className="h-4 w-4" />
          {tc('backToService', { service: serviceName })}
        </Link>
      </Button>

      {/* Hero */}
      <header className="relative mt-4 overflow-hidden rounded-2xl">
        <div className="relative aspect-[16/9] w-full sm:aspect-[3/1]">
          <Image
            src={category.image}
            alt={tc('heroTitle', vars)}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy/85 via-navy/45 to-navy/10" />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
          <p className="flex items-center gap-1.5 text-sm font-medium text-white/80">
            <MapPin className="h-4 w-4" />
            {cityObj.name}, {provinceName}
          </p>
          <h1 className="mt-1 text-balance text-3xl font-bold tracking-tight text-white drop-shadow sm:text-4xl lg:text-5xl">
            {tc('heroTitle', vars)}
          </h1>
          <p className="mt-2 max-w-2xl text-white/85">{serviceDesc}</p>
        </div>
      </header>

      {/* City intro */}
      <p className="mt-8 max-w-3xl leading-relaxed text-navy/70">{tc('intro', vars)}</p>

      {/* Listings */}
      <div className="mt-10">
        <ServiceCityListings
          serviceKey={category.key as ServiceKey}
          citySlug={cityObj.slug}
          cityName={cityObj.name}
        />
      </div>

      {/* FAQ */}
      <section className="mt-14 border-t border-navy/10 pt-8">
        <h2 className="text-lg font-semibold text-navy">{tc('faqTitle')}</h2>
        <div className="mt-4 divide-y divide-navy/10 overflow-hidden rounded-2xl border border-navy/10 bg-white">
          {faqs.map((f, i) => (
            <details
              key={i}
              className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-navy">
                {f.q}
                <ChevronDown className="h-4 w-4 shrink-0 text-navy/40 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-navy/70">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Pro CTA */}
      <section className="mt-12 overflow-hidden rounded-2xl bg-gradient-to-br from-navy to-navy-600 px-6 py-10 text-white sm:px-10">
        <h2 className="text-balance text-xl font-bold sm:text-2xl">{tc('proCtaTitle', vars)}</h2>
        <p className="mt-2 max-w-xl text-white/80">{tc('proCtaBody', vars)}</p>
        <Button asChild variant="secondary" size="lg" className="mt-5">
          <Link href="/pros/onboard">
            {tc('proCtaButton')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </section>

      {/* Nearby cities */}
      {nearby.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold text-navy">{tc('nearbyTitle', vars)}</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {nearby.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/services/${category.slug}/${c.slug}`}
                  className="inline-block rounded-full border border-navy/15 bg-white px-3 py-1.5 text-sm text-navy/80 transition-colors hover:border-forest/40 hover:bg-forest/5"
                >
                  {serviceName} · {c.name}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-5">
            <Link
              href={`/services/${category.slug}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-forest hover:underline"
            >
              {tc('browseAll', vars)}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </p>
        </section>
      )}
    </div>
  );
}
