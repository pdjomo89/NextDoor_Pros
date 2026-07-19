// ──────────────────────────────────────────────────────────────────────────
// Geography data — SINGLE SOURCE OF TRUTH (regions + cities, per country).
//
// Lives under convex/ so the backend can bundle it, and is imported by the
// frontend too (src/data/geography.ts wraps it with UI types/helpers). This is
// the one place city→country lives, so the two sides can never drift.
//
// Self-contained: no imports from src/ or Convex server APIs. `country` is a
// plain string here; the frontend narrows it to its CountryCode union.
//
// Invariants: city slugs and region codes are GLOBALLY unique across countries.
// ──────────────────────────────────────────────────────────────────────────

export type GeoRegion = {
  code: string;
  name: { en: string; fr: string };
  country: string;
};

export type GeoCity = {
  slug: string;
  name: string;
  province: string; // region code
  country: string;
};

/** Fallback market for unknown/legacy city slugs. Mirrors DEFAULT_COUNTRY. */
export const DEFAULT_COUNTRY = 'CM';

export const GEO_REGIONS: GeoRegion[] = [
  // ── Cameroon ──
  { code: 'LT', name: { en: 'Littoral', fr: 'Littoral' }, country: 'CM' },
  { code: 'CE', name: { en: 'Centre', fr: 'Centre' }, country: 'CM' },
  { code: 'OU', name: { en: 'West', fr: 'Ouest' }, country: 'CM' },
  // ── Canada — all 13 provinces & territories (ISO 3166-2:CA) ──
  { code: 'AB', name: { en: 'Alberta', fr: 'Alberta' }, country: 'CA' },
  { code: 'BC', name: { en: 'British Columbia', fr: 'Colombie-Britannique' }, country: 'CA' },
  { code: 'MB', name: { en: 'Manitoba', fr: 'Manitoba' }, country: 'CA' },
  { code: 'NB', name: { en: 'New Brunswick', fr: 'Nouveau-Brunswick' }, country: 'CA' },
  { code: 'NL', name: { en: 'Newfoundland and Labrador', fr: 'Terre-Neuve-et-Labrador' }, country: 'CA' },
  { code: 'NS', name: { en: 'Nova Scotia', fr: 'Nouvelle-Écosse' }, country: 'CA' },
  { code: 'NT', name: { en: 'Northwest Territories', fr: 'Territoires du Nord-Ouest' }, country: 'CA' },
  { code: 'NU', name: { en: 'Nunavut', fr: 'Nunavut' }, country: 'CA' },
  { code: 'ON', name: { en: 'Ontario', fr: 'Ontario' }, country: 'CA' },
  { code: 'PE', name: { en: 'Prince Edward Island', fr: 'Île-du-Prince-Édouard' }, country: 'CA' },
  { code: 'QC', name: { en: 'Quebec', fr: 'Québec' }, country: 'CA' },
  { code: 'SK', name: { en: 'Saskatchewan', fr: 'Saskatchewan' }, country: 'CA' },
  { code: 'YT', name: { en: 'Yukon', fr: 'Yukon' }, country: 'CA' },
];

export const GEO_CITIES: GeoCity[] = [
  // ── Cameroon ──
  { slug: 'douala', name: 'Douala', province: 'LT', country: 'CM' },
  { slug: 'yaounde', name: 'Yaoundé', province: 'CE', country: 'CM' },
  { slug: 'bafoussam', name: 'Bafoussam', province: 'OU', country: 'CM' },

  // ── Canada · Ontario (ON) ──
  { slug: 'toronto', name: 'Toronto', province: 'ON', country: 'CA' },
  { slug: 'ottawa', name: 'Ottawa', province: 'ON', country: 'CA' },
  { slug: 'mississauga', name: 'Mississauga', province: 'ON', country: 'CA' },
  { slug: 'brampton', name: 'Brampton', province: 'ON', country: 'CA' },
  { slug: 'hamilton', name: 'Hamilton', province: 'ON', country: 'CA' },
  { slug: 'london', name: 'London', province: 'ON', country: 'CA' },
  { slug: 'markham', name: 'Markham', province: 'ON', country: 'CA' },
  { slug: 'vaughan', name: 'Vaughan', province: 'ON', country: 'CA' },
  { slug: 'kitchener', name: 'Kitchener', province: 'ON', country: 'CA' },
  { slug: 'windsor', name: 'Windsor', province: 'ON', country: 'CA' },
  { slug: 'richmond-hill', name: 'Richmond Hill', province: 'ON', country: 'CA' },
  { slug: 'oakville', name: 'Oakville', province: 'ON', country: 'CA' },
  { slug: 'burlington', name: 'Burlington', province: 'ON', country: 'CA' },
  { slug: 'sudbury', name: 'Greater Sudbury', province: 'ON', country: 'CA' },
  { slug: 'oshawa', name: 'Oshawa', province: 'ON', country: 'CA' },
  { slug: 'barrie', name: 'Barrie', province: 'ON', country: 'CA' },
  { slug: 'guelph', name: 'Guelph', province: 'ON', country: 'CA' },
  { slug: 'kingston', name: 'Kingston', province: 'ON', country: 'CA' },
  { slug: 'thunder-bay', name: 'Thunder Bay', province: 'ON', country: 'CA' },
  { slug: 'waterloo', name: 'Waterloo', province: 'ON', country: 'CA' },
  { slug: 'cambridge', name: 'Cambridge', province: 'ON', country: 'CA' },
  { slug: 'st-catharines', name: 'St. Catharines', province: 'ON', country: 'CA' },
  { slug: 'niagara-falls', name: 'Niagara Falls', province: 'ON', country: 'CA' },
  { slug: 'brantford', name: 'Brantford', province: 'ON', country: 'CA' },
  { slug: 'whitby', name: 'Whitby', province: 'ON', country: 'CA' },
  { slug: 'ajax', name: 'Ajax', province: 'ON', country: 'CA' },
  { slug: 'milton', name: 'Milton', province: 'ON', country: 'CA' },
  { slug: 'peterborough', name: 'Peterborough', province: 'ON', country: 'CA' },

  // ── Canada · Quebec (QC) ──
  { slug: 'montreal', name: 'Montréal', province: 'QC', country: 'CA' },
  { slug: 'quebec-city', name: 'Québec City', province: 'QC', country: 'CA' },
  { slug: 'laval', name: 'Laval', province: 'QC', country: 'CA' },
  { slug: 'gatineau', name: 'Gatineau', province: 'QC', country: 'CA' },
  { slug: 'longueuil', name: 'Longueuil', province: 'QC', country: 'CA' },
  { slug: 'sherbrooke', name: 'Sherbrooke', province: 'QC', country: 'CA' },
  { slug: 'levis', name: 'Lévis', province: 'QC', country: 'CA' },
  { slug: 'trois-rivieres', name: 'Trois-Rivières', province: 'QC', country: 'CA' },
  { slug: 'terrebonne', name: 'Terrebonne', province: 'QC', country: 'CA' },
  { slug: 'saint-jean-sur-richelieu', name: 'Saint-Jean-sur-Richelieu', province: 'QC', country: 'CA' },
  { slug: 'repentigny', name: 'Repentigny', province: 'QC', country: 'CA' },
  { slug: 'drummondville', name: 'Drummondville', province: 'QC', country: 'CA' },
  { slug: 'saint-jerome', name: 'Saint-Jérôme', province: 'QC', country: 'CA' },
  { slug: 'granby', name: 'Granby', province: 'QC', country: 'CA' },
  { slug: 'blainville', name: 'Blainville', province: 'QC', country: 'CA' },
  { slug: 'saint-hyacinthe', name: 'Saint-Hyacinthe', province: 'QC', country: 'CA' },

  // ── Canada · British Columbia (BC) ──
  { slug: 'vancouver', name: 'Vancouver', province: 'BC', country: 'CA' },
  { slug: 'surrey', name: 'Surrey', province: 'BC', country: 'CA' },
  { slug: 'burnaby', name: 'Burnaby', province: 'BC', country: 'CA' },
  { slug: 'richmond', name: 'Richmond', province: 'BC', country: 'CA' },
  { slug: 'abbotsford', name: 'Abbotsford', province: 'BC', country: 'CA' },
  { slug: 'coquitlam', name: 'Coquitlam', province: 'BC', country: 'CA' },
  { slug: 'kelowna', name: 'Kelowna', province: 'BC', country: 'CA' },
  { slug: 'victoria', name: 'Victoria', province: 'BC', country: 'CA' },
  { slug: 'nanaimo', name: 'Nanaimo', province: 'BC', country: 'CA' },
  { slug: 'kamloops', name: 'Kamloops', province: 'BC', country: 'CA' },
  { slug: 'chilliwack', name: 'Chilliwack', province: 'BC', country: 'CA' },
  { slug: 'prince-george', name: 'Prince George', province: 'BC', country: 'CA' },
  { slug: 'langley', name: 'Langley', province: 'BC', country: 'CA' },
  { slug: 'delta', name: 'Delta', province: 'BC', country: 'CA' },
  { slug: 'maple-ridge', name: 'Maple Ridge', province: 'BC', country: 'CA' },
  { slug: 'new-westminster', name: 'New Westminster', province: 'BC', country: 'CA' },

  // ── Canada · Alberta (AB) ──
  { slug: 'calgary', name: 'Calgary', province: 'AB', country: 'CA' },
  { slug: 'edmonton', name: 'Edmonton', province: 'AB', country: 'CA' },
  { slug: 'red-deer', name: 'Red Deer', province: 'AB', country: 'CA' },
  { slug: 'lethbridge', name: 'Lethbridge', province: 'AB', country: 'CA' },
  { slug: 'st-albert', name: 'St. Albert', province: 'AB', country: 'CA' },
  { slug: 'medicine-hat', name: 'Medicine Hat', province: 'AB', country: 'CA' },
  { slug: 'grande-prairie', name: 'Grande Prairie', province: 'AB', country: 'CA' },
  { slug: 'airdrie', name: 'Airdrie', province: 'AB', country: 'CA' },
  { slug: 'fort-mcmurray', name: 'Fort McMurray', province: 'AB', country: 'CA' },
  { slug: 'spruce-grove', name: 'Spruce Grove', province: 'AB', country: 'CA' },
  { slug: 'leduc', name: 'Leduc', province: 'AB', country: 'CA' },

  // ── Canada · Manitoba (MB) ──
  { slug: 'winnipeg', name: 'Winnipeg', province: 'MB', country: 'CA' },
  { slug: 'brandon', name: 'Brandon', province: 'MB', country: 'CA' },
  { slug: 'steinbach', name: 'Steinbach', province: 'MB', country: 'CA' },
  { slug: 'thompson', name: 'Thompson', province: 'MB', country: 'CA' },

  // ── Canada · Saskatchewan (SK) ──
  { slug: 'saskatoon', name: 'Saskatoon', province: 'SK', country: 'CA' },
  { slug: 'regina', name: 'Regina', province: 'SK', country: 'CA' },
  { slug: 'prince-albert', name: 'Prince Albert', province: 'SK', country: 'CA' },
  { slug: 'moose-jaw', name: 'Moose Jaw', province: 'SK', country: 'CA' },
  { slug: 'swift-current', name: 'Swift Current', province: 'SK', country: 'CA' },

  // ── Canada · Nova Scotia (NS) ──
  { slug: 'halifax', name: 'Halifax', province: 'NS', country: 'CA' },
  { slug: 'sydney', name: 'Sydney', province: 'NS', country: 'CA' },
  { slug: 'dartmouth', name: 'Dartmouth', province: 'NS', country: 'CA' },
  { slug: 'truro', name: 'Truro', province: 'NS', country: 'CA' },

  // ── Canada · New Brunswick (NB) ──
  { slug: 'moncton', name: 'Moncton', province: 'NB', country: 'CA' },
  { slug: 'saint-john', name: 'Saint John', province: 'NB', country: 'CA' },
  { slug: 'fredericton', name: 'Fredericton', province: 'NB', country: 'CA' },
  { slug: 'dieppe', name: 'Dieppe', province: 'NB', country: 'CA' },

  // ── Canada · Newfoundland and Labrador (NL) ──
  { slug: 'st-johns', name: "St. John's", province: 'NL', country: 'CA' },
  { slug: 'mount-pearl', name: 'Mount Pearl', province: 'NL', country: 'CA' },
  { slug: 'corner-brook', name: 'Corner Brook', province: 'NL', country: 'CA' },

  // ── Canada · Prince Edward Island (PE) ──
  { slug: 'charlottetown', name: 'Charlottetown', province: 'PE', country: 'CA' },
  { slug: 'summerside', name: 'Summerside', province: 'PE', country: 'CA' },

  // ── Canada · Northwest Territories (NT) ──
  { slug: 'yellowknife', name: 'Yellowknife', province: 'NT', country: 'CA' },
  { slug: 'hay-river', name: 'Hay River', province: 'NT', country: 'CA' },

  // ── Canada · Yukon (YT) ──
  { slug: 'whitehorse', name: 'Whitehorse', province: 'YT', country: 'CA' },
  { slug: 'dawson-city', name: 'Dawson City', province: 'YT', country: 'CA' },

  // ── Canada · Nunavut (NU) ──
  { slug: 'iqaluit', name: 'Iqaluit', province: 'NU', country: 'CA' },
  { slug: 'rankin-inlet', name: 'Rankin Inlet', province: 'NU', country: 'CA' },
];

const CITY_COUNTRY: Record<string, string> = Object.fromEntries(
  GEO_CITIES.map((c) => [c.slug, c.country]),
);

/** Country a city belongs to; unknown/empty slugs fall back to the default. */
export function countryOfCity(citySlug: string | undefined | null): string {
  if (!citySlug) return DEFAULT_COUNTRY;
  return CITY_COUNTRY[citySlug] ?? DEFAULT_COUNTRY;
}
