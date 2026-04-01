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
  speakerBbox: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1),
  }).optional(),
  speakerCenter: z.object({
    x: z.number(),
    y: z.number(),
  }).optional(),
});

export type MagazineChecklistProps = z.infer<typeof schema>;
export const defaultProps: MagazineChecklistProps = schema.parse({});
