import { z } from 'zod';

const countdownItemSchema = z.object({
  title: z.string(),
  subtitle: z.string().default(''),
  value: z.string().default(''),
});

export const schema = z.object({
  title: z.string().default('TOP 5 PROGRAMMING LANGUAGES'),
  items: z.array(countdownItemSchema).default([
    { title: 'Python', subtitle: 'AI & Data Science', value: '28.1%' },
    { title: 'JavaScript', subtitle: 'Web Development', value: '17.4%' },
    { title: 'TypeScript', subtitle: 'Enterprise Web', value: '12.6%' },
    { title: 'Rust', subtitle: 'Systems & WASM', value: '9.8%' },
    { title: 'Go', subtitle: 'Cloud & Backend', value: '7.2%' },
  ]),
  background: z.enum(['dark', 'light', 'gradient']).default('dark'),
  accentColor: z.string().default('#6366F1'),
  numberColor: z.string().default('#6366F1'),
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

export type CountdownRevealProps = z.infer<typeof schema>;
export const defaultProps: CountdownRevealProps = schema.parse({});
