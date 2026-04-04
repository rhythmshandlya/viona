import { z } from 'zod';

export const schema = z.object({
  topic: z.string().default('Common Misconception'),
  myth: z.string().default('The conflict began in 2022 with no prior warning.'),
  fact: z.string().default('Tensions had been escalating since 2014, with multiple diplomatic failures preceding the full-scale conflict.'),
});

export type MagazineMythfactProps = z.infer<typeof schema>;
export const defaultProps: MagazineMythfactProps = schema.parse({});
