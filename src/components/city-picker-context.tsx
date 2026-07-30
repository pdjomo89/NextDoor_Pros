'use client';

import * as React from 'react';
import { getCityBySlug, type City } from '@/data/geography';
import { DEFAULT_COUNTRY, MARKETS, type CountryCode } from '@/lib/markets';

const CITY_KEY = 'ndp:selected-city';
const COUNTRY_KEY = 'ndp:selected-country';

type CityContextValue = {
  /** Active market. Explicitly selectable and persisted. */
  country: CountryCode;
  /** Selected city (always within `country`), or null. */
  city: City | null;
  setCountry: (country: CountryCode) => void;
  setCity: (slug: string | null) => void;
  /**
   * Whether `country` reflects a choice the visitor actually made (persisted)
   * rather than the fallback default. Lets a caller seed the market from a
   * weaker signal — geo-IP on the sign-up form — without ever overriding an
   * explicit pick. `false` until the restore effect has run.
   */
  hasStoredCountry: boolean;
};

const CityContext = React.createContext<CityContextValue | undefined>(undefined);

export function CityProvider({ children }: { children: React.ReactNode }) {
  const [country, setCountryState] = React.useState<CountryCode>(DEFAULT_COUNTRY);
  const [city, setCityState] = React.useState<City | null>(null);
  const [hasStoredCountry, setHasStoredCountry] = React.useState(false);

  // Restore persisted market + city. City must belong to the active country.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedCountry = localStorage.getItem(COUNTRY_KEY);
    const valid = !!storedCountry && storedCountry in MARKETS;
    const activeCountry = valid
      ? (storedCountry as CountryCode)
      : DEFAULT_COUNTRY;
    setCountryState(activeCountry);
    setHasStoredCountry(valid);

    const storedCity = localStorage.getItem(CITY_KEY);
    const found = storedCity ? getCityBySlug(storedCity) : undefined;
    if (found && found.country === activeCountry) setCityState(found);
  }, []);

  const setCity = React.useCallback((slug: string | null) => {
    if (!slug) {
      localStorage.removeItem(CITY_KEY);
      setCityState(null);
      return;
    }
    const found = getCityBySlug(slug);
    if (found) {
      localStorage.setItem(CITY_KEY, slug);
      localStorage.setItem(COUNTRY_KEY, found.country);
      setCountryState(found.country); // selecting a city implies its market
      setHasStoredCountry(true);
      setCityState(found);
    }
  }, []);

  const setCountry = React.useCallback(
    (next: CountryCode) => {
      if (!(next in MARKETS)) return;
      localStorage.setItem(COUNTRY_KEY, next);
      setCountryState(next);
      setHasStoredCountry(true);
      // Clear a city that doesn't belong to the newly-selected market.
      if (city && city.country !== next) {
        localStorage.removeItem(CITY_KEY);
        setCityState(null);
      }
    },
    [city],
  );

  return (
    <CityContext.Provider value={{ country, city, setCountry, setCity, hasStoredCountry }}>
      {children}
    </CityContext.Provider>
  );
}

export function useCity() {
  const ctx = React.useContext(CityContext);
  if (!ctx) throw new Error('useCity must be used within CityProvider');
  return ctx;
}
