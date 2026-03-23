import { z } from 'zod';

export const schema = z.object({
  term: z.string().default('Algorithm'),
  pronunciation: z.string().optional().default('/ˈæl.ɡə.rɪ.ðəm/'),
  partOfSpeech: z.string().optional().default('noun'),
  definition: z
    .string()
    .default('A step-by-step procedure for solving a problem or accomplishing a task'),
  example: z
    .string()
    .optional()
    .default('Search engines use algorithms to rank web pages'),
});

export type ExplainerDefinitionProps = z.infer<typeof schema>;
export const defaultProps: ExplainerDefinitionProps = schema.parse({});
