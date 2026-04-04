import { z } from 'zod';

export const schema = z.object({
  place: z.string().default('Geneva'),
  region: z.string().optional().default('Switzerland'),
  coordinates: z.string().optional().default('46.2044° N, 6.1432° E'),
  details: z.array(z.string()).min(0).max(4).default([
    'Population: 203,000',
    'Home to 38 international organizations',
    'Site of the historic Climate Accord',
  ]),
});

export type MagazineLocationProps = z.infer<typeof schema>;
export const defaultProps: MagazineLocationProps = schema.parse({});
