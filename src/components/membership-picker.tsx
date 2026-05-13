'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAction, useQuery } from 'convex/react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { api } from '../../convex/_generated/api';
import type { Locale } from '@/i18n/routing';

export type MembershipLabels = {
  eyebrow: string;
  title: string;
  subtitle: string;
  monthlyName: string;
  monthlyPrice: string;
  monthlyCadence: string;
  monthlyTagline: string;
  annualName: string;
  annualPrice: string;
  annualCadence: string;
  annualTagline: string;
  annualSave: string;
  startMonthly: string;
  startAnnual: string;
  redirecting: string;
  features: string[];
  alreadyActiveTitle: string;
  alreadyActiveBody: string;
  goToDashboard: string;
  noListingTitle: string;
  noListingBody: string;
  createListing: string;
  cancelledNotice: string;
  errorTitle: string;
};

export function MembershipPicker({
  locale,
  cancelled,
  labels: l,
}: {
  locale: Locale;
  cancelled: boolean;
  labels: MembershipLabels;
}) {
  const membership = useQuery(api.membership.myMembership) as
    | { hasContractor: true; status: string; plan: string | null }
    | null
    | undefined;
  const startCheckout = useAction(api.membership.startMembershipCheckout);
  const router = useRouter();

  const [busy, setBusy] = React.useState<'monthly' | 'annual' | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (membership && membership !== null && membership.status === 'active') {
      router.replace(`/${locale}/pros/dashboard`);
    }
  }, [membership, router, locale]);

  async function onPick(plan: 'monthly' | 'annual') {
    setError(null);
    setBusy(plan);
    try {
      const { url } = await startCheckout({ plan, locale });
      window.location.href = url;
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
      setBusy(null);
    }
  }

  if (membership === undefined) {
    return (
      <div className="flex items-center justify-center py-16 text-navy/60">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (membership === null) {
    return (
      <div className="rounded-2xl border border-navy/10 bg-white p-8 text-center">
        <h2 className="text-xl font-semibold text-navy">{l.noListingTitle}</h2>
        <p className="mt-2 text-navy/70">{l.noListingBody}</p>
        <Button asChild variant="secondary" size="lg" className="mt-5">
          <Link href="/pros/onboard">
            {l.createListing}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    );
  }

  if (membership.status === 'active') {
    return (
      <div className="rounded-2xl border border-forest/30 bg-forest/5 p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-forest" />
        <h2 className="mt-3 text-xl font-semibold text-navy">{l.alreadyActiveTitle}</h2>
        <p className="mt-2 text-navy/70">{l.alreadyActiveBody}</p>
        <Button asChild variant="secondary" size="lg" className="mt-5">
          <Link href="/pros/dashboard">{l.goToDashboard}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="text-center">
        <span className="inline-block rounded-full bg-forest/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-forest">
          {l.eyebrow}
        </span>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy">{l.title}</h1>
        <p className="mx-auto mt-2 max-w-xl text-navy/70">{l.subtitle}</p>
      </header>

      {cancelled && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {l.cancelledNotice}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">{l.errorTitle}</p>
            <p className="mt-0.5 text-red-700/80">{error}</p>
          </div>
        </div>
      )}

      <ul className="mt-2 grid gap-3 text-sm text-navy/80">
        {l.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="grid gap-5 md:grid-cols-2">
        <PlanCard
          name={l.monthlyName}
          price={l.monthlyPrice}
          cadence={l.monthlyCadence}
          tagline={l.monthlyTagline}
          cta={busy === 'monthly' ? l.redirecting : l.startMonthly}
          busy={busy === 'monthly'}
          onClick={() => onPick('monthly')}
        />
        <PlanCard
          name={l.annualName}
          price={l.annualPrice}
          cadence={l.annualCadence}
          tagline={l.annualTagline}
          highlight={l.annualSave}
          cta={busy === 'annual' ? l.redirecting : l.startAnnual}
          busy={busy === 'annual'}
          onClick={() => onPick('annual')}
          accent
        />
      </div>
    </div>
  );
}

function PlanCard({
  name,
  price,
  cadence,
  tagline,
  cta,
  busy,
  highlight,
  accent,
  onClick,
}: {
  name: string;
  price: string;
  cadence: string;
  tagline: string;
  cta: string;
  busy: boolean;
  highlight?: string;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <article
      className={
        'flex h-full flex-col rounded-2xl border bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ' +
        (accent ? 'border-forest/40 ring-2 ring-forest/15' : 'border-navy/10')
      }
    >
      {highlight && (
        <span className="mb-3 inline-flex w-fit items-center gap-1 rounded-full bg-forest/10 px-2.5 py-1 text-[11px] font-semibold text-forest">
          <Sparkles className="h-3.5 w-3.5" />
          {highlight}
        </span>
      )}
      <h3 className="text-lg font-semibold text-navy">{name}</h3>
      <p className="mt-1 text-sm text-navy/65">{tagline}</p>
      <p className="mt-4 flex items-baseline gap-1.5">
        <span className="text-4xl font-bold text-navy">{price}</span>
        <span className="text-sm text-navy/60">{cadence}</span>
      </p>
      <Button
        type="button"
        onClick={onClick}
        disabled={busy}
        variant={accent ? 'secondary' : 'primary'}
        size="lg"
        className="mt-6"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {cta}
      </Button>
    </article>
  );
}
