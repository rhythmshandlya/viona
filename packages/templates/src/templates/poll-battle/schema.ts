import { z } from 'zod';

const optionSchema = z.object({
  label: z.string(),
  votes: z.number(),
  color: z.string().optional(),
});

export const schema = z.object({
  question: z.string().default('Which framework do you prefer?'),
  options: z.array(optionSchema).default([
    { label: 'React', votes: 4280, color: '#61DAFB' },
    { label: 'Vue', votes: 2150, color: '#42B883' },
    { label: 'Svelte', votes: 1830, color: '#FF3E00' },
    { label: 'Angular', votes: 1240, color: '#DD0031' },
  ]),
  totalLabel: z.string().default('9,500 votes'),
  background: z.enum(['dark', 'light']).default('dark'),
  accentColor: z.string().default('#6366F1'),
  fontPair: z
    .enum(['modernTech', 'boldImpact', 'friendlyTech', 'strongReadable', 'elegantEditorial', 'cleanMinimal'])
    .default('boldImpact'),
  colors: z.object({
    primary: z.string().default('#6366F1'),
    secondary: z.string().default('#A5B4FC'),
    accent: z.string().default('#EC4899'),
    background: z.string().default('#0B0F1A'),
    text: z.string().default('#FFFFFF'),
  }).default({}),
});

export type PollBattleProps = z.infer<typeof schema>;
export const defaultProps: PollBattleProps = schema.parse({});
