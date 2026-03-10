import { z } from 'zod';

const coordSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string().optional(),
});

export const schema = z.object({
  startCoord: coordSchema.default({ lat: 38.7223, lng: -9.1393, label: 'Lisbon' }),
  endCoord: coordSchema.default({ lat: 41.0082, lng: 28.9784, label: 'Istanbul' }),
  compassStyle: z.enum(['classic', 'modern', 'nautical']).default('classic'),
  showBearing: z.boolean().default(true),
  mapStyle: z
    .enum(['satellite', 'watercolor', 'toner', 'tonerLite', 'terrain', 'osm', 'darkMatter', 'voyager', 'positron'])
    .default('satellite'),
  lineColor: z.string().default('#2C3E50'),
  lineWidth: z.number().min(1).max(12).default(4),
  showLabels: z.boolean().default(true),
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
    .default('elegantEditorial'),
  colors: z
    .object({
      primary: z.string().default('#2C3E50'),
      secondary: z.string().default('#8B4513'),
      accent: z.string().default('#C0392B'),
      background: z.string().default('#F5E6C8'),
      text: z.string().default('#2C3E50'),
    })
    .default({}),
});

export type CompassNavigatorProps = z.infer<typeof schema>;

export type Coord = z.infer<typeof coordSchema>;

export const defaultProps: CompassNavigatorProps = schema.parse({});
