import { z } from 'zod';

export const schema = z.object({
  items: z.array(z.object({
    text: z.string(),
    checked: z.boolean(),
  })).min(2).max(6).default([
    { text: 'Reduces emissions', checked: true },
    { text: 'Cost effective', checked: true },
    { text: 'Scalable', checked: false },
    { text: 'Politically feasible', checked: false },
  ]),
  title: z.string().optional().default('Policy Criteria'),
});

export type VoxChecklistProps = z.infer<typeof schema>;
export const defaultProps: VoxChecklistProps = schema.parse({});
