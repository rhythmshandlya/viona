import { z } from 'zod';

const coordSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string().optional(),
});

export const schema = z.object({
  startCoord: coordSchema.default({ lat: 40.7128, lng: -74.006, label: 'New York' }),
  endCoord: coordSchema.default({ lat: 35.6762, lng: 139.6503, label: 'Tokyo' }),
  startTimezone: z.string().default('UTC-5'),
  endTimezone: z.string().default('UTC+9'),
  clockStyle: z.enum(['digital', 'analog']).default('digital'),
  showZoneBands: z.boolean().default(true),
  showLocalTimes: z.boolean().default(true),
  lineColor: z.string().default('#3498DB'),
  lineWidth: z.number().min(1).max(12).default(3),
  mapStyle: z
    .enum(['satellite', 'watercolor', 'toner', 'tonerLite', 'terrain', 'osm', 'darkMatter', 'voyager', 'positron'])
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
      primary: z.string().default('#3498DB'),
      secondary: z.string().default('#2C3E50'),
      accent: z.string().default('#E74C3C'),
      background: z.string().default('#F2F2F2'),
      text: z.string().default('#2C3E50'),
    })
    .default({}),
});

export type TimezoneTravelerProps = z.infer<typeof schema>;

export type Coord = z.infer<typeof coordSchema>;

export const defaultProps: TimezoneTravelerProps = schema.parse({});
