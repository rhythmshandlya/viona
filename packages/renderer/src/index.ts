// Main render function
export { renderVideo, type RenderOptions } from './render';

// Types
export type { SubtitleItem, VideoCompositionProps, VideoCropSettings } from './components/VideoComposition';
export type { SubtitleWord, SubtitleStyle } from './components/AnimatedSubtitle';

// Components (for potential use in web app preview)
export { VideoComposition } from './components/VideoComposition';
export { AnimatedSubtitle } from './components/AnimatedSubtitle';
export { DynamicSubtitles } from './components/DynamicSubtitles';

// Animation engine
export * from './animations';
