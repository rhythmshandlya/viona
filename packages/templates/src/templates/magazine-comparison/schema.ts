import { z } from 'zod';

export const schema = z.object({
  leftLabel: z.string().default('NATO'),
  rightLabel: z.string().default('BRICS'),
  items: z.array(z.object({
    category: z.string(),
    left: z.string(),
    right: z.string(),
  })).min(2).max(5).default([
    { category: 'Members', left: '32 nations', right: '10 nations' },
    { category: 'GDP Share', left: '~45% of world', right: '~35% of world' },
    { category: 'Military', left: '3.5M active', right: '5.2M active' },
  ]),
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

export type MagazineComparisonProps = z.infer<typeof schema>;
export const defaultProps: MagazineComparisonProps = schema.parse({});
