'use client';

import * as React from 'react';
import { useMutation, useQuery } from 'convex/react';
import { MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { getConvexEnv } from '@/lib/convex-env';
import { api } from '../../convex/_generated/api';
import type { ButtonProps } from '@/components/ui/button';

/**
 * The single entry point for contacting a pro. Customers never see a phone
 * number or email — clicking this opens (or re-opens) an in-app conversation.
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
  const router = useRouter();
  const configured = getConvexEnv().configured;
  const viewer = useQuery(api.contractors.viewer, configured ? {} : 'skip') as
    | { _id: string }
    | null
    | undefined;
  const start = useMutation(api.messaging.startConversation);
  const [busy, setBusy] = React.useState(false);

  // Don't offer "message yourself" on your own listing.
  if (viewer && viewer._id === ownerId) return null;

  async function onClick() {
    if (!viewer) {
      router.push('/auth/sign-in');
      return;
    }
    setBusy(true);
    try {
      const id = await start({ contractorId: contractorId as never });
      router.push(`/messages?c=${id}`);
    } catch {
      setBusy(false);
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={onClick}
      disabled={busy || viewer === undefined}
    >
      <MessageSquare className="h-4 w-4" />
      {busy ? t('opening') : t('contactButton')}
    </Button>
  );
}
