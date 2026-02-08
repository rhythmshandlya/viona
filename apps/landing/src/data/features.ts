export interface Feature {
  icon: string;
  title: string;
  description: string;
}

export const features: Feature[] = [
  {
    icon: "mic",
    title: "Auto Transcription",
    description: "Word-level speech-to-text with 95%+ accuracy. Edit your video by editing the transcript.",
  },
  {
    icon: "sparkles",
    title: "AI Visual Generation",
    description: "Automatically creates flowcharts, diagrams, charts, and graphics that match what you're explaining.",
  },
  {
    icon: "scissors",
    title: "Filler Word Removal",
    description: "Automatically removes \"um\", \"uh\", \"like\", and awkward pauses. Clean audio, zero effort.",
  },
  {
    icon: "captions",
    title: "Animated Subtitles",
    description: "15+ animation presets including karaoke, typewriter, and word-by-word highlighting.",
  },
  {
    icon: "layout",
    title: "Smart Layouts",
    description: "Picture-in-picture, split screen, or fullscreen visuals. One click to switch between them.",
  },
  {
    icon: "download",
    title: "Export Anywhere",
    description: "Download in 1080p or 4K. Vertical for TikTok/Reels, square for LinkedIn, widescreen for YouTube.",
  },
];
