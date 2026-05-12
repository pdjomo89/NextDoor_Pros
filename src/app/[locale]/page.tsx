import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowRight, Handshake } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { ServiceCard } from '@/components/service-card';
import { CityBanner } from '@/components/city-banner';
import { FeaturedTitle } from '@/components/featured-title';
import { SERVICE_CATEGORIES } from '@/lib/services';
import type { Locale } from '@/i18n/routing';

const PARTNERS = ['Ticketflow', 'AfriNovaTech', 'Carys Care and Beauty'];

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Home');

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative isolate overflow-hidden text-white">
        <Image
          src="/hero-home-services.jpg"
          alt={t('hero.imageAlt')}
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy via-navy/90 to-navy/50" />
        <div className="container relative py-24 md:py-32">
          <div className="max-w-2xl space-y-6">
            <span className="inline-block rounded-full bg-forest/30 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-forest-100 ring-1 ring-inset ring-forest/40">
              {t('hero.eyebrow')}
            </span>
            <h1 className="text-balance text-4xl font-bold tracking-tight drop-shadow-sm sm:text-5xl lg:text-6xl">
              {t('hero.title')}
            </h1>
            <p className="text-balance text-lg text-white/85">
              {t('hero.subtitle')}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="secondary" size="lg">
                <Link href="/services">
                  {t('hero.ctaPrimary')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                <Link href="/contact">{t('hero.ctaSecondary')}</Link>
              </Button>
            </div>
            <dl className="flex flex-wrap gap-x-7 gap-y-2 pt-2 text-sm text-white/75">
              <Stat value="12,400+" label={t('stats.pros')} />
              <Stat value="65" label={t('stats.cities')} />
              <Stat value="380k+" label={t('stats.bookings')} />
              <Stat value="4.9 / 5" label={t('stats.rating')} />
            </dl>
          </div>
          <div className="mt-12 max-w-3xl rounded-2xl bg-white p-3 shadow-2xl shadow-navy/30">
            <CityBanner locale={locale as Locale} />
          </div>
        </div>
      </section>

      {/* Featured services */}
      <section className="container py-20">
        <div className="mx-auto max-w-2xl text-center">
          <FeaturedTitle />
          <p className="mt-3 text-navy/70">{t('featuredSubtitle')}</p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICE_CATEGORIES.map((c) => (
            <ServiceCard key={c.slug} category={c} />
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-navy/5 py-20">
        <div className="container">
          <h2 className="text-balance text-center text-3xl font-bold tracking-tight text-navy sm:text-4xl">
            {t('howItWorks.title')}
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {(['step1', 'step2', 'step3'] as const).map((step, i) => (
              <div
                key={step}
                className="rounded-xl border border-navy/10 bg-white p-6"
              >
                <div className="grid h-10 w-10 place-items-center rounded-full bg-forest text-white font-bold">
                  {i + 1}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-navy">
                  {t(`howItWorks.${step}Title`)}
                </h3>
                <p className="mt-2 text-sm text-navy/70">
                  {t(`howItWorks.${step}Body`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partners */}
      <section className="container py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-navy sm:text-4xl">
            {t('partners.title')}
          </h2>
          <p className="mt-3 text-navy/70">{t('partners.subtitle')}</p>
        </div>
        <ul className="mx-auto mt-12 grid max-w-4xl gap-5 sm:grid-cols-3">
          {PARTNERS.map((name) => (
            <li
              key={name}
              className="flex items-center justify-center gap-3 rounded-xl border border-navy/10 bg-white px-6 py-8 text-center"
            >
              <Handshake className="h-5 w-5 shrink-0 text-forest" aria-hidden />
              <span className="text-lg font-semibold text-navy">{name}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="font-bold text-white">{value}</dt>
      <dd>{label}</dd>
    </div>
  );
}
