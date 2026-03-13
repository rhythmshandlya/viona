import { z } from 'zod';

const categoryEnum = z.enum(['food', 'shopping', 'parks', 'transit', 'nightlife', 'culture']);

const poiSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string(),
  category: categoryEnum,
});

const centerCoordSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string(),
});

export const schema = z.object({
  centerCoord: centerCoordSchema.default({
    lat: 40.7282,
    lng: -73.7949,
    label: 'East Village, NYC',
  }),
  pois: z
    .array(poiSchema)
    .min(1)
    .default([
      { lat: 40.7295, lng: -73.792, label: "Joe's Pizza", category: 'food' },
      { lat: 40.7265, lng: -73.798, label: 'Veselka', category: 'food' },
      { lat: 40.731, lng: -73.789, label: 'Russ & Daughters', category: 'food' },
      { lat: 40.725, lng: -73.796, label: 'Tokio 7', category: 'shopping' },
      { lat: 40.728, lng: -73.791, label: 'Strand Bookstore', category: 'shopping' },
      { lat: 40.732, lng: -73.793, label: 'Tompkins Sq Park', category: 'parks' },
      { lat: 40.726, lng: -73.794, label: 'Washington Sq Park', category: 'parks' },
      { lat: 40.729, lng: -73.7895, label: 'Astor Place Station', category: 'transit' },
      { lat: 40.7275, lng: -73.7975, label: '1st Ave Station', category: 'transit' },
      { lat: 40.7305, lng: -73.796, label: 'Webster Hall', category: 'nightlife' },
      { lat: 40.724, lng: -73.795, label: 'Nuyorican Poets', category: 'nightlife' },
      { lat: 40.73, lng: -73.787, label: 'Anthology Film', category: 'culture' },
      { lat: 40.7255, lng: -73.793, label: 'Ukrainian Museum', category: 'culture' },
    ]),
  title: z.string().default('Neighborhood Guide'),
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
  mapPadding: z.number().min(40).max(300).default(80),
  fontPair: z
    .enum([
      'modernTech',
      'boldImpact',
      'friendlyTech',
      'strongReadable',
      'elegantEditorial',
      'cleanMinimal',
    ])
    .default('friendlyTech'),
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

export type NeighborhoodGuideProps = z.infer<typeof schema>;
export type POI = z.infer<typeof poiSchema>;
export type POICategory = z.infer<typeof categoryEnum>;

export const defaultProps: NeighborhoodGuideProps = schema.parse({});
