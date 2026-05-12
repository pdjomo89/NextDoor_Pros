import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Handshake, ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { pageMetadata } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1600&q=70';

const PARTNERS = ['Ticketflow', 'AfriNovaTech', 'Carys Care and Beauty'];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Partners' });
  return pageMetadata({
    locale: locale as Locale,
    path: '/partners',
    title: locale === 'fr' ? 'Partenaires' : 'Partners',
    description: t('lead'),
  });
}

export default async function PartnersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Partners');

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
        <div className="container py-20 text-center md:py-28">
          <span className="inline-block rounded-full bg-forest/30 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-forest-100 ring-1 ring-inset ring-forest/40">
            {t('eyebrow')}
          </span>
          <h1 className="mx-auto mt-4 max-w-3xl text-balance text-4xl font-bold tracking-tight drop-shadow-sm sm:text-5xl lg:text-6xl">
            {t('title')}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-lg text-white/85">{t('lead')}</p>
        </div>
      </section>

      {/* Partner list */}
      <section className="container py-16 md:py-20">
        <p className="mx-auto max-w-2xl text-center text-lg text-navy/70">{t('intro')}</p>
        <ul className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-3">
          {PARTNERS.map((name) => (
            <li
              key={name}
              className="flex flex-col items-center gap-4 rounded-2xl border border-navy/10 bg-white p-8 text-center shadow-sm transition-transform hover:-translate-y-0.5"
            >
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-forest/10 text-forest">
                <Handshake className="h-6 w-6" aria-hidden />
              </div>
              <span className="text-lg font-semibold text-navy">{name}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* CTA */}
      <section className="container py-16 md:py-20">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy to-navy-600 px-6 py-12 text-center text-white sm:px-10 sm:py-14">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-forest/20 blur-3xl" />
          <h2 className="relative text-balance text-2xl font-bold sm:text-3xl">{t('ctaTitle')}</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-white/80">{t('ctaBody')}</p>
          <div className="relative mt-7 flex justify-center">
            <Button asChild variant="secondary" size="lg">
              <Link href="/contact">
                {t('ctaButton')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
