import { z } from 'zod';

const coordSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string().optional(),
});

export const schema = z.object({
  hubCity: coordSchema.default({ lat: 40.7128, lng: -74.006, label: 'New York' }),
  destinations: z
    .array(coordSchema)
    .default([
      { lat: 51.5074, lng: -0.1278, label: 'London' },
      { lat: 48.8566, lng: 2.3522, label: 'Paris' },
      { lat: 35.6762, lng: 139.6503, label: 'Tokyo' },
      { lat: -33.8688, lng: 151.2093, label: 'Sydney' },
      { lat: 55.7558, lng: 37.6173, label: 'Moscow' },
      { lat: -23.5505, lng: -46.6333, label: 'São Paulo' },
      { lat: 1.3521, lng: 103.8198, label: 'Singapore' },
      { lat: 25.2048, lng: 55.2708, label: 'Dubai' },
    ]),
  arcStaggerFrames: z.number().min(10).max(60).default(30),
  arcColor: z.string().default('#00D4FF'),
  arcWidth: z.number().min(1).max(10).default(3),
  globeTexture: z.enum(['blue-marble', 'dark', 'night']).default('dark'),
  showLabels: z.boolean().default(true),
  showRings: z.boolean().default(true),
  showAtmosphere: z.boolean().default(true),
  showStars: z.boolean().default(true),
  title: z.string().default('GLOBAL NETWORK'),
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
      primary: z.string().default('#00D4FF'),
      secondary: z.string().default('#0a0a1a'),
      accent: z.string().default('#FF6B35'),
      background: z.string().default('#050510'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type GlobeConnectionsProps = z.infer<typeof schema>;

export const defaultProps: GlobeConnectionsProps = schema.parse({});
