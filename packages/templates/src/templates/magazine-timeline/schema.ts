import { z } from 'zod';

export const schema = z.object({
  events: z.array(z.object({
    year: z.string(),
    text: z.string(),
  })).min(2).max(5).default([
    { year: '2014', text: 'Crimea annexed' },
    { year: '2015', text: 'Minsk II agreement signed' },
    { year: '2022', text: 'Full-scale invasion begins' },
    { year: '2024', text: 'Peace negotiations resume' },
  ]),
  title: z.string().default('Timeline of the Conflict'),
});

export type MagazineTimelineProps = z.infer<typeof schema>;
export const defaultProps: MagazineTimelineProps = schema.parse({});
