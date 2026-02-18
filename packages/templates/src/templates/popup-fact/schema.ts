import { z } from 'zod';

const factSchema = z.object({
  title: z.string(),
  text: z.string(),
  icon: z.enum(['info', 'lightbulb', 'star']).optional().default('info'),
});

export const schema = z.object({
  facts: z.array(factSchema).default([
    {
      title: 'Did you know?',
      text: '90% of information transmitted to the brain is visual',
      icon: 'info',
    },
    {
      title: 'Fun Fact',
      text: 'The average attention span is now 8.25 seconds',
      icon: 'lightbulb',
    },
    {
      title: 'Research Shows',
      text: 'Videos with captions get 40% more engagement',
      icon: 'star',
    },
  ]),
  background: z.enum(['dark', 'light']).default('dark'),
  accentColor: z.string().default('#F59E0B'),
  fontPair: z
    .enum([
      'modernTech',
      'boldImpact',
      'friendlyTech',
      'strongReadable',
      'elegantEditorial',
      'cleanMinimal',
    ])
    .default('modernTech'),
  colors: z
    .object({
      primary: z.string().default('#6366F1'),
      secondary: z.string().default('#A5B4FC'),
      accent: z.string().default('#F59E0B'),
      background: z.string().default('#0B0F1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type PopupFactProps = z.infer<typeof schema>;
export type Fact = z.infer<typeof factSchema>;
export const defaultProps: PopupFactProps = schema.parse({});
