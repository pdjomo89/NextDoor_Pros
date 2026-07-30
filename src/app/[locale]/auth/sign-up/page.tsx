import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { AuthForm } from '@/components/auth-form';
import { AuthShell } from '@/components/auth-shell';
import { MARKETS, type CountryCode } from '@/lib/markets';
import type { Locale } from '@/i18n/routing';

export const metadata: Metadata = { title: 'Create account', robots: { index: false, follow: true } };

/**
 * Which market this visitor is signing up into.
 *
 * A pro's country normally comes from the city they pick during onboarding —
 * but that happens *after* sign-up, so at this point the only signal available
 * is where the request came from. Vercel sets `x-vercel-ip-country` at the
 * edge; locally it is absent and we fall back to the default market.
 *
 * `?country=` wins over geo-IP so the other market's flow stays reachable for
 * testing, and so a visitor behind a VPN has a way to correct a bad guess.
 */
function resolveCountry(explicit: string | undefined): string | undefined {
  const known = (c: string | undefined | null) =>
    c && c.toUpperCase() in MARKETS ? (c.toUpperCase() as CountryCode) : undefined;
  return known(explicit) ?? known(headers().get('x-vercel-ip-country'));
}

export default async function SignUpPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ country?: string }>;
}) {
  const { locale } = await params;
  const { country: explicitCountry } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('Auth');
  const country = resolveCountry(explicitCountry);

  return (
    <AuthShell
      brandHeadline={t('brandHeadline')}
      brandPoints={[t('brand1'), t('brand2'), t('brand3')]}
      title={t('signUp.title')}
      subtitle={t('signUp.subtitle')}
    >
      <AuthForm locale={locale as Locale} mode="sign-up" country={country} />
      <p className="mt-6 text-center text-sm text-navy/70">
        {t('signUp.haveAccount')}{' '}
        <Link href="/auth/sign-in" className="font-semibold text-forest hover:underline">
          {t('signUp.signInLink')}
        </Link>
      </p>
    </AuthShell>
  );
}
