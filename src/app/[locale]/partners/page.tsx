import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Handshake, ArrowRight, ExternalLink } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { pageMetadata } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1600&q=70';

type Partner = {
  slug: string;
  name: string;
  logo?: string;
  url?: string;
};

const PARTNERS: Partner[] = [
  {
    slug: 'ticketflow',
    name: 'Ticketflow',
    logo: '/partners/ticketflow.png',
    url: 'https://www.ticketflow.boutique',
  },
  {
    slug: 'afrinovatech',
    name: 'AfriNovaTech',
  },
  {
    slug: 'carys',
    name: 'Carys Care and Beauty',
    logo: '/partners/carys-care-and-beauty.jpg',
  },
];

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
        <ul className="mx-auto mt-14 grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PARTNERS.map((p) => {
            const tagline = t(`entries.${p.slug}.tagline`);

            const cardClass =
              'group flex h-full flex-col overflow-hidden rounded-2xl border border-navy/10 bg-white transition-colors duration-200 hover:border-navy/20';

            const inner = (
              <>
                <div className="relative aspect-[5/4] w-full">
                  {p.logo ? (
                    <Image
                      src={p.logo}
                      alt={`${p.name} logo`}
                      fill
                      sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
                      className="object-contain"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Handshake className="h-20 w-20 text-navy/30" aria-hidden />
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-6">
                  <h3 className="text-lg font-semibold text-navy">{p.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-navy/65">{tagline}</p>
                  {p.url && (
                    <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-forest">
                      {t('visitWebsite')}
                      <ExternalLink className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  )}
                </div>
              </>
            );
            return (
              <li key={p.slug}>
                {p.url ? (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cardClass}
                  >
                    {inner}
                  </a>
                ) : (
                  <div className={cardClass}>{inner}</div>
                )}
              </li>
            );
          })}
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
