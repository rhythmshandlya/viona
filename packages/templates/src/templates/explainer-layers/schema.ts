import { z } from 'zod';

export const schema = z.object({
  showBackground: z.boolean().default(false),
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
  speakerBbox: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1),
  }).optional(),
  speakerCenter: z.object({
    x: z.number(),
    y: z.number(),
  }).optional(),
});

export type ExplainerLayersProps = z.infer<typeof schema>;
export const defaultProps: ExplainerLayersProps = schema.parse({});
