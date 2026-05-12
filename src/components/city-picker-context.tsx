'use client';

import * as React from 'react';
import { getCityBySlug, type City } from '@/data/canadian-cities';

const STORAGE_KEY = 'ndp:selected-city';

type CityContextValue = {
  city: City | null;
  setCity: (slug: string | null) => void;
};

const CityContext = React.createContext<CityContextValue | undefined>(undefined);

export function CityProvider({ children }: { children: React.ReactNode }) {
  const [city, setCityState] = React.useState<City | null>(null);

  React.useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored) {
      const found = getCityBySlug(stored);
      if (found) setCityState(found);
    }
  }, []);

  const setCity = React.useCallback((slug: string | null) => {
    if (!slug) {
      localStorage.removeItem(STORAGE_KEY);
      setCityState(null);
      return;
    }
    const found = getCityBySlug(slug);
    if (found) {
      localStorage.setItem(STORAGE_KEY, slug);
      setCityState(found);
    }
  }, []);

  return (
    <CityContext.Provider value={{ city, setCity }}>{children}</CityContext.Provider>
  );
}

export function useCity() {
  const ctx = React.useContext(CityContext);
  if (!ctx) throw new Error('useCity must be used within CityProvider');
  return ctx;
}
