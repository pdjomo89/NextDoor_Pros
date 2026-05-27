'use client';

import * as React from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useQuery } from 'convex/react';
import { Menu, X, LogIn, Briefcase, MessageSquare } from 'lucide-react';
import { Link, usePathname } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { CityPicker } from '@/components/city-picker';
import { LanguageToggle } from '@/components/language-toggle';
import { getConvexEnv } from '@/lib/convex-env';
import { readGuestThreads } from '@/lib/guest-threads';
import { api } from '../../convex/_generated/api';
import type { Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

/** Messages link with a live unread-count badge. Rendered only when signed in. */
function InboxLink({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const t = useTranslations('Nav');
  const configured = getConvexEnv().configured;
  const count = useQuery(
    api.messaging.unreadCount,
    configured ? {} : 'skip',
  ) as number | undefined;
  const badge = count && count > 0 ? (count > 9 ? '9+' : String(count)) : null;

  return (
    <Link
      href="/messages"
      onClick={onNavigate}
      className={cn(
        'relative inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-navy/80 transition-colors hover:bg-navy/5 hover:text-navy',
        className,
      )}
    >
      <MessageSquare className="h-4 w-4" />
      {t('messages')}
      {badge && (
        <span className="grid h-4 min-w-4 place-items-center rounded-full bg-forest px-1 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

const NAV_ITEMS = [
  { href: '/services', key: 'services' },
  { href: '/jobs', key: 'jobs' },
  { href: '/pricing', key: 'pricing' },
  { href: '/about', key: 'about' },
  { href: '/partners', key: 'partners' },
  { href: '/news', key: 'news' },
  { href: '/contact', key: 'contact' },
] as const;

/** Messages link for signed-out visitors who have guest conversations saved
 *  on this device. Renders nothing otherwise. */
function GuestInboxLink({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const t = useTranslations('Nav');
  const [hasThreads, setHasThreads] = React.useState(false);
  React.useEffect(() => {
    setHasThreads(readGuestThreads().length > 0);
  }, []);
  if (!hasThreads) return null;

  return (
    <Link
      href="/messages"
      onClick={onNavigate}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-navy/80 transition-colors hover:bg-navy/5 hover:text-navy',
        className,
      )}
    >
      <MessageSquare className="h-4 w-4" />
      {t('messages')}
    </Link>
  );
}

export function SiteHeader({
  locale,
  signedIn = false,
}: {
  locale: Locale;
  signedIn?: boolean;
}) {
  const t = useTranslations('Nav');
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-navy/10 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center" aria-label={t('brand')}>
            <Image
              src="/logo.png"
              alt={t('brand')}
              width={1254}
              height={1254}
              priority
              className="h-12 w-12 sm:h-14 sm:w-14"
            />
            <span className="sr-only">{t('brand')}</span>
          </Link>
          <LanguageToggle />
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-forest/10 text-forest'
                    : 'text-navy/80 hover:bg-navy/5 hover:text-navy',
                )}
              >
                {t(item.key)}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <CityPicker locale={locale} />
          {signedIn ? (
            <>
              <InboxLink />
              <Button asChild variant="primary" size="sm">
                <Link href="/pros/dashboard">
                  <Briefcase className="h-4 w-4" />
                  {t('dashboard')}
                </Link>
              </Button>
            </>
          ) : (
            <>
              <GuestInboxLink />
              <Button asChild variant="ghost" size="sm">
                <Link href="/auth/sign-in">
                  <LogIn className="h-4 w-4" />
                  {t('signIn')}
                </Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link href="/auth/sign-up">{t('becomePro')}</Link>
              </Button>
            </>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={mobileOpen ? t('closeMenu') : t('openMenu')}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {mobileOpen && (
        <div className="border-t border-navy/10 bg-white md:hidden">
          <div className="container flex flex-col gap-3 py-4">
            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'rounded-md px-3 py-2 text-sm font-medium',
                      active
                        ? 'bg-forest/10 text-forest'
                        : 'text-navy/80 hover:bg-navy/5 hover:text-navy',
                    )}
                  >
                    {t(item.key)}
                  </Link>
                );
              })}
            </nav>
            <div className="flex flex-wrap items-center gap-2">
              <CityPicker locale={locale} />
            </div>
            <div className="flex flex-wrap gap-2">
              {signedIn ? (
                <>
                  <InboxLink
                    className="flex-1 border border-navy/15"
                    onNavigate={() => setMobileOpen(false)}
                  />
                  <Button asChild variant="primary" size="sm" className="flex-1">
                    <Link href="/pros/dashboard" onClick={() => setMobileOpen(false)}>
                      <Briefcase className="h-4 w-4" />
                      {t('dashboard')}
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <GuestInboxLink
                    className="flex-1 border border-navy/15"
                    onNavigate={() => setMobileOpen(false)}
                  />
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href="/auth/sign-in" onClick={() => setMobileOpen(false)}>
                      {t('signIn')}
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" size="sm" className="flex-1">
                    <Link href="/auth/sign-up" onClick={() => setMobileOpen(false)}>
                      {t('becomePro')}
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
