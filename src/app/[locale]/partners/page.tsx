import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  Briefcase,
  ExternalLink,
  Handshake,
  Megaphone,
  Sparkles,
  Users,
} from 'lucide-react';
import { PartnerInquiryForm } from '@/components/partner-inquiry-form';
import { pageMetadata } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1400&q=70';

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

const BENEFITS = [
  { key: 'reach', Icon: Users, tone: 'forest' },
  { key: 'network', Icon: Handshake, tone: 'navy' },
  { key: 'featured', Icon: Sparkles, tone: 'forest' },
  { key: 'comarketing', Icon: Megaphone, tone: 'navy' },
] as const;

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
  const tBenefits = await getTranslations('Partners.benefits');
  const tForm = await getTranslations('Partners.form');

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
            <p className="mt-5 max-w-2xl text-balance text-lg text-white/90">
              {t('lead')}
            </p>
          </div>
        </div>
      </section>

      {/* Why partner with us — benefit tiles */}
      <section className="container py-16 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-forest/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-forest">
            {t('whyTitle')}
          </span>
          <p className="mx-auto mt-3 text-balance text-lg text-navy/70">
            {t('whyLead')}
          </p>
        </div>
        <ul className="mx-auto mt-12 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map(({ key, Icon, tone }) => (
            <li
              key={key}
              className={
                'rounded-2xl p-6 text-white shadow-md ring-1 transition-transform hover:-translate-y-0.5 ' +
                (tone === 'forest'
                  ? 'bg-gradient-to-br from-forest to-forest/80 ring-forest/40'
                  : 'bg-gradient-to-br from-navy to-navy-600 ring-navy/40')
              }
            >
              <div
                className={
                  'inline-flex h-11 w-11 items-center justify-center rounded-xl ' +
                  (tone === 'forest' ? 'bg-white/20' : 'bg-forest/30')
                }
              >
                <Icon className="h-5 w-5 text-white" aria-hidden />
              </div>
              <h3 className="mt-4 text-base font-semibold text-white">
                {tBenefits(`${key}Title`)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/85">
                {tBenefits(`${key}Body`)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Featured partners — richer cards */}
      <section className="border-y border-navy/10 bg-navy/[0.02]">
        <div className="container py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-block rounded-full bg-forest/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-forest">
              {t('featuredTitle')}
            </span>
            <p className="mx-auto mt-3 text-balance text-lg text-navy/70">
              {t('featuredLead')}
            </p>
          </div>
          <ul className="mx-auto mt-12 grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PARTNERS.map((p) => {
              const tagline = t(`entries.${p.slug}.tagline`);
              const story = t(`entries.${p.slug}.story`);

              const cardClass =
                'group flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-navy/10 transition-all hover:-translate-y-1 hover:shadow-xl hover:ring-forest/25';

              const inner = (
                <>
                  {/* Logo showcase — matte wrapper with an inner framed logo block */}
                  <div className="bg-white p-5">
                    <div className="relative flex aspect-[4/3] w-full items-center justify-center rounded-xl bg-navy/[0.03] p-6 ring-1 ring-inset ring-navy/[0.06]">
                      {p.logo ? (
                        <div className="relative h-full w-full">
                          <Image
                            src={p.logo}
                            alt={`${p.name} logo`}
                            fill
                            sizes="(min-width: 1024px) 320px, (min-width: 640px) 40vw, 80vw"
                            className="object-contain"
                          />
                        </div>
                      ) : (
                        <Briefcase className="h-14 w-14 text-navy/20" aria-hidden />
                      )}
                    </div>
                  </div>
                  {/* Content zone — restrained, editorial */}
                  <div className="flex flex-1 flex-col px-6 pb-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-forest">
                      {tagline}
                    </p>
                    <h3 className="mt-1.5 text-xl font-bold text-navy">{p.name}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-navy/70">{story}</p>
                    {p.url && (
                      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-forest transition-all group-hover:gap-2.5">
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
        </div>
      </section>

      {/* Become a partner — inline form */}
      <section className="container py-16 md:py-24">
        <div className="mx-auto max-w-2xl">
          <div className="text-center">
            <span className="inline-block rounded-full bg-forest/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-forest">
              {tForm('title')}
            </span>
            <p className="mx-auto mt-3 text-balance text-lg text-navy/70">
              {tForm('intro')}
            </p>
          </div>
          <div className="mt-8">
            <PartnerInquiryForm locale={locale} />
          </div>
        </div>
      </section>
    </div>
  );
}
