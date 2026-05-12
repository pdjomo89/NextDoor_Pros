import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { ConvexAuthNextjsServerProvider } from '@convex-dev/auth/nextjs/server';
import { routing } from '@/i18n/routing';
import { CityProvider } from '@/components/city-picker-context';
import { ConvexClientProvider } from '@/components/convex-provider';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { WhatsAppButton } from '@/components/whatsapp-button';
import { getViewer } from '@/lib/contractors';
import { SITE_URL, SITE_NAME, buildAlternates, JsonLd } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Meta' });
  const title = t('title');
  const description = t('description');
  return {
    title: { default: title, template: `%s · ${SITE_NAME}` },
    description,
    keywords: [
      'local services',
      'home services Canada',
      'find a contractor',
      'hire a pro',
      'cleaning',
      'handyman',
      'painting',
      'moving',
      'catering',
      'NextDoor Pros',
    ],
    alternates: buildAlternates(locale as Locale, ''),
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: locale === 'fr' ? 'fr_CA' : 'en_CA',
      url: `${SITE_URL}/${locale}`,
      title,
      description,
      images: [`${SITE_URL}/logo.png`],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${SITE_URL}/logo.png`],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const meta = await getTranslations({ locale, namespace: 'Meta' });
  const viewer = await getViewer();
  const signedIn = Boolean(viewer);

  const orgLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: `${SITE_URL}/${locale}`,
    logo: `${SITE_URL}/logo.png`,
    description: meta('description'),
    email: 'hello@nextdoorpros.ca',
    areaServed: { '@type': 'Country', name: 'Canada' },
  };
  const siteLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: locale === 'fr' ? 'fr-CA' : 'en-CA',
  };

  return (
    <ConvexAuthNextjsServerProvider>
      <html lang={locale}>
        <body className="min-h-screen bg-background font-sans antialiased">
          <JsonLd data={[orgLd, siteLd]} />
          <ConvexClientProvider>
            <NextIntlClientProvider messages={messages}>
              <CityProvider>
                <div className="flex min-h-screen flex-col">
                  <SiteHeader locale={locale as Locale} signedIn={signedIn} />
                  <main className="flex-1">{children}</main>
                  <SiteFooter />
                </div>
                <WhatsAppButton />
              </CityProvider>
            </NextIntlClientProvider>
          </ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
