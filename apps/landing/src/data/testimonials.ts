export interface Testimonial {
  quote: string;
  author: string;
  role: string;
  company: string;
  avatar?: string;
}

export const testimonials: Testimonial[] = [
  {
    quote: "Cllipify has completely transformed how we create marketing content. What used to take days now takes minutes.",
    author: "Sarah Chen",
    role: "Marketing Director",
    company: "TechFlow",
  },
  {
    quote: "The AI understands exactly what I need. It's like having a professional video editor on demand, 24/7.",
    author: "Marcus Rodriguez",
    role: "Content Creator",
    company: "Creator Studio",
  },
  {
    quote: "We've increased our video output by 10x while cutting costs in half. Cllipify is a game-changer for agencies.",
    author: "Emily Watson",
    role: "Agency Owner",
    company: "Pixel Perfect",
  },
];

export const faqs = [
  {
    question: "How does Cllipify's AI video generation work?",
    answer: "Simply describe your video idea in plain text, and our AI analyzes your prompt to generate a professional video. You can specify style, mood, duration, and other parameters to customize the output.",
  },
  {
    question: "What video formats and resolutions are supported?",
    answer: "We support all major formats including MP4, MOV, and WebM. Resolution options range from 720p for the free tier up to 4K and beyond for Pro and Enterprise plans.",
  },
  {
    question: "Can I use Cllipify videos for commercial purposes?",
    answer: "Yes! All videos created with a paid plan can be used for commercial purposes. Free tier videos include a watermark that can be removed by upgrading.",
  },
  {
    question: "How does team collaboration work?",
    answer: "Pro and Enterprise plans include real-time collaboration features. Team members can work on projects simultaneously, leave comments, and share assets in a centralized workspace.",
  },
  {
    question: "What happens if I exceed my monthly video limit?",
    answer: "You can purchase additional video credits or upgrade to a higher tier. We'll notify you when you're approaching your limit so you can plan accordingly.",
  },
  {
    question: "Is there a free trial for paid plans?",
    answer: "Yes! We offer a 14-day free trial for our Pro plan with full access to all features. No credit card required to start.",
  },
];
