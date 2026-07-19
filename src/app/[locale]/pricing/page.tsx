import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Check, ArrowRight, Sparkles, Gift } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { pageMetadata } from '@/lib/seo';
import { currencyMinorUnits } from '@/lib/currency';
import type { Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

// Membership plans. Amounts are integer minor units of `CURRENCY` (CAD → cents).
const CURRENCY = 'CAD';
const PLANS = [
  { key: 'monthly', amount: 1500, periodKey: 'perMonth' as const, featured: false },
  { key: 'annual', amount: 16000, periodKey: 'perYear' as const, featured: true },
] as const;

// Annual vs 12× monthly, and the per-month equivalent of the annual plan.
const ANNUAL_SAVINGS = 1500 * 12 - 16000; // 2000 minor = CA$20.00
const ANNUAL_PER_MONTH = Math.round(16000 / 12); // 1333 minor ≈ CA$13.33

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Pricing' });
  return pageMetadata({
    locale: locale as Locale,
    path: '/pricing',
    title: t('title'),
    description: t('subtitle'),
  });
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Pricing');
  const l = locale as Locale;

  const features = t.raw('features') as string[];

  // Bare, locale-formatted amounts (no currency symbol) — the currency is
  // stated in the footnote. e.g. 1500 → "15.00" (en) / "15,00" (fr).
  const decimals = currencyMinorUnits(CURRENCY);
  const amount = (minor: number) =>
    new Intl.NumberFormat(l, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(minor / 10 ** decimals);

  return (
    <div className="flex flex-col">
      {/* Hero — vivid gradient with soft color blobs */}
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-navy via-navy-600 to-forest-700 text-white">
        <div className="pointer-events-none absolute -left-24 -top-28 h-80 w-80 rounded-full bg-forest/40 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 top-6 h-72 w-72 rounded-full bg-amber-400/25 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="container relative py-16 text-center md:py-24">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-forest-100 ring-1 ring-inset ring-white/25 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            {t('eyebrow')}
          </span>
          <h1 className="mx-auto mt-4 max-w-2xl text-balance bg-gradient-to-r from-white via-forest-50 to-amber-100 bg-clip-text text-4xl font-bold tracking-tight text-transparent drop-shadow-sm sm:text-5xl">
            {t('title')}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-balance text-lg text-white/85">
            {t('subtitle')}
          </p>
        </div>
      </section>

      {/* Plans — pulled up over the hero for depth */}
      <section className="container relative z-10 -mt-12 pb-8">
        {/* Free-trial banner */}
        <div className="mx-auto mb-8 flex max-w-2xl items-center justify-center gap-2 rounded-full border border-forest/20 bg-gradient-to-r from-forest-50 via-white to-sky-50 px-5 py-2.5 text-center text-sm font-medium text-navy shadow-sm">
          <Gift className="h-4 w-4 shrink-0 text-forest-600" />
          {t('freeBanner')}
        </div>

        <div className="mx-auto grid max-w-4xl items-stretch gap-6 md:grid-cols-2">
          {PLANS.map((plan) => {
            const price = amount(plan.amount);
            return (
              <div
                key={plan.key}
                className={cn(
                  'relative flex flex-col overflow-hidden rounded-3xl p-8 shadow-xl transition-transform',
                  plan.featured
                    ? 'bg-gradient-to-br from-blue-500 via-navy-500 to-navy-700 text-white ring-2 ring-sky-300/50 md:-translate-y-2'
                    : 'border border-navy/10 bg-white text-navy',
                )}
              >
                {/* Top accent bar (non-featured) / glow blob (featured) */}
                {plan.featured ? (
                  <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-sky-300/30 blur-2xl" />
                ) : (
                  <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-navy-300 via-forest to-forest-400" />
                )}

                {plan.featured && (
                  <span className="absolute right-6 top-6 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-navy shadow-md">
                    <Sparkles className="h-3.5 w-3.5" />
                    {t('bestValue')}
                  </span>
                )}

                <h2
                  className={cn(
                    'text-lg font-bold',
                    plan.featured ? 'text-white' : 'text-navy',
                  )}
                >
                  {t(`${plan.key}.name`)}
                </h2>
                <p
                  className={cn(
                    'mt-1 text-sm',
                    plan.featured ? 'text-sky-100/90' : 'text-navy/60',
                  )}
                >
                  {t(`${plan.key}.tagline`)}
                </p>

                <div className="mt-6 flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      'text-5xl font-extrabold tracking-tight',
                      plan.featured
                        ? 'text-white drop-shadow-sm'
                        : 'bg-gradient-to-br from-navy to-forest bg-clip-text text-transparent',
                    )}
                  >
                    {price}
                  </span>
                  <span
                    className={cn(
                      'text-sm font-medium',
                      plan.featured ? 'text-sky-100' : 'text-navy/50',
                    )}
                  >
                    {t(plan.periodKey)}
                  </span>
                </div>

                <div className="mt-3">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
                      plan.featured
                        ? 'bg-white/15 text-white ring-white/30'
                        : 'bg-forest/10 text-forest-700 ring-forest/20',
                    )}
                  >
                    <Gift className="h-3.5 w-3.5" />
                    {t('freeTrial')}
                  </span>
                </div>

                {plan.featured ? (
                  <p className="mt-2 text-sm font-semibold text-amber-200">
                    {t('annual.savings', {
                      perMonth: amount(ANNUAL_PER_MONTH),
                      save: amount(ANNUAL_SAVINGS),
                    })}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-navy/50">{t('monthly.note')}</p>
                )}

                <Link
                  href="/auth/sign-up"
                  className={cn(
                    'mt-8 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-5 py-3 text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
                    plan.featured
                      ? 'bg-white text-navy hover:bg-sky-50'
                      : 'bg-gradient-to-r from-forest to-forest-600 text-white hover:from-forest-500 hover:to-forest-700',
                  )}
                >
                  {t('ctaTrial')}
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <p
                  className={cn(
                    'mt-3 text-center text-xs',
                    plan.featured ? 'text-sky-100/80' : 'text-navy/45',
                  )}
                >
                  {t('trialNote')}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Shared benefits — soft two-tone tint with colored checks */}
      <section className="container pb-20 pt-6">
        <div className="mx-auto max-w-2xl rounded-3xl border border-forest/15 bg-gradient-to-br from-forest-50 via-white to-navy-50 p-8 shadow-sm">
          <h3 className="text-center text-sm font-bold uppercase tracking-wide text-forest-700">
            {t('featuresTitle')}
          </h3>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {features.map((feature, i) => (
              <li key={i} className="flex items-start gap-2.5 text-navy/80">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-forest/15 ring-1 ring-inset ring-forest/25">
                  <Check className="h-3 w-3 text-forest-600" />
                </span>
                <span className="text-sm">{feature}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-center text-xs text-navy/50">{t('note')}</p>
        </div>
      </section>
    </div>
  );
}
