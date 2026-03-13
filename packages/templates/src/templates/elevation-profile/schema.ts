import { z } from 'zod';

const coordSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string().optional(),
});

const elevationPointSchema = z.object({
  distance: z.number(),
  altitude: z.number(),
});

export const schema = z.object({
  startCoord: coordSchema.default({ lat: 45.9237, lng: 6.8694, label: 'Chamonix' }),
  endCoord: coordSchema.default({ lat: 46.0207, lng: 7.7491, label: 'Zermatt' }),
  waypoints: z.array(coordSchema).default([]),
  elevationData: z
    .array(elevationPointSchema)
    .default([
      { distance: 0, altitude: 1035 },
      { distance: 5, altitude: 1480 },
      { distance: 12, altitude: 2150 },
      { distance: 18, altitude: 2800 },
      { distance: 25, altitude: 3200 },
      { distance: 30, altitude: 2750 },
      { distance: 38, altitude: 2100 },
      { distance: 45, altitude: 1620 },
    ]),
  unit: z.enum(['meters', 'feet']).default('meters'),
  showPeakLabels: z.boolean().default(true),
  showStats: z.boolean().default(true),
  lineColor: z.string().default('#27AE60'),
  lineWidth: z.number().min(1).max(12).default(3),
  mapStyle: z
    .enum(['satellite', 'watercolor', 'toner', 'tonerLite', 'terrain', 'osm', 'darkMatter', 'voyager', 'positron'])
    .default('satellite'),
  mapPadding: z.number().min(50).max(300).default(150),
  curveIntensity: z.number().min(0).max(1).default(0.2),
  fontPair: z
    .enum([
      'modernTech',
      'boldImpact',
      'friendlyTech',
      'strongReadable',
      'elegantEditorial',
      'cleanMinimal',
    ])
    .default('strongReadable'),
  colors: z
    .object({
      primary: z.string().default('#27AE60'),
      secondary: z.string().default('#2C3E50'),
      accent: z.string().default('#E67E22'),
      background: z.string().default('#F5F0EB'),
      text: z.string().default('#2C3E50'),
    })
    .default({}),
});

export type ElevationProfileProps = z.infer<typeof schema>;

export type Coord = z.infer<typeof coordSchema>;

export type ElevationPoint = z.infer<typeof elevationPointSchema>;

export const defaultProps: ElevationProfileProps = schema.parse({});
