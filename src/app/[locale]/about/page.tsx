import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MapPinned, ShieldCheck, Tag, ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { pageMetadata } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=70';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'About' });
  return pageMetadata({
    locale: locale as Locale,
    path: '/about',
    title: locale === 'fr' ? 'À propos' : 'About us',
    description: t('lead'),
  });
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('About');

  const values = [
    { icon: MapPinned, key: 'local' as const, tone: 'forest' as const },
    { icon: Tag, key: 'fair' as const, tone: 'navy' as const },
    { icon: ShieldCheck, key: 'trust' as const, tone: 'forest' as const },
  ];

  return (
    <div className="flex flex-col">
      {/* Hero — full-width background image with overlay text */}
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
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-navy/95 via-navy/85 to-navy-600/70" />
        <div className="absolute -left-32 -top-32 -z-10 h-80 w-80 rounded-full bg-forest/25 blur-3xl" />
        <div className="absolute -right-24 bottom-0 -z-10 h-72 w-72 rounded-full bg-forest/15 blur-3xl" />
        <div className="container py-24 md:py-32 lg:py-40">
          <div className="relative max-w-3xl">
            <div className="absolute -left-5 top-1 hidden h-full w-1 bg-forest md:block" />
            <span className="inline-block rounded-full bg-forest/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-forest-100 ring-1 ring-inset ring-forest/40">
              {t('eyebrow')}
            </span>
            <h1 className="mt-5 text-balance text-4xl font-bold leading-tight tracking-tight drop-shadow-sm sm:text-5xl lg:text-6xl">
              {t('title')}
            </h1>
            <p className="mt-5 max-w-2xl text-balance text-lg text-white/90">{t('lead')}</p>
          </div>
        </div>
      </section>

      {/* Mission — editorial pull-quote with forest accent */}
      <section className="container py-16 md:py-24">
        <div className="mx-auto max-w-4xl">
          <span className="inline-block rounded-full bg-forest/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-forest">
            {t('missionTitle')}
          </span>
          <div className="mt-6 border-l-4 border-forest pl-6 sm:pl-8">
            <p className="text-balance text-2xl font-medium leading-relaxed text-navy sm:text-3xl">
              {t('missionBody')}
            </p>
          </div>
        </div>
      </section>

      {/* Values — bold gradient tiles, alternating navy/forest */}
      <section className="border-y border-navy/10 bg-navy/[0.02]">
        <div className="container py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-block rounded-full bg-forest/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-forest">
              {t('valuesTitle')}
            </span>
          </div>
          <ul className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
            {values.map(({ icon: Icon, key, tone }) => (
              <li
                key={key}
                className={
                  'flex flex-col rounded-2xl p-7 text-white shadow-md ring-1 transition-transform hover:-translate-y-1 ' +
                  (tone === 'forest'
                    ? 'bg-gradient-to-br from-forest to-forest/80 ring-forest/40'
                    : 'bg-gradient-to-br from-navy to-navy-600 ring-navy/40')
                }
              >
                <div
                  className={
                    'inline-flex h-12 w-12 items-center justify-center rounded-xl ' +
                    (tone === 'forest' ? 'bg-white/20' : 'bg-forest/30')
                  }
                >
                  <Icon className="h-6 w-6 text-white" aria-hidden />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">{t(`values.${key}Title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/85">
                  {t(`values.${key}Body`)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-16 md:py-24">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy to-navy-600 px-6 py-12 text-center text-white sm:px-10 sm:py-16">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-forest/25 blur-3xl" />
          <div className="absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-forest/15 blur-3xl" />
          <h2 className="relative text-balance text-2xl font-bold sm:text-3xl">{t('ctaTitle')}</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-white/80">{t('ctaBody')}</p>
          <div className="relative mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild variant="secondary" size="lg">
              <Link href="/services">
                {t('ctaBrowse')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-white/30 bg-white/10 text-white hover:bg-white/20"
            >
              <Link href="/pros/onboard">{t('ctaPro')}</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
