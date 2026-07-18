'use client';

import * as React from 'react';
import { useMutation, useQuery } from 'convex/react';
import {
  Loader2,
  Pencil,
  Plus,
  Trash2,
  AlertTriangle,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { Locale } from '@/i18n/routing';
import { formatFcfa } from '@/lib/currency';

export type ServicesLabels = {
  title: string;
  intro: string;
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
};

type ServiceRow = {
  _id: Id<'contractorServices'>;
  title: string;
  description?: string;
  priceCents: number;
  currency: string;
  active: boolean;
};

function formatPrice(amount: number, locale: Locale) {
  return formatFcfa(amount, locale);
}

export function ServicesSection({
  locale,
  labels: l,
}: {
  locale: Locale;
  labels: ServicesLabels;
}) {
  const services = useQuery(api.payments.listMyServices) as ServiceRow[] | undefined;
  const [editing, setEditing] = React.useState<ServiceRow | 'new' | null>(null);

  if (services === undefined) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-navy/10 bg-gradient-to-br from-navy-100 via-white to-forest-100 py-10 text-navy/60">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <article className="space-y-4 rounded-2xl border border-navy/10 bg-gradient-to-br from-navy-100 via-white to-forest-100 p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-navy">
            <Tag className="h-5 w-5 text-forest" />
            {l.title}
          </h2>
          <p className="mt-1 text-sm text-navy/60">{l.intro}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" />
          {l.addService}
        </Button>
      </header>

      {services.length === 0 ? (
        <p className="rounded-lg border border-dashed border-navy/15 px-3 py-6 text-center text-sm text-navy/50">
          {l.servicesEmpty}
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {services.map((s) => (
            <li
              key={s._id}
              className="flex items-start justify-between gap-3 rounded-xl border border-navy/10 bg-white/60 px-4 py-3"
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
    </article>
  );
}

function ServiceForm({
  locale,
  labels: l,
  initial,
  onClose,
}: {
  locale: Locale;
  labels: ServicesLabels;
  initial: ServiceRow | null;
  onClose: () => void;
}) {
  void locale;
  const upsert = useMutation(api.payments.upsertService);
  const remove = useMutation(api.payments.deleteService);

  const [title, setTitle] = React.useState(initial?.title ?? '');
  const [description, setDescription] = React.useState(initial?.description ?? '');
  const [price, setPrice] = React.useState(
    initial ? String(initial.priceCents) : '',
  );
  const [active, setActive] = React.useState(initial?.active ?? true);
  const [saving, setSaving] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const amount = Math.round(Number.parseFloat(price.replace(',', '.')));
    if (!Number.isFinite(amount) || amount < 100) {
      setError(l.saveError);
      return;
    }
    setSaving(true);
    try {
      await upsert({
        id: initial?._id,
        title,
        description: description.trim() || undefined,
        priceCents: amount,
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
          className="form-input-svc"
        />
      </Field>

      <Field label={l.fieldDescription}>
        <textarea
          value={description}
          rows={2}
          maxLength={600}
          onChange={(e) => setDescription(e.target.value)}
          className="form-input-svc resize-y"
        />
      </Field>

      <Field label={l.fieldPrice}>
        <div className="relative">
          <input
            required
            type="number"
            inputMode="numeric"
            step="1"
            min="100"
            max="50000000"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="form-input-svc pr-16"
            placeholder="25000"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-navy/50">
            FCFA
          </span>
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
        :global(.form-input-svc) {
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
        :global(.form-input-svc:focus) {
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
