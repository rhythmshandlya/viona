import { z } from 'zod';

export const schema = z.object({
  label: z.string().default('BREAKING NEWS'),
  headline: z.string().default('World leaders reach historic accord on climate finance framework'),
  source: z.string().optional().default('Reuters'),
  timestamp: z.string().optional().default('Just now'),
});

export type MagazineAlertProps = z.infer<typeof schema>;
export const defaultProps: MagazineAlertProps = schema.parse({});
