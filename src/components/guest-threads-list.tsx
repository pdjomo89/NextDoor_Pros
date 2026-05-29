'use client';

import * as React from 'react';
import { useQuery } from 'convex/react';
import { useTranslations } from 'next-intl';
import { ChevronRight, Loader2, MessageSquare } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { getConvexEnv } from '@/lib/convex-env';
import { readGuestThreads } from '@/lib/guest-threads';
import { api } from '../../convex/_generated/api';

type Summary = {
  token: string;
  otherName: string;
  lastMessagePreview: string;
  lastMessageAt: number;
  unread: number;
};

function formatStamp(ts: number) {
  const d = new Date(ts);
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/**
 * A guest customer's conversations, recovered from this device's localStorage
 * — so they can return to a thread without the emailed private link.
 */
export function GuestThreadsList() {
  const t = useTranslations('Messages');
  const configured = getConvexEnv().configured;

  // null = not yet read from localStorage (SSR-safe).
  const [tokens, setTokens] = React.useState<string[] | null>(null);
  React.useEffect(() => {
    setTokens(readGuestThreads().map((x) => x.token));
  }, []);

  const summaries = useQuery(
    api.messaging.getGuestConversations,
    configured && tokens && tokens.length > 0 ? { tokens } : 'skip',
  ) as Summary[] | undefined;

  const loading =
    tokens === null || (tokens.length > 0 && summaries === undefined);

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex justify-center rounded-2xl border border-navy/10 bg-white py-14 text-navy/50">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !summaries || summaries.length === 0 ? (
        <div className="rounded-2xl border border-navy/10 bg-navy/5 px-6 py-12 text-center">
          <MessageSquare className="mx-auto h-9 w-9 text-navy/30" />
          <p className="mt-3 font-semibold text-navy">{t('guestNoneTitle')}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-navy/60">
            {t('guestNoneBody')}
          </p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-navy/10 bg-white">
          {summaries.map((s) => (
            <li key={s.token}>
              <Link
                href={`/messages/guest?t=${s.token}`}
                className="flex items-center gap-3 border-b border-navy/5 px-4 py-3 transition-colors last:border-b-0 hover:bg-navy/5"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forest/15 text-forest">
                  <MessageSquare className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-navy">
                      {s.otherName}
                    </span>
                    <span className="shrink-0 text-[11px] text-navy/45">
                      {formatStamp(s.lastMessageAt)}
                    </span>
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-navy/55">
                      {s.lastMessagePreview || t('noMessagesYet')}
                    </span>
                    {s.unread > 0 && (
                      <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-forest px-1 text-[10px] font-bold text-white">
                        {s.unread}
                      </span>
                    )}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-navy/30" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="text-center text-xs text-navy/50">
        {t('proInboxHint')}{' '}
        <Link href="/auth/sign-in" className="font-semibold text-forest hover:underline">
          {t('signInCta')}
        </Link>
      </p>
    </div>
  );
}
