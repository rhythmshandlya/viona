import { z } from 'zod';

const stopSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string(),
  date: z.string().optional(),
});

export const schema = z.object({
  stops: z
    .array(stopSchema)
    .min(2)
    .default([
      { lat: 48.8566, lng: 2.3522, label: 'Paris', date: 'Jun 1' },
      { lat: 46.2044, lng: 6.1432, label: 'Geneva', date: 'Jun 4' },
      { lat: 45.4642, lng: 9.19, label: 'Milan', date: 'Jun 7' },
      { lat: 41.9028, lng: 12.4964, label: 'Rome', date: 'Jun 12' },
    ]),
  title: z.string().default('My Trip 2026'),
  lineColor: z.string().default('#E74C3C'),
  lineWidth: z.number().min(1).max(12).default(3),
  markerColor: z.string().default('#E74C3C'),
  showDates: z.boolean().default(true),
  showTotalDistance: z.boolean().default(true),
  cameraMode: z.enum(['overview', 'followEach']).default('overview'),
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
    .default('elegantEditorial'),
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

export type MultiStopJourneyProps = z.infer<typeof schema>;

export type Stop = z.infer<typeof stopSchema>;

export const defaultProps: MultiStopJourneyProps = schema.parse({});
