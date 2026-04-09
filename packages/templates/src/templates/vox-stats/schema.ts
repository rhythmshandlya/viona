import { z } from 'zod';

export const schema = z.object({
  value: z.string().default('2.4 million'),
  numericValue: z.number().default(2400000),
  unit: z.string().optional(),
  context: z.string().optional().default("That's 3x more than in 2010"),
  title: z.string().optional().default('People displaced'),
});

export type VoxStatsProps = z.infer<typeof schema>;
export const defaultProps: VoxStatsProps = schema.parse({});
