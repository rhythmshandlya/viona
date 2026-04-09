import { z } from 'zod';

export const schema = z.object({
  stages: z.array(z.object({
    label: z.string(),
    value: z.string(),
  })).min(2).max(5).default([
    { label: 'Applications', value: '10,000' },
    { label: 'Interviews', value: '2,000' },
    { label: 'Offers', value: '500' },
    { label: 'Accepted', value: '200' },
  ]),
  title: z.string().optional(),
});

export type VoxFunnelProps = z.infer<typeof schema>;
export const defaultProps: VoxFunnelProps = schema.parse({});
