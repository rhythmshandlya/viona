import { FONT_PAIRS } from '../../fonts';
import type { TutorialIntroProps } from './schema';

export function getConstants(props: TutorialIntroProps) {
  const fontPair = FONT_PAIRS[props.fontPair];

  const COLORS = {
    primary: props.colors.primary,
    secondary: props.colors.secondary,
    accent: props.colors.accent,
    background: props.colors.background,
    text: props.colors.text,
  };

  const FONTS = {
    headline: fontPair.headline,
    body: fontPair.body,
  };

  const SPRING_CONFIG = {
    damping: 22,
    stiffness: 90,
    mass: 0.9,
  };

  const TOTAL_FRAMES = 360;
  const SCENE_COUNT = 3;
  const FRAMES_PER_SCENE = TOTAL_FRAMES / SCENE_COUNT; // 120

  const TIMING = {
    totalFrames: TOTAL_FRAMES,
    sceneCount: SCENE_COUNT,
    framesPerScene: FRAMES_PER_SCENE,
    scene1: { start: 0, duration: FRAMES_PER_SCENE },
    scene2: { start: FRAMES_PER_SCENE, duration: FRAMES_PER_SCENE },
    scene3: { start: FRAMES_PER_SCENE * 2, duration: FRAMES_PER_SCENE },
  };

  return { COLORS, FONTS, SPRING_CONFIG, TIMING };
}
