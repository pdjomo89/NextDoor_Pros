import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ServiceCard } from '@/components/service-card';
import { CityBanner } from '@/components/city-banner';
import { JobsHero } from '@/components/jobs-hero';
import { TOP_LEVEL_SERVICE_CATEGORIES } from '@/lib/services';
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
    <div className="container py-12">
      <JobsHero
        eyebrow={t('heroEyebrow')}
        title={t('title')}
        subtitle={t('subtitle')}
        image="https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1600&q=70"
      />

      <div className="mt-8">
        <CityBanner locale={locale as Locale} />
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {TOP_LEVEL_SERVICE_CATEGORIES.map((c) => (
          <ServiceCard key={c.slug} category={c} />
        ))}
      </div>
    </div>
  );
}
