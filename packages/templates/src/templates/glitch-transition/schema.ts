import { z } from 'zod';

export const schema = z.object({
  text: z.string().optional().default('NEXT TOPIC'),
  intensity: z.number().min(0.5).max(2.0).default(1.0),
  background: z.enum(['dark', 'light']).default('dark'),
  accentColor: z.string().default('#00FFFF'),
  fontPair: z
    .enum([
      'modernTech',
      'boldImpact',
      'friendlyTech',
      'strongReadable',
      'elegantEditorial',
      'newspaperClassic',
      'cleanMinimal',
    ])
    .default('modernTech'),
  colors: z
    .object({
      primary: z.string().default('#0A0A0A'),
      secondary: z.string().default('#1A1A2E'),
      accent: z.string().default('#00FFFF'),
      background: z.string().default('#050510'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type GlitchTransitionProps = z.infer<typeof schema>;

export const defaultProps: GlitchTransitionProps = schema.parse({});
