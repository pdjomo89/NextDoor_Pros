import type { Metadata } from 'next';
import { routing, type Locale } from '@/i18n/routing';

/** Production origin. Override with NEXT_PUBLIC_SITE_URL (no trailing slash). */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://mynextdoorpros.com'
).replace(/\/$/, '');

export const SITE_NAME = 'NextDoor Pros';

const OG_IMAGE = `${SITE_URL}/logo.png`;

/** Build the absolute URL for a path on a given locale, e.g. localePath('en', '/services') -> '/en/services'. */
export function localePath(locale: string, path = '') {
  const clean = path === '/' ? '' : path.replace(/^\//, '/').replace(/\/$/, '');
  return `/${locale}${clean}`;
}

/** `alternates` block: canonical for this locale + hreflang links for every locale. */
export function buildAlternates(locale: Locale, path = ''): Metadata['alternates'] {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = localePath(l, path);
  languages['x-default'] = localePath(routing.defaultLocale, path);
  return { canonical: localePath(locale, path), languages };
}

/**
 * Standard page metadata: title, description, canonical + hreflang, Open Graph and Twitter cards.
 * `title` is the page-specific part; the locale layout adds the "· NextDoor Pros" suffix via its template.
 */
export function pageMetadata(args: {
  locale: Locale;
  path?: string;
  title: string;
  description: string;
  /** Pass false for pages that shouldn't be indexed (auth, dashboard, etc.). */
  index?: boolean;
  images?: string[];
}): Metadata {
  const { locale, path = '', title, description, index = true, images = [OG_IMAGE] } = args;
  const url = `${SITE_URL}${localePath(locale, path)}`;
  return {
    title,
    description,
    alternates: buildAlternates(locale, path),
    robots: index ? undefined : { index: false, follow: true },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: locale === 'fr' ? 'fr_CA' : 'en_CA',
      url,
      title: `${title} · ${SITE_NAME}`,
      description,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} · ${SITE_NAME}`,
      description,
      images,
    },
  };
}

/** Renders a JSON-LD <script>. Use inside server components. */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
