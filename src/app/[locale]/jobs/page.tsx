import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Plus } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { CityBanner } from '@/components/city-banner';
import { JobsHero } from '@/components/jobs-hero';
import { JobsList } from '@/components/jobs-list';
import { getConvexEnv } from '@/lib/convex-env';
import { pageMetadata } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Jobs' });
  return pageMetadata({
    locale: locale as Locale,
    path: '/jobs',
    title: t('title'),
    description: t('subtitle'),
  });
}

export default async function JobsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Jobs');

  return (
    <div className="container py-12">
      <JobsHero eyebrow={t('heroEyebrow')} title={t('title')} subtitle={t('subtitle')}>
        <Button asChild variant="secondary" size="lg">
          <Link href="/jobs/new">
            <Plus className="h-4 w-4" />
            {t('postJob')}
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          size="lg"
          className="border-white/30 bg-white/10 text-white hover:bg-white/20"
        >
          <Link href="/jobs/mine">{t('myJobsTitle')}</Link>
        </Button>
      </JobsHero>

      <div className="mt-8">
        <CityBanner locale={locale as Locale} />
      </div>

      <div className="mt-10">
        {getConvexEnv().configured ? (
          <JobsList />
        ) : (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
            Configure Convex (see <code>CONVEX_SETUP.md</code>) to enable jobs.
          </div>
        )}
      </div>
    </div>
  );
}
