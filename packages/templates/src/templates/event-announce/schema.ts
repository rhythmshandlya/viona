import { z } from 'zod';

export const schema = z.object({
  eventTitle: z.string().default('Design Systems\nConference 2026'),
  date: z.string().default('March 15, 2026'),
  time: z.string().default('9:00 AM — 5:00 PM PST'),
  location: z.string().default('San Francisco, CA'),
  cta: z.string().default('Register Now — Free'),
  background: z.enum(['dark', 'light']).default('dark'),
  accentColor: z.string().default('#8B5CF6'),
  fontPair: z
    .enum([
      'modernTech',
      'boldImpact',
      'friendlyTech',
      'strongReadable',
      'elegantEditorial',
      'cleanMinimal',
    ])
    .default('boldImpact'),
  colors: z
    .object({
      primary: z.string().default('#8B5CF6'),
      secondary: z.string().default('#C4B5FD'),
      accent: z.string().default('#EC4899'),
      background: z.string().default('#0B0F1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type EventAnnounceProps = z.infer<typeof schema>;
export const defaultProps: EventAnnounceProps = schema.parse({});
