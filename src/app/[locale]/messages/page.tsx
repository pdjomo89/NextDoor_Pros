import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MessageSquare } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { MessagesClient } from '@/components/messages-client';
import { getViewer } from '@/lib/contractors';
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
      path: '/messages',
      title: t('title'),
      description: t('metaDescription'),
    }),
    robots: { index: false, follow: false },
  };
}

export default async function MessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { locale } = await params;
  const { c } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('Messages');
  const viewer = await getViewer();

  return (
    <div className="container max-w-5xl py-10">
      <h1 className="text-2xl font-bold tracking-tight text-navy">{t('title')}</h1>
      <p className="mt-1 text-sm text-navy/60">{t('subtitle')}</p>

      <div className="mt-6">
        {viewer ? (
          <MessagesClient initialConversationId={c ?? null} />
        ) : (
          <div className="rounded-2xl border border-navy/10 bg-navy/5 px-6 py-12 text-center">
            <MessageSquare className="mx-auto h-9 w-9 text-navy/30" />
            <p className="mt-3 font-semibold text-navy">{t('signInTitle')}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-navy/60">
              {t('signInBody')}
            </p>
            <Button asChild variant="secondary" size="sm" className="mt-4">
              <Link href="/auth/sign-in">{t('signInCta')}</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
