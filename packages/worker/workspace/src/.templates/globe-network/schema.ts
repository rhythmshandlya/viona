import { z } from 'zod';

const coordSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string().optional(),
});

export const schema = z.object({
  city1: coordSchema.default({ lat: 40.7128, lng: -74.006, label: 'New York' }),
  city2: coordSchema.default({ lat: 51.5074, lng: -0.1278, label: 'London' }),
  city3: coordSchema.default({ lat: 35.6762, lng: 139.6503, label: 'Tokyo' }),
  city4: coordSchema.default({ lat: -33.8688, lng: 151.2093, label: 'Sydney' }),
  city5: coordSchema.default({ lat: 1.3521, lng: 103.8198, label: 'Singapore' }),
  globeTexture: z.enum(['blue-marble', 'dark', 'night']).default('night'),
  arcColor: z.string().default('#8B5CF6'),
  arcWidth: z.number().min(1).max(10).default(3),
  rotationSpeed: z.number().min(0).max(3).default(0.5),
  showLabels: z.boolean().default(true),
  showAtmosphere: z.boolean().default(true),
  backgroundColor: z.string().default('#0a0a1a'),
  showStars: z.boolean().default(true),
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
      primary: z.string().default('#8B5CF6'),
      secondary: z.string().default('#1a1a2e'),
      accent: z.string().default('#00D4FF'),
      background: z.string().default('#0a0a1a'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type GlobeNetworkProps = z.infer<typeof schema>;

export type Coord = z.infer<typeof coordSchema>;

export const defaultProps: GlobeNetworkProps = schema.parse({});
