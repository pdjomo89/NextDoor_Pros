import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ServiceCard } from '@/components/service-card';
import { CityBanner } from '@/components/city-banner';
import { SERVICE_CATEGORIES } from '@/lib/services';
import { pageMetadata } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Services' });
  return pageMetadata({
    locale: locale as Locale,
    path: '/services',
    title: locale === 'fr' ? 'Tous les services locaux au Canada' : 'All local services across Canada',
    description: t('subtitle'),
  });
}

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Services');

  return (
    <div className="container py-16">
      <header className="mx-auto max-w-2xl text-center">
        <h1 className="text-balance text-4xl font-bold tracking-tight text-navy sm:text-5xl">
          {t('title')}
        </h1>
        <p className="mt-3 text-navy/70">{t('subtitle')}</p>
      </header>

      <div className="mt-8">
        <CityBanner locale={locale as Locale} />
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICE_CATEGORIES.map((c) => (
          <ServiceCard key={c.slug} category={c} />
        ))}
      </div>
    </div>
  );
}
