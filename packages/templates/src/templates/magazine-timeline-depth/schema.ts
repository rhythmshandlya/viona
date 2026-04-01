// packages/templates/src/templates/magazine-timeline-depth/schema.ts
import { z } from 'zod';

const speakerBboxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

export const schema = z.object({
  events: z.array(z.object({
    year: z.string(),
    text: z.string(),
  })).min(2).max(6).default([
    { year: '1991', text: 'Independence declared' },
    { year: '2004', text: 'Orange Revolution' },
    { year: '2014', text: 'Revolution of Dignity' },
    { year: '2022', text: 'Full-scale invasion begins' },
  ]),
  title: z.string().default('Timeline'),
  speakerBbox: speakerBboxSchema.default({ x: 0.28, y: 0.10, w: 0.44, h: 0.75 }),
  speakerCenter: z.object({
    x: z.number(),
    y: z.number(),
  }).default({ x: 0.50, y: 0.45 }),
});

export type MagazineTimelineDepthProps = z.infer<typeof schema>;
export const defaultProps: MagazineTimelineDepthProps = schema.parse({});
