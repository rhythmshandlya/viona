export interface FeaturePage {
  slug: string;
  name: string;
  tagline: string;
  summary: string;
}

export const featurePages: FeaturePage[] = [
  {
    slug: "ai-chat-editor",
    name: "AI Chat Editor",
    tagline: "Edit by prompt.",
    summary:
      "Describe any edit in plain English — cut filler words, split scenes, swap a caption style, regenerate a visual — and Viona performs it. No timeline gymnastics.",
  },
  {
    slug: "caption-templates",
    name: "Animated Caption Templates",
    tagline: "20+ subtitle styles.",
    summary:
      "Viral presets (MrBeast, Hormozi, Ali Abdaal), cinematic looks (Netflix, typewriter), and display modes (karaoke, word-by-word) — burn-in or track-based, fully customizable.",
  },
  {
    slug: "ai-visuals",
    name: "AI Visual Generation",
    tagline: "Charts and graphics, synced.",
    summary:
      "Viona analyzes your narration and auto-generates flowcharts, timelines, stat cards, comparison matrices, and more — timed precisely to what you're saying.",
  },
];
