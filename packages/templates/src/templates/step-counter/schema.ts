import { z } from 'zod';

export const schema = z.object({
  steps: z
    .array(z.string())
    .default([
      'Prepare your workspace',
      'Install dependencies',
      'Configure settings',
      'Build the project',
      'Deploy to production',
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
      accent: z.string().default('#EC4899'),
      background: z.string().default('#0B0F1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type StepCounterProps = z.infer<typeof schema>;
export const defaultProps: StepCounterProps = schema.parse({});
