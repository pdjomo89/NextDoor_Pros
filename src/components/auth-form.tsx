'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuthActions } from '@convex-dev/auth/react';
import { useAction, useConvexAuth } from 'convex/react';
import { Briefcase, HardHat, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCity } from '@/components/city-picker-context';
import { getConvexEnv } from '@/lib/convex-env';
import { formatMoney } from '@/lib/currency';
import {
  allMarkets,
  getMarket,
  type CountryCode,
  type MembershipRole,
} from '@/lib/markets';
import type { Locale } from '@/i18n/routing';
import { api } from '../../convex/_generated/api';

type Plan = 'monthly' | 'yearly';

type Props = {
  locale: Locale;
  mode: 'sign-in' | 'sign-up';
  /**
   * Market to preselect in the country field, resolved server-side from
   * `?country=` or geo-IP. Only a starting point — the user can change it.
   */
  country?: string;
};

export function AuthForm({ locale, mode, country: initialCountry }: Props) {
  const t = useTranslations('Auth');
  const tm = useTranslations('Membership');
  const router = useRouter();
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const startMembership = useAction(api.memberships.startMembership);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // The market lives in the app-wide city/country context — the same value the
  // header picker shows and onboarding reads — so the selector below stays in
  // agreement with the rest of the UI instead of being a second source of truth.
  const { country, setCountry, hasStoredCountry } = useCity();
  const market = getMarket(country);
  const monetization = market.monetization;
  // Membership only exists in subscription markets (Canada today). Pay-as-you-go
  // markets (Cameroon) keep the plain email + password form.
  const picksMembership =
    mode === 'sign-up' && monetization.model === 'subscription';

  // Geo-IP is only a fallback for someone who has never chosen a market; an
  // explicit pick (persisted by the context) always wins.
  const geoSeeded = React.useRef(false);
  React.useEffect(() => {
    if (geoSeeded.current || hasStoredCountry || !initialCountry) return;
    const geo = getMarket(initialCountry).country;
    if (geo !== country) {
      geoSeeded.current = true;
      setCountry(geo);
    }
  }, [hasStoredCountry, initialCountry, country, setCountry]);

  const [role, setRole] = React.useState<MembershipRole>('pro');
  const [plan, setPlan] = React.useState<Plan>('yearly');

  // Set once the account exists and we still owe the user a checkout redirect.
  // Handing off through state (rather than awaiting inline) lets us wait for the
  // Convex client to pick up the new identity before calling an authed action.
  const [pendingCheckout, setPendingCheckout] = React.useState<{
    role: MembershipRole;
    plan: Plan;
  } | null>(null);

  // Creating a Checkout session is not idempotent, so run the handoff at most
  // once even if the effect's dependencies churn.
  const checkoutStarted = React.useRef(false);

  React.useEffect(() => {
    if (!pendingCheckout || !isAuthenticated || checkoutStarted.current) return;
    checkoutStarted.current = true;
    let canceled = false;
    (async () => {
      const query = new URLSearchParams({
        country: market.country,
        role: pendingCheckout.role,
        plan: pendingCheckout.plan,
      });
      try {
        const { url } = await startMembership({
          role: pendingCheckout.role,
          plan: pendingCheckout.plan,
          country: market.country,
          locale,
        });
        if (canceled) return;
        window.location.href = url;
      } catch (err) {
        // The account was created, so there is nothing to retry here — send the
        // user to the membership hub with their choice preselected instead of
        // stranding them on a sign-up form they have already completed.
        console.error('Membership checkout error:', err);
        if (canceled) return;
        query.set('status', 'checkout_failed');
        router.push(`/${locale}/membership?${query.toString()}`);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [
    pendingCheckout,
    isAuthenticated,
    startMembership,
    market.country,
    locale,
    router,
  ]);

  if (!getConvexEnv().configured) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Convex isn&apos;t configured yet. See <code>CONVEX_SETUP.md</code>.
      </div>
    );
  }

  // Turn a thrown auth error into a message the user can act on. Convex masks
  // plain server errors as "Server Error" in production, so the specific
  // Password-provider strings below only match in dev — in production we fall
  // back to a context-aware message (different for sign-up vs sign-in).
  function describeError(err: unknown): string {
    const raw = err instanceof Error ? err.message : String(err);
    const m = raw.toLowerCase();

    // Reliable on the client regardless of environment.
    if (
      m.includes('failed to fetch') ||
      m.includes('networkerror') ||
      m.includes('network request') ||
      m.includes('websocket')
    ) {
      return t('errNetwork');
    }

    // Convex Auth Password-provider signals (visible in dev).
    if (m.includes('already exists')) return t('errEmailTaken');
    if (m.includes('invalid password')) return t('errWeakPassword');
    if (
      m.includes('invalid credentials') ||
      m.includes('invalidsecret') ||
      m.includes('invalidaccountid')
    ) {
      return t('errInvalidCredentials');
    }

    // Production fallback (the real reason is masked by Convex).
    return mode === 'sign-up' ? t('errSignUpFailed') : t('errInvalidCredentials');
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const password = String(formData.get('password') ?? '');

    // Catch the most common sign-up failure before hitting the server, where
    // the "Invalid password" reason would otherwise be masked in production.
    if (mode === 'sign-up' && password.length < 8) {
      setError(t('errWeakPassword'));
      return;
    }

    setSubmitting(true);
    try {
      formData.set('flow', mode === 'sign-in' ? 'signIn' : 'signUp');
      // The membership radios live in this form for layout, but they are
      // controlled React state — the auth provider should only see credentials.
      formData.delete('accountType');
      formData.delete('plan');
      formData.delete('country');
      await signIn('password', formData);
      if (picksMembership) {
        // Stay in the submitting state: the effect above takes over and sends
        // the browser to Stripe Checkout once the new session is live.
        setPendingCheckout({ role, plan });
        return;
      }
      router.push(`/${locale}/pros/dashboard`);
      router.refresh();
      setSubmitting(false);
    } catch (err) {
      console.error('Auth error:', err);
      setError(describeError(err));
      setSubmitting(false);
    }
  }

  const money = (minor: number) =>
    formatMoney(minor, market.currency, locale, market.country);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {mode === 'sign-up' && (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy">
            {t('countryLabel')}
          </span>
          <select
            name="country"
            value={country}
            onChange={(e) => setCountry(e.target.value as CountryCode)}
            className="w-full rounded-md border border-navy/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-forest/20"
          >
            {allMarkets().map((m) => (
              <option key={m.country} value={m.country}>
                {m.name[locale]}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-navy/55">
            {t('countryHint')}
          </span>
        </label>
      )}

      {picksMembership && monetization.model === 'subscription' && (
        <>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-navy">
              {t('accountTypeLabel')}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <ChoiceCard
                name="accountType"
                checked={role === 'poster'}
                onSelect={() => setRole('poster')}
                icon={<Briefcase className="h-4 w-4" />}
                title={tm('roleEmployer')}
                detail={tm('roleEmployerDesc')}
              />
              <ChoiceCard
                name="accountType"
                checked={role === 'pro'}
                onSelect={() => setRole('pro')}
                icon={<HardHat className="h-4 w-4" />}
                title={tm('rolePro')}
                detail={tm('roleProDesc')}
              />
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-navy">
              {t('planLabel')}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <ChoiceCard
                name="plan"
                checked={plan === 'monthly'}
                onSelect={() => setPlan('monthly')}
                title={tm('planMonthly')}
                detail={tm('perMonth', {
                  price: money(monetization[role].monthlyMinor),
                })}
              />
              <ChoiceCard
                name="plan"
                checked={plan === 'yearly'}
                onSelect={() => setPlan('yearly')}
                title={tm('planYearly')}
                detail={tm('perYear', {
                  price: money(monetization[role].yearlyMinor),
                })}
                badge={t('yearlySave', {
                  percent: yearlySavingsPercent(
                    monetization[role].monthlyMinor,
                    monetization[role].yearlyMinor,
                  ),
                })}
              />
            </div>
            {monetization.trialDays > 0 && (
              <p className="mt-1.5 text-xs text-navy/60">
                {tm('trialBanner', {
                  months: Math.round(monetization.trialDays / 30),
                })}
              </p>
            )}
          </fieldset>
        </>
      )}

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
        {pendingCheckout
          ? t('redirectingToCheckout')
          : submitting
            ? t('submitting')
            : mode === 'sign-in'
              ? t('signInAction')
              : t('signUpAction')}
      </Button>
    </form>
  );
}

/** Discount of the yearly plan against 12× the monthly price, as a percentage. */
function yearlySavingsPercent(monthlyMinor: number, yearlyMinor: number) {
  const full = monthlyMinor * 12;
  if (full <= 0 || yearlyMinor >= full) return 0;
  return Math.round(((full - yearlyMinor) / full) * 100);
}

/** A radio rendered as a selectable card — keyboard and screen-reader native. */
function ChoiceCard({
  name,
  checked,
  onSelect,
  icon,
  title,
  detail,
  badge,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  icon?: React.ReactNode;
  title: string;
  detail: string;
  badge?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition ${
        checked
          ? 'border-forest bg-forest/[0.06] ring-1 ring-forest/30'
          : 'border-navy/15 bg-white hover:border-navy/30'
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="mt-1 h-3.5 w-3.5 shrink-0 accent-forest"
      />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-medium text-navy">
          {icon}
          {title}
          {badge && (
            <span className="rounded-full bg-forest/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-forest">
              {badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs text-navy/60">{detail}</span>
      </span>
    </label>
  );
}
