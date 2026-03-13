import { z } from 'zod';

const coordSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string().optional(),
});

export const schema = z.object({
  startCoord: coordSchema.default({ lat: 40.7128, lng: -74.006, label: 'New York' }),
  endCoord: coordSchema.default({ lat: 51.5074, lng: -0.1278, label: 'London' }),
  globeTexture: z.enum(['blue-marble', 'dark', 'night']).default('blue-marble'),
  arcColor: z.string().default('#FF6B35'),
  arcWidth: z.number().min(1).max(10).default(3),
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
      primary: z.string().default('#FF6B35'),
      secondary: z.string().default('#1a1a2e'),
      accent: z.string().default('#00D4FF'),
      background: z.string().default('#0a0a1a'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type GlobeSpinProps = z.infer<typeof schema>;

export type Coord = z.infer<typeof coordSchema>;

export const defaultProps: GlobeSpinProps = schema.parse({});
