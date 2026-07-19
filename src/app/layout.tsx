import type { Metadata } from 'next';
import { SITE_URL, SITE_NAME } from '@/lib/seo';
import { DEFAULT_MARKET } from '@/lib/markets';
import './globals.css';

// Root-layout metadata is not locale-scoped, so it uses the default market's
// default language. Per-market / per-locale copy is refined in later phases.
const marketName = DEFAULT_MARKET.name[DEFAULT_MARKET.defaultLocale];

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${SITE_NAME} — Trusted local services across ${marketName}`,
  description: `Trusted local services across ${marketName}.`,
  applicationName: SITE_NAME,
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
