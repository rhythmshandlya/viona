import { z } from 'zod';

export const schema = z.object({
  text: z
    .string()
    .default(
      'The future of content creation is here and it\'s more powerful than ever before'
    ),
  highlightWords: z
    .array(z.string())
    .default(['future', 'powerful']),
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
    .default('boldImpact'),
  colors: z
    .object({
      primary: z.string().default('#F59E0B'),
      secondary: z.string().default('#FBBF24'),
      accent: z.string().default('#F59E0B'),
      background: z.string().default('#0B0F1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type KineticCaptionProps = z.infer<typeof schema>;
export const defaultProps: KineticCaptionProps = schema.parse({});
