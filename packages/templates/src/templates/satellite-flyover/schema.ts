import { z } from 'zod';

const coordSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string().optional(),
});

export const schema = z.object({
  startCoord: coordSchema.default({ lat: 36.1069, lng: -112.1129, label: 'Grand Canyon' }),
  endCoord: coordSchema.default({ lat: 36.9983, lng: -110.0985, label: 'Monument Valley' }),
  waypoints: z.array(coordSchema).default([]),
  showClouds: z.boolean().default(true),
  labelStyle: z.enum(['lowerThird', 'minimal', 'none']).default('lowerThird'),
  showDistance: z.boolean().default(false),
  lineColor: z.string().default('rgba(255,255,255,0.6)'),
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
    .default('cleanMinimal'),
  colors: z
    .object({
      primary: z.string().default('#FFFFFF'),
      secondary: z.string().default('#1a1a1a'),
      accent: z.string().default('#00D4FF'),
      background: z.string().default('#1a1a1a'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type SatelliteFlyoverProps = z.infer<typeof schema>;

export type Coord = z.infer<typeof coordSchema>;

export const defaultProps: SatelliteFlyoverProps = schema.parse({});
