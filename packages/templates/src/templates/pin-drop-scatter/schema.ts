import { z } from 'zod';

const locationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string(),
});

export const schema = z.object({
  locations: z
    .array(locationSchema)
    .min(1)
    .default([
      { lat: 40.7128, lng: -74.006, label: 'New York' },
      { lat: 34.0522, lng: -118.2437, label: 'Los Angeles' },
      { lat: 51.5074, lng: -0.1278, label: 'London' },
      { lat: 35.6762, lng: 139.6503, label: 'Tokyo' },
      { lat: 48.8566, lng: 2.3522, label: 'Paris' },
      { lat: -33.8688, lng: 151.2093, label: 'Sydney' },
      { lat: 25.2048, lng: 55.2708, label: 'Dubai' },
      { lat: 1.3521, lng: 103.8198, label: 'Singapore' },
    ]),
  title: z.string().default('Our Locations'),
  showConnections: z.boolean().default(false),
  showCounter: z.boolean().default(true),
  markerColor: z.string().default('#E74C3C'),
  markerSize: z.number().min(8).max(40).default(18),
  staggerDelay: z.number().min(5).max(60).default(20),
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
      background: z.string().default('#F5F0EB'),
      text: z.string().default('#2C3E50'),
    })
    .default({}),
});

export type PinDropScatterProps = z.infer<typeof schema>;

export type Location = z.infer<typeof locationSchema>;

export const defaultProps: PinDropScatterProps = schema.parse({});
