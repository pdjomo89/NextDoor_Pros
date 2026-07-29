import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MembershipClient } from '@/components/membership-client';
import { getConvexEnv } from '@/lib/convex-env';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Membership');
  return {
    title: t('title'),
    description: t('metaDescription'),
    robots: { index: false, follow: true },
  };
}

export default async function MembershipPage({
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

  return (
    <div className="container max-w-3xl py-12">
      <Suspense>
        <MembershipClient />
      </Suspense>
    </div>
  );
}
