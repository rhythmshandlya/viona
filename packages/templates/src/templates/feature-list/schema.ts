import { z } from 'zod';

const featureSchema = z.object({
  icon: z.string(),
  title: z.string(),
  description: z.string(),
});

export const schema = z.object({
  heading: z.string().default('Why Teams Love Us'),
  features: z.array(featureSchema).default([
    { icon: '\u26A1', title: 'Lightning Fast', description: 'Sub-100ms response times globally' },
    { icon: '\uD83D\uDD12', title: 'Enterprise Security', description: 'SOC 2 compliant with E2E encryption' },
    { icon: '\uD83D\uDD04', title: 'Real-time Sync', description: 'Instant collaboration across all devices' },
    { icon: '\uD83D\uDCCA', title: 'Advanced Analytics', description: 'Deep insights with custom dashboards' },
  ]),
  background: z.enum(['dark', 'light']).default('dark'),
  accentColor: z.string().default('#6366F1'),
  fontPair: z
    .enum(['modernTech', 'boldImpact', 'friendlyTech', 'strongReadable', 'elegantEditorial', 'cleanMinimal'])
    .default('modernTech'),
  colors: z
    .object({
      primary: z.string().default('#6366F1'),
      secondary: z.string().default('#A5B4FC'),
      accent: z.string().default('#EC4899'),
      background: z.string().default('#0B0F1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type FeatureListProps = z.infer<typeof schema>;
export const defaultProps: FeatureListProps = schema.parse({});
