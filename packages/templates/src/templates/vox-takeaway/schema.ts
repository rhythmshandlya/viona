import { z } from 'zod';

export const schema = z.object({
  takeaways: z.array(z.string()).min(1).max(4).default([
    'Renewable energy is now cheaper than fossil fuels',
    'Policy matters more than technology',
    'The transition is accelerating',
  ]),
  title: z.string().default('Key Takeaways'),
});

export type VoxTakeawayProps = z.infer<typeof schema>;
export const defaultProps: VoxTakeawayProps = schema.parse({});
