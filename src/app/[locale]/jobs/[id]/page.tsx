import { getTranslations, setRequestLocale } from 'next-intl/server';
import { JobDetail } from '@/components/job-detail';
import { JobsHero } from '@/components/jobs-hero';
import type { Locale } from '@/i18n/routing';

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Jobs');

  return (
    <div className="container max-w-3xl py-12">
      <JobsHero
        compact
        eyebrow={t('heroEyebrow')}
        title={t('detailHeroTitle')}
        backHref="/jobs"
        backLabel={t('backToJobs')}
      />
      <div className="mt-8">
        <JobDetail locale={locale as Locale} id={id} />
      </div>
    </div>
  );
}
