import { z } from 'zod';

const citySchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string().optional(),
  value: z.number(),
});

export const schema = z.object({
  cities: z
    .array(citySchema)
    .default([
      { lat: 35.6762, lng: 139.6503, label: 'Tokyo', value: 37.4 },
      { lat: 28.7041, lng: 77.1025, label: 'Delhi', value: 32.9 },
      { lat: 31.2304, lng: 121.4737, label: 'Shanghai', value: 29.2 },
      { lat: -23.5505, lng: -46.6333, label: 'São Paulo', value: 22.4 },
      { lat: 19.076, lng: 72.8777, label: 'Mumbai', value: 21.7 },
      { lat: 30.0444, lng: 31.2357, label: 'Cairo', value: 21.3 },
      { lat: 23.8103, lng: 90.4125, label: 'Dhaka', value: 22.5 },
      { lat: -6.2088, lng: 106.8456, label: 'Jakarta', value: 11.2 },
      { lat: 40.7128, lng: -74.006, label: 'New York', value: 18.8 },
      { lat: 39.9042, lng: 116.4074, label: 'Beijing', value: 21.5 },
      { lat: 14.5995, lng: 120.9842, label: 'Manila', value: 14.4 },
      { lat: 34.0522, lng: -118.2437, label: 'Los Angeles', value: 12.5 },
      { lat: 37.5665, lng: 126.978, label: 'Seoul', value: 9.8 },
      { lat: 51.5074, lng: -0.1278, label: 'London', value: 9.5 },
      { lat: 48.8566, lng: 2.3522, label: 'Paris', value: 11.1 },
      { lat: 55.7558, lng: 37.6173, label: 'Moscow', value: 12.6 },
      { lat: -34.6037, lng: -58.3816, label: 'Buenos Aires', value: 15.3 },
      { lat: 41.0082, lng: 28.9784, label: 'Istanbul', value: 15.6 },
      { lat: 13.7563, lng: 100.5018, label: 'Bangkok', value: 10.7 },
      { lat: 6.5244, lng: 3.3792, label: 'Lagos', value: 15.9 },
      { lat: 1.3521, lng: 103.8198, label: 'Singapore', value: 5.9 },
      { lat: -1.2921, lng: 36.8219, label: 'Nairobi', value: 5.1 },
      { lat: 19.4326, lng: -99.1332, label: 'Mexico City', value: 21.8 },
      { lat: 52.52, lng: 13.405, label: 'Berlin', value: 3.7 },
      { lat: -33.8688, lng: 151.2093, label: 'Sydney', value: 5.4 },
      { lat: 25.2048, lng: 55.2708, label: 'Dubai', value: 3.5 },
      { lat: 43.6532, lng: -79.3832, label: 'Toronto', value: 6.3 },
      { lat: 22.3193, lng: 114.1694, label: 'Hong Kong', value: 7.5 },
      { lat: -22.9068, lng: -43.1729, label: 'Rio de Janeiro', value: 13.6 },
      { lat: 33.8886, lng: 35.4955, label: 'Beirut', value: 2.4 },
    ]),
  hexResolution: z.number().min(1).max(5).default(3),
  maxAltitude: z.number().min(0.1).max(2).default(0.8),
  hexMargin: z.number().min(0).max(0.9).default(0.4),
  colorLow: z.string().default('#FFDD00'),
  colorHigh: z.string().default('#FF3300'),
  globeTexture: z.enum(['blue-marble', 'dark', 'night']).default('dark'),
  showAtmosphere: z.boolean().default(true),
  showStars: z.boolean().default(true),
  title: z.string().default('WORLD POPULATION'),
  subtitle: z.string().default('Major Metropolitan Areas (millions)'),
  showTitle: z.boolean().default(true),
  fontPair: z
    .enum([
      'modernTech',
      'boldImpact',
      'friendlyTech',
      'strongReadable',
      'elegantEditorial',
      'cleanMinimal',
    ])
    .default('modernTech'),
  colors: z
    .object({
      primary: z.string().default('#FFDD00'),
      secondary: z.string().default('#0a0a1a'),
      accent: z.string().default('#FF3300'),
      background: z.string().default('#050510'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type GlobeHexbinsProps = z.infer<typeof schema>;

export const defaultProps: GlobeHexbinsProps = schema.parse({});
