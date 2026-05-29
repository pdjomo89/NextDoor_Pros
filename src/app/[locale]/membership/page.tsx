import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { isAuthenticatedNextjs } from '@convex-dev/auth/nextjs/server';
import { MembershipPicker } from '@/components/membership-picker';
import { getConvexEnv } from '@/lib/convex-env';
import type { Locale } from '@/i18n/routing';

export const metadata: Metadata = {
  title: 'Subscription',
  robots: { index: false, follow: false },
};

export default async function MembershipPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ cancelled?: string; returnTo?: string }>;
}) {
  const { locale } = await params;
  const { cancelled, returnTo } = await searchParams;
  setRequestLocale(locale);

  if (!getConvexEnv().configured) redirect(`/${locale}/pros/dashboard`);

  const authed = await isAuthenticatedNextjs();
  if (!authed) redirect(`/${locale}/auth/sign-in`);

  // Only accept locale-relative paths to avoid open redirects.
  const safeReturnTo =
    returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')
      ? returnTo
      : '/pros/dashboard';

  const t = await getTranslations('Pros.membershipPicker');

  return (
    <div className="container max-w-3xl py-12">
      <MembershipPicker
        locale={locale as Locale}
        cancelled={cancelled === '1'}
        returnTo={safeReturnTo}
        labels={{
          eyebrow: t('eyebrow'),
          title: t('title'),
          subtitle: t('subtitle'),
          monthlyName: t('monthlyName'),
          monthlyPrice: t('monthlyPrice'),
          monthlyCadence: t('monthlyCadence'),
          monthlyTagline: t('monthlyTagline'),
          annualName: t('annualName'),
          annualPrice: t('annualPrice'),
          annualCadence: t('annualCadence'),
          annualTagline: t('annualTagline'),
          annualSave: t('annualSave'),
          startMonthly: t('startMonthly'),
          startAnnual: t('startAnnual'),
          redirecting: t('redirecting'),
          features: [t('feature1'), t('feature2'), t('feature3'), t('feature4')],
          alreadyActiveTitle: t('alreadyActiveTitle'),
          alreadyActiveBody: t('alreadyActiveBody'),
          goToDashboard: t('goToDashboard'),
          planMonthly: t('planMonthly'),
          planAnnual: t('planAnnual'),
          renewsOn: t('renewsOn'),
          manageBtn: t('manageBtn'),
          cancelledNotice: t('cancelledNotice'),
          errorTitle: t('errorTitle'),
        }}
      />
    </div>
  );
}
