import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('Getting Started with React'),
  subtitle: z.string().default("A Complete Beginner's Guide"),
  author: z.string().default('Your Name'),
  topics: z.array(z.string()).default(['Components', 'State Management', 'Hooks']),
  chapters: z
    .array(
      z.object({
        number: z.number(),
        title: z.string(),
      })
    )
    .default([
      { number: 1, title: 'Setting Up Your Environment' },
      { number: 2, title: 'Your First Component' },
      { number: 3, title: 'Managing State' },
      { number: 4, title: 'Working with Hooks' },
    ]),
  colors: z
    .object({
      primary: z.string().default('#3B82F6'),
      secondary: z.string().default('#6366F1'),
      accent: z.string().default('#0EA5E9'),
      background: z.string().default('#F8FAFC'),
      text: z.string().default('#0F172A'),
    })
    .default({}),
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
});

export type TutorialIntroProps = z.infer<typeof schema>;

export const defaultProps: TutorialIntroProps = schema.parse({});
