'use client';

import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuthActions } from '@convex-dev/auth/react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SignOutButton() {
  const t = useTranslations('Auth');
  const { signOut } = useAuthActions();
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) ?? 'en';

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={async () => {
        await signOut();
        router.push(`/${locale}`);
        router.refresh();
      }}
    >
      <LogOut className="h-4 w-4" />
      {t('signOut')}
    </Button>
  );
}
