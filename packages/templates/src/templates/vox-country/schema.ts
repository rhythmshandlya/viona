import { z } from 'zod';

export const schema = z.object({
  country: z.string().default('Brazil'),
  stats: z.array(z.object({
    label: z.string(),
    value: z.string(),
  })).min(1).max(4).default([
    { label: 'Population', value: '214M' },
    { label: 'GDP', value: '$1.9T' },
    { label: 'Area', value: '8.5M km²' },
  ]),
  accentColor: z.string().optional(),
});

export type VoxCountryProps = z.infer<typeof schema>;
export const defaultProps: VoxCountryProps = schema.parse({});
