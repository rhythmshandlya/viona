import { z } from 'zod';

export const schema = z.object({
  evidence: z.object({
    label: z.string(),
    detail: z.string(),
  }).default({ label: 'The Data', detail: 'CO2 levels reached 424 ppm in 2024' }),
  interpretation: z.object({
    label: z.string(),
    detail: z.string(),
  }).default({ label: 'What It Means', detail: 'Highest level in 800,000 years' }),
  title: z.string().optional(),
});

export type VoxEvidenceProps = z.infer<typeof schema>;
export const defaultProps: VoxEvidenceProps = schema.parse({});
