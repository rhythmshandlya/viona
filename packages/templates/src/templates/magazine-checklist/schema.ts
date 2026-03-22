import { z } from 'zod';

export const schema = z.object({
  items: z.array(z.object({
    text: z.string(),
    checked: z.boolean().default(true),
  })).min(2).max(6).default([
    { text: 'Ceasefire agreement signed', checked: true },
    { text: 'Humanitarian corridor opened', checked: true },
    { text: 'Sanctions package approved', checked: true },
  ]),
  title: z.string().default('Key Developments'),
});

export type MagazineChecklistProps = z.infer<typeof schema>;
export const defaultProps: MagazineChecklistProps = schema.parse({});
