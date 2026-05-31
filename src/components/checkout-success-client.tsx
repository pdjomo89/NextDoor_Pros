'use client';

import { useQuery } from 'convex/react';
import { CheckCircle2, Clock, HelpCircle, Loader2 } from 'lucide-react';
import { api } from '../../convex/_generated/api';
import type { Locale } from '@/i18n/routing';

type Labels = {
  loading: string;
  successTitle: string;
  successBody: string;
  pendingTitle: string;
  pendingBody: string;
  missingTitle: string;
  missingBody: string;
  amountLabel: string;
  paidTo: string;
};

const CAD = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const CAD_FR = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' });

export function CheckoutSuccessClient({
  sessionId,
  locale,
  labels: l,
}: {
  sessionId: string | null;
  locale: Locale;
  labels: Labels;
}) {
  const payment = useQuery(
    api.payments.getPaymentBySession,
    sessionId ? { sessionId } : 'skip',
  ) as
    | {
        status: string;
        amountCents: number;
        currency: string;
        contractorBusinessName: string | null;
      }
    | null
    | undefined;

  if (!sessionId) {
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

  if (payment.status === 'held' || payment.status === 'released') {
    return (
      <Card
        icon="success"
        title={l.successTitle}
        body={l.successBody}
        amountLabel={l.amountLabel}
        amount={amount}
        paidToLabel={l.paidTo}
        paidTo={payment.contractorBusinessName ?? undefined}
      />
    );
  }

  return (
    <Card
      icon="pending"
      title={l.pendingTitle}
      body={l.pendingBody}
      amountLabel={l.amountLabel}
      amount={amount}
    />
  );
}

function Card({
  icon,
  title,
  body,
  amountLabel,
  amount,
  paidToLabel,
  paidTo,
}: {
  icon: 'success' | 'pending' | 'missing';
  title: string;
  body: string;
  amountLabel?: string;
  amount?: string;
  paidToLabel?: string;
  paidTo?: string;
}) {
  return (
    <div
      className={
        'rounded-2xl border p-8 text-center ' +
        (icon === 'success'
          ? 'border-forest/30 bg-forest/5'
          : icon === 'pending'
            ? 'border-amber-300 bg-amber-50'
            : 'border-navy/10 bg-white')
      }
    >
      {icon === 'success' && <CheckCircle2 className="mx-auto h-12 w-12 text-forest" />}
      {icon === 'pending' && <Clock className="mx-auto h-12 w-12 text-amber-600" />}
      {icon === 'missing' && <HelpCircle className="mx-auto h-12 w-12 text-navy/40" />}
      <h1 className="mt-3 text-2xl font-semibold text-navy">{title}</h1>
      <p className="mt-2 text-navy/75">{body}</p>
      {amount && amountLabel && (
        <p className="mt-4 text-sm font-medium text-navy/80">
          {amountLabel}{' '}
          <span className="text-base font-bold text-forest">{amount}</span>
        </p>
      )}
      {paidTo && paidToLabel && (
        <p className="mt-1 text-sm text-navy/70">
          {paidToLabel} <span className="font-semibold text-navy">{paidTo}</span>
        </p>
      )}
    </div>
  );
}
