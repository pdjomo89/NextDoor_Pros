'use client';

import * as React from 'react';
import { useMutation, useQuery } from 'convex/react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Loader2, MessageSquare, Send, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getConvexEnv } from '@/lib/convex-env';
import { api } from '../../convex/_generated/api';
import { cn } from '@/lib/utils';

type Conversation = {
  _id: string;
  contractorId: string;
  role: 'customer' | 'contractor';
  otherName: string;
  lastMessageAt: number;
  lastMessagePreview: string;
  unread: number;
};

type ThreadMessage = {
  _id: string;
  _creationTime: number;
  senderRole: string;
  body: string;
  flagged: boolean;
  mine: boolean;
};

function formatStamp(ts: number) {
  const d = new Date(ts);
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·';
}

export function MessagesClient({
  initialConversationId,
}: {
  initialConversationId: string | null;
}) {
  const t = useTranslations('Messages');
  const configured = getConvexEnv().configured;

  const conversations = useQuery(
    api.messaging.listMyConversations,
    configured ? {} : 'skip',
  ) as Conversation[] | undefined;

  const [selectedId, setSelectedId] = React.useState<string | null>(
    initialConversationId,
  );

  const thread = useQuery(
    api.messaging.listMessages,
    configured && selectedId
      ? { conversationId: selectedId as never }
      : 'skip',
  ) as { myRole: string; messages: ThreadMessage[] } | null | undefined;

  const sendMessage = useMutation(api.messaging.sendMessage);
  const markRead = useMutation(api.messaging.markRead);

  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const selected = conversations?.find((c) => c._id === selectedId) ?? null;
  const msgCount = thread?.messages.length ?? 0;

  // Clear the unread badge whenever the open thread changes or grows.
  React.useEffect(() => {
    if (selectedId) markRead({ conversationId: selectedId as never }).catch(() => {});
  }, [selectedId, msgCount, markRead]);

  // Keep the latest message in view.
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [msgCount, selectedId]);

  async function doSend() {
    const body = draft.trim();
    if (!body || !selectedId || sending) return;
    setSending(true);
    try {
      await sendMessage({ conversationId: selectedId as never, body });
      setDraft('');
    } finally {
      setSending(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void doSend();
  }

  if (!configured) {
    return <p className="text-sm text-navy/60">{t('unavailable')}</p>;
  }

  return (
    <div className="grid h-[70vh] min-h-[460px] grid-cols-1 overflow-hidden rounded-2xl border border-navy/10 bg-white md:grid-cols-[320px_1fr]">
      {/* Conversation list */}
      <aside
        className={cn(
          'flex flex-col border-navy/10 md:border-r',
          selectedId ? 'hidden md:flex' : 'flex',
        )}
      >
        <header className="border-b border-navy/10 px-4 py-3">
          <h2 className="text-sm font-semibold text-navy">{t('inboxTitle')}</h2>
        </header>
        <div className="flex-1 overflow-y-auto">
          {conversations === undefined ? (
            <div className="flex justify-center py-10 text-navy/50">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <MessageSquare className="mx-auto h-8 w-8 text-navy/25" />
              <p className="mt-2 text-sm font-medium text-navy">{t('empty')}</p>
              <p className="mt-1 text-xs text-navy/55">{t('emptyHint')}</p>
            </div>
          ) : (
            <ul>
              {conversations.map((c) => (
                <li key={c._id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c._id)}
                    className={cn(
                      'flex w-full items-center gap-3 border-b border-navy/5 px-4 py-3 text-left transition-colors hover:bg-navy/5',
                      c._id === selectedId && 'bg-forest/10',
                    )}
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forest/15 text-xs font-bold text-forest">
                      {initials(c.otherName)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-navy">
                          {c.otherName}
                        </span>
                        <span className="shrink-0 text-[11px] text-navy/45">
                          {formatStamp(c.lastMessageAt)}
                        </span>
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-navy/55">
                          {c.lastMessagePreview || t('noMessagesYet')}
                        </span>
                        {c.unread > 0 && (
                          <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-forest px-1 text-[10px] font-bold text-white">
                            {c.unread}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-navy/35">
                        {c.role === 'customer' ? t('roleAsCustomer') : t('roleAsPro')}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Thread */}
      <section
        className={cn(
          'flex flex-col',
          selectedId ? 'flex' : 'hidden md:flex',
        )}
      >
        {!selected ? (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-navy/50">
            {t('selectPrompt')}
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-navy/10 px-4 py-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label={t('back')}
                onClick={() => setSelectedId(null)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-forest/15 text-xs font-bold text-forest">
                {initials(selected.otherName)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-navy">
                  {selected.otherName}
                </p>
                <p className="text-[11px] text-navy/50">
                  {selected.role === 'customer'
                    ? t('roleAsCustomer')
                    : t('roleAsPro')}
                </p>
              </div>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto bg-navy/[0.03] px-4 py-4">
              {thread === undefined ? (
                <div className="flex justify-center py-10 text-navy/50">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : thread === null || thread.messages.length === 0 ? (
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

            <form onSubmit={onSubmit} className="border-t border-navy/10 px-4 py-3">
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
          </>
        )}
      </section>
    </div>
  );
}
