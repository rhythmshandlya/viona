import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('Key Takeaways'),
  points: z.array(z.string()).min(2).max(5).default([
    '47 nations reached consensus in record time',
    'Humanitarian access begins within 72 hours',
    'Verification mechanisms are legally binding',
    'Next review summit scheduled for September',
  ]),
});

export type MagazineTakeawaysProps = z.infer<typeof schema>;
export const defaultProps: MagazineTakeawaysProps = schema.parse({});
