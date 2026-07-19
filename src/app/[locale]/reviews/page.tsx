import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LeaveReviewClient } from '@/components/leave-review-client';
import { pageMetadata } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'ReviewsPage' });
  return pageMetadata({
    locale: locale as Locale,
    path: '/reviews',
    title: t('metaTitle'),
    description: t('metaDescription'),
  });
}

export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('ReviewsPage');

  return (
    <div className="flex flex-col">
      {/* Hero — background photo under a colorful gradient */}
      <section className="relative isolate overflow-hidden text-white">
        <Image
          src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1600&q=70"
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-navy/95 via-navy-600/90 to-forest-800/85" />
        <div className="pointer-events-none absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-forest/30 blur-3xl" />
        <div className="container py-16 text-center md:py-20">
          <span className="inline-block rounded-full bg-forest/30 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-forest-100 ring-1 ring-inset ring-forest/40">
            {t('eyebrow')}
          </span>
          <h1 className="mx-auto mt-4 max-w-2xl text-balance text-4xl font-bold tracking-tight drop-shadow-sm sm:text-5xl">
            {t('title')}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-balance text-lg text-white/85">
            {t('subtitle')}
          </p>
        </div>
      </section>

      {/* Form + side panel */}
      <section className="container py-12 md:py-16">
        <div className="mx-auto max-w-6xl">
          <LeaveReviewClient />
        </div>
      </section>
    </div>
  );
}
