import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { AuthForm } from '@/components/auth-form';
import { AuthShell } from '@/components/auth-shell';
import type { Locale } from '@/i18n/routing';

export const metadata: Metadata = { title: 'Create account', robots: { index: false, follow: true } };

export default async function SignUpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Auth');

  return (
    <AuthShell
      brandHeadline={t('brandHeadline')}
      brandPoints={[t('brand1'), t('brand2'), t('brand3')]}
      title={t('signUp.title')}
      subtitle={t('signUp.subtitle')}
    >
      <AuthForm locale={locale as Locale} mode="sign-up" />
      <p className="mt-6 text-center text-sm text-navy/70">
        {t('signUp.haveAccount')}{' '}
        <Link href="/auth/sign-in" className="font-semibold text-forest hover:underline">
          {t('signUp.signInLink')}
        </Link>
      </p>
    </AuthShell>
  );
}
