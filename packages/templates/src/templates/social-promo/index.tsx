import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { getConstants } from './constants';
import type { SocialPromoProps } from './schema';
import HookScene from './scenes/HookScene';
import BenefitsScene from './scenes/BenefitsScene';
import TestimonialScene from './scenes/TestimonialScene';
import CTAScene from './scenes/CTAScene';

const SocialPromo: React.FC<SocialPromoProps> = (props) => {
  const { COLORS, FONTS, SPRING_CONFIG, TIMING } = getConstants(props);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <Sequence
        from={TIMING.hook.start}
        durationInFrames={TIMING.hook.duration}
        name="Hook"
      >
        <HookScene
          hookText={props.hookText}
          colors={COLORS}
          fonts={FONTS}
          springConfig={SPRING_CONFIG}
        />
      </Sequence>

      <Sequence
        from={TIMING.benefits.start}
        durationInFrames={TIMING.benefits.duration}
        name="Benefits"
      >
        <BenefitsScene
          benefits={props.benefits}
          colors={COLORS}
          fonts={FONTS}
          springConfig={SPRING_CONFIG}
        />
      </Sequence>

      <Sequence
        from={TIMING.testimonial.start}
        durationInFrames={TIMING.testimonial.duration}
        name="Testimonial"
      >
        <TestimonialScene
          testimonial={props.testimonial}
          colors={COLORS}
          fonts={FONTS}
          springConfig={SPRING_CONFIG}
        />
      </Sequence>

      <Sequence
        from={TIMING.cta.start}
        durationInFrames={TIMING.cta.duration}
        name="CTA"
      >
        <CTAScene
          ctaText={props.ctaText}
          socialHandles={props.socialHandles}
          colors={COLORS}
          fonts={FONTS}
          springConfig={SPRING_CONFIG}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default SocialPromo;
