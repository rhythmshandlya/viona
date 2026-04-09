import { z } from 'zod';

export const schema = z.object({
  text: z.string().default('Breaking: New data changes everything'),
  severity: z.enum(['info', 'warning', 'critical']).default('warning'),
});

export type VoxAlertProps = z.infer<typeof schema>;
export const defaultProps: VoxAlertProps = schema.parse({});
