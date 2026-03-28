import { z } from 'zod';

export const schema = z.object({
  region: z.string().default('Middle East'),
  regionLat: z.number().default(29.0),
  regionLng: z.number().default(47.0),
  label: z.string().default('THE MIDDLE EAST'),
  routePoints: z.array(z.object({
    lat: z.number(),
    lng: z.number(),
  })).default([]),
  zoomLevel: z.number().min(2).max(8).default(4),
});

export type MagazineInkmapProps = z.infer<typeof schema>;
export const defaultProps: MagazineInkmapProps = schema.parse({});
