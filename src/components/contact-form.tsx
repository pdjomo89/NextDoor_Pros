'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CityPicker } from '@/components/city-picker';
import { useCity } from '@/components/city-picker-context';
import type { Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

export function ContactForm({ locale }: { locale: Locale }) {
  const t = useTranslations('Contact.form');
  const { city } = useCity();
  const [submitted, setSubmitted] = React.useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
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
            className="form-input"
          />
        </Field>
        <Field label={t('email')}>
          <input
            required
            type="email"
            name="email"
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
          className="form-input"
        />
      </Field>

      <Field label={t('message')}>
        <textarea
          required
          name="message"
          rows={5}
          className="form-input resize-y"
        />
      </Field>

      <Button type="submit" variant="secondary" size="lg" className="w-full sm:w-auto">
        <Send className="h-4 w-4" />
        {t('send')}
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
