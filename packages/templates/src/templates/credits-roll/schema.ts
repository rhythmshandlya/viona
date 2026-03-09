import { z } from 'zod';

const creditEntrySchema = z.object({
  role: z.string(),
  names: z.array(z.string()),
});

export const schema = z.object({
  title: z.string().default('CREDITS'),
  credits: z
    .array(creditEntrySchema)
    .default([
      { role: 'Directed by', names: ['Alex Rivera'] },
      { role: 'Written by', names: ['Sarah Chen'] },
      { role: 'Produced by', names: ['Mike Johnson', 'Lisa Park'] },
      { role: 'Music by', names: ['David Kim'] },
      {
        role: 'Special Thanks',
        names: ['The entire community', 'Our amazing supporters'],
      },
    ]),
  background: z.enum(['dark', 'light']).default('dark'),
  accentColor: z.string().default('#F59E0B'),
  fontPair: z
    .enum([
      'modernTech',
      'boldImpact',
      'friendlyTech',
      'strongReadable',
      'elegantEditorial',
      'cleanMinimal',
    ])
    .default('elegantEditorial'),
  colors: z
    .object({
      primary: z.string().default('#F59E0B'),
      secondary: z.string().default('#AAAAAA'),
      accent: z.string().default('#F59E0B'),
      background: z.string().default('#0A0A0A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type CreditsRollProps = z.infer<typeof schema>;

export type CreditEntry = z.infer<typeof creditEntrySchema>;

export const defaultProps: CreditsRollProps = schema.parse({});
