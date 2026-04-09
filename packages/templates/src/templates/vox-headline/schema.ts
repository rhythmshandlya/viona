import { z } from 'zod';

export const schema = z.object({
  headline: z.string().default('This tiny line on a map caused a war'),
  subtext: z.string().optional(),
  accentBar: z.enum(['left', 'underline', 'none']).default('underline'),
  background: z.enum(['dark', 'light']).default('dark'),
});

export type VoxHeadlineProps = z.infer<typeof schema>;
export const defaultProps: VoxHeadlineProps = schema.parse({});
