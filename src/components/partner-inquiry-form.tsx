'use client';

import * as React from 'react';
import { useMutation } from 'convex/react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, CheckCircle2, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '../../convex/_generated/api';

/**
 * Inline "Become a partner" inquiry form on /partners. Reuses the existing
 * `contactMessages.submit` mutation with a fixed subject so it lands in the
 * same ops inbox as general contact-form messages.
 */
export function PartnerInquiryForm({ locale }: { locale: string }) {
  const t = useTranslations('Partners.form');
  const submit = useMutation(api.contactMessages.submit);

  const [name, setName] = React.useState('');
  const [business, setBusiness] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [honeypot, setHoneypot] = React.useState('');

  const [state, setState] = React.useState<'idle' | 'submitting' | 'success' | 'error'>(
    'idle',
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === 'submitting' || state === 'success') return;
    setState('submitting');
    try {
      await submit({
        name: name.trim(),
        email: email.trim(),
        subject: 'Partnership inquiry',
        message: `Business: ${business.trim()}\n\n${message.trim()}`,
        locale,
        honeypot,
      });
      setState('success');
    } catch (err) {
      console.error(err);
      setState('error');
    }
  }

  if (state === 'success') {
    return (
      <div className="rounded-2xl border border-forest/30 bg-forest/5 p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-forest" />
        <h3 className="mt-3 text-xl font-semibold text-navy">{t('successTitle')}</h3>
        <p className="mx-auto mt-2 max-w-md text-navy/70">{t('successBody')}</p>
      </div>
    );
  }

  const submitting = state === 'submitting';

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-2xl border border-navy/10 bg-white p-6 shadow-sm sm:p-8"
    >
      {/* honeypot — bots fill this, humans don't see it */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        className="hidden"
        aria-hidden
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('nameLabel')} required>
          <input
            required
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('namePlaceholder')}
            disabled={submitting}
            className="form-input-partner"
          />
        </Field>
        <Field label={t('businessLabel')} required>
          <input
            required
            type="text"
            value={business}
            onChange={(e) => setBusiness(e.target.value)}
            placeholder={t('businessPlaceholder')}
            disabled={submitting}
            className="form-input-partner"
          />
        </Field>
      </div>

      <Field label={t('emailLabel')} required>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('emailPlaceholder')}
          disabled={submitting}
          className="form-input-partner"
        />
      </Field>

      <Field label={t('messageLabel')} required>
        <textarea
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t('messagePlaceholder')}
          disabled={submitting}
          className="form-input-partner resize-y"
        />
      </Field>

      {state === 'error' && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">{t('errorTitle')}</p>
            <p className="mt-0.5 text-red-700/80">{t('errorBody')}</p>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-1">
        <Button type="submit" variant="secondary" size="lg" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting ? t('submitting') : t('submit')}
        </Button>
      </div>

      <style jsx>{`
        :global(.form-input-partner) {
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
        :global(.form-input-partner:focus) {
          border-color: #1f8a3b;
          box-shadow: 0 0 0 3px rgba(31, 138, 59, 0.15);
        }
      `}</style>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-navy">
        {label}
        {required && <span className="ml-0.5 text-forest">*</span>}
      </span>
      {children}
    </label>
  );
}
