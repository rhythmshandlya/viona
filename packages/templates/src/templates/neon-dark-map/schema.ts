import { z } from 'zod';

const coordSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string().optional(),
});

export const schema = z.object({
  startCoord: coordSchema.default({ lat: 35.6762, lng: 139.6503, label: 'Tokyo' }),
  endCoord: coordSchema.default({ lat: 37.5665, lng: 126.978, label: 'Seoul' }),
  waypoints: z.array(coordSchema).default([]),
  neonColor: z.string().default('#00F5FF'),
  glowIntensity: z.number().min(0.1).max(2.0).default(1.0),
  lineWidth: z.number().min(1).max(12).default(3),
  showDistance: z.boolean().default(true),
  showLabels: z.boolean().default(true),
  mapStyle: z
    .enum([
      'satellite',
      'watercolor',
      'toner',
      'tonerLite',
      'terrain',
      'osm',
      'darkMatter',
      'voyager',
      'positron',
    ])
    .default('satellite'),
  mapPadding: z.number().min(50).max(300).default(150),
  curveIntensity: z.number().min(0).max(1).default(0.3),
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
      primary: z.string().default('#00F5FF'),
      secondary: z.string().default('#FF00FF'),
      accent: z.string().default('#00FF88'),
      background: z.string().default('#0e0e0e'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type NeonDarkMapProps = z.infer<typeof schema>;

export type Coord = z.infer<typeof coordSchema>;

export const defaultProps: NeonDarkMapProps = schema.parse({});
