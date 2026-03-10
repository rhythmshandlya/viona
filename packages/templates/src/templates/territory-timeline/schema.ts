import { z } from 'zod';

const territorySchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string(),
  date: z.string(),
  radius: z.number().optional(),
});

export const schema = z.object({
  territories: z
    .array(territorySchema)
    .default([
      { lat: 40.7128, lng: -74.0060, label: 'New York', date: '2020' },
      { lat: 34.0522, lng: -118.2437, label: 'Los Angeles', date: '2021' },
      { lat: 41.8781, lng: -87.6298, label: 'Chicago', date: '2022' },
      { lat: 51.5074, lng: -0.1278, label: 'London', date: '2023' },
      { lat: 48.8566, lng: 2.3522, label: 'Paris', date: '2024' },
      { lat: 35.6762, lng: 139.6503, label: 'Tokyo', date: '2025' },
    ]),
  title: z.string().default('Our Expansion'),
  showConnections: z.boolean().default(true),
  showDates: z.boolean().default(true),
  regionColor: z.string().default('#3498DB'),
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
  mapPadding: z.number().min(50).max(400).default(120),
  fontPair: z
    .enum([
      'modernTech',
      'boldImpact',
      'friendlyTech',
      'strongReadable',
      'elegantEditorial',
      'cleanMinimal',
    ])
    .default('strongReadable'),
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

export type TerritoryTimelineProps = z.infer<typeof schema>;
export type Territory = z.infer<typeof territorySchema>;

export const defaultProps: TerritoryTimelineProps = schema.parse({});
