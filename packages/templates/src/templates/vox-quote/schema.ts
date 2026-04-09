import { z } from 'zod';

export const schema = z.object({
  quote: z.string().default('The data clearly shows this trend is accelerating beyond what anyone predicted'),
  speaker: z.string().default('Dr. Sarah Chen'),
  title: z.string().optional().default('Climate Research Institute'),
});

export type VoxQuoteProps = z.infer<typeof schema>;
export const defaultProps: VoxQuoteProps = schema.parse({});
