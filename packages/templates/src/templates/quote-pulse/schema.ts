import { z } from 'zod';

const phraseSchema = z.object({
  text: z.string(),
  emphasis: z.boolean().default(false),
});

export const schema = z.object({
  phrases: z.array(phraseSchema).default([
    { text: 'The only way', emphasis: false },
    { text: 'to do great work', emphasis: false },
    { text: 'is to love', emphasis: true },
    { text: 'what you do.', emphasis: false },
  ]),
  author: z.string().default('Steve Jobs'),
  authorTitle: z.string().default(''),
  style: z.enum(['centered', 'stacked']).default('centered'),
  background: z.enum(['dark', 'light', 'gradient']).default('dark'),
  accentColor: z.string().default('#6366F1'),
  fontPair: z
    .enum(['modernTech', 'boldImpact', 'friendlyTech', 'strongReadable', 'elegantEditorial', 'cleanMinimal'])
    .default('boldImpact'),
  colors: z
    .object({
      primary: z.string().default('#6366F1'),
      secondary: z.string().default('#A5B4FC'),
      accent: z.string().default('#EC4899'),
      background: z.string().default('#0B0F1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type QuotePulseProps = z.infer<typeof schema>;
export const defaultProps: QuotePulseProps = schema.parse({});
