import { z } from 'zod';

const sideSchema = z.object({
  label: z.string(),
  value: z.string(),
  detail: z.string().optional(),
});

export const schema = z.object({
  sideA: sideSchema.default({ label: 'United States', value: '$65,000', detail: 'GDP per capita' }),
  sideB: sideSchema.default({ label: 'China', value: '$12,500', detail: 'GDP per capita' }),
  winner: z.enum(['a', 'b', 'none']).default('a'),
  title: z.string().optional(),
});

export type VoxVersusProps = z.infer<typeof schema>;
export const defaultProps: VoxVersusProps = schema.parse({});
