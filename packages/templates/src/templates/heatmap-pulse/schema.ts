import { z } from 'zod';

const pointSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  value: z.number(),
  label: z.string(),
});

export const schema = z.object({
  points: z
    .array(pointSchema)
    .default([
      { lat: 40.7128, lng: -74.0060, value: 95, label: 'New York' },
      { lat: 34.0522, lng: -118.2437, value: 78, label: 'Los Angeles' },
      { lat: 51.5074, lng: -0.1278, value: 88, label: 'London' },
      { lat: 35.6762, lng: 139.6503, value: 72, label: 'Tokyo' },
      { lat: 48.8566, lng: 2.3522, value: 65, label: 'Paris' },
      { lat: -33.8688, lng: 151.2093, value: 55, label: 'Sydney' },
      { lat: 25.2048, lng: 55.2708, value: 45, label: 'Dubai' },
      { lat: 1.3521, lng: 103.8198, value: 60, label: 'Singapore' },
    ]),
  title: z.string().default('Regional Performance'),
  metricLabel: z.string().default('Sales'),
  colorScale: z.enum(['warm', 'cool', 'green']).default('warm'),
  showLegend: z.boolean().default(true),
  showLabels: z.boolean().default(true),
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
    .default('modernTech'),
  colors: z
    .object({
      primary: z.string().default('#FF6B35'),
      secondary: z.string().default('#1a1a2e'),
      accent: z.string().default('#00D4FF'),
      background: z.string().default('#F2F2F2'),
      text: z.string().default('#2C3E50'),
    })
    .default({}),
});

export type HeatmapPulseProps = z.infer<typeof schema>;
export const defaultProps: HeatmapPulseProps = schema.parse({});
