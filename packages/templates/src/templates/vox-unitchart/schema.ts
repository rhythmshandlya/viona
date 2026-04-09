import { z } from 'zod';

export const schema = z.object({
  total: z.number().default(100),
  highlighted: z.number().default(23),
  unit: z.string().default('people'),
  label: z.string().default('23 out of 100 affected'),
});

export type VoxUnitchartProps = z.infer<typeof schema>;
export const defaultProps: VoxUnitchartProps = schema.parse({});
