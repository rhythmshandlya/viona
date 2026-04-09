import { z } from 'zod';

export const schema = z.object({
  question: z.string().default('But why does this keep happening?'),
});

export type VoxQuestionProps = z.infer<typeof schema>;
export const defaultProps: VoxQuestionProps = schema.parse({});
