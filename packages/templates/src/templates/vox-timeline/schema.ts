import { z } from 'zod';

export const schema = z.object({
  events: z.array(z.object({
    year: z.string(),
    label: z.string(),
    description: z.string().optional(),
  })).min(3).max(6).default([
    { year: '1992', label: 'Kyoto Protocol proposed' },
    { year: '2005', label: 'Protocol enters force' },
    { year: '2015', label: 'Paris Agreement signed' },
    { year: '2021', label: 'Glasgow Climate Pact' },
  ]),
  title: z.string().optional().default('Climate Policy Timeline'),
});

export type VoxTimelineProps = z.infer<typeof schema>;
export const defaultProps: VoxTimelineProps = schema.parse({});
