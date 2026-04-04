import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('Red Flags'),
  items: z.array(z.string()).min(1).max(5).default([
    'Unverified sources spreading misinformation',
    'Deepfake footage circulating on social media',
    'Phishing emails disguised as aid organizations',
    'Fake donation links targeting sympathizers',
  ]),
});

export type MagazineWarningProps = z.infer<typeof schema>;
export const defaultProps: MagazineWarningProps = schema.parse({});
