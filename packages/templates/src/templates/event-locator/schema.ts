import { z } from 'zod';

const coordSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string(),
});

export const schema = z.object({
  venueCoord: coordSchema.default({ lat: 40.7128, lng: -74.0060, label: 'The Grand Hall' }),
  eventName: z.string().default('Annual Conference 2026'),
  eventDate: z.string().default('March 15, 2026'),
  eventTime: z.string().default('7:00 PM'),
  address: z.string().default('123 Broadway, New York, NY'),
  nearbyLandmarks: z
    .array(coordSchema)
    .default([
      { lat: 40.7081, lng: -74.0089, label: 'Wall Street Station' },
      { lat: 40.7116, lng: -74.0131, label: 'World Trade Center' },
      { lat: 40.7061, lng: -73.9969, label: 'Brooklyn Bridge' },
    ]),
  showDirections: z.boolean().default(true),
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
  mapPadding: z.number().min(50).max(400).default(100),
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
      primary: z.string().default('#7C3AED'),
      secondary: z.string().default('#2C3E50'),
      accent: z.string().default('#D4A962'),
      background: z.string().default('#F5F0EB'),
      text: z.string().default('#2C3E50'),
    })
    .default({}),
});

export type EventLocatorProps = z.infer<typeof schema>;

export const defaultProps: EventLocatorProps = schema.parse({});
