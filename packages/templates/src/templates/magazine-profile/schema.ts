import { z } from 'zod';

export const schema = z.object({
  name: z.string().default('Dr. Elena Vasquez'),
  title: z.string().default('Chief Diplomatic Correspondent'),
  details: z.array(z.string()).min(1).max(5).default([
    'Based in Geneva, Switzerland',
    '15 years covering international relations',
    'Pulitzer Prize finalist, 2024',
    'Former UN press corps member',
  ]),
  initials: z.string().optional().default('EV'),
});

export type MagazineProfileProps = z.infer<typeof schema>;
export const defaultProps: MagazineProfileProps = schema.parse({});
