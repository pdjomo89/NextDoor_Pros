import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { CityBanner } from '@/components/city-banner';
import { ServiceListings } from '@/components/service-listings';
import { SERVICE_CATEGORIES, type ServiceKey } from '@/lib/services';
import { FEATURED_CITIES } from '@/data/canadian-cities';
import { SITE_URL, SITE_NAME, pageMetadata, JsonLd } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';

export function generateStaticParams() {
  return SERVICE_CATEGORIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const category = SERVICE_CATEGORIES.find((c) => c.slug === slug);
  if (!category) return {};
  const t = await getTranslations({ locale, namespace: 'Services' });
  const name = t(`categories.${category.key}.title`);
  const description = t(`categories.${category.key}.description`);
  const title =
    locale === 'fr'
      ? `${name} — pros locaux vérifiés partout au Canada`
      : `${name} — trusted local pros across Canada`;
  return pageMetadata({
    locale: locale as Locale,
    path: `/services/${slug}`,
    title,
    description,
    images: [category.image, `${SITE_URL}/logo.png`],
  });
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const category = SERVICE_CATEGORIES.find((c) => c.slug === slug);
  if (!category) notFound();

  const t = await getTranslations('Services');
  const name = t(`categories.${category.key}.title`);
  const description = t(`categories.${category.key}.description`);

  const serviceLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    description,
    serviceType: name,
    provider: { '@type': 'Organization', name: SITE_NAME, url: `${SITE_URL}/${locale}` },
    areaServed: { '@type': 'Country', name: 'Canada' },
    url: `${SITE_URL}/${locale}/services/${slug}`,
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE_URL}/${locale}` },
      { '@type': 'ListItem', position: 2, name: t('title'), item: `${SITE_URL}/${locale}/services` },
      { '@type': 'ListItem', position: 3, name, item: `${SITE_URL}/${locale}/services/${slug}` },
    ],
  };

  return (
    <div className="container py-12">
      <JsonLd data={[serviceLd, breadcrumbLd]} />
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/services">
          <ArrowLeft className="h-4 w-4" />
          {t('backToAll')}
        </Link>
      </Button>

      <header className="relative mt-4 overflow-hidden rounded-2xl">
        <div className="relative aspect-[16/9] w-full sm:aspect-[3/1]">
          <Image
            src={category.image}
            alt={t(`categories.${category.key}.title`)}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy/85 via-navy/45 to-navy/10" />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
          <h1 className="text-balance text-3xl font-bold tracking-tight text-white drop-shadow sm:text-4xl lg:text-5xl">
            {t(`categories.${category.key}.title`)}
          </h1>
          <p className="mt-2 max-w-2xl text-white/85">
            {t(`categories.${category.key}.description`)}
          </p>
        </div>
      </header>

      <div className="mt-8">
        <CityBanner locale={locale as Locale} />
      </div>

      <div className="mt-10">
        <ServiceListings serviceKey={category.key as ServiceKey} />
      </div>

      <section className="mt-14 border-t border-navy/10 pt-8">
        <h2 className="text-lg font-semibold text-navy">{t('findInCity', { service: name })}</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {FEATURED_CITIES.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/services/${category.slug}/${c.slug}`}
                className="inline-block rounded-full border border-navy/15 bg-white px-3 py-1.5 text-sm text-navy/80 transition-colors hover:border-forest/40 hover:bg-forest/5"
              >
                {name} · {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
