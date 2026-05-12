'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuthActions } from '@convex-dev/auth/react';
import { LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getConvexEnv } from '@/lib/convex-env';
import type { Locale } from '@/i18n/routing';

type Props = {
  locale: Locale;
  mode: 'sign-in' | 'sign-up';
};

export function AuthForm({ locale, mode }: Props) {
  const t = useTranslations('Auth');
  const router = useRouter();
  const { signIn } = useAuthActions();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!getConvexEnv().configured) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Convex isn&apos;t configured yet. See <code>CONVEX_SETUP.md</code>.
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      formData.set('flow', mode === 'sign-in' ? 'signIn' : 'signUp');
      await signIn('password', formData);
      router.push(`/${locale}/pros/dashboard`);
      router.refresh();
    } catch (err) {
      setError(t('errInvalidCredentials'));
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-navy">
          {t('emailLabel')}
        </span>
        <input
          required
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          className="w-full rounded-md border border-navy/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-forest/20"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-navy">
          {t('passwordLabel')}
        </span>
        <input
          required
          name="password"
          type="password"
          autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
          minLength={8}
          placeholder={mode === 'sign-up' ? t('passwordHint') : undefined}
          className="w-full rounded-md border border-navy/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-forest/20"
        />
      </label>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="secondary"
        size="lg"
        disabled={submitting}
        className="w-full"
      >
        {mode === 'sign-in' ? (
          <LogIn className="h-4 w-4" />
        ) : (
          <UserPlus className="h-4 w-4" />
        )}
        {submitting
          ? t('submitting')
          : mode === 'sign-in'
            ? t('signInAction')
            : t('signUpAction')}
      </Button>
    </form>
  );
}
