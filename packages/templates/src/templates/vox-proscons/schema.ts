import { z } from 'zod';

export const schema = z.object({
  pros: z.array(z.string()).min(1).max(3).default(['Clean energy', 'Job creation']),
  cons: z.array(z.string()).min(1).max(3).default(['High upfront cost', 'Intermittency']),
  title: z.string().optional(),
});

export type VoxProsConsProps = z.infer<typeof schema>;
export const defaultProps: VoxProsConsProps = schema.parse({});
