import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('Key Takeaways'),
  items: z
    .array(z.string())
    .default([
      'Automate repetitive tasks',
      'Focus on high-impact work',
      'Measure what matters',
      'Iterate based on data',
      'Ship fast, learn faster',
    ]),
  markerStyle: z.enum(['checkmark', 'number', 'dot']).default('checkmark'),
  background: z.enum(['dark', 'light']).default('dark'),
  accentColor: z.string().default('#10B981'),
  fontPair: z
    .enum([
      'modernTech',
      'boldImpact',
      'friendlyTech',
      'strongReadable',
      'elegantEditorial',
      'cleanMinimal',
    ])
    .default('cleanMinimal'),
  colors: z
    .object({
      primary: z.string().default('#10B981'),
      secondary: z.string().default('#6EE7B7'),
      accent: z.string().default('#10B981'),
      background: z.string().default('#0B0F1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type BulletStackProps = z.infer<typeof schema>;
export const defaultProps: BulletStackProps = schema.parse({});
