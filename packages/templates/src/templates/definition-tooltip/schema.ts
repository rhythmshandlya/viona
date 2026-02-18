import { z } from 'zod';

export const schema = z.object({
  term: z.string().default('Algorithm'),
  pronunciation: z.string().default('/\u02C8\u00E6l\u0261\u0259\u02CCr\u026A\u00F0\u0259m/'),
  partOfSpeech: z.string().default('noun'),
  definition: z
    .string()
    .default(
      'A process or set of rules to be followed in calculations or problem-solving operations, especially by a computer.'
    ),
  example: z.string().optional().default('The search algorithm ranks results by relevance.'),
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

export type DefinitionTooltipProps = z.infer<typeof schema>;
export const defaultProps: DefinitionTooltipProps = schema.parse({});
