export type Region = {
  code: string;
  name: { en: string; fr: string };
};

// Kept as `Province` alias so existing imports and the `province` DB field don't
// need a schema migration — Cameroon's sub-divisions are Regions (shown as such
// in the UI), but internally the field name stays `province`.
export type Province = Region;

export type City = {
  slug: string;
  name: string;
  province: string; // region code
};

/** Cameroon regions that have listed cities. */
export const PROVINCES: Province[] = [
  { code: 'LT', name: { en: 'Littoral', fr: 'Littoral' } },
  { code: 'CE', name: { en: 'Centre', fr: 'Centre' } },
  { code: 'OU', name: { en: 'West', fr: 'Ouest' } },
];

export const CAMEROON_CITIES: City[] = [
  { slug: 'douala', name: 'Douala', province: 'LT' },
  { slug: 'yaounde', name: 'Yaoundé', province: 'CE' },
  { slug: 'bafoussam', name: 'Bafoussam', province: 'OU' },
];

export function getCityBySlug(slug: string): City | undefined {
  return CAMEROON_CITIES.find((c) => c.slug === slug);
}

/** Largest / highest-traffic cities — used to pre-render & sitemap per-city service pages. */
export const FEATURED_CITY_SLUGS = [
  'douala',
  'yaounde',
  'bafoussam',
] as const;

export const FEATURED_CITIES: City[] = FEATURED_CITY_SLUGS.map(
  (slug) => CAMEROON_CITIES.find((c) => c.slug === slug)!,
).filter(Boolean);

/** Other cities in the same region (excluding the given slug), alphabetical. */
export function citiesInProvince(provinceCode: string, excludeSlug?: string): City[] {
  return CAMEROON_CITIES.filter(
    (c) => c.province === provinceCode && c.slug !== excludeSlug,
  ).sort((a, b) => a.name.localeCompare(b.name));
}

export function getProvinceByCode(code: string): Province | undefined {
  return PROVINCES.find((p) => p.code === code);
}

export function citiesGroupedByProvince(): { province: Province; cities: City[] }[] {
  return PROVINCES.map((province) => ({
    province,
    cities: CAMEROON_CITIES.filter((c) => c.province === province.code).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  })).filter((g) => g.cities.length > 0);
}
