// ──────────────────────────────────────────────────────────────────────────
// Geography (frontend) — a typed wrapper over the single source of truth in
// convex/geo.ts. Region/city DATA lives there (so the backend can't drift);
// this module adds the CountryCode typing and the UI helper functions.
//
// Each city belongs to a country; a listing/job's country is derived from its
// city (see `countryOfCity`). City slugs and region codes are globally unique.
// ──────────────────────────────────────────────────────────────────────────

import {
  GEO_CITIES,
  GEO_REGIONS,
  countryOfCity as geoCountryOfCity,
} from '../../convex/geo';
import { DEFAULT_COUNTRY, type CountryCode } from '@/lib/markets';

export type Region = {
  code: string;
  name: { en: string; fr: string };
  country: CountryCode;
};

// `Province` alias kept so existing imports and the `province` DB field don't
// need a migration — sub-divisions are Regions (Cameroon) or Provinces
// (Canada), but the internal field name stays `province`.
export type Province = Region;

export type City = {
  slug: string;
  name: string;
  province: string; // region code
  country: CountryCode;
};

/** All regions across all countries (typed view of the shared data). */
export const REGIONS = GEO_REGIONS as Region[];

/** Back-compat alias — prefer REGIONS / regionsForCountry. */
export const PROVINCES: Province[] = REGIONS;

/** Every city across all countries (typed view of the shared data). */
export const ALL_CITIES = GEO_CITIES as City[];

export function getCityBySlug(slug: string): City | undefined {
  return ALL_CITIES.find((c) => c.slug === slug);
}

/**
 * Country a city belongs to — the source of a listing/job's country. Unknown
 * slugs fall back to the default market so legacy rows still resolve.
 */
export function countryOfCity(slug: string | undefined | null): CountryCode {
  return geoCountryOfCity(slug) as CountryCode;
}

/** Cities in a given country. */
export function citiesForCountry(country: CountryCode): City[] {
  return ALL_CITIES.filter((c) => c.country === country);
}

/** Regions in a given country. */
export function regionsForCountry(country: CountryCode): Region[] {
  return REGIONS.filter((r) => r.country === country);
}

/**
 * Largest / highest-traffic cities — used to pre-render & sitemap per-city
 * service pages. Canada's biggest metros, with a spread across provinces so the
 * long-tail pages in each region have a prerendered neighbour to link from.
 */
export const FEATURED_CITY_SLUGS = [
  'toronto',
  'montreal',
  'vancouver',
  'calgary',
  'edmonton',
  'ottawa',
  'winnipeg',
  'quebec-city',
  'hamilton',
  'mississauga',
  'halifax',
  'surrey',
] as const;

export const FEATURED_CITIES: City[] = FEATURED_CITY_SLUGS.map(
  (slug) => ALL_CITIES.find((c) => c.slug === slug)!,
).filter(Boolean);

/** Other cities in the same region (excluding the given slug), alphabetical. */
export function citiesInProvince(provinceCode: string, excludeSlug?: string): City[] {
  return ALL_CITIES.filter(
    (c) => c.province === provinceCode && c.slug !== excludeSlug,
  ).sort((a, b) => a.name.localeCompare(b.name));
}

export function getProvinceByCode(code: string): Province | undefined {
  return REGIONS.find((p) => p.code === code);
}

/** Regions (with their cities) for one country, for pickers. Empty regions dropped. */
export function citiesGroupedByProvince(
  country: CountryCode,
): { province: Province; cities: City[] }[] {
  return regionsForCountry(country)
    .map((province) => ({
      province,
      cities: ALL_CITIES.filter((c) => c.province === province.code).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    }))
    .filter((g) => g.cities.length > 0);
}
