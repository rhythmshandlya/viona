import { z } from 'zod';

export const schema = z.object({
  fact: z.string().default('The International Space Station orbits Earth every 92 minutes, meaning astronauts witness 16 sunrises and sunsets each day.'),
  source: z.string().optional().default('NASA'),
});

export type MagazineDidyouknowProps = z.infer<typeof schema>;
export const defaultProps: MagazineDidyouknowProps = schema.parse({});
