import { z } from 'zod';

const articleSchema = z.object({
  source: z.string(),
  section: z.string(),
  headline: z.string(),
  subheadline: z.string(),
  author: z.string(),
  date: z.string(),
  body: z.string(),
  pageRef: z.string(),
});

export const schema = z.object({
  brandName: z.string().default('OpenAI'),
  articles: z
    .array(articleSchema)
    .default([
      {
        source: 'The New York Times',
        section: 'TECHNOLOGY',
        headline: 'OpenAI Unveils Most Powerful A.I. System in Landmark Announcement',
        subheadline: 'The new model demonstrates reasoning abilities that researchers say could reshape entire industries within months, not years.',
        author: 'By Karen Weise and Cade Metz',
        date: 'Published Feb. 12, 2026',
        body: 'OpenAI on Wednesday revealed its most advanced artificial intelligence model yet, demonstrating capabilities that stunned even veteran researchers in what industry analysts are calling a watershed moment for the technology sector. The system, which the company has been developing in secret for over a year, represents a significant leap forward in machine reasoning and creativity. Silicon Valley executives who attended a private demonstration described the technology as "nothing short of extraordinary," raising fresh questions about the pace of innovation and its implications for the global workforce. The announcement sent shockwaves through financial markets, with technology stocks surging in after-hours trading.',
        pageRef: 'Read full article \u203A',
      },
      {
        source: 'The Wall Street Journal',
        section: 'MARKETS',
        headline: 'OpenAI Secures Record $10 Billion In Funding as A.I. Race Intensifies',
        subheadline: 'The investment round, the largest for a private tech company, values the startup at roughly $300 billion.',
        author: 'By Berber Jin and Miles Kruppa',
        date: 'Updated Feb. 10, 2026 9:47 am ET',
        body: 'OpenAI has closed a funding round of more than $10 billion, according to people familiar with the matter, in a deal that values the artificial-intelligence startup at roughly $300 billion and underscores the enormous sums flowing into AI development. The investment round, led by a consortium of sovereign wealth funds and major technology investors, is the largest ever for a private technology company. The deal reflects growing conviction among institutional investors that artificial intelligence will fundamentally reshape industries from healthcare to finance.',
        pageRef: 'Read full article \u203A',
      },
      {
        source: 'Financial Times',
        section: 'REGULATION',
        headline: 'European regulators draw up sweeping rules targeting OpenAI and AI rivals',
        subheadline: 'Brussels moves to impose strict transparency requirements and mandatory safety audits on AI companies.',
        author: 'Madhumita Murgia in Brussels',
        date: 'February 8, 2026',
        body: 'OpenAI and rival AI companies face sweeping new regulatory constraints after the European Commission unveiled a comprehensive framework aimed squarely at the rapid advancement of artificial intelligence. The proposed rules, which have been in development since late last year, would impose strict transparency requirements on AI companies operating in the EU and mandate regular safety audits. Commissioner Thierry Breton said the rules were necessary to ensure that "the transformative power of AI serves European citizens rather than endangering them."',
        pageRef: 'Read full article \u203A',
      },
      {
        source: 'The Washington Post',
        section: 'EDUCATION',
        headline: 'Universities struggle to adapt as OpenAI tools reshape higher education',
        subheadline: 'A new study finds AI technology embedded in 70% of North American universities, raising questions about the future of learning.',
        author: 'By Pranshu Verma and Gerrit De Vynck',
        date: 'February 6, 2026 at 6:00 a.m. EST',
        body: 'OpenAI technology is now embedded in more than 70 percent of North American universities, fundamentally altering how students learn and how professors teach, according to a sweeping study released Thursday. The research, conducted jointly by MIT and Stanford, revealed that AI-powered tools have become so deeply integrated into academic workflows that many institutions can no longer function without them. Faculty members reported that student work has improved dramatically in quality, but expressed deep concern about whether graduates are developing genuine critical thinking skills.',
        pageRef: 'Read full article \u203A',
      },
      {
        source: 'Reuters',
        section: 'WORLD',
        headline: 'OpenAI CEO draws record crowd at Davos with vision of human-AI future',
        subheadline: 'The address drew the largest audience in the World Economic Forum\'s 54-year history.',
        author: 'Anna Googasian and Jeffrey Dastin',
        date: 'February 4, 2026 3:22 PM GMT',
        body: 'OpenAI\'s chief executive drew the largest audience in the World Economic Forum\'s 54-year history on Tuesday, delivering a keynote that outlined an ambitious vision for the future of human-AI collaboration. Speaking to a packed auditorium with thousands more watching on screens throughout the congress centre, the executive described a world in which AI systems would serve as "intellectual partners" to every person on the planet. The address drew a prolonged standing ovation, though critics were quick to point out the lack of concrete commitments on AI safety.',
        pageRef: '',
      },
      {
        source: 'The Guardian',
        section: 'HEALTH',
        headline: 'OpenAI diagnostic tools detect cancers up to 18 months earlier, study finds',
        subheadline: 'Landmark Lancet study tracking 200,000 patients shows striking results in pancreatic and ovarian cancer screening.',
        author: 'Hannah Devlin Science correspondent',
        date: 'Thu 30 Jan 2026 14.03 GMT',
        body: 'OpenAI\'s AI-powered diagnostic tools can identify certain cancers up to 18 months before traditional screening methods, according to a landmark study published in The Lancet on Thursday. Healthcare systems across three continents reported extraordinary results, with research teams showing particularly striking advances in pancreatic and ovarian cancer screening. The study, which tracked more than 200,000 patients across 14 countries over three years, is being called "potentially the most significant advance in early detection in decades" by leading oncologists.',
        pageRef: 'Read full article \u203A',
      },
      {
        source: 'Bloomberg',
        section: 'ENTERTAINMENT',
        headline: 'Hollywood\'s AI Transformation Accelerates With OpenAI Studio Deals',
        subheadline: 'Three of five major studios confirm they are already using the tools on current productions.',
        author: 'By Lucas Shaw and Ashley Carman',
        date: 'February 1, 2026, 5:00 AM PST',
        body: 'OpenAI technology is being integrated across major Hollywood production pipelines after studios quietly signed multi-year agreements valued at hundreds of millions of dollars collectively, according to people with knowledge of the deals. The agreements cover everything from AI-assisted screenwriting to automated visual effects generation, marking the entertainment industry\'s most dramatic technological shift since the transition to streaming. The deals have provoked fierce backlash from creative unions, which argue that the technology threatens hundreds of thousands of jobs.',
        pageRef: '',
      },
      {
        source: 'BBC News',
        section: 'CYBER SECURITY',
        headline: 'Intelligence agencies warn of security risks from OpenAI models',
        subheadline: 'Classified report from five nations highlights concerns about AI exploitation by hostile state actors.',
        author: 'Joe Tidy Cyber correspondent',
        date: '28 January 2026',
        body: 'OpenAI models could be exploited by hostile state actors and criminal organisations, cybersecurity experts from five nations have warned in an extraordinary joint statement. A classified report, portions of which were declassified and released to the public on Wednesday, describes several scenarios in which current AI capabilities could be used to generate sophisticated cyberattacks, create convincing disinformation campaigns at unprecedented scale, and develop novel methods of evading existing digital security measures.',
        pageRef: 'More on this story \u203A',
      },
    ]),
  highlightColor: z.string().default('#FFDD44'),
  framesPerArticle: z.number().default(4),
  blurEnabled: z.boolean().default(false),
  blurIntensity: z.number().default(0.6),
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
    .default('newspaperClassic'),
  colors: z
    .object({
      primary: z.string().default('#1A1A1A'),
      secondary: z.string().default('#555555'),
      accent: z.string().default('#C0392B'),
      background: z.string().default('#FAF9F6'),
      text: z.string().default('#1C1C1C'),
    })
    .default({}),
});

export type HeadlineStormProps = z.infer<typeof schema>;

export type Article = z.infer<typeof articleSchema>;

export const defaultProps: HeadlineStormProps = schema.parse({});
