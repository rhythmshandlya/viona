import { z } from 'zod';

export const schema = z.object({
  text: z.string().default('Fun fact: This has happened before — in 1973'),
  icon: z.enum(['info', 'warning', 'star', 'pin']).default('info'),
});

export type VoxCalloutProps = z.infer<typeof schema>;
export const defaultProps: VoxCalloutProps = schema.parse({});
