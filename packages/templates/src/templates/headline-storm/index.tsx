import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { getConstants } from './constants';
import type { HeadlineStormProps } from './schema';
import ArticleFrame from './components/ArticleFrame';

const HeadlineStorm: React.FC<HeadlineStormProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const articleCount = props.articles.length;

  // Speed ramp: slow start, fast middle, slow end with hold
  // Phase 1 (0-30): first article holds
  // Phase 2 (30-90): accelerating flips
  // Phase 3 (90-360): rapid fire
  // Phase 4 (360-420): decelerating
  // Phase 5 (420-450): final hold
  let articleIndex: number;

  if (frame < 30) {
    articleIndex = 0;
  } else if (frame < 90) {
    const t = (frame - 30) / 60;
    const easedProgress = t * t;
    const maxArticles = Math.floor(60 / props.framesPerArticle);
    articleIndex = Math.floor(easedProgress * maxArticles);
  } else if (frame < 360) {
    const phaseFrame = frame - 90;
    const fromPhase2 = Math.floor(60 / props.framesPerArticle);
    articleIndex = fromPhase2 + Math.floor(phaseFrame / props.framesPerArticle);
  } else if (frame < 420) {
    const t = (frame - 360) / 60;
    const easedProgress = t * (2 - t);
    const fromPrev =
      Math.floor(60 / props.framesPerArticle) +
      Math.floor(270 / props.framesPerArticle);
    const maxArticles = Math.floor(60 / props.framesPerArticle);
    articleIndex = fromPrev + Math.floor(easedProgress * maxArticles);
  } else {
    const fromAll =
      Math.floor(60 / props.framesPerArticle) +
      Math.floor(270 / props.framesPerArticle) +
      Math.floor(60 / props.framesPerArticle);
    articleIndex = fromAll;
  }

  const currentArticle = props.articles[articleIndex % articleCount];

  // Flash on article switch
  const getArticleIndex = (f: number) => {
    if (f < 30) return 0;
    if (f < 90) {
      const t = (f - 30) / 60;
      return Math.floor(t * t * Math.floor(60 / props.framesPerArticle));
    }
    if (f < 360) {
      return (
        Math.floor(60 / props.framesPerArticle) +
        Math.floor((f - 90) / props.framesPerArticle)
      );
    }
    if (f < 420) {
      const t = (f - 360) / 60;
      return (
        Math.floor(60 / props.framesPerArticle) +
        Math.floor(270 / props.framesPerArticle) +
        Math.floor(t * (2 - t) * Math.floor(60 / props.framesPerArticle))
      );
    }
    return (
      Math.floor(60 / props.framesPerArticle) +
      Math.floor(270 / props.framesPerArticle) +
      Math.floor(60 / props.framesPerArticle)
    );
  };

  const prevIdx = frame > 0 ? getArticleIndex(frame - 1) : 0;
  const justSwitched = articleIndex !== prevIdx;
  const flashOpacity = justSwitched ? 0.12 : 0;

  // Intro / outro fades
  const introOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const outroOpacity = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames - 1],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill style={{ opacity: introOpacity * outroOpacity }}>
      <ArticleFrame
        article={currentArticle}
        brandName={props.brandName}
        highlightColor={props.highlightColor}
        headlineFont={FONTS.headline}
        bodyFont={FONTS.body}
        blurEnabled={props.blurEnabled}
        blurIntensity={props.blurIntensity}
        articleIndex={articleIndex % articleCount}
      />

      {/* White flash on switch */}
      <AbsoluteFill
        style={{
          backgroundColor: '#FFFFFF',
          opacity: flashOpacity,
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};

export default HeadlineStorm;
