import { z } from 'zod';

const handleSchema = z.object({
  platform: z.string(),
  username: z.string(),
  color: z.string().optional(),
});

export const schema = z.object({
  handles: z
    .array(handleSchema)
    .default([
      { platform: 'YouTube', username: '@creativestudio', color: '#FF0000' },
      { platform: 'Instagram', username: '@creativestudio', color: '#E4405F' },
      { platform: 'TikTok', username: '@creativestudio', color: '#000000' },
      { platform: 'X', username: '@creativestudio', color: '#1DA1F2' },
    ]),
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

export type SocialHandleBarProps = z.infer<typeof schema>;

export type Handle = z.infer<typeof handleSchema>;

export const defaultProps: SocialHandleBarProps = schema.parse({});
