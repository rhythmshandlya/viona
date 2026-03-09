import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('Should You Switch to TypeScript?'),
  pros: z
    .array(z.string())
    .default([
      'Type safety catches bugs early',
      'Better IDE autocompletion',
      'Self-documenting code',
      'Large ecosystem support',
    ]),
  cons: z
    .array(z.string())
    .default([
      'Steeper learning curve',
      'Build step required',
      'More verbose syntax',
      'Migration effort for existing projects',
    ]),
  prosColor: z.string().default('#10B981'),
  consColor: z.string().default('#EF4444'),
  background: z.enum(['dark', 'light']).default('dark'),
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

export type ProsConsProps = z.infer<typeof schema>;

export const defaultProps: ProsConsProps = schema.parse({});
