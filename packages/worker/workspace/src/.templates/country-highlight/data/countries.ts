/**
 * Country data loader — loads polygon data from static JSON at render time
 * instead of bundling 355KB inline.
 */
import { staticFile, delayRender, continueRender } from 'remotion';
import { useState, useEffect } from 'react';

export interface CountryData {
  name: string;
  iso_a3: string;
  iso_a2: string;
  /** [minLng, minLat, maxLng, maxLat] */
  bbox: [number, number, number, number];
  /** [lng, lat] */
  centroid: [number, number];
  /** Array of polygon outer rings, each ring is [lng, lat][] */
  polygons: [number, number][][];
}

// Runtime cache — loaded once, shared across all instances
let cachedCountries: CountryData[] | null = null;

export function useCountries(): CountryData[] | null {
  const [countries, setCountries] = useState<CountryData[] | null>(cachedCountries);
  const [handle] = useState(() => cachedCountries ? null : delayRender('Loading country data'));

  useEffect(() => {
    if (cachedCountries) return;

    fetch(staticFile('data/countries.json'))
      .then((r) => r.json())
      .then((data: CountryData[]) => {
        cachedCountries = data;
        setCountries(data);
        if (handle !== null) continueRender(handle);
      })
      .catch((err) => {
        console.error('Failed to load country data:', err);
        if (handle !== null) continueRender(handle);
      });
  }, [handle]);

  return countries;
}

export function findCountryIn(
  countries: CountryData[],
  nameOrCode: string,
): CountryData | undefined {
  const q = nameOrCode.trim().toLowerCase();
  return countries.find(
    (c) =>
      c.name.toLowerCase() === q ||
      c.iso_a3.toLowerCase() === q ||
      c.iso_a2.toLowerCase() === q,
  );
}
