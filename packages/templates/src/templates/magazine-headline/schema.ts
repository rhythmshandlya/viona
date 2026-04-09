import { z } from 'zod';

export const schema = z.object({
  category: z.string().default('INVESTIGATION'),
  headline: z.string().default('The Hidden Cost of Progress'),
  dateline: z.string().optional().default('March 2026 — Special Report'),
});

export type MagazineHeadlineProps = z.infer<typeof schema>;
export const defaultProps: MagazineHeadlineProps = schema.parse({});
