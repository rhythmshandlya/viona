import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('IPCC Report'),
  excerpt: z.string().default('Global temperatures are on track to exceed 1.5°C by 2030'),
  source: z.string().default('IPCC AR6 Synthesis'),
  year: z.string().optional().default('2023'),
});

export type VoxSourceProps = z.infer<typeof schema>;
export const defaultProps: VoxSourceProps = schema.parse({});
