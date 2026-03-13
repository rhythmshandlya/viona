import { z } from 'zod';

export const schema = z.object({
  beforeLabel: z.string().default('BEFORE'),
  afterLabel: z.string().default('AFTER'),
  morphFrame: z.number().default(60),
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

export type ShapeMorphTransitionProps = z.infer<typeof schema>;
export const defaultProps: ShapeMorphTransitionProps = schema.parse({});
