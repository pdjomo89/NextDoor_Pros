'use client';

import * as React from 'react';
import { useMutation, useQuery } from 'convex/react';
import { AlertTriangle, Loader2, MessageSquare, Send, ShieldCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { getConvexEnv } from '@/lib/convex-env';
import { api } from '../../convex/_generated/api';
import type { ButtonProps } from '@/components/ui/button';

/**
 * The single entry point for contacting a pro. Opens a guest inquiry modal —
 * no account or sign-in needed. Customers never see a phone number or email;
 * the pro replies in-app and the customer gets a private link by email.
 * Hidden on the pro's own listing.
 */
export function ContactProButton({
  contractorId,
  ownerId,
  variant = 'primary',
  size = 'sm',
  className,
}: {
  contractorId: string;
  ownerId: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
}) {
  const t = useTranslations('Messages');
  const configured = getConvexEnv().configured;
  const viewer = useQuery(api.contractors.viewer, configured ? {} : 'skip') as
    | { _id: string }
    | null
    | undefined;
  const [open, setOpen] = React.useState(false);

  // Don't offer "message yourself" on your own listing.
  if (viewer && viewer._id === ownerId) return null;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
        disabled={!configured}
      >
        <MessageSquare className="h-4 w-4" />
        {t('contactButton')}
      </Button>
      {open && (
        <ContactProModal
          contractorId={contractorId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ContactProModal({
  contractorId,
  onClose,
}: {
  contractorId: string;
  onClose: () => void;
}) {
  const t = useTranslations('Messages');
  const locale = useLocale();
  const router = useRouter();
  const startGuest = useMutation(api.messaging.startGuestConversation);

  const [email, setEmail] = React.useState('');
  const [name, setName] = React.useState('');
  const [body, setBody] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, busy]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (email.trim() === '' || body.trim() === '') return;
    setBusy(true);
    try {
      const { guestToken } = await startGuest({
        contractorId: contractorId as never,
        email: email.trim(),
        name: name.trim() || undefined,
        body: body.trim(),
        locale,
      });
      router.push(`/messages/guest?t=${guestToken}`);
    } catch (err) {
      const code = err instanceof Error ? err.message : String(err);
      setError(code.includes('INVALID_EMAIL') ? t('errEmail') : t('errGeneric'));
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-navy/40 px-4 backdrop-blur-sm"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl"
      >
        <header>
          <h3 className="text-lg font-semibold text-navy">{t('modalTitle')}</h3>
          <p className="mt-1 text-sm text-navy/70">{t('modalIntro')}</p>
        </header>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-navy/55">
            {t('emailLabel')}
          </span>
          <input
            required
            type="email"
            value={email}
            autoComplete="email"
            placeholder={t('emailPlaceholder')}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            className="form-input-msg"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-navy/55">
            {t('nameLabel')}
          </span>
          <input
            type="text"
            value={name}
            autoComplete="name"
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            className="form-input-msg"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-navy/55">
            {t('messageLabel')}
          </span>
          <textarea
            required
            value={body}
            rows={4}
            maxLength={2000}
            placeholder={t('composerPlaceholder')}
            onChange={(e) => setBody(e.target.value)}
            disabled={busy}
            className="form-input-msg resize-y"
          />
        </label>

        <p className="flex items-start gap-1.5 text-[11px] text-navy/55">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest" />
          {t('redactionNotice')}
        </p>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={busy}
          >
            {t('cancel')}
          </Button>
          <Button type="submit" variant="secondary" size="sm" disabled={busy}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {busy ? t('sending') : t('sendInquiry')}
          </Button>
        </div>

        <style jsx>{`
          :global(.form-input-msg) {
            width: 100%;
            border-radius: 0.5rem;
            border: 1px solid hsl(215 20% 88%);
            background: white;
            padding: 0.5rem 0.75rem;
            font-size: 0.875rem;
            color: hsl(215 60% 12%);
            outline: none;
            transition: border-color 0.15s, box-shadow 0.15s;
          }
          :global(.form-input-msg:focus) {
            border-color: #1f8a3b;
            box-shadow: 0 0 0 3px rgba(31, 138, 59, 0.15);
          }
        `}</style>
      </form>
    </div>
  );
}
