'use client';

import * as React from 'react';
import { useMutation, useQuery } from 'convex/react';
import { useTranslations } from 'next-intl';
import { Check, Copy, Link2, Loader2, MessageSquare, Send, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getConvexEnv } from '@/lib/convex-env';
import { rememberGuestThread } from '@/lib/guest-threads';
import { api } from '../../convex/_generated/api';
import { cn } from '@/lib/utils';

type GuestThread = {
  otherName: string;
  customerName: string | null;
  unread: number;
  messages: Array<{
    _id: string;
    _creationTime: number;
    senderRole: string;
    body: string;
    flagged: boolean;
    mine: boolean;
  }>;
};

function formatStamp(ts: number) {
  const d = new Date(ts);
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/**
 * The customer's view of one conversation, authorized purely by the secret
 * `token` from their private link — no account needed.
 */
export function GuestConversationClient({ token }: { token: string }) {
  const t = useTranslations('Messages');
  const configured = getConvexEnv().configured;

  const thread = useQuery(
    api.messaging.getGuestConversation,
    configured && token ? { token } : 'skip',
  ) as GuestThread | null | undefined;

  const sendGuest = useMutation(api.messaging.sendGuestMessage);
  const markRead = useMutation(api.messaging.markGuestRead);

  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  // The current page URL *is* the private link. Read it after mount so the
  // component stays SSR-safe.
  const [href, setHref] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => {
    setHref(window.location.href);
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(href || window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable — the link is still visible to copy manually.
    }
  }

  const msgCount = thread?.messages.length ?? 0;

  React.useEffect(() => {
    if (token && thread) markRead({ token }).catch(() => {});
  }, [token, thread, msgCount, markRead]);

  // Persist a valid thread to this device so it shows in "your conversations".
  React.useEffect(() => {
    if (token && thread) rememberGuestThread(token);
  }, [token, thread]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [msgCount]);

  async function doSend() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await sendGuest({ token, body });
      setDraft('');
    } finally {
      setSending(false);
    }
  }

  if (!configured || !token) {
    return <InvalidLink message={t('invalidLink')} />;
  }
  if (thread === undefined) {
    return (
      <div className="flex justify-center rounded-2xl border border-navy/10 bg-white py-16 text-navy/50">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (thread === null) {
    return <InvalidLink message={t('invalidLink')} />;
  }

  return (
    <div className="flex h-[70vh] min-h-[460px] flex-col overflow-hidden rounded-2xl border border-navy/10 bg-white">
      <header className="flex items-center gap-3 border-b border-navy/10 px-4 py-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-forest/15 text-forest">
          <MessageSquare className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-navy">
            {t('threadWith', { name: thread.otherName })}
          </p>
          <p className="text-[11px] text-navy/50">{t('guestLinkNotice')}</p>
        </div>
      </header>

      {/* Private-link bar — lets the customer save their way back in. */}
      <div className="flex items-center gap-3 border-b border-forest/20 bg-forest/[0.06] px-4 py-2.5">
        <Link2 className="h-4 w-4 shrink-0 text-forest" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-navy/75">
            {t('saveLinkBody')}
          </p>
          <p className="truncate font-mono text-[11px] text-navy/45">
            {href || '…'}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={copyLink}
          className="shrink-0"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-forest" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? t('copied') : t('copyLink')}
        </Button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-navy/[0.03] px-4 py-4">
        {thread.messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-navy/50">
            {t('threadEmpty')}
          </p>
        ) : (
          thread.messages.map((m) => (
            <div
              key={m._id}
              className={cn('flex', m.mine ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm',
                  m.mine
                    ? 'rounded-br-sm bg-navy text-white'
                    : 'rounded-bl-sm bg-white text-navy ring-1 ring-navy/10',
                )}
              >
                <p className="whitespace-pre-line break-words">{m.body}</p>
                <span
                  className={cn(
                    'mt-1 block text-[10px]',
                    m.mine ? 'text-white/55' : 'text-navy/40',
                  )}
                >
                  {formatStamp(m._creationTime)}
                  {m.flagged && ` · ${t('flaggedNote')}`}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void doSend();
        }}
        className="border-t border-navy/10 px-4 py-3"
      >
        <p className="mb-2 flex items-center gap-1.5 text-[11px] text-navy/50">
          <ShieldCheck className="h-3.5 w-3.5 text-forest" />
          {t('redactionNotice')}
        </p>
        <div className="flex items-end gap-2">
          <textarea
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void doSend();
              }
            }}
            maxLength={2000}
            placeholder={t('composerPlaceholder')}
            className="max-h-32 min-h-[40px] flex-1 resize-y rounded-md border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-forest focus:ring-2 focus:ring-forest/20"
          />
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={sending || draft.trim() === ''}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {t('send')}
          </Button>
        </div>
      </form>
    </div>
  );
}

function InvalidLink({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-navy/10 bg-navy/5 px-6 py-12 text-center">
      <MessageSquare className="mx-auto h-9 w-9 text-navy/30" />
      <p className="mt-3 max-w-sm text-sm text-navy/60">{message}</p>
    </div>
  );
}
