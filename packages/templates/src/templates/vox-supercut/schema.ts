import { z } from 'zod';

export const schema = z.object({
  items: z.array(z.string()).min(4).max(12).default([
    'Breaking News',
    'Alert',
    'Update',
    'Report',
    'Analysis',
    'Exclusive',
    'Investigation',
    'Revealed',
  ]),
  title: z.string().optional(),
});

export type VoxSupercutProps = z.infer<typeof schema>;
export const defaultProps: VoxSupercutProps = schema.parse({});
