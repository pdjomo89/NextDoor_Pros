import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { GuestConversationClient } from '@/components/guest-conversation-client';
import { pageMetadata } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Messages' });
  return {
    ...pageMetadata({
      locale: locale as Locale,
      path: '/messages/guest',
      title: t('guestTitle'),
      description: t('metaDescription'),
    }),
    robots: { index: false, follow: false },
  };
}

export default async function GuestMessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { locale } = await params;
  const { t: token } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('Messages');

  return (
    <div className="container max-w-3xl py-10">
      <h1 className="text-2xl font-bold tracking-tight text-navy">
        {t('guestTitle')}
      </h1>
      <p className="mt-1 text-sm text-navy/60">{t('guestSubtitle')}</p>

      <div className="mt-6">
        <GuestConversationClient token={token ?? ''} />
      </div>
    </div>
  );
}
