import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft, Calendar } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { pageMetadata } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';
import { POSTS, POST_IMAGE, POST_SLUG, SLUG_TO_POST } from '../posts';

export function generateStaticParams() {
  return POSTS.map((id) => ({ slug: POST_SLUG[id] }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = SLUG_TO_POST[slug];
  if (!post) return {};
  const t = await getTranslations({ locale, namespace: 'News' });
  return pageMetadata({
    locale: locale as Locale,
    path: `/news/${slug}`,
    title: t(`posts.${post}.title`),
    description: t(`posts.${post}.excerpt`),
  });
}

export default async function NewsPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const post = SLUG_TO_POST[slug];
  if (!post) notFound();

  const t = await getTranslations('News');
  const body = t.raw(`posts.${post}.body`) as string[];

  return (
    <article className="flex flex-col">
      {/* Hero */}
      <header className="relative isolate overflow-hidden text-white">
        <Image
          src={POST_IMAGE[post]}
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-navy/95 via-navy/85 to-navy/70" />
        <div className="container py-20 md:py-24">
          <Link
            href="/news"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white/85 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('backToNews')}
          </Link>
          <div className="mt-6 flex items-center gap-2 text-sm text-white/80">
            <Calendar className="h-4 w-4" />
            <span>{t(`posts.${post}.date`)}</span>
          </div>
          <h1 className="mt-3 max-w-3xl text-balance text-4xl font-bold tracking-tight drop-shadow-sm sm:text-5xl">
            {t(`posts.${post}.title`)}
          </h1>
          <p className="mt-4 max-w-2xl text-balance text-lg text-white/85">
            {t(`posts.${post}.excerpt`)}
          </p>
        </div>
      </header>

      {/* Body */}
      <section className="container py-14 md:py-20">
        <div className="mx-auto max-w-2xl space-y-5 text-lg leading-relaxed text-navy/80">
          {body.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>

        <div className="mx-auto mt-12 max-w-2xl border-t border-navy/10 pt-8">
          <Link
            href="/news"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-forest hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('backToNews')}
          </Link>
        </div>
      </section>
    </article>
  );
}
