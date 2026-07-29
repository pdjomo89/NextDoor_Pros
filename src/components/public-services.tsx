'use client';

import { useQuery } from 'convex/react';
import { Loader2, Tag } from 'lucide-react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { Locale } from '@/i18n/routing';
import { formatMoney } from '@/lib/currency';
import { regionForCurrency } from '@/lib/markets';

export type PublicServicesLabels = {
  sectionTitle: string;
  sectionIntro: string;
};

type ServiceRow = {
  _id: Id<'contractorServices'>;
  title: string;
  description?: string;
  priceCents: number;
  currency: string;
};

function formatPrice(amount: number, currency: string, locale: Locale) {
  const cur = currency.toUpperCase();
  return formatMoney(amount, cur, locale, regionForCurrency(cur));
}

/**
 * Read-only price list for a contractor's public profile. Shows the pro's
 * services as information only — customers reach out via the contact button
 * to arrange the work; there is no online payment.
 */
export function PublicServices({
  contractorId,
  locale,
  labels: l,
}: {
  contractorId: Id<'contractors'>;
  locale: Locale;
  labels: PublicServicesLabels;
}) {
  const services = useQuery(api.payments.listPublicServices, { contractorId }) as
    | ServiceRow[]
    | undefined;

  if (services === undefined) {
    return (
      <section className="mt-6 rounded-2xl border border-navy/10 bg-gradient-to-br from-navy-100 via-white to-forest-100 p-6">
        <div className="flex items-center justify-center py-4 text-navy/60">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </section>
    );
  }
  if (services.length === 0) return null;

  return (
    <section className="mt-6 rounded-2xl border border-forest/30 bg-gradient-to-br from-forest/[0.04] to-white p-6">
      <header className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-forest/10 text-forest">
          <Tag className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-navy">{l.sectionTitle}</h2>
          <p className="mt-0.5 text-sm text-navy/70">{l.sectionIntro}</p>
        </div>
      </header>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {services.map((s) => (
          <li
            key={s._id}
            className="flex h-full flex-col gap-3 rounded-xl border border-navy/10 bg-gradient-to-br from-navy-100 via-white to-forest-100 p-4"
          >
            <div className="flex-1">
              <h3 className="font-semibold text-navy">{s.title}</h3>
              {s.description && (
                <p className="mt-1 text-sm text-navy/70">{s.description}</p>
              )}
            </div>
            <span className="text-lg font-bold text-forest">
              {formatPrice(s.priceCents, s.currency, locale)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
