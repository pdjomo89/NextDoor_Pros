import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { CheckoutSuccessClient } from '@/components/checkout-success-client';
import type { Locale } from '@/i18n/routing';

export const metadata: Metadata = {
  title: 'Booking confirmed',
  robots: { index: false, follow: false },
};

export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { locale } = await params;
  const { session_id } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('Checkout.success');

  return (
    <div className="container max-w-xl py-16">
      <CheckoutSuccessClient
        sessionId={session_id ?? null}
        locale={locale as Locale}
        labels={{
          loading: t('loading'),
          successTitle: t('successTitle'),
          successBody: t('successBody'),
          pendingTitle: t('pendingTitle'),
          pendingBody: t('pendingBody'),
          missingTitle: t('missingTitle'),
          missingBody: t('missingBody'),
          amountLabel: t('amountLabel'),
          paidTo: t('paidTo'),
        }}
      />
      <div className="mt-8 flex justify-center gap-3">
        <Button asChild variant="secondary" size="lg">
          <Link href="/services">{t('browseMore')}</Link>
        </Button>
      </div>
    </div>
  );
}
