import { z } from 'zod';

export const schema = z.object({
  target: z.number().default(47),
  unit: z.string().optional().default('%'),
  comparison: z.string().optional().default('up from 12% in 2015'),
  label: z.string().optional().default('of electricity from renewables'),
});

export type VoxCounterProps = z.infer<typeof schema>;
export const defaultProps: VoxCounterProps = schema.parse({});
