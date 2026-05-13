'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from 'convex/react';
import { CheckCircle2, Loader2, Send, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CityPicker } from '@/components/city-picker';
import { useCity } from '@/components/city-picker-context';
import { getConvexEnv } from '@/lib/convex-env';
import { api } from '../../convex/_generated/api';
import type { Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

export function ContactForm({ locale }: { locale: Locale }) {
  const t = useTranslations('Contact.form');
  const { city } = useCity();
  const convexConfigured = getConvexEnv().configured;
  const submit = useMutation(api.contactMessages.submit);

  const [submitted, setSubmitted] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;

    const formData = new FormData(e.currentTarget);
    const name = String(formData.get('name') ?? '');
    const email = String(formData.get('email') ?? '');
    const subject = String(formData.get('subject') ?? '');
    const message = String(formData.get('message') ?? '');
    const honeypot = String(formData.get('website') ?? '');

    setError(null);
    setSending(true);
    try {
      if (!convexConfigured) {
        throw new Error('Backend not configured');
      }
      await submit({
        name,
        email,
        subject,
        message,
        citySlug: city?.slug,
        locale,
        honeypot,
      });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError(t('errorBody'));
    } finally {
      setSending(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-forest/30 bg-forest/5 p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-forest" />
        <h2 className="mt-3 text-xl font-semibold text-navy">{t('successTitle')}</h2>
        <p className="mt-2 text-navy/70">{t('successBody')}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-navy/10 bg-white p-6 shadow-sm sm:p-7"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('name')}>
          <input
            required
            type="text"
            name="name"
            autoComplete="name"
            disabled={sending}
            className="form-input"
          />
        </Field>
        <Field label={t('email')}>
          <input
            required
            type="email"
            name="email"
            autoComplete="email"
            disabled={sending}
            className="form-input"
          />
        </Field>
      </div>

      <Field label={t('city')}>
        <div className="flex flex-wrap items-center gap-2">
          <CityPicker locale={locale} />
          {city && (
            <span className="text-sm text-navy/60">
              {city.name}, {city.province}
            </span>
          )}
        </div>
      </Field>

      <Field label={t('subject')}>
        <input
          required
          type="text"
          name="subject"
          disabled={sending}
          className="form-input"
        />
      </Field>

      <Field label={t('message')}>
        <textarea
          required
          name="message"
          rows={5}
          maxLength={5000}
          disabled={sending}
          className="form-input resize-y"
        />
      </Field>

      {/* Honeypot — hidden from humans, irresistible to bots. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">{t('errorTitle')}</p>
            <p className="mt-0.5 text-red-700/80">{error}</p>
          </div>
        </div>
      )}

      <Button
        type="submit"
        variant="secondary"
        size="lg"
        disabled={sending}
        className="w-full sm:w-auto"
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {sending ? t('sending') : t('send')}
      </Button>

      <style jsx>{`
        :global(.form-input) {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid hsl(215 20% 88%);
          background: white;
          padding: 0.625rem 0.75rem;
          font-size: 0.875rem;
          color: hsl(215 60% 12%);
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        :global(.form-input:focus) {
          border-color: #1f8a3b;
          box-shadow: 0 0 0 3px rgba(31, 138, 59, 0.15);
        }
        :global(.form-input:disabled) {
          background: hsl(210 17% 97%);
          cursor: not-allowed;
        }
      `}</style>
    </form>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-sm font-medium text-navy">{label}</span>
      {children}
    </label>
  );
}
