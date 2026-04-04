import { z } from 'zod';

export const schema = z.object({
  subject: z.string().default('Geneva Peace Framework'),
  rating: z.string().default('8.5'),
  ratingLabel: z.string().default('out of 10'),
  highlights: z.array(z.string()).min(2).max(4).default([
    'Broadest multilateral support since 1945',
    'Enforceable verification mechanisms',
    'Immediate humanitarian impact',
  ]),
  recommendation: z.string().default('A landmark achievement, though implementation remains the true test.'),
});

export type MagazineVerdictProps = z.infer<typeof schema>;
export const defaultProps: MagazineVerdictProps = schema.parse({});
