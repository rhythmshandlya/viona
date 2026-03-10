export interface Testimonial {
  quote: string;
  author: string;
  handle?: string;
  role: string;
  company: string;
  color: string;
  featured?: boolean;
}

export const testimonials: Testimonial[] = [
  {
    quote: "I used to spend 4 hours editing each video. Now I upload, review the AI visuals, and export in 20 minutes. My engagement went up 40% in the first month.",
    author: "James Park",
    handle: "@jamespark_edu",
    role: "Course creator",
    company: "180K subscribers",
    color: "#7C3AED",
    featured: true,
  },
  {
    quote: "The AI generates diagrams that actually match what I'm explaining — not generic stock. My students say the videos are finally clear.",
    author: "Dr. Lisa Chen",
    handle: "@drlichenmd",
    role: "EdTech founder",
    company: "MedLearn Pro",
    color: "#2563EB",
    featured: true,
  },
  {
    quote: "We produce 30+ explainer videos a month. Viona cut our production time in half. The AI chat editor is the feature I didn't know I needed.",
    author: "Marcus Webb",
    handle: "@marcuswebb_vid",
    role: "Creative director",
    company: "Explainer Studio",
    color: "#059669",
    featured: true,
  },
];

export const faqs = [
  {
    question: "How does Viona understand what visuals to create?",
    answer: "Our AI analyzes your transcript to identify concepts, processes, comparisons, and data points. It then generates contextually relevant visuals—like a flowchart when you explain a process, or a chart when you mention statistics—synced exactly to when you discuss each topic.",
  },
  {
    question: "What types of visuals can Viona generate?",
    answer: "We support flowcharts, timelines, step sequences, 2x2 matrices, Venn diagrams, bar charts, line graphs, stat cards, side-by-side comparisons, text callouts, and more. The AI chooses the best format based on your content.",
  },
  {
    question: "What video formats can I upload?",
    answer: "We accept MP4, MOV, and WebM files up to 60 minutes long. The video should have clear audio for best transcription results.",
  },
  {
    question: "Can I edit the AI-generated visuals?",
    answer: "Yes! You can accept, reject, or refine any visual. Just type what you want changed—like 'make this chart blue' or 'use a pie chart instead'—and the AI will regenerate it.",
  },
  {
    question: "What about the subtitle styling options?",
    answer: "Choose from 20+ animation presets including viral styles (MrBeast, Hormozi, Ali Abdaal), cinematic styles (Netflix, typewriter), and display modes (karaoke, word-by-word). Customize fonts, colors, glow effects, and positioning.",
  },
  {
    question: "Is there a free trial?",
    answer: "Yes! The Starter plan is free forever with 5 videos per month at 720p. Upgrade to Pro for more videos, 4K quality, and no watermark.",
  },
];
