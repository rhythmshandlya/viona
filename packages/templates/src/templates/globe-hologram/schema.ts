import { z } from 'zod';

const coordSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string().optional(),
});

export const schema = z.object({
  startCoord: coordSchema.default({ lat: 37.7749, lng: -122.4194, label: 'San Francisco' }),
  endCoord: coordSchema.default({ lat: 35.6762, lng: 139.6503, label: 'Tokyo' }),
  style: z.enum(['wireframe', 'hollow']).default('wireframe'),
  glowColor: z.string().default('#00FFCC'),
  arcColor: z.string().default('#FF00FF'),
  showScanline: z.boolean().default(true),
  showLabels: z.boolean().default(true),
  showAtmosphere: z.boolean().default(true),
  title: z.string().default('SIGNAL TRACE'),
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
      primary: z.string().default('#00FFCC'),
      secondary: z.string().default('#0a0a1a'),
      accent: z.string().default('#FF00FF'),
      background: z.string().default('#050510'),
      text: z.string().default('#00FFCC'),
    })
    .default({}),
});

export type GlobeHologramProps = z.infer<typeof schema>;

export const defaultProps: GlobeHologramProps = schema.parse({});
