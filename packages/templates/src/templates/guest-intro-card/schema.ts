import { z } from 'zod';

export const schema = z.object({
  guestName: z.string().default('Alex Rivera'),
  guestTitle: z
    .string()
    .default('Senior Product Designer at Figma'),
  bio: z
    .string()
    .default(
      "10+ years building design systems for world-class teams. Author of 'Design at Scale'."
    ),
  socialHandle: z.string().default('@alexrivera'),
  background: z.enum(['dark', 'light']).default('dark'),
  accentColor: z.string().default('#8B5CF6'),
  fontPair: z
    .enum([
      'modernTech',
      'boldImpact',
      'friendlyTech',
      'strongReadable',
      'elegantEditorial',
      'newspaperClassic',
      'cleanMinimal',
    ])
    .default('cleanMinimal'),
  colors: z
    .object({
      primary: z.string().default('#FFFFFF'),
      secondary: z.string().default('#A1A1AA'),
      accent: z.string().default('#8B5CF6'),
      background: z.string().default('#09090B'),
      text: z.string().default('#FAFAFA'),
    })
    .default({}),
});

export type GuestIntroCardProps = z.infer<typeof schema>;

export const defaultProps: GuestIntroCardProps = schema.parse({});
