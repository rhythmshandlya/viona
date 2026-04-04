import { z } from 'zod';

export const schema = z.object({
  quote: z.string().default('This agreement represents the most significant diplomatic breakthrough of the century. Its implications will reshape international relations for decades.'),
  author: z.string().default('Dr. Elena Vasquez'),
  role: z.string().optional().default('Chief Diplomatic Correspondent'),
  context: z.string().optional().default('Speaking at the Geneva Press Conference, March 2026'),
});

export type MagazineQuoteProps = z.infer<typeof schema>;
export const defaultProps: MagazineQuoteProps = schema.parse({});
