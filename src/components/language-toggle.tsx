'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Globe } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Locale } from '@/i18n/routing';

export function LanguageToggle() {
  const t = useTranslations('Nav');
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const currentLocale = params.locale as Locale;

  const switchTo = (locale: Locale) => {
    router.replace(pathname, { locale });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2" aria-label={t('language')}>
          <Globe className="h-4 w-4" />
          <span className="font-semibold uppercase">{currentLocale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => switchTo('en')}>
          <span className="flex-1">{t('english')}</span>
          {currentLocale === 'en' && <span className="text-forest">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => switchTo('fr')}>
          <span className="flex-1">{t('french')}</span>
          {currentLocale === 'fr' && <span className="text-forest">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
