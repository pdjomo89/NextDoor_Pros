'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery } from 'convex/react';
import { CheckCircle2, Loader2, Send, Stars } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StarPicker } from '@/components/star-picker';
import { StarRating } from '@/components/star-rating';
import { getConvexEnv } from '@/lib/convex-env';
import { api } from '../../convex/_generated/api';
import type { ReviewDoc } from '@/lib/review-types';

type ProOption = {
  _id: string;
  businessName: string;
  services: string[];
  citySlug: string;
  province: string;
  ratingCount: number;
  ratingSum: number;
};

export function LeaveReviewClient() {
  const t = useTranslations('ReviewsPage');
  const configured = getConvexEnv().configured;

  const pros = useQuery(api.contractors.listAllPublished, configured ? {} : 'skip') as
    | ProOption[]
    | undefined;
  const viewer = useQuery(api.contractors.viewer, configured ? {} : 'skip') as
    | { _id: string } | null | undefined;

  const submit = useMutation(api.reviews.submit);
  const submitGuest = useMutation(api.reviews.submitGuest);

  const [selectedId, setSelectedId] = React.useState('');
  const [rating, setRating] = React.useState(0);
  const [comment, setComment] = React.useState('');
  const [name, setName] = React.useState('');
  const [honeypot, setHoneypot] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);

  const signedIn = Boolean(viewer);

  const reviews = useQuery(
    api.reviews.listForContractor,
    configured && selectedId ? { contractorId: selectedId as never } : 'skip',
  ) as ReviewDoc[] | undefined;

  const selectedPro = pros?.find((p) => p._id === selectedId) ?? null;

  if (!configured) {
    return (
      <p className="rounded-2xl border border-navy/10 bg-navy/5 p-6 text-sm text-navy/70">
        {t('unavailable')}
      </p>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedId) {
      setError(t('errPro'));
      return;
    }
    if (rating < 1) {
      setError(t('errRating'));
      return;
    }
    if (!signedIn && !name.trim()) {
      setError(t('errName'));
      return;
    }
    setBusy(true);
    try {
      if (signedIn) {
        await submit({ contractorId: selectedId as never, rating, comment });
      } else {
        await submitGuest({
          contractorId: selectedId as never,
          rating,
          comment,
          name,
          honeypot,
        });
      }
      setSubmitted(true);
      setRating(0);
      setComment('');
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-5 lg:items-start">
      {/* Form */}
      <form
        onSubmit={onSubmit}
        className="space-y-5 rounded-2xl border border-navy/10 bg-gradient-to-br from-navy-100 via-white to-forest-100 p-6 shadow-sm sm:p-7 lg:col-span-3"
      >
        {submitted && (
          <div className="flex items-start gap-2 rounded-lg border border-forest/30 bg-forest/10 px-3 py-2.5 text-sm text-forest-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
            <div>
              <p className="font-semibold">{t('successTitle')}</p>
              <p className="mt-0.5 text-forest-800/80">{t('successBody')}</p>
            </div>
          </div>
        )}

        {/* Pick a pro */}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy">{t('proLabel')}</span>
          {pros === undefined ? (
            <div className="flex items-center gap-2 py-2 text-sm text-navy/50">
              <Loader2 className="h-4 w-4 animate-spin" /> {t('loadingPros')}
            </div>
          ) : pros.length === 0 ? (
            <p className="text-sm text-navy/60">{t('noPros')}</p>
          ) : (
            <select
              required
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value);
                setSubmitted(false);
                setError(null);
              }}
              disabled={busy}
              className="w-full rounded-md border border-navy/15 bg-white px-3 py-2.5 text-sm text-navy outline-none focus:border-forest focus:ring-2 focus:ring-forest/20"
            >
              <option value="">{t('proPlaceholder')}</option>
              {pros.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.businessName} — {p.citySlug}, {p.province}
                </option>
              ))}
            </select>
          )}
        </label>

        {/* Stars */}
        <div>
          <span className="mb-1.5 block text-sm font-medium text-navy">{t('ratingLabel')}</span>
          <StarPicker value={rating} onChange={setRating} size="lg" />
        </div>

        {/* Comment */}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy">{t('commentLabel')}</span>
          <textarea
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={2000}
            placeholder={t('commentPlaceholder')}
            disabled={busy}
            className="w-full resize-y rounded-md border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-forest focus:ring-2 focus:ring-forest/20"
          />
        </label>

        {/* Name — guests only */}
        {!signedIn && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy">{t('nameLabel')}</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              autoComplete="name"
              disabled={busy}
              className="w-full rounded-md border border-navy/15 bg-white px-3 py-2.5 text-sm text-navy outline-none focus:border-forest focus:ring-2 focus:ring-forest/20"
            />
          </label>
        )}

        {/* Honeypot — hidden from humans. */}
        <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
          <label>
            Website
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </label>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <Button type="submit" variant="secondary" size="lg" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {busy ? t('submitting') : t('submit')}
        </Button>
      </form>

      {/* Selected pro's existing reviews */}
      <aside className="lg:col-span-2 lg:sticky lg:top-24">
        {!selectedPro ? (
          <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-forest/30 bg-gradient-to-br from-forest-50 via-white to-navy-50 p-8 text-center shadow-sm">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-forest/10 text-forest ring-1 ring-inset ring-forest/20">
              <Stars className="h-7 w-7" />
            </span>
            <p className="mt-4 text-base font-semibold text-navy">{t('sideHintTitle')}</p>
            <p className="mt-1.5 text-sm text-navy/60">{t('sideHint')}</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-navy/10 bg-white/70 p-5">
            <h2 className="text-lg font-semibold text-navy">{selectedPro.businessName}</h2>
            <div className="mt-2">
              {selectedPro.ratingCount > 0 ? (
                <StarRating
                  value={selectedPro.ratingSum / selectedPro.ratingCount}
                  count={selectedPro.ratingCount}
                  size="md"
                />
              ) : (
                <span className="text-sm text-navy/50">{t('noneYet')}</span>
              )}
            </div>

            <div className="mt-4 space-y-3">
              {reviews === undefined ? (
                <div className="flex items-center justify-center py-6 text-navy/50">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : reviews.length === 0 ? null : (
                reviews.slice(0, 5).map((r) => (
                  <div key={r._id} className="rounded-xl border border-navy/10 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-navy">
                        {r.authorName ?? t('anon')}
                      </span>
                      <StarRating value={r.rating} />
                    </div>
                    {r.comment && <p className="mt-1.5 text-sm text-navy/70">{r.comment}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
