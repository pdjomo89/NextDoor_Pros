'use client';

import * as React from 'react';
import { useMutation, useQuery } from 'convex/react';
import { MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { getConvexEnv } from '@/lib/convex-env';
import { GuestMessageModal } from '@/components/guest-message-modal';
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
  const startGuest = useMutation(api.messaging.startGuestConversation);
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
        <GuestMessageModal
          title={t('modalTitle')}
          intro={t('modalIntro')}
          submit={({ email, name, body, locale }) =>
            startGuest({
              contractorId: contractorId as never,
              email: email ?? '',
              name,
              body,
              locale,
            })
          }
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
