import { z } from 'zod';

export const schema = z.object({
  text: z.string().default('The policy was designed to reduce emissions by 40% before 2030'),
  highlightPhrase: z.string().default('reduce emissions by 40%'),
  source: z.string().optional(),
});

export type VoxHighlightProps = z.infer<typeof schema>;
export const defaultProps: VoxHighlightProps = schema.parse({});
