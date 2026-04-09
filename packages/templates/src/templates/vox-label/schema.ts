import { z } from 'zod';

export const schema = z.object({
  location: z.string().optional().default('Washington, D.C.'),
  date: z.string().optional().default('March 2024'),
  source: z.string().optional(),
});

export type VoxLabelProps = z.infer<typeof schema>;
export const defaultProps: VoxLabelProps = schema.parse({});
