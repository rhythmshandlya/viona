import { z } from 'zod';

export const schema = z.object({
  cause: z.string().default('Rising global temperatures melt polar ice caps'),
  effect: z.string().default('Sea levels rise, threatening coastal cities'),
  label: z.string().optional().default('Therefore'),
});

export type ExplainerCauseEffectProps = z.infer<typeof schema>;
export const defaultProps: ExplainerCauseEffectProps = schema.parse({});
