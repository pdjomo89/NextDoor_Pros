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
  /** Tailwind gradient classes for the card's poster backdrop. */
  gradient: string;
};

const PARTNERS: Partner[] = [
  {
    slug: 'ticketflow',
    name: 'Ticketflow',
    logo: '/partners/ticketflow.png',
    url: 'https://www.ticketflow.boutique',
    gradient: 'from-violet-600 via-fuchsia-600 to-rose-500',
  },
  {
    slug: 'afrinovatech',
    name: 'AfriNovaTech',
    gradient: 'from-amber-500 via-orange-500 to-red-500',
  },
  {
    slug: 'carys',
    name: 'Carys Care and Beauty',
    logo: '/partners/carys-care-and-beauty.jpg',
    gradient: 'from-amber-400 via-yellow-500 to-orange-500',
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
        <ul className="mx-auto mt-14 grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {PARTNERS.map((p) => {
            const tagline = t(`entries.${p.slug}.tagline`);

            const cardClass =
              'group relative flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-md ring-1 ring-navy/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:ring-navy/10';

            const inner = (
              <>
                {/* Poster header: vivid gradient + frosted logo stage */}
                <div
                  className={`relative aspect-[5/4] overflow-hidden bg-gradient-to-br ${p.gradient}`}
                >
                  <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-white/25 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-black/20 blur-3xl" />
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.25),_transparent_55%)]" />

                  <div className="absolute inset-0 grid place-items-center p-5">
                    {p.logo ? (
                      <div className="grid aspect-square w-[88%] max-w-[280px] place-items-center overflow-hidden rounded-2xl bg-white/95 p-2 shadow-2xl ring-1 ring-white/50 backdrop-blur-sm transition-transform duration-500 group-hover:scale-105">
                        <Image
                          src={p.logo}
                          alt={`${p.name} logo`}
                          width={1254}
                          height={1254}
                          className="h-full w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="grid aspect-square w-[88%] max-w-[280px] place-items-center rounded-2xl bg-white/95 shadow-2xl ring-1 ring-white/50 backdrop-blur-sm transition-transform duration-500 group-hover:scale-105">
                        <Handshake className="h-28 w-28 text-forest" aria-hidden />
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom content */}
                <div className="flex flex-1 flex-col gap-2 p-6">
                  <h3 className="text-xl font-bold text-navy">{p.name}</h3>
                  <p className="text-sm leading-relaxed text-navy/70">{tagline}</p>
                  {p.url && (
                    <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-forest">
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
