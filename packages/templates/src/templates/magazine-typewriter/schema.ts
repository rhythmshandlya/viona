import { z } from 'zod';

export const schema = z.object({
  lines: z.array(z.string()).default([
    'The agreement was unprecedented.',
    '47 nations signed in a single day.',
    'Nothing like it had happened before.',
  ]),
  emphasis: z.number().min(0).default(1),
});

export type MagazineTypewriterProps = z.infer<typeof schema>;
export const defaultProps: MagazineTypewriterProps = schema.parse({});
