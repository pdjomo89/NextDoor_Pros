import type { MetadataRoute } from 'next';
import { fetchQuery } from 'convex/nextjs';
import { routing } from '@/i18n/routing';
import { SITE_URL, localePath } from '@/lib/seo';
import { SERVICE_CATEGORIES } from '@/lib/services';
import { FEATURED_CITY_SLUGS } from '@/data/canadian-cities';
import { getConvexEnv } from '@/lib/convex-env';
import { api } from '../../convex/_generated/api';

const STATIC_PATHS = ['', '/services', '/jobs', '/pricing', '/about', '/news', '/contact'];

function entry(path: string, opts: Partial<MetadataRoute.Sitemap[number]> = {}): MetadataRoute.Sitemap {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = `${SITE_URL}${localePath(l, path)}`;
  return routing.locales.map((locale) => ({
    url: `${SITE_URL}${localePath(locale, path)}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
    alternates: { languages },
    ...opts,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  for (const path of STATIC_PATHS) {
    entries.push(
      ...entry(path, {
        priority: path === '' ? 1 : 0.6,
        changeFrequency: path === '/jobs' || path === '/news' ? 'daily' : 'weekly',
      }),
    );
  }
  for (const c of SERVICE_CATEGORIES) {
    entries.push(...entry(`/services/${c.slug}`, { priority: 0.8 }));
    for (const city of FEATURED_CITY_SLUGS) {
      entries.push(...entry(`/services/${c.slug}/${city}`, { priority: 0.7 }));
    }
  }

  // Published contractor profiles (best-effort — skip if the backend is unreachable).
  if (getConvexEnv().configured) {
    try {
      const pros = (await fetchQuery(api.contractors.publishedIds, {})) as {
        id: string;
        updatedAt: number;
      }[];
      for (const p of pros) {
        entries.push(
          ...entry(`/pros/${p.id}`, {
            priority: 0.5,
            lastModified: new Date(p.updatedAt),
          }),
        );
      }
    } catch {
      // ignore — sitemap still valid without profile URLs
    }
  }

  return entries;
}
