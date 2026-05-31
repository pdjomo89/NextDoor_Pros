'use client';

import * as React from 'react';
import { useMutation, useQuery } from 'convex/react';
import { CheckCircle2, HelpCircle, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '../../convex/_generated/api';
import type { Locale } from '@/i18n/routing';

export type ConfirmLabels = {
  loading: string;
  missingTitle: string;
  missingBody: string;
  reviewTitle: string;
  reviewBody: string;
  amountLabel: string;
  proLabel: string;
  confirmBtn: string;
  confirming: string;
  doneTitle: string;
  doneBody: string;
  alreadyTitle: string;
  alreadyBody: string;
  error: string;
};

const CAD = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const CAD_FR = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' });

type PaymentInfo = {
  status: string;
  amountCents: number;
  currency: string;
  contractorBusinessName: string | null;
  serviceTitle: string | null;
  deliveredAt: number | null;
};

export function ConfirmCompletionClient({
  token,
  locale,
  labels: l,
}: {
  token: string | null;
  locale: Locale;
  labels: ConfirmLabels;
}) {
  const payment = useQuery(
    api.payments.getPaymentByConfirmToken,
    token ? { token } : 'skip',
  ) as PaymentInfo | null | undefined;
  const confirm = useMutation(api.payments.confirmCompletion);

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Optimistic local view of the released state after the user clicks.
  const [released, setReleased] = React.useState(false);

  if (!token) {
    return <Card icon="missing" title={l.missingTitle} body={l.missingBody} />;
  }
  if (payment === undefined) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-navy/10 bg-white py-12 text-navy/60">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="ml-2 text-sm">{l.loading}</span>
      </div>
    );
  }
  if (payment === null) {
    return <Card icon="missing" title={l.missingTitle} body={l.missingBody} />;
  }

  const formatter = locale === 'fr' ? CAD_FR : CAD;
  const amount = formatter.format(payment.amountCents / 100);

  const isDone =
    released || payment.status === 'released' || payment.status === 'releasing';

  if (isDone) {
    return (
      <Card
        icon="done"
        title={l.doneTitle}
        body={l.doneBody}
        amountLabel={l.amountLabel}
        amount={amount}
        proLabel={l.proLabel}
        pro={payment.contractorBusinessName ?? undefined}
      />
    );
  }

  // Refunded / disputed / anything that isn't 'held' can't be confirmed.
  if (payment.status !== 'held') {
    return <Card icon="missing" title={l.alreadyTitle} body={l.alreadyBody} />;
  }

  async function onConfirm() {
    if (!token) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await confirm({ token });
      if (res.status === 'releasing' || res.status === 'released') {
        setReleased(true);
      } else {
        // Non-confirmable state surfaced by the server (e.g. refunded).
        setError(l.error);
      }
    } catch (err) {
      console.error(err);
      setError(l.error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-forest/30 bg-forest/5 p-8 text-center">
      <ShieldCheck className="mx-auto h-12 w-12 text-forest" />
      <h1 className="mt-3 text-2xl font-semibold text-navy">{l.reviewTitle}</h1>
      <p className="mt-2 text-navy/75">{l.reviewBody}</p>

      <div className="mt-4 space-y-1">
        <p className="text-sm font-medium text-navy/80">
          {l.amountLabel}{' '}
          <span className="text-base font-bold text-forest">{amount}</span>
        </p>
        {payment.contractorBusinessName && (
          <p className="text-sm text-navy/70">
            {l.proLabel}{' '}
            <span className="font-semibold text-navy">
              {payment.contractorBusinessName}
            </span>
          </p>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <Button
        variant="secondary"
        size="lg"
        className="mt-6"
        onClick={onConfirm}
        disabled={submitting}
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        {submitting ? l.confirming : l.confirmBtn}
      </Button>
    </div>
  );
}

function Card({
  icon,
  title,
  body,
  amountLabel,
  amount,
  proLabel,
  pro,
}: {
  icon: 'done' | 'missing';
  title: string;
  body: string;
  amountLabel?: string;
  amount?: string;
  proLabel?: string;
  pro?: string;
}) {
  return (
    <div
      className={
        'rounded-2xl border p-8 text-center ' +
        (icon === 'done' ? 'border-forest/30 bg-forest/5' : 'border-navy/10 bg-white')
      }
    >
      {icon === 'done' ? (
        <CheckCircle2 className="mx-auto h-12 w-12 text-forest" />
      ) : (
        <HelpCircle className="mx-auto h-12 w-12 text-navy/40" />
      )}
      <h1 className="mt-3 text-2xl font-semibold text-navy">{title}</h1>
      <p className="mt-2 text-navy/75">{body}</p>
      {amount && amountLabel && (
        <p className="mt-4 text-sm font-medium text-navy/80">
          {amountLabel}{' '}
          <span className="text-base font-bold text-forest">{amount}</span>
        </p>
      )}
      {pro && proLabel && (
        <p className="mt-1 text-sm text-navy/70">
          {proLabel} <span className="font-semibold text-navy">{pro}</span>
        </p>
      )}
    </div>
  );
}
