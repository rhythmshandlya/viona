import { z } from 'zod';

const regionSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string(),
  values: z.array(z.number()),
});

export const schema = z.object({
  regions: z
    .array(regionSchema)
    .default([
      { lat: 40.7128, lng: -74.0060, label: 'New York', values: [10, 25, 45, 70, 95] },
      { lat: 34.0522, lng: -118.2437, label: 'Los Angeles', values: [8, 20, 35, 55, 78] },
      { lat: 51.5074, lng: -0.1278, label: 'London', values: [12, 30, 50, 65, 88] },
      { lat: 35.6762, lng: 139.6503, label: 'Tokyo', values: [5, 15, 40, 60, 72] },
      { lat: 48.8566, lng: 2.3522, label: 'Paris', values: [7, 18, 30, 50, 65] },
      { lat: -33.8688, lng: 151.2093, label: 'Sydney', values: [3, 10, 25, 40, 55] },
    ]),
  title: z.string().default('Market Growth'),
  metricLabel: z.string().default('Revenue ($M)'),
  timeLabels: z.array(z.string()).default(['2022', '2023', '2024', '2025', '2026']),
  bubbleColor: z.string().default('#7C3AED'),
  showRanking: z.boolean().default(true),
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
  mapPadding: z.number().min(50).max(400).default(200),
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
      background: z.string().default('#F2F2F2'),
      text: z.string().default('#2C3E50'),
    })
    .default({}),
});

export type ChoroplethRaceProps = z.infer<typeof schema>;
export type Region = z.infer<typeof regionSchema>;

export const defaultProps: ChoroplethRaceProps = schema.parse({});
