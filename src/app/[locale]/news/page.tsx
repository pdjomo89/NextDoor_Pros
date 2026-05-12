import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowRight, Calendar } from 'lucide-react';
import { pageMetadata } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1444084316824-dc26d6657664?auto=format&fit=crop&w=1600&q=70';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'News' });
  return pageMetadata({
    locale: locale as Locale,
    path: '/news',
    title: t('title'),
    description: t('subtitle'),
  });
}

const POSTS = ['p1', 'p2', 'p3'] as const;

const unsplash = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=70`;

const POST_IMAGE: Record<(typeof POSTS)[number], string> = {
  p1: unsplash('1519178614-68673b201f36'),
  p2: unsplash('1599685315640-9ceab2f58148'),
  p3: unsplash('1521791136064-7986c2920216'),
};

export default async function NewsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('News');

  const [featured, ...rest] = POSTS;

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative isolate overflow-hidden text-white">
        <Image
          src={HERO_IMAGE}
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-navy/95 via-navy/85 to-navy/70" />
        <div className="container py-20 text-center md:py-24">
          <span className="inline-block rounded-full bg-forest/30 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-forest-100 ring-1 ring-inset ring-forest/40">
            {t('eyebrow')}
          </span>
          <h1 className="mx-auto mt-4 max-w-2xl text-balance text-4xl font-bold tracking-tight drop-shadow-sm sm:text-5xl">
            {t('title')}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-balance text-lg text-white/85">{t('subtitle')}</p>
        </div>
      </section>

      {/* Posts */}
      <section className="container py-16 md:py-20">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
          {/* Featured */}
          <article className="group flex flex-col overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-sm transition-shadow hover:shadow-md md:col-span-2 md:flex-row">
            <div className="relative aspect-[16/10] overflow-hidden bg-navy/5 md:aspect-auto md:w-5/12">
              <Image
                src={POST_IMAGE[featured]}
                alt={t(`posts.${featured}.title`)}
                fill
                sizes="(min-width: 768px) 42vw, 100vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <span className="absolute left-4 top-4 rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-navy">
                {t('latest')}
              </span>
            </div>
            <div className="flex flex-1 flex-col p-7 md:p-9">
              <div className="flex items-center gap-2 text-xs text-navy/60">
                <Calendar className="h-3.5 w-3.5" />
                <span>{t(`posts.${featured}.date`)}</span>
              </div>
              <h2 className="mt-3 text-balance text-2xl font-bold text-navy sm:text-3xl">
                {t(`posts.${featured}.title`)}
              </h2>
              <p className="mt-3 flex-1 text-navy/70">{t(`posts.${featured}.excerpt`)}</p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-forest">
                {t('readMore')}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </article>

          {/* Rest */}
          {rest.map((id) => (
            <article
              key={id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-navy/5">
                <Image
                  src={POST_IMAGE[id]}
                  alt={t(`posts.${id}.title`)}
                  fill
                  sizes="(min-width: 768px) 42vw, 100vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-center gap-2 text-xs text-navy/60">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{t(`posts.${id}.date`)}</span>
                </div>
                <h2 className="mt-2 text-lg font-semibold text-navy">{t(`posts.${id}.title`)}</h2>
                <p className="mt-2 flex-1 text-sm text-navy/70">{t(`posts.${id}.excerpt`)}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-forest">
                  {t('readMore')}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
