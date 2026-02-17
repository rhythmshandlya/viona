import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { getConstants } from './constants';
import type { ProductLaunchProps } from './schema';
import IntroScene from './scenes/IntroScene';
import FeatureScene from './scenes/FeatureScene';
import PricingScene from './scenes/PricingScene';
import CTAScene from './scenes/CTAScene';

const ProductLaunch: React.FC<ProductLaunchProps> = (props) => {
  const { COLORS, FONTS, SPRING_CONFIG, TIMING } = getConstants(props);

  const introStart = 0;
  const featuresStart = TIMING.intro;
  const pricingStart = featuresStart + TIMING.features;
  const ctaStart = pricingStart + TIMING.pricing;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <Sequence from={introStart} durationInFrames={TIMING.intro}>
        <IntroScene
          productName={props.productName}
          tagline={props.tagline}
          colors={COLORS}
          fonts={FONTS}
          springConfig={SPRING_CONFIG}
        />
      </Sequence>

      <Sequence from={featuresStart} durationInFrames={TIMING.features}>
        <FeatureScene
          features={props.features}
          colors={COLORS}
          fonts={FONTS}
          springConfig={SPRING_CONFIG}
        />
      </Sequence>

      <Sequence from={pricingStart} durationInFrames={TIMING.pricing}>
        <PricingScene
          price={props.price}
          colors={COLORS}
          fonts={FONTS}
          springConfig={SPRING_CONFIG}
        />
      </Sequence>

      <Sequence from={ctaStart} durationInFrames={TIMING.cta}>
        <CTAScene
          ctaText={props.ctaText}
          productName={props.productName}
          colors={COLORS}
          fonts={FONTS}
          springConfig={SPRING_CONFIG}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default ProductLaunch;
