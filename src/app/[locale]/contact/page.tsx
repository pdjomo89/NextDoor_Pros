import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Mail, Clock, Building2, Phone } from 'lucide-react';
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

      {/* Form + info */}
      <section className="container py-16 md:py-20">
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-5">
          <div className="md:col-span-3">
            <ContactForm locale={locale as Locale} />
          </div>
          <aside className="space-y-4 md:col-span-2">
            <div className="flex items-start gap-4 rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-forest/10 text-forest">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-navy/50">
                  {t('info.phoneLabel')}
                </div>
                <ul className="mt-1 space-y-0.5">
                  {SUPPORT_PHONES.map((p) => (
                    <li key={p.href}>
                      <a href={p.href} className="font-medium text-navy hover:text-forest">
                        {p.display}
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-sm text-navy/60">{t('info.phoneHelp')}</p>
              </div>
            </div>
            <InfoRow icon={Mail} label={t('info.emailLabel')} value={t('info.emailValue')} />
            <InfoRow icon={Clock} label={t('info.hoursLabel')} value={t('info.hoursValue')} />
            <InfoRow icon={Building2} label={t('info.hqLabel')} value={t('info.hqValue')} />
          </aside>
        </div>
      </section>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-forest/10 text-forest">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-navy/50">{label}</div>
        <p className="mt-0.5 text-navy">{value}</p>
      </div>
    </div>
  );
}
