import { z } from 'zod';

const coordSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string().optional(),
});

export const schema = z.object({
  startCoord: coordSchema.default({ lat: 34.0522, lng: -118.2437, label: 'Los Angeles' }),
  endCoord: coordSchema.default({ lat: 36.1699, lng: -115.1398, label: 'Las Vegas' }),
  waypoints: z.array(coordSchema).default([]),
  vehicleType: z.enum(['car', 'van', 'motorcycle', 'bicycle']).default('car'),
  unit: z.enum(['miles', 'km']).default('miles'),
  title: z.string().default('ROAD TRIP'),
  showCompass: z.boolean().default(true),
  lineColor: z.string().default('#E8722A'),
  lineWidth: z.number().min(1).max(12).default(4),
  lineStyle: z.enum(['solid', 'dashed']).default('dashed'),
  showDistance: z.boolean().default(true),
  showLabels: z.boolean().default(true),
  mapStyle: z
    .enum(['satellite', 'watercolor', 'toner', 'tonerLite', 'terrain', 'osm', 'darkMatter', 'voyager', 'positron'])
    .default('terrain'),
  mapPadding: z.number().min(50).max(300).default(120),
  curveIntensity: z.number().min(0).max(1).default(0.15),
  fontPair: z
    .enum([
      'modernTech',
      'boldImpact',
      'friendlyTech',
      'strongReadable',
      'elegantEditorial',
      'cleanMinimal',
    ])
    .default('boldImpact'),
  colors: z
    .object({
      primary: z.string().default('#E8722A'),
      secondary: z.string().default('#3D2B1F'),
      accent: z.string().default('#C4A35A'),
      background: z.string().default('#F5EDE0'),
      text: z.string().default('#3D2B1F'),
    })
    .default({}),
});

export type RoadTripProps = z.infer<typeof schema>;

export type Coord = z.infer<typeof coordSchema>;

export const defaultProps: RoadTripProps = schema.parse({});
