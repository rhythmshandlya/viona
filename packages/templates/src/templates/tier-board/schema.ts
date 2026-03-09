import { z } from 'zod';

const tierItemSchema = z.object({
  name: z.string(),
  tier: z.enum(['S', 'A', 'B', 'C', 'D']),
});

export const schema = z.object({
  title: z.string().default('PROGRAMMING LANGUAGES'),
  items: z.array(tierItemSchema).default([
    { name: 'TypeScript', tier: 'S' },
    { name: 'Python', tier: 'S' },
    { name: 'Rust', tier: 'A' },
    { name: 'Go', tier: 'A' },
    { name: 'Java', tier: 'B' },
    { name: 'C#', tier: 'B' },
    { name: 'PHP', tier: 'C' },
    { name: 'Ruby', tier: 'C' },
    { name: 'Perl', tier: 'D' },
  ]),
  background: z.enum(['dark', 'light']).default('dark'),
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

export type TierBoardProps = z.infer<typeof schema>;
export const defaultProps: TierBoardProps = schema.parse({});
