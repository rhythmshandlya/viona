import { z } from 'zod';

export const schema = z.object({
  number: z.string().default('73%'),
  quote: z.string().default('Of executives surveyed believe the current approach is unsustainable within five years.'),
  source: z.string().default('Global Leadership Survey, 2026'),
});

export type MagazineSplitquoteProps = z.infer<typeof schema>;
export const defaultProps: MagazineSplitquoteProps = schema.parse({});
