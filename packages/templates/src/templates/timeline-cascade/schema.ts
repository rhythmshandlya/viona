import { z } from 'zod';

const milestoneSchema = z.object({
  date: z.string(),
  title: z.string(),
  description: z.string().default(''),
});

export const schema = z.object({
  title: z.string().default('OUR JOURNEY'),
  milestones: z.array(milestoneSchema).default([
    { date: '2020', title: 'Founded', description: 'Started in a garage with 3 people' },
    { date: '2021', title: 'Seed Round', description: 'Raised $2M from top investors' },
    { date: '2022', title: '10K Users', description: 'Product-market fit achieved' },
    { date: '2023', title: 'Series A', description: '$15M to scale globally' },
    { date: '2024', title: '1M Users', description: 'Became market leader' },
  ]),
  background: z.enum(['dark', 'light']).default('dark'),
  accentColor: z.string().default('#6366F1'),
  fontPair: z
    .enum(['modernTech', 'boldImpact', 'friendlyTech', 'strongReadable', 'elegantEditorial', 'cleanMinimal'])
    .default('cleanMinimal'),
  colors: z.object({
    primary: z.string().default('#6366F1'),
    secondary: z.string().default('#A5B4FC'),
    accent: z.string().default('#EC4899'),
    background: z.string().default('#0B0F1A'),
    text: z.string().default('#FFFFFF'),
  }).default({}),
});

export type TimelineCascadeProps = z.infer<typeof schema>;
export const defaultProps: TimelineCascadeProps = schema.parse({});
