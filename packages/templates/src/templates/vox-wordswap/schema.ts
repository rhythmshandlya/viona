import { z } from 'zod';

export const schema = z.object({
  sentence: z.string().default("The real problem isn't {word}"),
  wordA: z.string().default('technology'),
  wordB: z.string().default('politics'),
});

export type VoxWordswapProps = z.infer<typeof schema>;
export const defaultProps: VoxWordswapProps = schema.parse({});
