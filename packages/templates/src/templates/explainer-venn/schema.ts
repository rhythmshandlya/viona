import { z } from 'zod';

export const schema = z.object({
  showBackground: z.boolean().default(false),
  title: z.string().default('Frontend vs Backend'),
  leftLabel: z.string().default('Frontend'),
  rightLabel: z.string().default('Backend'),
  leftItems: z.array(z.string()).min(1).max(4).default(['UI/UX', 'CSS', 'React']),
  rightItems: z.array(z.string()).min(1).max(4).default(['Database', 'APIs', 'Auth']),
  sharedItems: z.array(z.string()).min(1).max(3).default(['JavaScript', 'Testing']),
});

export type ExplainerVennProps = z.infer<typeof schema>;
export const defaultProps: ExplainerVennProps = schema.parse({});
