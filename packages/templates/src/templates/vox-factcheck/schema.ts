import { z } from 'zod';

export const schema = z.object({
  claim: z.string().default('Nuclear energy is the most dangerous power source'),
  reality: z.string().default('Coal kills 800x more people per unit of energy than nuclear'),
  source: z.string().optional(),
});

export type VoxFactCheckProps = z.infer<typeof schema>;
export const defaultProps: VoxFactCheckProps = schema.parse({});
