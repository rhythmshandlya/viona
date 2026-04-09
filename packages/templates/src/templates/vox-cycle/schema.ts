import { z } from 'zod';

export const schema = z.object({
  steps: z.array(z.string()).min(3).max(6).default([
    'Produce',
    'Consume',
    'Waste',
    'Recycle',
  ]),
  title: z.string().optional().default('Circular Economy'),
});

export type VoxCycleProps = z.infer<typeof schema>;
export const defaultProps: VoxCycleProps = schema.parse({});
