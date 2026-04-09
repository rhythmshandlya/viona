import { z } from 'zod';

export const schema = z.object({
  items: z.array(z.string()).min(2).max(6).default([
    'Costs have dropped 89% since 2010',
    'Installation rates doubled last year',
    'Grid storage is the remaining bottleneck',
    'Policy incentives are working',
  ]),
  title: z.string().optional().default('Key Points'),
});

export type VoxBulletsProps = z.infer<typeof schema>;
export const defaultProps: VoxBulletsProps = schema.parse({});
