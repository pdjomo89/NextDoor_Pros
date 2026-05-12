import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { isAuthenticatedNextjs } from '@convex-dev/auth/nextjs/server';
import { OnboardForm } from '@/components/onboard-form';
import { JobsHero } from '@/components/jobs-hero';
import { getConvexEnv } from '@/lib/convex-env';
import type { Locale } from '@/i18n/routing';

export const metadata: Metadata = { title: 'Your business listing', robots: { index: false, follow: false } };

export default async function OnboardPage({
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
          See <code>CONVEX_SETUP.md</code> to configure Convex first.
        </div>
      </div>
    );
  }

  const authed = await isAuthenticatedNextjs();
  if (!authed) redirect(`/${locale}/auth/sign-in`);

  const t = await getTranslations('Pros.onboard');

  return (
    <div className="container max-w-3xl py-12">
      <JobsHero
        compact
        image="/hero-home-services.jpg"
        eyebrow={t('eyebrow')}
        title={t('heroTitle')}
        subtitle={t('subtitle')}
        backHref="/pros/dashboard"
        backLabel={t('backToDashboard')}
      />
      <div className="mt-8">
        <OnboardForm locale={locale as Locale} />
      </div>
    </div>
  );
}
