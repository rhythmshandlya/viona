import { z } from 'zod';

export const schema = z.object({
  title: z.string().optional().default('Military Comparison'),
  leftName: z.string().default('NATO'),
  rightName: z.string().default('BRICS'),
  leftStats: z.array(z.string()).min(1).max(4).default([
    '32 member nations',
    '3.5M active personnel',
    '$1.2T defense budget',
  ]),
  rightStats: z.array(z.string()).min(1).max(4).default([
    '10 member nations',
    '5.2M active personnel',
    '$420B defense budget',
  ]),
});

export type MagazineVersusProps = z.infer<typeof schema>;
export const defaultProps: MagazineVersusProps = schema.parse({});
