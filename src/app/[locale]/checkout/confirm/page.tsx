import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { ConfirmCompletionClient } from '@/components/confirm-completion-client';
import type { Locale } from '@/i18n/routing';

export const metadata: Metadata = {
  title: 'Confirm work complete',
  robots: { index: false, follow: false },
};

export default async function CheckoutConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { locale } = await params;
  const { t: token } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('Checkout.confirm');

  return (
    <div className="container max-w-xl py-16">
      <ConfirmCompletionClient
        token={token ?? null}
        locale={locale as Locale}
        labels={{
          loading: t('loading'),
          missingTitle: t('missingTitle'),
          missingBody: t('missingBody'),
          reviewTitle: t('reviewTitle'),
          reviewBody: t('reviewBody'),
          amountLabel: t('amountLabel'),
          proLabel: t('proLabel'),
          confirmBtn: t('confirmBtn'),
          confirming: t('confirming'),
          doneTitle: t('doneTitle'),
          doneBody: t('doneBody'),
          alreadyTitle: t('alreadyTitle'),
          alreadyBody: t('alreadyBody'),
          error: t('error'),
        }}
      />
      <div className="mt-8 flex justify-center gap-3">
        <Button asChild variant="ghost" size="lg">
          <Link href="/messages">{t('inboxLink')}</Link>
        </Button>
      </div>
    </div>
  );
}
