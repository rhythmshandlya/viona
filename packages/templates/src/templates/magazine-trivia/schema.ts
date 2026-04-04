import { z } from 'zod';

export const schema = z.object({
  question: z.string().default('How many countries have a permanent seat on the UN Security Council?'),
  answer: z.string().default('Five'),
  detail: z.string().optional().default('China, France, Russia, the United Kingdom, and the United States'),
});

export type MagazineTriviaProps = z.infer<typeof schema>;
export const defaultProps: MagazineTriviaProps = schema.parse({});
