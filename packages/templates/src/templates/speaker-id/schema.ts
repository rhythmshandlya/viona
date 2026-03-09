import { z } from 'zod';

export const schema = z.object({
  name: z.string().default('Sarah Chen'),
  title: z.string().default('VP of Engineering'),
  company: z.string().default('TechCorp Inc.'),
  background: z.enum(['dark', 'light']).default('dark'),
  accentColor: z.string().default('#6366F1'),
  fontPair: z
    .enum([
      'modernTech',
      'boldImpact',
      'friendlyTech',
      'strongReadable',
      'elegantEditorial',
      'cleanMinimal',
    ])
    .default('cleanMinimal'),
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

export type SpeakerIdProps = z.infer<typeof schema>;

export const defaultProps: SpeakerIdProps = schema.parse({});
