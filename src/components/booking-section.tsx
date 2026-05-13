'use client';

import * as React from 'react';
import { useAction, useQuery } from 'convex/react';
import {
  AlertTriangle,
  CreditCard,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCity } from '@/components/city-picker-context';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { Locale } from '@/i18n/routing';

export type BookingLabels = {
  sectionTitle: string;
  sectionIntro: string;
  bookButton: string;
  modalTitle: string;
  emailLabel: string;
  nameLabel: string;
  nameOptional: string;
  noteLabel: string;
  noteOptional: string;
  notePlaceholder: string;
  paySecurely: string;
  redirecting: string;
  cancel: string;
  errorTitle: string;
  feeDisclosure: string;
  empty: string;
};

type ServiceRow = {
  _id: Id<'contractorServices'>;
  title: string;
  description?: string;
  priceCents: number;
  currency: string;
};

const CAD = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const CAD_FR = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' });

function formatPrice(cents: number, locale: Locale) {
  return (locale === 'fr' ? CAD_FR : CAD).format(cents / 100);
}

export function BookingSection({
  contractorId,
  contractorAcceptsPayments,
  locale,
  labels: l,
}: {
  contractorId: Id<'contractors'>;
  contractorAcceptsPayments: boolean;
  locale: Locale;
  labels: BookingLabels;
}) {
  const services = useQuery(
    api.payments.listPublicServices,
    contractorAcceptsPayments ? { contractorId } : 'skip',
  ) as ServiceRow[] | undefined;

  const [picked, setPicked] = React.useState<ServiceRow | null>(null);

  if (!contractorAcceptsPayments) return null;
  if (services === undefined) {
    return (
      <section className="mt-6 rounded-2xl border border-navy/10 bg-white p-6">
        <div className="flex items-center justify-center py-4 text-navy/60">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </section>
    );
  }
  if (services.length === 0) return null;

  return (
    <section className="mt-6 rounded-2xl border border-forest/30 bg-gradient-to-br from-forest/[0.04] to-white p-6">
      <header className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-forest/10 text-forest">
          <CreditCard className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-navy">{l.sectionTitle}</h2>
          <p className="mt-0.5 text-sm text-navy/70">{l.sectionIntro}</p>
        </div>
      </header>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {services.map((s) => (
          <li
            key={s._id}
            className="flex h-full flex-col gap-3 rounded-xl border border-navy/10 bg-white p-4"
          >
            <div className="flex-1">
              <h3 className="font-semibold text-navy">{s.title}</h3>
              {s.description && (
                <p className="mt-1 text-sm text-navy/70">{s.description}</p>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-forest">
                {formatPrice(s.priceCents, locale)}
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPicked(s)}
              >
                {l.bookButton}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-navy/55">
        <ShieldCheck className="h-3.5 w-3.5 text-forest" />
        {l.feeDisclosure}
      </p>

      {picked && (
        <BookingModal
          service={picked}
          locale={locale}
          labels={l}
          onClose={() => setPicked(null)}
        />
      )}
    </section>
  );
}

function BookingModal({
  service,
  locale,
  labels: l,
  onClose,
}: {
  service: ServiceRow;
  locale: Locale;
  labels: BookingLabels;
  onClose: () => void;
}) {
  const createSession = useAction(api.payments.createCheckoutSession);
  const { city } = useCity();
  const [email, setEmail] = React.useState('');
  const [name, setName] = React.useState('');
  const [note, setNote] = React.useState('');
  const [redirecting, setRedirecting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !redirecting) onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, redirecting]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setRedirecting(true);
    try {
      const { url } = await createSession({
        contractorServiceId: service._id,
        customerEmail: email.trim(),
        customerName: name.trim() || undefined,
        customerCitySlug: city?.slug,
        note: note.trim() || undefined,
        locale,
      });
      window.location.href = url;
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
      setRedirecting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-navy/40 px-4 backdrop-blur-sm"
      onClick={() => {
        if (!redirecting) onClose();
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl"
      >
        <header>
          <h3 className="text-lg font-semibold text-navy">{l.modalTitle}</h3>
          <p className="mt-1 text-sm text-navy/70">
            {service.title} — <span className="font-semibold text-forest">
              {formatPrice(service.priceCents, locale)}
            </span>
          </p>
        </header>

        <Field label={l.emailLabel}>
          <input
            required
            type="email"
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            disabled={redirecting}
            className="form-input-book"
          />
        </Field>

        <Field label={`${l.nameLabel} ${l.nameOptional}`}>
          <input
            type="text"
            value={name}
            autoComplete="name"
            onChange={(e) => setName(e.target.value)}
            disabled={redirecting}
            className="form-input-book"
          />
        </Field>

        <Field label={`${l.noteLabel} ${l.noteOptional}`}>
          <textarea
            value={note}
            rows={3}
            maxLength={1000}
            placeholder={l.notePlaceholder}
            onChange={(e) => setNote(e.target.value)}
            disabled={redirecting}
            className="form-input-book resize-y"
          />
        </Field>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">{l.errorTitle}</p>
              <p className="mt-0.5 text-red-700/80">{error}</p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={redirecting}
          >
            {l.cancel}
          </Button>
          <Button type="submit" variant="secondary" size="sm" disabled={redirecting}>
            {redirecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4" />
            )}
            {redirecting ? l.redirecting : l.paySecurely}
          </Button>
        </div>

        <style jsx>{`
          :global(.form-input-book) {
            width: 100%;
            border-radius: 0.5rem;
            border: 1px solid hsl(215 20% 88%);
            background: white;
            padding: 0.5rem 0.75rem;
            font-size: 0.875rem;
            color: hsl(215 60% 12%);
            outline: none;
            transition: border-color 0.15s, box-shadow 0.15s;
          }
          :global(.form-input-book:focus) {
            border-color: #1f8a3b;
            box-shadow: 0 0 0 3px rgba(31, 138, 59, 0.15);
          }
        `}</style>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-navy/55">
        {label}
      </span>
      {children}
    </label>
  );
}
