import { z } from 'zod';

export const schema = z.object({
  headline: z.string().default('Breaking Development in Global Trade'),
  subhead: z.string().default('New agreements reshape international commerce'),
  publicationDate: z.string().default('March 21, 2026'),
  section: z.string().default('WORLD AFFAIRS'),
});

export type MagazineNewspaperProps = z.infer<typeof schema>;
export const defaultProps: MagazineNewspaperProps = schema.parse({});
