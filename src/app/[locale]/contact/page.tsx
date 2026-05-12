import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Mail, Clock, Building2, Phone, ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { ContactForm } from '@/components/contact-form';
import { pageMetadata } from '@/lib/seo';
import { SUPPORT_PHONES } from '@/lib/contact';
import type { Locale } from '@/i18n/routing';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1600&q=70';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Contact' });
  return pageMetadata({
    locale: locale as Locale,
    path: '/contact',
    title: t('title'),
    description: t('subtitle'),
  });
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Contact');
  const emailValue = t('info.emailValue');

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

      {/* Form + contact methods */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white to-navy/5 py-16 md:py-24">
        <div className="pointer-events-none absolute -left-28 top-10 h-72 w-72 rounded-full bg-forest/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-28 bottom-0 h-80 w-80 rounded-full bg-navy/10 blur-3xl" />
        <div className="container relative">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-5 lg:items-start">
            {/* Contact methods */}
            <div className="lg:col-span-2 lg:sticky lg:top-24">
              <h2 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">
                {t('reachTitle')}
              </h2>
              <p className="mt-3 text-navy/70">{t('reachBody')}</p>

              <div className="mt-7 space-y-4">
                {/* Customer service — featured */}
                <div className="group relative overflow-hidden rounded-2xl border border-forest/20 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <div className="absolute inset-y-0 left-0 w-1.5 bg-forest" />
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-forest text-white">
                      <Phone className="h-5 w-5" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-navy/50">
                      {t('info.phoneLabel')}
                    </span>
                  </div>
                  <ul className="mt-4 space-y-1.5">
                    {SUPPORT_PHONES.map((p) => (
                      <li key={p.href}>
                        <a
                          href={p.href}
                          className="text-lg font-semibold text-navy transition-colors hover:text-forest"
                        >
                          {p.display}
                        </a>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm text-navy/60">{t('info.phoneHelp')}</p>
                </div>

                <InfoRow
                  icon={Mail}
                  label={t('info.emailLabel')}
                  value={emailValue}
                  href={`mailto:${emailValue}`}
                />
                <InfoRow icon={Clock} label={t('info.hoursLabel')} value={t('info.hoursValue')} />
                <InfoRow icon={Building2} label={t('info.hqLabel')} value={t('info.hqValue')} />
              </div>
            </div>

            {/* Form */}
            <div className="lg:col-span-3">
              <ContactForm locale={locale as Locale} />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-16 md:py-20">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy to-navy-600 px-6 py-12 text-center text-white sm:px-10 sm:py-14">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-forest/20 blur-3xl" />
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

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-navy/10 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-forest/10 text-forest">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-navy/50">{label}</div>
        {href ? (
          <a href={href} className="mt-0.5 block break-words text-navy transition-colors hover:text-forest">
            {value}
          </a>
        ) : (
          <p className="mt-0.5 break-words text-navy">{value}</p>
        )}
      </div>
    </div>
  );
}
