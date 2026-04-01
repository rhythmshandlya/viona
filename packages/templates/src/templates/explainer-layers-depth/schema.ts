import { z } from 'zod';

const speakerBboxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

export const schema = z.object({
  title: z.string().default('Web Application Stack'),
  layers: z
    .array(
      z.object({
        label: z.string(),
        items: z.array(z.string()).max(5).optional(),
      }),
    )
    .min(3)
    .max(7)
    .default([
      { label: 'Infrastructure', items: ['AWS', 'Docker', 'K8s'] },
      { label: 'Database', items: ['PostgreSQL', 'Redis'] },
      { label: 'Backend', items: ['Node.js', 'Express', 'GraphQL'] },
      { label: 'Frontend', items: ['React', 'TypeScript', 'Tailwind'] },
      { label: 'CDN & Edge', items: ['CloudFront', 'Vercel'] },
    ]),
  speakerBbox: speakerBboxSchema.default({ x: 0.28, y: 0.10, w: 0.44, h: 0.75 }),
  speakerCenter: z.object({
    x: z.number(),
    y: z.number(),
  }).default({ x: 0.50, y: 0.45 }),
});

export type ExplainerLayersDepthProps = z.infer<typeof schema>;
export const defaultProps: ExplainerLayersDepthProps = schema.parse({});
