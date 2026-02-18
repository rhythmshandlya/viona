import { z } from 'zod';

const commentSchema = z.object({
  username: z.string(),
  text: z.string(),
  likes: z.number().optional(),
});

export const schema = z.object({
  comments: z
    .array(commentSchema)
    .default([
      {
        username: '@designfan',
        text: 'This is exactly what I needed! Game changer \u{1F525}',
        likes: 142,
      },
      {
        username: '@techreview',
        text: 'Best explanation I\'ve seen on this topic',
        likes: 89,
      },
      {
        username: '@creativepro',
        text: 'Subscribed immediately after watching this',
        likes: 256,
      },
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
      'newspaperClassic',
      'cleanMinimal',
    ])
    .default('cleanMinimal'),
  colors: z
    .object({
      primary: z.string().default('#6366F1'),
      secondary: z.string().default('#818CF8'),
      accent: z.string().default('#6366F1'),
      background: z.string().default('#0B0F1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type CommentHighlightProps = z.infer<typeof schema>;

export type Comment = z.infer<typeof commentSchema>;

export const defaultProps: CommentHighlightProps = schema.parse({});
