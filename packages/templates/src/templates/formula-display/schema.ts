import { z } from 'zod';

const formulaPartSchema = z.object({
  text: z.string(),
  isHighlight: z.boolean().optional(),
});

const variableSchema = z.object({
  symbol: z.string(),
  meaning: z.string(),
});

export const schema = z.object({
  title: z.string().default('Mass-Energy Equivalence'),
  formulaParts: z
    .array(formulaPartSchema)
    .default([
      { text: 'E' },
      { text: ' = ', isHighlight: false },
      { text: 'mc', isHighlight: true },
      { text: '\u00B2' },
    ]),
  description: z
    .string()
    .default('Energy equals mass times the speed of light squared'),
  variables: z
    .array(variableSchema)
    .default([
      { symbol: 'E', meaning: 'Energy (joules)' },
      { symbol: 'm', meaning: 'Mass (kilograms)' },
      { symbol: 'c', meaning: 'Speed of light (3\u00D710\u2078 m/s)' },
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
      'newspaperClassic',
      'cleanMinimal',
    ])
    .default('elegantEditorial'),
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

export type FormulaDisplayProps = z.infer<typeof schema>;
export const defaultProps: FormulaDisplayProps = schema.parse({});
