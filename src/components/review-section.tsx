'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery } from 'convex/react';
import { Loader2, Star, Trash2 } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { StarRating } from '@/components/star-rating';
import { getConvexEnv } from '@/lib/convex-env';
import { api } from '../../convex/_generated/api';
import type { ReviewDoc } from '@/lib/review-types';
import { cn } from '@/lib/utils';

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = React.useState(0);
  const shown = hover || value;
  return (
    <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          className="rounded p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <Star
            className={cn('h-6 w-6', n <= shown ? 'text-amber-400' : 'text-navy/20')}
            fill="currentColor"
            strokeWidth={0}
          />
        </button>
      ))}
    </div>
  );
}

function ReviewForm({ contractorId }: { contractorId: string }) {
  const t = useTranslations('Reviews');
  const mine = useQuery(api.reviews.myReviewFor, { contractorId: contractorId as never }) as
    | { rating: number; comment: string }
    | null
    | undefined;
  const submit = useMutation(api.reviews.submit);
  const removeMine = useMutation(api.reviews.removeMine);

  const [rating, setRating] = React.useState(0);
  const [comment, setComment] = React.useState('');
  const [hydrated, setHydrated] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (mine === undefined || hydrated) return;
    if (mine) {
      setRating(mine.rating);
      setComment(mine.comment);
    }
    setHydrated(true);
  }, [mine, hydrated]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (rating < 1) {
      setError(t('errRating'));
      return;
    }
    setBusy(true);
    try {
      await submit({ contractorId: contractorId as never, rating, comment });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!confirm(t('confirmDelete'))) return;
    setBusy(true);
    try {
      await removeMine({ contractorId: contractorId as never });
      setRating(0);
      setComment('');
    } finally {
      setBusy(false);
    }
  }

  const editing = Boolean(mine);

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-navy/10 bg-white p-5">
      <p className="text-sm font-semibold text-navy">{editing ? t('yourReview') : t('leaveReview')}</p>
      <div className="mt-3">
        <StarPicker value={rating} onChange={setRating} />
      </div>
      <textarea
        rows={3}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t('commentPlaceholder')}
        className="mt-3 w-full resize-y rounded-md border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-forest focus:ring-2 focus:ring-forest/20"
      />
      {error && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="submit" variant="secondary" size="sm" disabled={busy}>
          {busy ? t('submitting') : editing ? t('updateReview') : t('submit')}
        </Button>
        {editing && (
          <Button type="button" variant="ghost" size="sm" onClick={onDelete} disabled={busy}>
            <Trash2 className="h-4 w-4" />
            {t('delete')}
          </Button>
        )}
      </div>
    </form>
  );
}

export function ReviewSection({
  contractorId,
  isOwner,
}: {
  contractorId: string;
  isOwner: boolean;
}) {
  const t = useTranslations('Reviews');
  const configured = getConvexEnv().configured;
  const viewer = useQuery(api.contractors.viewer, configured ? {} : 'skip') as
    | { _id: string } | null | undefined;
  const reviews = useQuery(
    api.reviews.listForContractor,
    configured ? { contractorId: contractorId as never } : 'skip',
  ) as ReviewDoc[] | undefined;

  if (!configured) return null;

  const signedIn = Boolean(viewer);

  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold text-navy">{t('title')}</h2>

      {/* Write a review */}
      <div className="mt-4">
        {isOwner ? (
          <p className="rounded-2xl border border-navy/10 bg-navy/5 p-4 text-sm text-navy/60">
            {t('ownListing')}
          </p>
        ) : signedIn ? (
          <ReviewForm contractorId={contractorId} />
        ) : (
          <p className="rounded-2xl border border-navy/10 bg-navy/5 p-4 text-sm text-navy/70">
            <Link href="/auth/sign-in" className="font-semibold text-forest hover:underline">
              {t('signInToReview')}
            </Link>
          </p>
        )}
      </div>

      {/* Existing reviews */}
      <div className="mt-6">
        {reviews === undefined ? (
          <div className="flex items-center justify-center py-10 text-navy/60">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-navy/60">{t('noneBody')}</p>
        ) : (
          <ul className="space-y-4">
            {reviews.map((r) => (
              <li key={r._id} className="rounded-2xl border border-navy/10 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-navy">
                    {r.authorName ?? t('anon')}
                  </span>
                  <span className="text-xs text-navy/50">
                    {new Date(r._creationTime).toLocaleDateString()}
                  </span>
                </div>
                <div className="mt-1">
                  <StarRating value={r.rating} />
                </div>
                {r.comment && <p className="mt-2 text-sm text-navy/80">{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
