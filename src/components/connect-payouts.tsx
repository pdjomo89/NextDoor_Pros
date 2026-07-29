'use client';

import * as React from 'react';
import { useAction, useQuery } from 'convex/react';
import { Banknote, CheckCircle2, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { getConvexEnv } from '@/lib/convex-env';
import { monetizationModel } from '@/lib/markets';
import { api } from '../../convex/_generated/api';

/**
 * Pro payout onboarding (Stripe Connect). Lets a pro set up where the platform
 * sends their job earnings. Only shown in markets whose job payments run through
 * the platform (subscription markets, e.g. Canada).
 */
export function ConnectPayouts({ country }: { country?: string }) {
  const t = useTranslations('Payouts');
  const locale = useLocale();
  const configured = getConvexEnv().configured;
  const isSubscription = monetizationModel(country) === 'subscription';

  const status = useQuery(
    api.connect.myConnectStatus,
    configured && isSubscription ? {} : 'skip',
  );
  const start = useAction(api.connect.createOnboardingLink);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onStart() {
    setError(null);
    setBusy(true);
    try {
      const { url } = await start({ locale });
      window.location.href = url; // Stripe-hosted onboarding
    } catch {
      setError(t('error'));
      setBusy(false);
    }
  }

  // Payg markets (Cameroon) don't collect job payments through the platform yet.
  if (!isSubscription) return null;

  const payoutsReady = status?.payoutsEnabled;
  const started = status?.hasAccount && !status?.payoutsEnabled;

  return (
    <article className="space-y-3 rounded-2xl border border-navy/10 bg-gradient-to-br from-navy-100 via-white to-forest-100 p-6">
      <header>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-navy">
          <Banknote className="h-5 w-5 text-forest" />
          {t('title')}
        </h2>
        <p className="mt-1 text-sm text-navy/60">{t('intro')}</p>
      </header>

      {payoutsReady ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-forest/10 px-2.5 py-1 text-xs font-medium text-forest">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {t('active')}
        </span>
      ) : (
        <Button variant="secondary" size="sm" onClick={onStart} disabled={busy}>
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Banknote className="h-4 w-4" />
          )}
          {busy ? t('opening') : started ? t('finish') : t('setup')}
        </Button>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </article>
  );
}
