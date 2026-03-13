import React, { useMemo } from 'react';
import { Sequence, useVideoConfig, continueRender, delayRender } from 'remotion';
import { getAvailableFonts } from '@remotion/google-fonts';
import { AnimatedSubtitle } from './AnimatedSubtitle';
import type { Rect, SubtitleItemData, SubtitleStyle } from './types';

interface SubtitleLayerProps {
  subtitles: SubtitleItemData[];
  videoRect: Rect;
  defaultStyle?: SubtitleStyle;
}

/**
 * Load a Google Font dynamically by family name.
 * Returns the CSS font-family string, or the original name if not found.
 */
function useDynamicFont(fontFamily: string | undefined): string {
  const [loadedFamily, setLoadedFamily] = React.useState<string>(fontFamily || 'Inter');
  const [handle] = React.useState(() => delayRender('Loading font'));

  React.useEffect(() => {
    let cancelled = false;

    if (!fontFamily) {
      continueRender(handle);
      return;
    }

    const fonts = getAvailableFonts();
    const match = fonts.find((f) => f.fontFamily === fontFamily);
    if (!match) {
      // Not a Google Font — use as-is (system font)
      continueRender(handle);
      return;
    }

    match.load().then(async (loaded) => {
      const info = await loaded.loadFont();
      if (!cancelled) {
        setLoadedFamily(info.fontFamily);
        continueRender(handle);
      }
    }).catch(() => {
      if (!cancelled) {
        // Font load failed — use fallback
        continueRender(handle);
      }
    });

    return () => { cancelled = true; };
  }, [fontFamily, handle]);

  return loadedFamily;
}

export const SubtitleLayer: React.FC<SubtitleLayerProps> = ({
  subtitles,
  videoRect,
  defaultStyle,
}) => {
  const { fps } = useVideoConfig();
  const requestedFont = defaultStyle?.fontFamily;
  const loadedFont = useDynamicFont(requestedFont);

  // Merge loaded font into default style
  const resolvedStyle = useMemo(() => {
    if (!defaultStyle) return defaultStyle;
    return { ...defaultStyle, fontFamily: loadedFont };
  }, [defaultStyle, loadedFont]);

  if (subtitles.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: videoRect.x,
        top: videoRect.y,
        width: videoRect.w,
        height: videoRect.h,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      {subtitles.map((item, index) => {
        const fromFrame = Math.round((item.startMs / 1000) * fps);
        const durationInFrames = Math.max(1, Math.round(((item.endMs - item.startMs) / 1000) * fps));

        const mergedStyle: SubtitleStyle = {
          ...resolvedStyle,
          ...item.style,
        };

        return (
          <Sequence
            key={index}
            from={fromFrame}
            durationInFrames={durationInFrames}
          >
            <AnimatedSubtitle
              words={item.words}
              startMs={item.startMs}
              endMs={item.endMs}
              style={mergedStyle}
            />
          </Sequence>
        );
      })}
    </div>
  );
};
