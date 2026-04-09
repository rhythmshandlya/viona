import { z } from 'zod';

export const schema = z.object({
  verdict: z.string().default('The evidence is clear'),
  rationale: z.string().optional().default('Three decades of data point in the same direction'),
  confidence: z.enum(['strong', 'moderate', 'uncertain']).default('strong'),
});

export type VoxVerdictProps = z.infer<typeof schema>;
export const defaultProps: VoxVerdictProps = schema.parse({});
