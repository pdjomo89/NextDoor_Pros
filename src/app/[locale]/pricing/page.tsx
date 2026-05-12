import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Check, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { pageMetadata } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

type Plan = {
  id: 'monthly' | 'annual';
  price: string;
  cadenceKey: 'cadenceMonthly' | 'cadenceAnnual';
  featured: boolean;
  features: string[];
};

const PLANS: Plan[] = [
  {
    id: 'monthly',
    price: '$15',
    cadenceKey: 'cadenceMonthly',
    featured: false,
    features: ['listing', 'contacts', 'jobs', 'cancel'],
  },
  {
    id: 'annual',
    price: '$160',
    cadenceKey: 'cadenceAnnual',
    featured: true,
    features: ['everything', 'featured', 'badge', 'support', 'savings'],
  },
];

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1556745757-8d76bdb6984b?auto=format&fit=crop&w=1600&q=70';

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
    title: locale === 'fr' ? 'Tarifs — abonnement pro' : 'Pricing — Pro membership',
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

  return (
    <div className="container py-16">
      {/* Hero */}
      <section className="relative isolate overflow-hidden rounded-3xl text-white shadow-lg shadow-navy/20">
        <Image
          src={HERO_IMAGE}
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-navy via-navy/95 to-navy/70" />
        <div className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-center sm:pb-28 sm:pt-20">
          <span className="inline-block rounded-full bg-forest/30 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-forest-100 ring-1 ring-inset ring-forest/40">
            {t('eyebrow')}
          </span>
          <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight drop-shadow-sm sm:text-5xl">
            {t('title')}
          </h1>
          <p className="mt-3 text-balance text-white/80">{t('subtitle')}</p>
        </div>
      </section>

      {/* Plans */}
      <div className="mx-auto -mt-10 grid max-w-4xl gap-6 px-2 md:grid-cols-2">
        {PLANS.map((plan) => (
          <article
            key={plan.id}
            className={cn(
              'relative flex flex-col rounded-2xl p-8 transition-transform',
              plan.featured
                ? 'bg-gradient-to-b from-navy to-navy-600 text-white shadow-xl shadow-navy/30 ring-1 ring-forest/40 md:-mt-4 md:mb-4'
                : 'border border-navy/10 bg-white shadow-sm hover:-translate-y-0.5 hover:shadow-md',
            )}
          >
            {plan.featured && (
              <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-forest px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow">
                <Sparkles className="h-3 w-3" />
                {t('bestValue')}
              </span>
            )}

            <h2 className={cn('text-xl font-bold', plan.featured ? 'text-white' : 'text-navy')}>
              {t(`plans.${plan.id}.name`)}
            </h2>
            <p className={cn('mt-1 text-sm', plan.featured ? 'text-white/70' : 'text-navy/70')}>
              {t(`plans.${plan.id}.tagline`)}
            </p>

            <div className="mt-6 flex items-baseline gap-1.5">
              <span
                className={cn(
                  'text-5xl font-extrabold tracking-tight',
                  plan.featured ? 'text-white' : 'text-navy',
                )}
              >
                {plan.price}
              </span>
              <span className={cn('text-sm', plan.featured ? 'text-white/70' : 'text-navy/60')}>
                {t(plan.cadenceKey)}
              </span>
            </div>
            {plan.id === 'annual' && (
              <p className="mt-1.5 text-xs font-medium text-forest-200">{t('annualEquivalent')}</p>
            )}

            <div
              className={cn(
                'my-6 h-px w-full',
                plan.featured ? 'bg-white/15' : 'bg-navy/10',
              )}
            />

            <ul className="space-y-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <span
                    className={cn(
                      'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full',
                      plan.featured ? 'bg-forest/30 text-forest-100' : 'bg-forest/10 text-forest',
                    )}
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <span className={cn(plan.featured ? 'text-white/90' : 'text-navy/80')}>
                    {t(`plans.${plan.id}.features.${f}`)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-8 pt-2">
              <Button
                asChild
                variant={plan.featured ? 'secondary' : 'primary'}
                size="lg"
                className="w-full"
              >
                <Link href="/auth/sign-up">{t(`plans.${plan.id}.cta`)}</Link>
              </Button>
            </div>
          </article>
        ))}
      </div>

      <p className="mx-auto mt-10 max-w-xl text-center text-xs text-navy/50">{t('disclaimer')}</p>
    </div>
  );
}
