import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('Welcome'),
  subtitle: z.string().default('Something beautiful is here'),
  background: z.enum(['light', 'cream', 'soft']).default('light'),
  accentColor: z.string().default('#E07860'),
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
      primary: z.string().default('#E07860'),      // Coral salmon (from Claude reference)
      secondary: z.string().default('#808080'),    // Medium gray (from Claude reference)
      accent: z.string().default('#E07860'),
      background: z.string().default('#F5F5F5'),   // Light gray background
      text: z.string().default('#2D2D2D'),
    })
    .default({}),
});

export type WarmIntroProps = z.infer<typeof schema>;
export const defaultProps: WarmIntroProps = schema.parse({});
