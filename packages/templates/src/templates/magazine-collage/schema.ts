import { z } from 'zod';

export const schema = z.object({
  fragments: z.array(z.object({
    text: z.string(),
    style: z.enum(['headline', 'pullquote', 'label', 'stat']).default('headline'),
  })).default([
    { text: 'The Migration Question', style: 'headline' },
    { text: '2.4 Million Displaced', style: 'stat' },
    { text: 'A crisis decades in the making', style: 'pullquote' },
  ]),
  topic: z.string().default('MIGRATION'),
});

export type MagazineCollageProps = z.infer<typeof schema>;
export const defaultProps: MagazineCollageProps = schema.parse({});
