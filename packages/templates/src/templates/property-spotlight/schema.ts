import { z } from 'zod';

const amenityCategorySchema = z.enum([
  'school',
  'park',
  'transit',
  'shop',
  'restaurant',
  'gym',
]);

const amenitySchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string(),
  category: amenityCategorySchema,
});

const propertyCoordSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string(),
});

export const schema = z.object({
  propertyCoord: propertyCoordSchema.default({
    lat: 40.758,
    lng: -73.9855,
    label: '123 Main St',
  }),
  amenities: z
    .array(amenitySchema)
    .default([
      { lat: 40.7614, lng: -73.9776, label: 'Central Library', category: 'school' },
      { lat: 40.7644, lng: -73.9723, label: 'Central Park', category: 'park' },
      { lat: 40.7527, lng: -73.9772, label: 'Grand Central', category: 'transit' },
      { lat: 40.759, lng: -73.9845, label: 'Times Sq Mall', category: 'shop' },
      { lat: 40.755, lng: -73.987, label: "Hell's Kitchen Bistro", category: 'restaurant' },
      { lat: 40.761, lng: -73.991, label: 'Equinox Gym', category: 'gym' },
      { lat: 40.7505, lng: -73.9934, label: 'Penn Station', category: 'transit' },
      { lat: 40.758, lng: -73.975, label: 'Bryant Park', category: 'park' },
      { lat: 40.763, lng: -73.99, label: 'PS 111', category: 'school' },
      { lat: 40.756, lng: -73.98, label: 'Café Roma', category: 'restaurant' },
    ]),
  radii: z.array(z.number()).default([500, 1000, 2000]),
  title: z.string().default('Nearby Amenities'),
  mapStyle: z
    .enum(['satellite', 'watercolor', 'toner', 'tonerLite', 'terrain', 'osm', 'darkMatter', 'voyager', 'positron'])
    .default('satellite'),
  mapPadding: z.number().min(20).max(200).default(60),
  fontPair: z
    .enum([
      'modernTech',
      'boldImpact',
      'friendlyTech',
      'strongReadable',
      'elegantEditorial',
      'cleanMinimal',
    ])
    .default('cleanMinimal'),
  colors: z
    .object({
      primary: z.string().default('#7C3AED'),
      secondary: z.string().default('#2C3E50'),
      accent: z.string().default('#00D4FF'),
      background: z.string().default('#F5F0EB'),
      text: z.string().default('#2C3E50'),
    })
    .default({}),
});

export type PropertySpotlightProps = z.infer<typeof schema>;
export type AmenityCategory = z.infer<typeof amenityCategorySchema>;
export type Amenity = z.infer<typeof amenitySchema>;
export type PropertyCoord = z.infer<typeof propertyCoordSchema>;

export const defaultProps: PropertySpotlightProps = schema.parse({});
