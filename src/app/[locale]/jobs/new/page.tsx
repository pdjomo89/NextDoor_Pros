import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { isAuthenticatedNextjs } from '@convex-dev/auth/nextjs/server';
import { JobForm } from '@/components/job-form';
import { JobsHero } from '@/components/jobs-hero';
import { getConvexEnv } from '@/lib/convex-env';
import type { Locale } from '@/i18n/routing';

export const metadata: Metadata = { title: 'Post a job', robots: { index: false, follow: true } };

export default async function NewJobPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (!getConvexEnv().configured) {
    return (
      <div className="container max-w-2xl py-16">
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
          See <code>CONVEX_SETUP.md</code> first.
        </div>
      </div>
    );
  }

  const authed = await isAuthenticatedNextjs();
  if (!authed) redirect(`/${locale}/auth/sign-in`);

  const t = await getTranslations('Jobs');
  const tForm = await getTranslations('Jobs.form');

  return (
    <div className="container max-w-3xl py-12">
      <JobsHero
        compact
        eyebrow={t('heroEyebrow')}
        title={tForm('title')}
        subtitle={tForm('subtitle')}
        backHref="/jobs"
        backLabel={t('backToJobs')}
      />
      <div className="mt-8">
        <JobForm locale={locale as Locale} />
      </div>
    </div>
  );
}
