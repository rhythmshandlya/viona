import { z } from 'zod';

export const schema = z.object({
  name: z.string().default('Dr. Sarah Chen'),
  title: z.string().default('Climate Research Institute'),
  fact: z.string().optional().default('Published 47 peer-reviewed papers'),
  role: z.string().optional().default('Lead Researcher'),
});

export type VoxProfileProps = z.infer<typeof schema>;
export const defaultProps: VoxProfileProps = schema.parse({});
