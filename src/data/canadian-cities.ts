export type Province = {
  code: string;
  name: { en: string; fr: string };
};

export type City = {
  slug: string;
  name: string;
  province: string;
};

export const PROVINCES: Province[] = [
  { code: 'AB', name: { en: 'Alberta', fr: 'Alberta' } },
  { code: 'BC', name: { en: 'British Columbia', fr: 'Colombie-Britannique' } },
  { code: 'MB', name: { en: 'Manitoba', fr: 'Manitoba' } },
  { code: 'NB', name: { en: 'New Brunswick', fr: 'Nouveau-Brunswick' } },
  { code: 'NL', name: { en: 'Newfoundland and Labrador', fr: 'Terre-Neuve-et-Labrador' } },
  { code: 'NS', name: { en: 'Nova Scotia', fr: 'Nouvelle-Écosse' } },
  { code: 'NT', name: { en: 'Northwest Territories', fr: 'Territoires du Nord-Ouest' } },
  { code: 'NU', name: { en: 'Nunavut', fr: 'Nunavut' } },
  { code: 'ON', name: { en: 'Ontario', fr: 'Ontario' } },
  { code: 'PE', name: { en: 'Prince Edward Island', fr: 'Île-du-Prince-Édouard' } },
  { code: 'QC', name: { en: 'Quebec', fr: 'Québec' } },
  { code: 'SK', name: { en: 'Saskatchewan', fr: 'Saskatchewan' } },
  { code: 'YT', name: { en: 'Yukon', fr: 'Yukon' } },
];

export const CANADIAN_CITIES: City[] = [
  // Ontario
  { slug: 'toronto-on', name: 'Toronto', province: 'ON' },
  { slug: 'ottawa-on', name: 'Ottawa', province: 'ON' },
  { slug: 'mississauga-on', name: 'Mississauga', province: 'ON' },
  { slug: 'brampton-on', name: 'Brampton', province: 'ON' },
  { slug: 'hamilton-on', name: 'Hamilton', province: 'ON' },
  { slug: 'london-on', name: 'London', province: 'ON' },
  { slug: 'markham-on', name: 'Markham', province: 'ON' },
  { slug: 'vaughan-on', name: 'Vaughan', province: 'ON' },
  { slug: 'kitchener-on', name: 'Kitchener', province: 'ON' },
  { slug: 'windsor-on', name: 'Windsor', province: 'ON' },
  { slug: 'oakville-on', name: 'Oakville', province: 'ON' },
  { slug: 'burlington-on', name: 'Burlington', province: 'ON' },
  { slug: 'oshawa-on', name: 'Oshawa', province: 'ON' },
  { slug: 'barrie-on', name: 'Barrie', province: 'ON' },
  { slug: 'guelph-on', name: 'Guelph', province: 'ON' },
  { slug: 'kingston-on', name: 'Kingston', province: 'ON' },
  { slug: 'waterloo-on', name: 'Waterloo', province: 'ON' },
  { slug: 'cambridge-on', name: 'Cambridge', province: 'ON' },
  { slug: 'st-catharines-on', name: 'St. Catharines', province: 'ON' },
  { slug: 'thunder-bay-on', name: 'Thunder Bay', province: 'ON' },
  { slug: 'sudbury-on', name: 'Sudbury', province: 'ON' },

  // Quebec
  { slug: 'montreal-qc', name: 'Montréal', province: 'QC' },
  { slug: 'quebec-city-qc', name: 'Québec City', province: 'QC' },
  { slug: 'laval-qc', name: 'Laval', province: 'QC' },
  { slug: 'gatineau-qc', name: 'Gatineau', province: 'QC' },
  { slug: 'longueuil-qc', name: 'Longueuil', province: 'QC' },
  { slug: 'sherbrooke-qc', name: 'Sherbrooke', province: 'QC' },
  { slug: 'trois-rivieres-qc', name: 'Trois-Rivières', province: 'QC' },
  { slug: 'saguenay-qc', name: 'Saguenay', province: 'QC' },
  { slug: 'levis-qc', name: 'Lévis', province: 'QC' },

  // British Columbia
  { slug: 'vancouver-bc', name: 'Vancouver', province: 'BC' },
  { slug: 'surrey-bc', name: 'Surrey', province: 'BC' },
  { slug: 'burnaby-bc', name: 'Burnaby', province: 'BC' },
  { slug: 'richmond-bc', name: 'Richmond', province: 'BC' },
  { slug: 'victoria-bc', name: 'Victoria', province: 'BC' },
  { slug: 'kelowna-bc', name: 'Kelowna', province: 'BC' },
  { slug: 'abbotsford-bc', name: 'Abbotsford', province: 'BC' },
  { slug: 'coquitlam-bc', name: 'Coquitlam', province: 'BC' },
  { slug: 'langley-bc', name: 'Langley', province: 'BC' },
  { slug: 'nanaimo-bc', name: 'Nanaimo', province: 'BC' },
  { slug: 'kamloops-bc', name: 'Kamloops', province: 'BC' },

  // Alberta
  { slug: 'calgary-ab', name: 'Calgary', province: 'AB' },
  { slug: 'edmonton-ab', name: 'Edmonton', province: 'AB' },
  { slug: 'red-deer-ab', name: 'Red Deer', province: 'AB' },
  { slug: 'lethbridge-ab', name: 'Lethbridge', province: 'AB' },
  { slug: 'st-albert-ab', name: 'St. Albert', province: 'AB' },
  { slug: 'medicine-hat-ab', name: 'Medicine Hat', province: 'AB' },
  { slug: 'fort-mcmurray-ab', name: 'Fort McMurray', province: 'AB' },

  // Manitoba
  { slug: 'winnipeg-mb', name: 'Winnipeg', province: 'MB' },
  { slug: 'brandon-mb', name: 'Brandon', province: 'MB' },
  { slug: 'steinbach-mb', name: 'Steinbach', province: 'MB' },

  // Saskatchewan
  { slug: 'saskatoon-sk', name: 'Saskatoon', province: 'SK' },
  { slug: 'regina-sk', name: 'Regina', province: 'SK' },
  { slug: 'prince-albert-sk', name: 'Prince Albert', province: 'SK' },
  { slug: 'moose-jaw-sk', name: 'Moose Jaw', province: 'SK' },

  // Nova Scotia
  { slug: 'halifax-ns', name: 'Halifax', province: 'NS' },
  { slug: 'sydney-ns', name: 'Sydney', province: 'NS' },
  { slug: 'dartmouth-ns', name: 'Dartmouth', province: 'NS' },

  // New Brunswick
  { slug: 'moncton-nb', name: 'Moncton', province: 'NB' },
  { slug: 'saint-john-nb', name: 'Saint John', province: 'NB' },
  { slug: 'fredericton-nb', name: 'Fredericton', province: 'NB' },

  // Newfoundland and Labrador
  { slug: 'st-johns-nl', name: "St. John's", province: 'NL' },
  { slug: 'mount-pearl-nl', name: 'Mount Pearl', province: 'NL' },

  // Prince Edward Island
  { slug: 'charlottetown-pe', name: 'Charlottetown', province: 'PE' },
  { slug: 'summerside-pe', name: 'Summerside', province: 'PE' },

  // Territories
  { slug: 'whitehorse-yt', name: 'Whitehorse', province: 'YT' },
  { slug: 'yellowknife-nt', name: 'Yellowknife', province: 'NT' },
  { slug: 'iqaluit-nu', name: 'Iqaluit', province: 'NU' },
];

export function getCityBySlug(slug: string): City | undefined {
  return CANADIAN_CITIES.find((c) => c.slug === slug);
}

/** Largest / highest-traffic cities — used to pre-render & sitemap per-city service pages. */
export const FEATURED_CITY_SLUGS = [
  'toronto-on',
  'montreal-qc',
  'vancouver-bc',
  'calgary-ab',
  'edmonton-ab',
  'ottawa-on',
  'winnipeg-mb',
  'quebec-city-qc',
  'hamilton-on',
  'mississauga-on',
  'kitchener-on',
  'london-on',
  'halifax-ns',
  'victoria-bc',
  'surrey-bc',
  'saskatoon-sk',
] as const;

export const FEATURED_CITIES: City[] = FEATURED_CITY_SLUGS.map(
  (slug) => CANADIAN_CITIES.find((c) => c.slug === slug)!,
).filter(Boolean);

/** Other cities in the same province (excluding the given slug), alphabetical. */
export function citiesInProvince(provinceCode: string, excludeSlug?: string): City[] {
  return CANADIAN_CITIES.filter(
    (c) => c.province === provinceCode && c.slug !== excludeSlug,
  ).sort((a, b) => a.name.localeCompare(b.name));
}

export function getProvinceByCode(code: string): Province | undefined {
  return PROVINCES.find((p) => p.code === code);
}

export function citiesGroupedByProvince(): { province: Province; cities: City[] }[] {
  return PROVINCES.map((province) => ({
    province,
    cities: CANADIAN_CITIES.filter((c) => c.province === province.code).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  })).filter((g) => g.cities.length > 0);
}
