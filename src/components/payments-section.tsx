'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAction, useMutation, useQuery } from 'convex/react';
import {
  CheckCircle2,
  CircleDashed,
  CreditCard,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { Locale } from '@/i18n/routing';

export type PaymentsLabels = {
  title: string;
  intro: string;
  statusNotStartedTitle: string;
  statusNotStartedBody: string;
  statusInProgressTitle: string;
  statusInProgressBody: string;
  statusActiveTitle: string;
  statusActiveBody: string;
  setupBtn: string;
  continueBtn: string;
  manageBtn: string;
  refreshBtn: string;
  refreshing: string;
  noContractor: string;

  servicesTitle: string;
  servicesIntro: string;
  servicesEmpty: string;
  addService: string;
  editService: string;
  inactive: string;

  formNewTitle: string;
  formEditTitle: string;
  fieldTitle: string;
  fieldDescription: string;
  fieldPrice: string;
  priceHint: string;
  fieldActive: string;
  save: string;
  saving: string;
  cancel: string;
  remove: string;
  removeConfirm: string;
  saveError: string;
  feeNote: string;
};

type ServiceRow = {
  _id: Id<'contractorServices'>;
  title: string;
  description?: string;
  priceCents: number;
  currency: string;
  active: boolean;
};

const CAD = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
});
const CAD_FR = new Intl.NumberFormat('fr-CA', {
  style: 'currency',
  currency: 'CAD',
});

function formatPrice(cents: number, locale: Locale) {
  return (locale === 'fr' ? CAD_FR : CAD).format(cents / 100);
}

export function PaymentsSection({
  locale,
  labels: l,
}: {
  locale: Locale;
  labels: PaymentsLabels;
}) {
  const status = useQuery(api.payments.myStripeStatus) as
    | { hasContractor: true; hasAccount: boolean; onboardingComplete: boolean }
    | null
    | undefined;
  const services = useQuery(api.payments.listMyServices) as ServiceRow[] | undefined;

  const startOnboarding = useAction(api.payments.startOnboarding);
  const refreshAccountStatus = useAction(api.payments.refreshAccountStatus);
  const getDashboardLink = useAction(api.payments.getDashboardLink);

  const [redirecting, setRedirecting] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // When the contractor returns from the Stripe-hosted flow, re-sync state.
  const searchParams = useSearchParams();
  const router = useRouter();
  const stripeReturn = searchParams?.get('stripe');
  React.useEffect(() => {
    if (!stripeReturn || !status?.hasAccount) return;
    let cancelled = false;
    (async () => {
      try {
        await refreshAccountStatus({});
      } finally {
        if (!cancelled) router.replace(`/${locale}/pros/dashboard`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stripeReturn, status?.hasAccount, refreshAccountStatus, router, locale]);

  if (status === undefined || services === undefined) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-navy/10 bg-white py-10 text-navy/60">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (status === null) {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
        {l.noContractor}
      </div>
    );
  }

  async function onSetup() {
    setError(null);
    setRedirecting(true);
    try {
      const { url } = await startOnboarding({ locale });
      window.location.href = url;
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
      setRedirecting(false);
    }
  }

  async function onManage() {
    setError(null);
    setRedirecting(true);
    try {
      const { url } = await getDashboardLink({});
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRedirecting(false);
    }
  }

  async function onRefresh() {
    setError(null);
    setRefreshing(true);
    try {
      await refreshAccountStatus({});
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
    }
  }

  const { hasAccount, onboardingComplete } = status;
  const state: 'idle' | 'in_progress' | 'active' = !hasAccount
    ? 'idle'
    : onboardingComplete
      ? 'active'
      : 'in_progress';

  return (
    <article className="space-y-5 rounded-2xl border border-navy/10 bg-white p-6">
      <header>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-navy">
          <CreditCard className="h-5 w-5 text-forest" />
          {l.title}
        </h2>
        <p className="mt-1 text-sm text-navy/60">{l.intro}</p>
      </header>

      {/* Onboarding status panel */}
      <div
        className={
          'flex flex-wrap items-start justify-between gap-4 rounded-xl border p-4 ' +
          (state === 'active'
            ? 'border-forest/30 bg-forest/5'
            : state === 'in_progress'
              ? 'border-amber-300 bg-amber-50'
              : 'border-navy/15 bg-navy/5')
        }
      >
        <div className="flex items-start gap-3">
          {state === 'active' ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-forest" />
          ) : state === 'in_progress' ? (
            <CircleDashed className="mt-0.5 h-5 w-5 text-amber-600" />
          ) : (
            <CircleDashed className="mt-0.5 h-5 w-5 text-navy/50" />
          )}
          <div>
            <p className="font-semibold text-navy">
              {state === 'active'
                ? l.statusActiveTitle
                : state === 'in_progress'
                  ? l.statusInProgressTitle
                  : l.statusNotStartedTitle}
            </p>
            <p className="mt-0.5 text-sm text-navy/70">
              {state === 'active'
                ? l.statusActiveBody
                : state === 'in_progress'
                  ? l.statusInProgressBody
                  : l.statusNotStartedBody}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {state === 'idle' && (
            <Button variant="secondary" size="sm" onClick={onSetup} disabled={redirecting}>
              {redirecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              {l.setupBtn}
            </Button>
          )}
          {state === 'in_progress' && (
            <>
              <Button variant="secondary" size="sm" onClick={onSetup} disabled={redirecting}>
                {redirecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                {l.continueBtn}
              </Button>
              <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {refreshing ? l.refreshing : l.refreshBtn}
              </Button>
            </>
          )}
          {state === 'active' && (
            <Button variant="outline" size="sm" onClick={onManage} disabled={redirecting}>
              {redirecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              {l.manageBtn}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Services catalog */}
      <ServicesCatalog
        locale={locale}
        labels={l}
        services={services}
        onboardingComplete={onboardingComplete}
      />
    </article>
  );
}

function ServicesCatalog({
  locale,
  labels: l,
  services,
  onboardingComplete,
}: {
  locale: Locale;
  labels: PaymentsLabels;
  services: ServiceRow[];
  onboardingComplete: boolean;
}) {
  const [editing, setEditing] = React.useState<ServiceRow | 'new' | null>(null);

  return (
    <div className="space-y-3 border-t border-navy/10 pt-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-navy">{l.servicesTitle}</h3>
          <p className="mt-0.5 text-sm text-navy/60">{l.servicesIntro}</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setEditing('new')}
          disabled={!onboardingComplete}
          title={!onboardingComplete ? l.statusNotStartedBody : undefined}
        >
          <Plus className="h-4 w-4" />
          {l.addService}
        </Button>
      </header>

      {!onboardingComplete && (
        <p className="rounded-lg bg-navy/5 px-3 py-2 text-xs text-navy/60">
          {l.feeNote}
        </p>
      )}

      {services.length === 0 ? (
        <p className="rounded-lg border border-dashed border-navy/15 px-3 py-6 text-center text-sm text-navy/50">
          {l.servicesEmpty}
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {services.map((s) => (
            <li
              key={s._id}
              className="flex items-start justify-between gap-3 rounded-xl border border-navy/10 bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-navy">
                  {s.title}{' '}
                  {!s.active && (
                    <span className="ml-1 rounded bg-navy/10 px-1.5 py-0.5 text-[10px] font-semibold text-navy/60">
                      {l.inactive}
                    </span>
                  )}
                </p>
                {s.description && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-navy/60">
                    {s.description}
                  </p>
                )}
                <p className="mt-1 text-sm font-semibold text-forest">
                  {formatPrice(s.priceCents, locale)}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEditing(s)}>
                <Pencil className="h-4 w-4" />
                {l.editService}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <ServiceForm
          locale={locale}
          labels={l}
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function ServiceForm({
  locale,
  labels: l,
  initial,
  onClose,
}: {
  locale: Locale;
  labels: PaymentsLabels;
  initial: ServiceRow | null;
  onClose: () => void;
}) {
  const upsert = useMutation(api.payments.upsertService);
  const remove = useMutation(api.payments.deleteService);

  const [title, setTitle] = React.useState(initial?.title ?? '');
  const [description, setDescription] = React.useState(initial?.description ?? '');
  const [price, setPrice] = React.useState(
    initial ? (initial.priceCents / 100).toFixed(2) : '',
  );
  const [active, setActive] = React.useState(initial?.active ?? true);
  const [saving, setSaving] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const cents = Math.round(Number.parseFloat(price.replace(',', '.')) * 100);
    if (!Number.isFinite(cents) || cents < 100) {
      setError(l.saveError);
      return;
    }
    setSaving(true);
    try {
      await upsert({
        id: initial?._id,
        title,
        description: description.trim() || undefined,
        priceCents: cents,
        active,
      });
      onClose();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function onRemove() {
    if (!initial) return;
    if (!window.confirm(l.removeConfirm)) return;
    setRemoving(true);
    try {
      await remove({ id: initial._id });
      onClose();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
      setRemoving(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-xl border border-navy/15 bg-navy/[0.02] p-4"
    >
      <h4 className="font-semibold text-navy">
        {initial ? l.formEditTitle : l.formNewTitle}
      </h4>

      <Field label={l.fieldTitle}>
        <input
          required
          type="text"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          className="form-input-pay"
        />
      </Field>

      <Field label={l.fieldDescription}>
        <textarea
          value={description}
          rows={2}
          maxLength={600}
          onChange={(e) => setDescription(e.target.value)}
          className="form-input-pay resize-y"
        />
      </Field>

      <Field label={l.fieldPrice}>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-navy/50">
            $
          </span>
          <input
            required
            type="number"
            inputMode="decimal"
            step="0.01"
            min="1"
            max="50000"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="form-input-pay pl-7"
            placeholder="80.00"
          />
        </div>
        <p className="mt-1 text-xs text-navy/55">{l.priceHint}</p>
      </Field>

      <label className="flex items-center gap-2 text-sm text-navy">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="h-4 w-4 accent-forest"
        />
        {l.fieldActive}
      </label>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" size="sm" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? l.saving : l.save}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            {l.cancel}
          </Button>
        </div>
        {initial && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={removing}
            className="text-red-600 hover:text-red-700"
          >
            {removing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {l.remove}
          </Button>
        )}
      </div>

      <style jsx>{`
        :global(.form-input-pay) {
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
        :global(.form-input-pay:focus) {
          border-color: #1f8a3b;
          box-shadow: 0 0 0 3px rgba(31, 138, 59, 0.15);
        }
      `}</style>
    </form>
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
