import { z } from 'zod';

export const schema = z.object({
  question: z.string().default('What would YOU do differently?'),
  cta: z.string().default('Drop your answer in the comments!'),
  background: z.enum(['dark', 'light']).default('dark'),
  accentColor: z.string().default('#8B5CF6'),
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
      primary: z.string().default('#8B5CF6'),
      secondary: z.string().default('#FFFFFF'),
      accent: z.string().default('#8B5CF6'),
      background: z.string().default('#0B0F1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type AudienceQuestionProps = z.infer<typeof schema>;
export const defaultProps: AudienceQuestionProps = schema.parse({});
