export interface Testimonial {
  quote: string;
  author: string;
  role: string;
  company: string;
  avatar?: string;
}

export const testimonials: Testimonial[] = [
  {
    quote: "I used to spend 4 hours editing each video. Now I upload, review the AI visuals, and export in 20 minutes. My audience says my videos are clearer than ever.",
    author: "James Park",
    role: "Course Creator",
    company: "CodeMentor Academy",
  },
  {
    quote: "The AI actually understands what I'm explaining and creates matching diagrams. Not generic stock footage—real, contextual visuals that help my viewers learn.",
    author: "Dr. Lisa Chen",
    role: "EdTech Founder",
    company: "MedLearn Pro",
  },
  {
    quote: "We produce 30+ explainer videos a month for clients. Viona cut our production time in half while making the videos more professional.",
    author: "Marcus Webb",
    role: "Creative Director",
    company: "Explainer Studio",
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
    answer: "Choose from 15+ animation presets including viral styles (bounce, shake, color-wipe), cinematic styles (fade-rise, typewriter), and display modes (karaoke, word-by-word). You can also customize fonts, colors, and positioning.",
  },
  {
    question: "Is there a free trial?",
    answer: "Yes! The Starter plan is free forever with 5 videos per month at 720p. Upgrade to Pro for more videos, 4K quality, and no watermark.",
  },
];
