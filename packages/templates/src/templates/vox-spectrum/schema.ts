import { z } from 'zod';

const markerSchema = z.object({
  label: z.string(),
  position: z.number().min(0).max(100),
});

export const schema = z.object({
  leftLabel: z.string().default('Less regulation'),
  rightLabel: z.string().default('More regulation'),
  markers: z.array(markerSchema).min(1).max(5).default([
    { label: 'US', position: 25 },
    { label: 'UK', position: 55 },
    { label: 'EU', position: 80 },
  ]),
  title: z.string().optional(),
});

export type VoxSpectrumProps = z.infer<typeof schema>;
export const defaultProps: VoxSpectrumProps = schema.parse({});
