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
 * Contact a job's poster (employer) through platform messaging — no account
 * needed, no phone/email shared. Mirrors ContactProButton but routes to the
 * job thread. Hidden on the poster's own job.
 */
export function ContactEmployerButton({
  jobId,
  posterId,
  variant = 'primary',
  size = 'sm',
  className,
}: {
  jobId: string;
  posterId: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
}) {
  const t = useTranslations('Jobs');
  const configured = getConvexEnv().configured;
  const viewer = useQuery(api.contractors.viewer, configured ? {} : 'skip') as
    | { _id: string }
    | null
    | undefined;
  const startJob = useMutation(api.messaging.startJobConversation);
  const [open, setOpen] = React.useState(false);

  // Don't offer "message yourself" on your own posting.
  if (viewer && viewer._id === posterId) return null;

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
        {t('messageEmployer')}
      </Button>
      {open && (
        <GuestMessageModal
          title={t('messageModalTitle')}
          intro={t('messageModalIntro')}
          submit={({ email, name, body, locale }) =>
            startJob({ jobId: jobId as never, email, name, body, locale })
          }
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
