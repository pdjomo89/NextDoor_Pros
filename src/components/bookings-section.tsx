'use client';

import * as React from 'react';
import { useMutation, useQuery } from 'convex/react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  PackageCheck,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { Locale } from '@/i18n/routing';

export type BookingsLabels = {
  title: string;
  intro: string;
  empty: string;
  customer: string;
  statusHeld: string;
  statusDelivered: string;
  statusReleasing: string;
  statusReleased: string;
  statusRefunded: string;
  statusDisputed: string;
  markDelivered: string;
  markingDelivered: string;
  deliveredHint: string;
  payoutLabel: string;
  releasedOn: string;
  error: string;
};

type Booking = {
  _id: Id<'payments'>;
  createdAt: number;
  status: string;
  amountCents: number;
  applicationFeeCents: number;
  payoutCents: number;
  currency: string;
  customerName: string | null;
  customerCitySlug: string | null;
  serviceTitle: string | null;
  deliveredAt: number | null;
  releasedAt: number | null;
};

const CAD = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const CAD_FR = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' });

function money(cents: number, locale: Locale) {
  return (locale === 'fr' ? CAD_FR : CAD).format(cents / 100);
}

export function BookingsSection({
  locale,
  labels: l,
}: {
  locale: Locale;
  labels: BookingsLabels;
}) {
  const bookings = useQuery(api.payments.listMyBookings) as Booking[] | undefined;
  const markDelivered = useMutation(api.payments.markWorkDelivered);

  const [busyId, setBusyId] = React.useState<Id<'payments'> | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  if (bookings === undefined) {
    return (
      <article className="flex items-center justify-center rounded-2xl border border-navy/10 bg-white py-10 text-navy/60">
        <Loader2 className="h-5 w-5 animate-spin" />
      </article>
    );
  }

  async function onDeliver(id: Id<'payments'>) {
    setError(null);
    setBusyId(id);
    try {
      await markDelivered({ paymentId: id });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <article className="space-y-4 rounded-2xl border border-navy/10 bg-white p-6">
      <header>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-navy">
          <Wallet className="h-5 w-5 text-forest" />
          {l.title}
        </h2>
        <p className="mt-1 text-sm text-navy/60">{l.intro}</p>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{l.error}</span>
        </div>
      )}

      {bookings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-navy/15 px-3 py-6 text-center text-sm text-navy/50">
          {l.empty}
        </p>
      ) : (
        <ul className="space-y-2">
          {bookings.map((b) => (
            <BookingRow
              key={b._id}
              booking={b}
              locale={locale}
              labels={l}
              busy={busyId === b._id}
              onDeliver={() => onDeliver(b._id)}
            />
          ))}
        </ul>
      )}
    </article>
  );
}

function BookingRow({
  booking: b,
  locale,
  labels: l,
  busy,
  onDeliver,
}: {
  booking: Booking;
  locale: Locale;
  labels: BookingsLabels;
  busy: boolean;
  onDeliver: () => void;
}) {
  // 'held' splits into not-yet-delivered (actionable) vs delivered-awaiting.
  const phase =
    b.status === 'held' && b.deliveredAt == null
      ? 'awaiting_delivery'
      : b.status === 'held'
        ? 'delivered'
        : b.status;

  const badge = {
    awaiting_delivery: { text: l.statusHeld, cls: 'bg-amber-100 text-amber-800', Icon: Clock },
    delivered: { text: l.statusDelivered, cls: 'bg-sky-100 text-sky-800', Icon: PackageCheck },
    releasing: { text: l.statusReleasing, cls: 'bg-sky-100 text-sky-800', Icon: Loader2 },
    released: { text: l.statusReleased, cls: 'bg-forest/10 text-forest', Icon: CheckCircle2 },
    refunded: { text: l.statusRefunded, cls: 'bg-navy/10 text-navy/60', Icon: AlertTriangle },
    disputed: { text: l.statusDisputed, cls: 'bg-red-100 text-red-700', Icon: AlertTriangle },
  }[phase] ?? { text: b.status, cls: 'bg-navy/10 text-navy/60', Icon: Clock };

  const Icon = badge.Icon;

  return (
    <li className="rounded-xl border border-navy/10 bg-white px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-navy">
            {b.serviceTitle ?? '—'}
          </p>
          <p className="mt-0.5 text-xs text-navy/55">
            {l.customer}: {b.customerName || '—'}
            {b.customerCitySlug ? ` · ${b.customerCitySlug}` : ''}
          </p>
          <p className="mt-1 text-sm">
            <span className="font-semibold text-forest">{money(b.payoutCents, locale)}</span>{' '}
            <span className="text-xs text-navy/50">
              {l.payoutLabel} ({money(b.amountCents, locale)})
            </span>
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span
            className={
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ' +
              badge.cls
            }
          >
            <Icon className={'h-3 w-3' + (phase === 'releasing' ? ' animate-spin' : '')} />
            {badge.text}
          </span>

          {phase === 'awaiting_delivery' && (
            <Button variant="secondary" size="sm" onClick={onDeliver} disabled={busy}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PackageCheck className="h-4 w-4" />
              )}
              {busy ? l.markingDelivered : l.markDelivered}
            </Button>
          )}
        </div>
      </div>

      {phase === 'delivered' && (
        <p className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
          {l.deliveredHint}
        </p>
      )}
    </li>
  );
}
