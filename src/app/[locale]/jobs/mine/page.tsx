import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { isAuthenticatedNextjs } from '@convex-dev/auth/nextjs/server';
import { Plus } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { JobsHero } from '@/components/jobs-hero';
import { MyJobsList } from '@/components/my-jobs-list';
import { getConvexEnv } from '@/lib/convex-env';
import type { Locale } from '@/i18n/routing';

export const metadata: Metadata = { title: 'My job postings', robots: { index: false, follow: false } };

export default async function MyJobsPage({
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

  return (
    <div className="container max-w-4xl py-12">
      <JobsHero
        compact
        eyebrow={t('heroEyebrow')}
        title={t('myJobsTitle')}
        subtitle={t('myJobsSubtitle')}
        backHref="/jobs"
        backLabel={t('backToJobs')}
      >
        <Button asChild variant="secondary" size="lg">
          <Link href="/jobs/new">
            <Plus className="h-4 w-4" />
            {t('postJob')}
          </Link>
        </Button>
      </JobsHero>
      <div className="mt-8">
        <MyJobsList locale={locale as Locale} />
      </div>
    </div>
  );
}
