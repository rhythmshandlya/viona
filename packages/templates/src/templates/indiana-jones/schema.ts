import { z } from 'zod';

const coordSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string().optional(),
});

export const schema = z.object({
  startCoord: coordSchema.default({ lat: 48.8566, lng: 2.3522, label: 'Paris' }),
  endCoord: coordSchema.default({ lat: 30.0444, lng: 31.2357, label: 'Cairo' }),
  waypoints: z.array(coordSchema).default([]),
  title: z.string().default('The Journey Begins'),
  lineColor: z.string().default('#C0392B'),
  lineWidth: z.number().min(1).max(12).default(5),
  showCompass: z.boolean().default(true),
  showDistance: z.boolean().default(true),
  mapStyle: z
    .enum(['satellite', 'watercolor', 'toner', 'tonerLite', 'terrain', 'osm', 'darkMatter', 'voyager', 'positron'])
    .default('terrain'),
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
      primary: z.string().default('#C0392B'),
      secondary: z.string().default('#2C3E50'),
      accent: z.string().default('#D4A962'),
      background: z.string().default('#F5E6C8'),
      text: z.string().default('#2C3E50'),
    })
    .default({}),
});

export type IndianaJonesProps = z.infer<typeof schema>;

export type Coord = z.infer<typeof coordSchema>;

export const defaultProps: IndianaJonesProps = schema.parse({});
