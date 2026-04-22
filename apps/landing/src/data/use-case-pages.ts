export interface UseCasePage {
  slug: string;
  name: string;
  tagline: string;
  summary: string;
}

export const useCasePages: UseCasePage[] = [
  {
    slug: "content-creators",
    name: "Content Creators",
    tagline: "YouTube, TikTok, Reels.",
    summary:
      "Ship more clips, faster. Cut filler, add viral captions, and auto-export vertical, square, and widescreen from a single timeline.",
  },
  {
    slug: "educators",
    name: "Educators & Course Creators",
    tagline: "Lectures that land.",
    summary:
      "Turn recordings into polished lessons with auto-generated diagrams, clean captions, and chapter-ready timing — without a production team.",
  },
  {
    slug: "teams",
    name: "Marketing & Product Teams",
    tagline: "Scale video production.",
    summary:
      "Produce launch videos, demos, tutorials, and social clips at agency speed. Brand presets, team collaboration, and prompt-based edits keep output consistent.",
  },
];
