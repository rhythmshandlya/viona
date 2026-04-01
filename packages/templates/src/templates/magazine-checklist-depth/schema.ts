// packages/templates/src/templates/magazine-checklist-depth/schema.ts
import { z } from 'zod';

const speakerBboxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

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
  speakerBbox: speakerBboxSchema.default({ x: 0.28, y: 0.10, w: 0.44, h: 0.75 }),
  speakerCenter: z.object({
    x: z.number(),
    y: z.number(),
  }).default({ x: 0.50, y: 0.45 }),
});

export type MagazineChecklistDepthProps = z.infer<typeof schema>;
export const defaultProps: MagazineChecklistDepthProps = schema.parse({});
