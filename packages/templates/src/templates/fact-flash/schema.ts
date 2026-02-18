import { z } from 'zod';

const factSchema = z.object({
  number: z.string(),
  label: z.string(),
  context: z.string().default(''),
});

export const schema = z.object({
  facts: z.array(factSchema).default([
    { number: '73%', label: 'of consumers', context: 'prefer short-form video content' },
    { number: '4.2B', label: 'daily views', context: 'on YouTube Shorts alone' },
    { number: '2.7x', label: 'more engagement', context: 'than static image posts' },
    { number: '90%', label: 'of marketers', context: 'plan to increase video spend' },
  ]),
  tagline: z.string().default('DID YOU KNOW?'),
  background: z.enum(['dark', 'light', 'gradient']).default('dark'),
  accentColor: z.string().default('#F59E0B'),
  fontPair: z
    .enum(['modernTech', 'boldImpact', 'friendlyTech', 'strongReadable', 'elegantEditorial', 'cleanMinimal'])
    .default('boldImpact'),
  colors: z.object({
    primary: z.string().default('#6366F1'),
    secondary: z.string().default('#A5B4FC'),
    accent: z.string().default('#EC4899'),
    background: z.string().default('#0B0F1A'),
    text: z.string().default('#FFFFFF'),
  }).default({}),
});

export type FactFlashProps = z.infer<typeof schema>;
export const defaultProps: FactFlashProps = schema.parse({});
