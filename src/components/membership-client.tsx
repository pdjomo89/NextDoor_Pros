'use client';

import * as React from 'react';
import { useAction, useQuery } from 'convex/react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Info, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { getConvexEnv } from '@/lib/convex-env';
import { formatMoney } from '@/lib/currency';
import {
  DEFAULT_COUNTRY,
  getMarket,
  membershipTrialDays,
  type Market,
} from '@/lib/markets';
import { api } from '../../convex/_generated/api';

type Role = 'poster' | 'pro';

/**
 * Membership hub (subscription markets, e.g. Canada). Reads `?country=` (so the
 * Canada flow can be previewed while CM is the live market) and `?status=` from
 * the post-checkout redirect. Pay-as-you-go markets get a "not needed" notice.
 */
export function MembershipClient() {
  const t = useTranslations('Membership');
  const params = useSearchParams();
  const configured = getConvexEnv().configured;

  const country = (params.get('country') ?? DEFAULT_COUNTRY).toUpperCase();
  const market = getMarket(country);
  const status = params.get('status');

  const viewer = useQuery(api.contractors.viewer, configured ? {} : 'skip') as
    | { _id: string }
    | null
    | undefined;

  if (market.monetization.model !== 'subscription') {
    return (
      <Notice
        icon={<Info className="h-5 w-5 text-forest" />}
        title={t('notAvailableTitle')}
        body={t('notAvailableBody')}
      />
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-navy">{t('title')}</h1>
        <p className="mt-1 text-navy/70">{t('subtitle')}</p>
      </header>

      {status === 'success' && (
        <Banner variant="success">{t('successBanner')}</Banner>
      )}
      {status === 'cancel' && <Banner variant="info">{t('cancelBanner')}</Banner>}

      {membershipTrialDays(country) > 0 && (
        <Banner variant="info">
          {t('trialBanner', {
            months: Math.round(membershipTrialDays(country) / 30),
          })}
        </Banner>
      )}

      {viewer === null ? (
        <Notice
          icon={<Info className="h-5 w-5 text-forest" />}
          title={t('signInTitle')}
          body={t('signInBody')}
          action={
            <Button asChild variant="primary" size="sm">
              <Link href="/auth/sign-in">{t('signInCta')}</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          <RoleCard role="poster" country={country} market={market} />
          <RoleCard role="pro" country={country} market={market} />
        </div>
      )}
    </div>
  );
}

function RoleCard({
  role,
  country,
  market,
}: {
  role: Role;
  country: string;
  market: Market;
}) {
  const t = useTranslations('Membership');
  const locale = useLocale();
  const membership = useQuery(api.memberships.myMembership, { role, country });
  const start = useAction(api.memberships.startMembership);
  const portal = useAction(api.memberships.openBillingPortal);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const plan =
    market.monetization.model === 'subscription'
      ? role === 'poster'
        ? market.monetization.poster
        : market.monetization.pro
      : null;

  const money = (minor: number) =>
    formatMoney(minor, market.currency, locale, market.country);

  async function subscribe(planKey: 'monthly' | 'yearly') {
    setError(null);
    setBusy(planKey);
    try {
      const { url } = await start({ role, plan: planKey, country, locale });
      window.location.href = url;
    } catch {
      setError(t('errGeneric'));
      setBusy(null);
    }
  }

  async function manage() {
    setError(null);
    setBusy('manage');
    try {
      const { url } = await portal({ role, locale });
      window.location.href = url;
    } catch {
      setError(t('errGeneric'));
      setBusy(null);
    }
  }

  const roleLabel = role === 'poster' ? t('roleEmployer') : t('rolePro');
  const roleDesc = role === 'poster' ? t('roleEmployerDesc') : t('roleProDesc');
  const quotaLabel =
    role === 'poster' ? t('quotaLabelPoster') : t('quotaLabelPro');
  const trialDays =
    market.monetization.model === 'subscription'
      ? market.monetization.trialDays
      : 0;
  const subscribeCta = trialDays > 0 ? t('startTrial') : t('subscribe');

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-navy/10 bg-white p-6">
      <div>
        <h2 className="font-semibold text-navy">{roleLabel}</h2>
        <p className="mt-0.5 text-sm text-navy/60">{roleDesc}</p>
      </div>

      {membership?.active ? (
        <div className="space-y-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-forest/10 px-2.5 py-1 text-xs font-medium text-forest">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t('statusActive')}
          </span>
          <p className="text-sm text-navy/70">
            {t('quotaUsage', {
              used: membership.used,
              quota: membership.quota,
              label: quotaLabel,
            })}
          </p>
          {membership.currentPeriodEnd && (
            <p className="text-xs text-navy/55">
              {membership.cancelAtPeriodEnd
                ? t('cancelsOn', {
                    date: new Date(
                      membership.currentPeriodEnd,
                    ).toLocaleDateString(locale),
                  })
                : t('renewsOn', {
                    date: new Date(
                      membership.currentPeriodEnd,
                    ).toLocaleDateString(locale),
                  })}
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={manage}
            disabled={busy === 'manage' || !membership.hasBilling}
          >
            {busy === 'manage' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {busy === 'manage' ? t('opening') : t('manageBilling')}
          </Button>
        </div>
      ) : (
        plan && (
          <div className="space-y-2">
            <PlanRow
              title={t('planMonthly')}
              price={t('perMonth', { price: money(plan.monthlyMinor) })}
              busy={busy === 'monthly'}
              onClick={() => subscribe('monthly')}
              cta={subscribeCta}
              busyLabel={t('subscribing')}
            />
            <PlanRow
              title={t('planYearly')}
              price={t('perYear', { price: money(plan.yearlyMinor) })}
              busy={busy === 'yearly'}
              onClick={() => subscribe('yearly')}
              cta={subscribeCta}
              busyLabel={t('subscribing')}
            />
          </div>
        )
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function PlanRow({
  title,
  price,
  busy,
  onClick,
  cta,
  busyLabel,
}: {
  title: string;
  price: string;
  busy: boolean;
  onClick: () => void;
  cta: string;
  busyLabel: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-navy/10 bg-navy/[0.02] px-4 py-3">
      <div>
        <p className="text-sm font-medium text-navy">{title}</p>
        <p className="text-sm text-navy/60">{price}</p>
      </div>
      <Button variant="secondary" size="sm" onClick={onClick} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {busy ? busyLabel : cta}
      </Button>
    </div>
  );
}

function Notice({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-navy/10 bg-navy/[0.03] p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div>
          <h2 className="font-semibold text-navy">{title}</h2>
          <p className="mt-1 text-sm text-navy/70">{body}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function Banner({
  variant,
  children,
}: {
  variant: 'success' | 'info';
  children: React.ReactNode;
}) {
  const styles =
    variant === 'success'
      ? 'border-forest/30 bg-forest/[0.06] text-forest'
      : 'border-navy/15 bg-navy/[0.04] text-navy/80';
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  );
}
