import type { AnimationType, AnimationFn } from './types';

const none: AnimationFn = () => ({});

// Viral
const elasticPopIn: AnimationFn = (p) => ({
  transform: `scale(${p < 0.6 ? p * 2 : 1 + (1 - p) * 0.4})`,
  opacity: Math.min(p * 2, 1),
});
const elasticPopOut: AnimationFn = (p) => ({
  transform: `scale(${1 - p * 0.3})`,
  opacity: 1 - p,
});
const elasticPopActive: AnimationFn = (p) => {
  const pulse = 1 + 0.05 * Math.sin(p * Math.PI * 2);
  return { transform: `scale(${pulse})` };
};

const bounceUpIn: AnimationFn = (p) => ({
  transform: `translateY(${(1 - p) * 30}px)`,
  opacity: Math.min(p * 1.5, 1),
});
const bounceUpOut: AnimationFn = (p) => ({
  transform: `translateY(${p * -20}px)`,
  opacity: 1 - p,
});
const bounceUpActive: AnimationFn = (p) => {
  const b = Math.abs(Math.sin(p * Math.PI * 3)) * 3;
  return { transform: `translateY(${-b}px)` };
};

const shakeIn: AnimationFn = (p) => ({
  transform: `scale(${p})`,
  opacity: Math.min(p * 2, 1),
});
const shakeActive: AnimationFn = (p) => {
  const x = (Math.random() - 0.5) * 4;
  const y = (Math.random() - 0.5) * 4;
  return { transform: `translate(${x}px, ${y}px)` };
};
const shakeOut: AnimationFn = (p) => ({
  transform: `scale(${1 - p})`,
  opacity: 1 - p,
});

const colorWipeIn: AnimationFn = (p) => ({
  clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`,
});
const colorWipeActive: AnimationFn = (p) => {
  const glow = 0.8 + 0.2 * Math.sin(p * Math.PI * 2);
  return { filter: `brightness(${glow})` };
};
const colorWipeOut: AnimationFn = (p) => ({
  clipPath: `inset(0 0 0 ${p * 100}%)`,
});

const flip3dIn: AnimationFn = (p) => ({
  transform: `perspective(400px) rotateX(${(1 - p) * 90}deg)`,
  opacity: p,
});
const flip3dOut: AnimationFn = (p) => ({
  transform: `perspective(400px) rotateX(${p * -90}deg)`,
  opacity: 1 - p,
});

const punchIn: AnimationFn = (p) => {
  const scale = p < 0.5 ? p * 2.8 : 1.4 - (p - 0.5) * 0.8;
  return { transform: `scale(${scale})`, opacity: Math.min(p * 3, 1) };
};
const punchOut: AnimationFn = (p) => ({
  transform: `scale(${1 - p * 0.8})`,
  opacity: Math.max(0, 1 - p * 1.5),
});

// Cinematic
const fadeRiseIn: AnimationFn = (p) => ({
  transform: `translateY(${(1 - p) * 10}px)`,
  opacity: p,
});
const fadeRiseOut: AnimationFn = (p) => ({
  transform: `translateY(${p * -10}px)`,
  opacity: 1 - p,
});

const typewriterIn: AnimationFn = (p) => ({
  clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`,
});
const typewriterActive: AnimationFn = (p) => {
  const blink = Math.floor(p * 6) % 2 === 0 ? 1 : 0;
  return { borderRight: `2px solid rgba(255,255,255,${blink})` };
};
const typewriterOut: AnimationFn = (p) => ({
  opacity: 1 - p,
});

const smoothSlideIn: AnimationFn = (p) => ({
  transform: `translateX(${(1 - p) * -30}px)`,
  opacity: p,
});
const smoothSlideOut: AnimationFn = (p) => ({
  transform: `translateX(${p * 30}px)`,
  opacity: 1 - p,
});

const softScaleIn: AnimationFn = (p) => ({
  transform: `scale(${0.8 + p * 0.2})`,
  opacity: p,
});
const softScaleOut: AnimationFn = (p) => ({
  transform: `scale(${1 - p * 0.2})`,
  opacity: 1 - p,
});

const underlineWipeIn: AnimationFn = (p) => ({
  borderBottom: '3px solid currentColor',
  borderImage: `linear-gradient(90deg, currentColor ${p * 100}%, transparent ${p * 100}%) 1`,
});
const underlineWipeOut: AnimationFn = (p) => ({
  borderBottom: '3px solid currentColor',
  borderImage: `linear-gradient(90deg, transparent ${p * 100}%, currentColor ${p * 100}%) 1`,
});

// Ad / Premium
const appleFadeIn: AnimationFn = (p) => ({
  opacity: p,
  filter: `blur(${(1 - p) * 4}px)`,
});
const appleFadeOut: AnimationFn = (p) => ({
  opacity: 1 - p,
  filter: `blur(${p * 4}px)`,
});

const googleSlideIn: AnimationFn = (p) => ({
  transform: `translateY(${(1 - p) * 16}px)`,
  opacity: p,
});
const googleSlideOut: AnimationFn = (p) => ({
  transform: `translateY(${p * -16}px)`,
  opacity: 1 - p,
});

const cleanScaleIn: AnimationFn = (p) => ({
  transform: `scale(${0.9 + p * 0.1})`,
  opacity: p,
});
const cleanScaleOut: AnimationFn = (p) => ({
  transform: `scale(${1 + p * 0.1})`,
  opacity: 1 - p,
});

const letterCascadeIn: AnimationFn = (p) => ({
  transform: `translateY(${(1 - p) * 8}px)`,
  opacity: Math.min(p * 1.5, 1),
});
const letterCascadeOut: AnimationFn = (p) => ({
  opacity: 1 - p,
});

const smoothRevealIn: AnimationFn = (p) => ({
  clipPath: `inset(${(1 - p) * 100}% 0 0 0)`,
});
const smoothRevealOut: AnimationFn = (p) => ({
  clipPath: `inset(0 0 ${p * 100}% 0)`,
});

// Registry
interface AnimationSet {
  in: AnimationFn;
  active: AnimationFn;
  out: AnimationFn;
}

export const ANIMATION_REGISTRY: Record<AnimationType, AnimationSet> = {
  'none':           { in: none, active: none, out: none },
  // Viral
  'elastic-pop':    { in: elasticPopIn, active: elasticPopActive, out: elasticPopOut },
  'bounce-up':      { in: bounceUpIn, active: bounceUpActive, out: bounceUpOut },
  'shake':          { in: shakeIn, active: shakeActive, out: shakeOut },
  'color-wipe':     { in: colorWipeIn, active: colorWipeActive, out: colorWipeOut },
  '3d-flip':        { in: flip3dIn, active: none, out: flip3dOut },
  'punch':          { in: punchIn, active: none, out: punchOut },
  // Cinematic
  'fade-rise':      { in: fadeRiseIn, active: none, out: fadeRiseOut },
  'typewriter':     { in: typewriterIn, active: typewriterActive, out: typewriterOut },
  'smooth-slide':   { in: smoothSlideIn, active: none, out: smoothSlideOut },
  'soft-scale':     { in: softScaleIn, active: none, out: softScaleOut },
  'underline-wipe': { in: underlineWipeIn, active: none, out: underlineWipeOut },
  // Ad / Premium
  'apple-fade':      { in: appleFadeIn, active: none, out: appleFadeOut },
  'google-slide':    { in: googleSlideIn, active: none, out: googleSlideOut },
  'clean-scale':     { in: cleanScaleIn, active: none, out: cleanScaleOut },
  'letter-cascade':  { in: letterCascadeIn, active: none, out: letterCascadeOut },
  'smooth-reveal':   { in: smoothRevealIn, active: none, out: smoothRevealOut },
};

export function getAnimation(type: AnimationType, phase: 'in' | 'active' | 'out'): AnimationFn {
  const set = ANIMATION_REGISTRY[type] || ANIMATION_REGISTRY['none'];
  return set[phase];
}
