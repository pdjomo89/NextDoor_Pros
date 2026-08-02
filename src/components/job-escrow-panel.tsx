'use client';

import * as React from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { Banknote, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { getConvexEnv } from '@/lib/convex-env';
import { currencyMinorUnits, formatMoney } from '@/lib/currency';
import { getMarket, monetizationModel } from '@/lib/markets';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

/**
 * Days before a done-marked escrow auto-releases. Mirrors
 * ESCROW_AUTO_RELEASE_DAYS in convex/jobEscrow.ts — that module can't be
 * imported here (it pulls in server-only code), so keep the two in sync.
 */
const AUTO_RELEASE_DAYS = 2;

/**
 * Escrow controls for a job, shown to the two participants (the pro who unlocked
 * the lead, and the employer/poster). Pro requests payment → employer pays →
 * platform holds → pro marks done → employer confirms (or auto-release) → payout
 * minus commission. Only rendered in subscription markets (Canada).
 */
export function JobEscrowPanel({
  jobId,
  posterId,
  country,
}: {
  jobId: string;
  posterId: string;
  country?: string;
}) {
  const t = useTranslations('JobPay');
  const locale = useLocale();
  const configured = getConvexEnv().configured;
  const isSubscription = monetizationModel(country) === 'subscription';
  const market = getMarket(country);

  const viewer = useQuery(api.contractors.viewer, configured ? {} : 'skip') as
    | { _id: string }
    | null
    | undefined;
  const signedIn = !!viewer;
  const active = configured && signedIn && isSubscription;

  const escrow = useQuery(
    api.jobEscrow.myJobEscrow,
    active ? { jobId: jobId as Id<'jobs'> } : 'skip',
  );
  const unlock = useQuery(
    api.leadUnlocks.isUnlocked,
    active ? { jobId: jobId as Id<'jobs'> } : 'skip',
  );
  const connect = useQuery(api.connect.myConnectStatus, active ? {} : 'skip');

  const requestPayment = useMutation(api.jobEscrow.requestJobPayment);
  const payEscrow = useAction(api.jobEscrow.payJobEscrow);
  const markDone = useMutation(api.jobEscrow.markJobDone);
  const confirmRelease = useAction(api.jobEscrow.confirmAndRelease);
  const refund = useAction(api.jobEscrow.refundJobEscrow);

  const [amount, setAmount] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!active) return null;

  const exponent = currencyMinorUnits(market.currency);
  const fmt = (minor: number) =>
    formatMoney(minor, market.currency, locale, market.country);

  const isEmployer = viewer._id === posterId;
  const isPro = !isEmployer && unlock?.unlocked === true;
  const role: 'employer' | 'pro' | null = escrow
    ? escrow.role
    : isEmployer
      ? 'employer'
      : isPro
        ? 'pro'
        : null;
  if (!role) return null; // not a participant

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  }

  async function onRequest() {
    const minor = Math.round(Number.parseFloat(amount.replace(',', '.')) * 10 ** exponent);
    if (!Number.isFinite(minor) || minor < 100) return setError(t('error'));
    await run(() => requestPayment({ jobId: jobId as Id<'jobs'>, amount: minor }));
  }

  const pct = escrow && escrow.amount > 0
    ? Math.round((escrow.commission / escrow.amount) * 100)
    : 0;

  return (
    <div className="mt-6 rounded-xl border border-forest/30 bg-forest/[0.04] p-5">
      <h2 className="flex items-center gap-2 font-semibold text-navy">
        <ShieldCheck className="h-5 w-5 text-forest" />
        {t('sectionTitle')}
      </h2>

      <div className="mt-3 space-y-3 text-sm text-navy/80">
        {/* No escrow yet */}
        {escrow === null && role === 'pro' && (
          connect?.payoutsEnabled ? (
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-navy/55">
                {t('amountLabel')} ({market.currency})
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min={100 / 10 ** exponent}
                  step={exponent > 0 ? '0.01' : '1'}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-40 rounded-lg border border-navy/15 px-3 py-2 text-sm outline-none focus:border-forest"
                  placeholder={exponent > 0 ? '150.00' : '25000'}
                />
                <Button variant="secondary" size="sm" onClick={onRequest} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
                  {t('requestCta')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p>{t('needPayouts')}</p>
              <Button asChild variant="secondary" size="sm">
                <Link href="/pros/dashboard">{t('setupPayouts')}</Link>
              </Button>
            </div>
          )
        )}

        {/* Requested */}
        {escrow?.status === 'requested' && role === 'pro' && (
          <p>{t('requestedPro', { amount: fmt(escrow.amount) })}</p>
        )}
        {escrow?.status === 'requested' && role === 'employer' && (
          <div className="space-y-2">
            <p className="font-medium text-navy">{t('payTitle')}</p>
            <p>{t('payDetail', { amount: fmt(escrow.amount) })}</p>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const { url } = await payEscrow({ escrowId: escrow._id, locale });
                  window.location.href = url;
                })
              }
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
              {t('payCta', { amount: fmt(escrow.amount) })}
            </Button>
          </div>
        )}

        {/* Held */}
        {escrow?.status === 'held' && role === 'pro' && (
          escrow.proMarkedDone ? (
            <p>{t('awaitingConfirm', { days: AUTO_RELEASE_DAYS })}</p>
          ) : (
            <div className="space-y-2">
              <p>{t('heldPro')}</p>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => run(() => markDone({ escrowId: escrow._id }))}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {t('markDone')}
              </Button>
            </div>
          )
        )}
        {escrow?.status === 'held' && role === 'employer' && (
          <div className="space-y-2">
            <p>{t('heldEmployer')}</p>
            <p className="text-xs text-navy/55">
              {t('feeNote', { pct, proReceives: fmt(escrow.proReceives) })}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => run(() => confirmRelease({ escrowId: escrow._id }))}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {t('confirmCta', { amount: fmt(escrow.proReceives) })}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => run(() => refund({ escrowId: escrow._id }))}
                className="text-red-600 hover:text-red-700"
              >
                {t('refundCta')}
              </Button>
            </div>
          </div>
        )}

        {/* Released / refunded */}
        {escrow?.status === 'released' && (
          <p className="text-forest">
            {role === 'pro'
              ? t('releasedPro', { amount: fmt(escrow.proReceives) })
              : t('releasedEmployer')}
          </p>
        )}
        {escrow?.status === 'refunded' && <p>{t('refunded')}</p>}

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
