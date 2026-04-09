import { z } from 'zod';

export const schema = z.object({
  frames: z.array(z.object({
    label: z.string(),
    caption: z.string().optional(),
  })).min(3).max(6).default([
    { label: 'Frame 1', caption: 'Before' },
    { label: 'Frame 2', caption: 'During' },
    { label: 'Frame 3', caption: 'After' },
    { label: 'Frame 4', caption: 'Recovery' },
  ]),
  title: z.string().optional(),
});

export type VoxFilmstripProps = z.infer<typeof schema>;
export const defaultProps: VoxFilmstripProps = schema.parse({});
