'use client';

import * as React from 'react';
import { useAction, useQuery } from 'convex/react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { api } from '../../convex/_generated/api';
import type { Locale } from '@/i18n/routing';

export type MembershipStatusLabels = {
  title: string;
  intro: string;
  statusActiveTitle: string;
  statusActiveBody: string;
  statusPastDueTitle: string;
  statusPastDueBody: string;
  statusCancelledTitle: string;
  statusCancelledBody: string;
  statusNoneTitle: string;
  statusNoneBody: string;
  statusIncompleteTitle: string;
  statusIncompleteBody: string;
  startBtn: string;
  manageBtn: string;
  resubscribeBtn: string;
  planMonthly: string;
  planAnnual: string;
  renewsOn: string;
  errorTitle: string;
};

export function MembershipStatusCard({
  locale,
  labels: l,
}: {
  locale: Locale;
  labels: MembershipStatusLabels;
}) {
  const membership = useQuery(api.membership.myMembership) as
    | {
        hasContractor: true;
        status: string;
        plan: string | null;
        currentPeriodEnd: number | null;
      }
    | null
    | undefined;
  const getPortalLink = useAction(api.membership.getCustomerPortalLink);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (membership === undefined) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-navy/10 bg-white py-8 text-navy/60">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (membership === null) return null; // No contractor record yet.

  const status = membership.status as
    | 'none'
    | 'active'
    | 'past_due'
    | 'cancelled'
    | 'incomplete';
  const renewsOn =
    membership.currentPeriodEnd && status === 'active'
      ? new Date(membership.currentPeriodEnd).toLocaleDateString(
          locale === 'fr' ? 'fr-CA' : 'en-CA',
          { year: 'numeric', month: 'short', day: 'numeric' },
        )
      : null;

  async function onManage() {
    setError(null);
    setBusy(true);
    try {
      const { url } = await getPortalLink({ locale });
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const planLabel =
    membership.plan === 'monthly'
      ? l.planMonthly
      : membership.plan === 'annual'
        ? l.planAnnual
        : '';

  let icon: React.ReactNode;
  let title: string;
  let body: string;
  let toneCls: string;

  if (status === 'active') {
    icon = <CheckCircle2 className="h-5 w-5 text-forest" />;
    title = l.statusActiveTitle;
    body = l.statusActiveBody;
    toneCls = 'border-forest/30 bg-forest/5';
  } else if (status === 'past_due') {
    icon = <AlertTriangle className="h-5 w-5 text-red-600" />;
    title = l.statusPastDueTitle;
    body = l.statusPastDueBody;
    toneCls = 'border-red-300 bg-red-50';
  } else if (status === 'cancelled') {
    icon = <CircleDashed className="h-5 w-5 text-navy/50" />;
    title = l.statusCancelledTitle;
    body = l.statusCancelledBody;
    toneCls = 'border-navy/15 bg-navy/5';
  } else if (status === 'incomplete') {
    icon = <CircleDashed className="h-5 w-5 text-amber-600" />;
    title = l.statusIncompleteTitle;
    body = l.statusIncompleteBody;
    toneCls = 'border-amber-300 bg-amber-50';
  } else {
    icon = <Sparkles className="h-5 w-5 text-forest" />;
    title = l.statusNoneTitle;
    body = l.statusNoneBody;
    toneCls = 'border-navy/15 bg-navy/5';
  }

  return (
    <article className="space-y-4 rounded-2xl border border-navy/10 bg-white p-6">
      <header>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-navy">
          <Sparkles className="h-5 w-5 text-forest" />
          {l.title}
        </h2>
        <p className="mt-1 text-sm text-navy/60">{l.intro}</p>
      </header>

      <div className={`flex flex-wrap items-start justify-between gap-4 rounded-xl border p-4 ${toneCls}`}>
        <div className="flex items-start gap-3">
          <span className="mt-0.5">{icon}</span>
          <div>
            <p className="font-semibold text-navy">{title}</p>
            <p className="mt-0.5 text-sm text-navy/70">{body}</p>
            {status === 'active' && planLabel && (
              <p className="mt-2 text-xs text-navy/60">
                {planLabel}
                {renewsOn && (
                  <>
                    {' · '}
                    {l.renewsOn} <span className="font-medium text-navy">{renewsOn}</span>
                  </>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(status === 'none' || status === 'cancelled') && (
            <Button asChild variant="secondary" size="sm">
              <Link href="/pros/onboard/membership">
                <Sparkles className="h-4 w-4" />
                {status === 'cancelled' ? l.resubscribeBtn : l.startBtn}
              </Link>
            </Button>
          )}
          {(status === 'active' || status === 'past_due') && (
            <Button variant="outline" size="sm" onClick={onManage} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              {l.manageBtn}
            </Button>
          )}
          {status === 'incomplete' && (
            <Button asChild variant="secondary" size="sm">
              <Link href="/pros/onboard/membership">{l.startBtn}</Link>
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">{l.errorTitle}</p>
            <p className="mt-0.5 text-red-700/80">{error}</p>
          </div>
        </div>
      )}
    </article>
  );
}
