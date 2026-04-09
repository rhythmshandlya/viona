import { z } from 'zod';

export const schema = z.object({
  concept: z.string().default('National Debt'),
  metaphor: z.string().default('If every dollar was a second...'),
  revealValue: z.string().default('31.4 trillion seconds = 995,000 years'),
  revealLabel: z.string().optional().default('Time to count'),
});

export type VoxMetaphorProps = z.infer<typeof schema>;
export const defaultProps: VoxMetaphorProps = schema.parse({});
