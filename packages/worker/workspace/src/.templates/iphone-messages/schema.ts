import { z } from 'zod';

const msgSchema = z.object({
  text: z.string().default(''),
  from: z.enum(['me', 'them']).default('them'),
});

export const schema = z.object({
  contactName: z.string().default('Alex'),
  contactEmoji: z.string().default('A'),
  msg1: msgSchema.default({ text: 'Hey! How are you?', from: 'them' }),
  msg2: msgSchema.default({ text: "I'm great! Just shipped v2.0", from: 'me' }),
  msg3: msgSchema.default({ text: 'No way, congrats!', from: 'them' }),
  msg4: msgSchema.default({ text: 'Thanks! Team worked so hard on it', from: 'me' }),
  msg5: msgSchema.default({ text: 'We should celebrate', from: 'them' }),
  msg6: msgSchema.default({ text: '', from: 'me' }),
  theme: z.enum(['light', 'dark']).default('light'),
  phoneColor: z.enum(['space-black', 'silver', 'gold', 'deep-purple']).default('space-black'),
  myBubbleColor: z.string().default('#007AFF'),
  backgroundColor: z.string().default('#0a0a1a'),
  showKeyboard: z.boolean().default(true),
});

export type IPhoneMessagesProps = z.infer<typeof schema>;

export const defaultProps: IPhoneMessagesProps = schema.parse({});
