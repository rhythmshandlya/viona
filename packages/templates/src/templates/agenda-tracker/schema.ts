import { z } from 'zod';

export const schema = z.object({
  title: z.string().default("TODAY'S AGENDA"),
  items: z
    .array(z.string())
    .default([
      'Introduction',
      'Market Analysis',
      'Product Demo',
      'Q&A Session',
      'Next Steps',
    ]),
  background: z.enum(['dark', 'light']).default('dark'),
  accentColor: z.string().default('#6366F1'),
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
      primary: z.string().default('#6366F1'),
      secondary: z.string().default('#A5B4FC'),
      accent: z.string().default('#6366F1'),
      background: z.string().default('#0B0F1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type AgendaTrackerProps = z.infer<typeof schema>;
export const defaultProps: AgendaTrackerProps = schema.parse({});
