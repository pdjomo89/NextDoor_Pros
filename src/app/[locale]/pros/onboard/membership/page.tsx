import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { isAuthenticatedNextjs } from '@convex-dev/auth/nextjs/server';
import { MembershipPicker } from '@/components/membership-picker';
import { getConvexEnv } from '@/lib/convex-env';
import type { Locale } from '@/i18n/routing';

export const metadata: Metadata = {
  title: 'Activate your pro membership',
  robots: { index: false, follow: false },
};

export default async function MembershipPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const { locale } = await params;
  const { cancelled } = await searchParams;
  setRequestLocale(locale);

  if (!getConvexEnv().configured) redirect(`/${locale}/pros/dashboard`);

  const authed = await isAuthenticatedNextjs();
  if (!authed) redirect(`/${locale}/auth/sign-in`);

  const t = await getTranslations('Pros.membershipPicker');

  return (
    <div className="container max-w-3xl py-12">
      <MembershipPicker
        locale={locale as Locale}
        cancelled={cancelled === '1'}
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
          features: [
            t('feature1'),
            t('feature2'),
            t('feature3'),
            t('feature4'),
          ],
          alreadyActiveTitle: t('alreadyActiveTitle'),
          alreadyActiveBody: t('alreadyActiveBody'),
          goToDashboard: t('goToDashboard'),
          noListingTitle: t('noListingTitle'),
          noListingBody: t('noListingBody'),
          createListing: t('createListing'),
          cancelledNotice: t('cancelledNotice'),
          errorTitle: t('errorTitle'),
        }}
      />
    </div>
  );
}
