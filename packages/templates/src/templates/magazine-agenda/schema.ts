import { z } from 'zod';

const slotSchema = z.object({
  time: z.string(),
  event: z.string(),
});

export const schema = z.object({
  title: z.string().default('Summit Day 1'),
  slots: z.array(slotSchema).min(2).max(6).default([
    { time: '09:00', event: 'Opening ceremony & keynote address' },
    { time: '10:30', event: 'Panel: Climate finance framework' },
    { time: '12:00', event: 'Working lunch — bilateral meetings' },
    { time: '14:00', event: 'Breakout sessions on regional targets' },
    { time: '16:30', event: 'Joint press conference' },
  ]),
});

export type MagazineAgendaProps = z.infer<typeof schema>;
export const defaultProps: MagazineAgendaProps = schema.parse({});
