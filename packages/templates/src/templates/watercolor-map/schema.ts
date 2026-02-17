import { z } from 'zod';

const coordSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string().optional(),
});

export const schema = z.object({
  startCoord: coordSchema.default({ lat: 48.8566, lng: 2.3522, label: 'Paris' }),
  endCoord: coordSchema.default({ lat: 41.9028, lng: 12.4964, label: 'Rome' }),
  mapStyle: z
    .enum(['watercolor', 'toner', 'tonerLite', 'terrain', 'osm'])
    .default('watercolor'),
  lineColor: z.string().default('#D64933'),
  lineWidth: z.number().min(1).max(12).default(4),
  lineStyle: z.enum(['solid', 'dashed']).default('solid'),
  markerColor: z.string().default('#D64933'),
  markerSize: z.number().min(8).max(40).default(18),
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
      primary: z.string().default('#D64933'),
      secondary: z.string().default('#2C3E50'),
      accent: z.string().default('#E67E22'),
      background: z.string().default('#F5F0EB'),
      text: z.string().default('#2C3E50'),
    })
    .default({}),
});

export type WatercolorMapProps = z.infer<typeof schema>;

export type Coord = z.infer<typeof coordSchema>;

export const defaultProps: WatercolorMapProps = schema.parse({});
