import { z } from 'zod';

const coordSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string().optional(),
});

export const schema = z.object({
  startCoord: coordSchema.default({ lat: 40.7128, lng: -74.006, label: 'New York' }),
  endCoord: coordSchema.default({ lat: 34.0522, lng: -118.2437, label: 'Los Angeles' }),
  splitDirection: z.enum(['horizontal', 'vertical']).default('vertical'),
  mapStyle: z
    .enum(['satellite', 'watercolor', 'toner', 'tonerLite', 'terrain', 'osm', 'darkMatter', 'voyager', 'positron'])
    .default('satellite'),
  lineColor: z.string().default('#7C3AED'),
  showDistance: z.boolean().default(true),
  showLabels: z.boolean().default(true),
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
      primary: z.string().default('#7C3AED'),
      secondary: z.string().default('#1a1a2e'),
      accent: z.string().default('#00D4FF'),
      background: z.string().default('#F5F0EB'),
      text: z.string().default('#1a1a1a'),
    })
    .default({}),
});

export type SplitDepartureProps = z.infer<typeof schema>;

export type Coord = z.infer<typeof coordSchema>;

export const defaultProps: SplitDepartureProps = schema.parse({});
