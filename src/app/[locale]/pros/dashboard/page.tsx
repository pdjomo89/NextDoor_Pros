import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { isAuthenticatedNextjs } from '@convex-dev/auth/nextjs/server';
import { DashboardClient } from '@/components/dashboard-client';
import { getConvexEnv } from '@/lib/convex-env';
import type { Locale } from '@/i18n/routing';

export const metadata: Metadata = { title: 'Dashboard', robots: { index: false, follow: false } };

export default async function ProDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (!getConvexEnv().configured) return <ConvexNotConfigured />;

  const authed = await isAuthenticatedNextjs();
  if (!authed) redirect(`/${locale}/auth/sign-in`);

  const t = await getTranslations('Pros.dashboard');
  return (
    <div className="container max-w-4xl py-12">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy to-navy-600 px-6 py-8 text-white sm:px-8 sm:py-10">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-forest/20 blur-3xl" />
        <p className="relative text-xs font-semibold uppercase tracking-wide text-forest-200">
          {t('eyebrow')}
        </p>
        <h1 className="relative mt-1 text-2xl font-bold sm:text-3xl">{t('title')}</h1>
        <p className="relative mt-1.5 text-sm text-white/75">{t('subtitle')}</p>
      </section>
      <div className="mt-8">
        <DashboardClient
          locale={locale as Locale}
          labels={{
            title: t('title'),
            noListingTitle: t('noListingTitle'),
            noListingBody: t('noListingBody'),
            createListing: t('createListing'),
            edit: t('edit'),
            viewPublic: t('viewPublic'),
            published: t('published'),
            draft: t('draft'),
            publishedHelp: t('publishedHelp'),
            draftHelp: t('draftHelp'),
            phone: t('phone'),
            email: t('email'),
            whatsapp: t('whatsapp'),
            photos: {
              title: t('photos.title'),
              help: t('photos.help'),
              upload: t('photos.upload'),
              uploading: t('photos.uploading'),
              remove: t('photos.remove'),
              empty: t('photos.empty'),
              max: t('photos.max'),
              failed: t('photos.failed'),
            },
          }}
        />
      </div>
    </div>
  );
}

function ConvexNotConfigured() {
  return (
    <div className="container max-w-2xl py-16">
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
        <h2 className="text-base font-semibold">Convex not configured</h2>
        <p className="mt-2">
          Run <code className="rounded bg-amber-100 px-1.5 py-0.5">npx convex dev</code> once
          to provision your Convex deployment and generate the typed client. See{' '}
          <code className="rounded bg-amber-100 px-1.5 py-0.5">CONVEX_SETUP.md</code>.
        </p>
      </div>
    </div>
  );
}
