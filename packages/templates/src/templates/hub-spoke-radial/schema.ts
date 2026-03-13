import { z } from 'zod';

const coordSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string().optional(),
});

export const schema = z.object({
  hubCoord: coordSchema.default({ lat: 40.7128, lng: -74.006, label: 'New York' }),
  destinations: z
    .array(coordSchema)
    .default([
      { lat: 51.5074, lng: -0.1278, label: 'London' },
      { lat: 48.8566, lng: 2.3522, label: 'Paris' },
      { lat: 35.6762, lng: 139.6503, label: 'Tokyo' },
      { lat: -33.8688, lng: 151.2093, label: 'Sydney' },
      { lat: 25.2048, lng: 55.2708, label: 'Dubai' },
    ]),
  lineColor: z.string().default('#E74C3C'),
  lineWidth: z.number().min(1).max(12).default(3),
  spokeStyle: z.enum(['solid', 'dashed', 'dotted']).default('solid'),
  showDistances: z.boolean().default(true),
  showTotalCount: z.boolean().default(true),
  title: z.string().default('Places I Visited'),
  staggerDelay: z.number().min(5).max(30).default(15),
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
  mapPadding: z.number().min(50).max(300).default(120),
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
      primary: z.string().default('#E74C3C'),
      secondary: z.string().default('#2C3E50'),
      accent: z.string().default('#3498DB'),
      background: z.string().default('#F2F2F2'),
      text: z.string().default('#2C3E50'),
    })
    .default({}),
});

export type HubSpokeRadialProps = z.infer<typeof schema>;

export type Coord = z.infer<typeof coordSchema>;

export const defaultProps: HubSpokeRadialProps = schema.parse({});
