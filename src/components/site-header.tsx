'use client';

import * as React from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Menu, X, LogIn, Briefcase } from 'lucide-react';
import { Link, usePathname } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { CityPicker } from '@/components/city-picker';
import { LanguageToggle } from '@/components/language-toggle';
import type { Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/services', key: 'services' },
  { href: '/jobs', key: 'jobs' },
  { href: '/pricing', key: 'pricing' },
  { href: '/about', key: 'about' },
  { href: '/partners', key: 'partners' },
  { href: '/news', key: 'news' },
  { href: '/contact', key: 'contact' },
] as const;

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
          <LanguageToggle />
          {signedIn ? (
            <Button asChild variant="primary" size="sm">
              <Link href="/pros/dashboard">
                <Briefcase className="h-4 w-4" />
                {t('dashboard')}
              </Link>
            </Button>
          ) : (
            <>
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
              <LanguageToggle />
            </div>
            <div className="flex flex-wrap gap-2">
              {signedIn ? (
                <Button asChild variant="primary" size="sm" className="flex-1">
                  <Link href="/pros/dashboard" onClick={() => setMobileOpen(false)}>
                    <Briefcase className="h-4 w-4" />
                    {t('dashboard')}
                  </Link>
                </Button>
              ) : (
                <>
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
