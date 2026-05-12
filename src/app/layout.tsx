import type { Metadata } from 'next';
import { SITE_URL, SITE_NAME } from '@/lib/seo';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${SITE_NAME} — Trusted local services across Canada`,
  description: 'Trusted local services across Canada.',
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
