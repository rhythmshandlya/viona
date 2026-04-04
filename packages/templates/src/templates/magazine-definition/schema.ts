import { z } from 'zod';

export const schema = z.object({
  term: z.string().default('Ceasefire'),
  pronunciation: z.string().optional().default('/\u02C8si\u02D0s.fa\u026A.\u0259r/'),
  definition: z.string().default('A temporary suspension of fighting, typically one during which peace talks take place; an agreement to stop fighting.'),
  category: z.string().optional().default('International Law'),
});

export type MagazineDefinitionProps = z.infer<typeof schema>;
export const defaultProps: MagazineDefinitionProps = schema.parse({});
