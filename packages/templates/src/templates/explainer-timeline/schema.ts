import { z } from 'zod';

export const schema = z.object({
  title: z.string().optional().default('History of the Internet'),
  events: z
    .array(
      z.object({
        date: z.string(),
        label: z.string(),
        detail: z.string().optional(),
      }),
    )
    .min(3)
    .max(6)
    .default([
      { date: '1969', label: 'ARPANET', detail: 'First network connection' },
      { date: '1983', label: 'TCP/IP', detail: 'Standard protocol adopted' },
      { date: '1991', label: 'World Wide Web', detail: 'Tim Berners-Lee goes public' },
      { date: '2007', label: 'Mobile Era', detail: 'iPhone launches' },
    ]),
});

export type ExplainerTimelineProps = z.infer<typeof schema>;
export const defaultProps: ExplainerTimelineProps = schema.parse({});
