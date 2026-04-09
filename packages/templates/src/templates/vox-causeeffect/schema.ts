import { z } from 'zod';

export const schema = z.object({
  chain: z.array(z.object({
    label: z.string(),
    detail: z.string().optional(),
  })).min(2).max(5).default([
    { label: 'Deforestation' },
    { label: 'Soil erosion' },
    { label: 'River pollution' },
    { label: 'Fishery collapse' },
  ]),
  title: z.string().optional(),
});

export type VoxCauseEffectProps = z.infer<typeof schema>;
export const defaultProps: VoxCauseEffectProps = schema.parse({});
