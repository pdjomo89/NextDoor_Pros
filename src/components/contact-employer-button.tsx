'use client';

import * as React from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { Loader2, Lock, LogIn, MessageSquare } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { getConvexEnv } from '@/lib/convex-env';
import { GuestMessageModal } from '@/components/guest-message-modal';
import { formatMoney } from '@/lib/currency';
import { getMarket, leadUnlockFeeMinor, monetizationModel } from '@/lib/markets';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { ButtonProps } from '@/components/ui/button';

/**
 * Contact a job's poster (employer) through platform messaging. Contacting is
 * gated behind a lead unlock, whose mechanics depend on the job's market:
 *   • Pay-as-you-go (Cameroon): the pro pays a per-lead fee via Fapshi.
 *   • Subscription (Canada): the unlock is covered by the pro's membership quota;
 *     no member (or quota spent) → they're pointed at the membership page.
 * No phone/email is ever shared. Hidden on the poster's own job.
 */
export function ContactEmployerButton({
  jobId,
  posterId,
  country,
  variant = 'primary',
  size = 'sm',
  className,
}: {
  jobId: string;
  posterId: string;
  /** ISO country of the job's market — drives the unlock model + fee display. */
  country?: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
}) {
  const t = useTranslations('Jobs');
  const locale = useLocale();
  const configured = getConvexEnv().configured;
  const model = monetizationModel(country);

  const viewer = useQuery(api.contractors.viewer, configured ? {} : 'skip') as
    | { _id: string }
    | null
    | undefined;
  const signedIn = !!viewer;

  const unlock = useQuery(
    api.leadUnlocks.isUnlocked,
    configured && signedIn ? { jobId: jobId as Id<'jobs'> } : 'skip',
  );

  // Pro-side membership (subscription markets only).
  const membership = useQuery(
    api.memberships.myMembership,
    configured && signedIn && model === 'subscription' && country
      ? { role: 'pro' as const, country }
      : 'skip',
  );

  const startLeadUnlock = useAction(api.leadUnlocks.startLeadUnlock);
  const refreshLeadUnlock = useAction(api.leadUnlocks.refreshLeadUnlock);
  const unlockWithMembership = useMutation(api.leadUnlocks.unlockWithMembership);
  const startJob = useMutation(api.messaging.startJobConversation);

  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Returning from hosted checkout (?unlocked=1) — force-settle in case the
  // webhook is delayed; the isUnlocked query then updates reactively.
  const refreshed = React.useRef(false);
  React.useEffect(() => {
    if (refreshed.current || !configured || !signedIn) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('unlocked') === '1') {
      refreshed.current = true;
      refreshLeadUnlock({ jobId: jobId as Id<'jobs'> }).catch(() => {});
    }
  }, [configured, signedIn, jobId, refreshLeadUnlock]);

  // Don't offer "message yourself" on your own posting.
  if (viewer && viewer._id === posterId) return null;

  const feeMinor = leadUnlockFeeMinor(country);
  const market = getMarket(country);
  const feeLabel =
    feeMinor != null
      ? formatMoney(feeMinor, market.currency, locale, market.country)
      : null;

  // Not signed in → send them to sign in first.
  if (configured && viewer === null) {
    return (
      <Button asChild variant={variant} size={size} className={className}>
        <Link href="/auth/sign-in">
          <LogIn className="h-4 w-4" />
          {t('signInToContact')}
        </Link>
      </Button>
    );
  }

  const memberCanUnlock =
    model === 'subscription' && !!membership?.active && membership.remaining > 0;

  // Message composer, shown once the lead is (or can be) unlocked. In
  // subscription markets sending also consumes one membership unlock.
  function messageButton() {
    const submit = async (args: { body: string; locale: string }) => {
      if (!unlock?.unlocked && model === 'subscription') {
        await unlockWithMembership({ jobId: jobId as Id<'jobs'> });
      }
      return startJob({
        jobId: jobId as Id<'jobs'>,
        body: args.body,
        locale: args.locale,
      });
    };
    return (
      <>
        <Button
          variant={variant}
          size={size}
          className={className}
          onClick={() => setOpen(true)}
        >
          <MessageSquare className="h-4 w-4" />
          {t('messageEmployer')}
        </Button>
        {open && (
          <GuestMessageModal
            authenticated
            title={t('messageModalTitle')}
            intro={t('messageModalIntro')}
            submit={submit}
            onClose={() => setOpen(false)}
          />
        )}
      </>
    );
  }

  // Already unlocked, or a member with quota left → straight to the composer.
  if (unlock?.unlocked || memberCanUnlock) return messageButton();

  // Payment in flight (pay-as-you-go) — flips reactively once the webhook lands.
  if (unlock?.pending) {
    return (
      <Button variant={variant} size={size} className={className} disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('unlockPending')}
      </Button>
    );
  }

  // Subscription market, but no active membership (or quota spent) → join.
  if (model === 'subscription') {
    const quotaSpent = !!membership?.active && membership.remaining <= 0;
    return (
      <div className="space-y-1.5">
        <Button asChild variant={variant} size={size} className={className}>
          <Link href={`/membership?country=${market.country}`}>
            <Lock className="h-4 w-4" />
            {t('joinToContact')}
          </Link>
        </Button>
        {quotaSpent && (
          <p className="text-xs text-navy/55">{t('membershipLimit')}</p>
        )}
      </div>
    );
  }

  // Pay-as-you-go market: pay the per-lead unlock fee via hosted checkout.
  async function onUnlock() {
    setError(null);
    setBusy(true);
    try {
      const { link } = await startLeadUnlock({
        jobId: jobId as Id<'jobs'>,
        locale,
      });
      window.location.href = link;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  const loading = !configured || viewer === undefined || unlock === undefined;
  return (
    <div className="space-y-1.5">
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={onUnlock}
        disabled={loading || busy || feeMinor == null}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Lock className="h-4 w-4" />
        )}
        {feeLabel ? t('unlockLead', { fee: feeLabel }) : t('messageEmployer')}
      </Button>
      {error && <p className="text-xs text-red-600">{t('unlockError')}</p>}
    </div>
  );
}
