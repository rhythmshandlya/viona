import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('How It Happened'),
  steps: z.array(z.object({
    label: z.string(),
    description: z.string().optional(),
  })).min(2).max(5).default([
    { label: 'Delegates arrived in Geneva', description: 'From 47 nations' },
    { label: 'Framework terms negotiated', description: 'Over 72 hours non-stop' },
    { label: 'Final agreement signed', description: 'Historic unanimous vote' },
  ]),
});

export type MagazineStepsProps = z.infer<typeof schema>;
export const defaultProps: MagazineStepsProps = schema.parse({});
