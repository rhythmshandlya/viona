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

// Scale Bounce — 70%→120%→100% overshoot
const scaleBounceIn: AnimationFn = (p) => {
  const scale = p < 0.5
    ? 0.7 + p * 1.0        // 0.7 → 1.2
    : 1.2 - (p - 0.5) * 0.4; // 1.2 → 1.0
  return { transform: `scale(${scale})`, opacity: Math.min(p * 2.5, 1) };
};
const scaleBounceOut: AnimationFn = (p) => ({
  transform: `scale(${1 - p * 0.3})`,
  opacity: 1 - p,
});

// Slide Up — slide from below
const slideUpIn: AnimationFn = (p) => ({
  transform: `translateY(${(1 - p) * 40}px)`,
  opacity: Math.min(p * 2, 1),
});
const slideUpOut: AnimationFn = (p) => ({
  transform: `translateY(${p * -30}px)`,
  opacity: 1 - p,
});

// Weight Shift — simulated font weight light→bold via scaleX
const weightShiftIn: AnimationFn = (p) => ({
  transform: `scaleX(${0.85 + p * 0.15})`,
  opacity: Math.min(p * 2, 1),
  fontWeight: Math.round(300 + p * 500) as unknown as string,
});
const weightShiftActive: AnimationFn = () => ({
  fontWeight: 800 as unknown as string,
});

// Float — gentle vertical floating
const floatIn: AnimationFn = (p) => ({
  transform: `translateY(${(1 - p) * 15}px)`,
  opacity: p,
});
const floatActive: AnimationFn = (p) => {
  const y = Math.sin(p * Math.PI * 4) * 4;
  return { transform: `translateY(${y}px)` };
};
const floatOut: AnimationFn = (p) => ({
  transform: `translateY(${p * -10}px)`,
  opacity: 1 - p,
});

// Rotate Bounce — rotated entry with bounce (Ryan Trahan style)
const rotateBounceIn: AnimationFn = (p) => {
  const scale = p < 0.5 ? 0.7 + p * 1.0 : 1.2 - (p - 0.5) * 0.4;
  return {
    transform: `scale(${scale}) rotate(-6deg)`,
    opacity: Math.min(p * 2.5, 1),
  };
};
const rotateBounceOut: AnimationFn = (p) => ({
  transform: `scale(${1 - p * 0.3}) rotate(-6deg)`,
  opacity: 1 - p,
});

// Constant Wiggle — continuous subtle rotation and position jitter
const constantWiggleActive: AnimationFn = (p) => {
  const rot = Math.sin(p * Math.PI * 8) * 3;
  const y = Math.sin(p * Math.PI * 6 + 0.5) * 2;
  return { transform: `rotate(${-6 + rot}deg) translateY(${y}px)` };
};

// Slam Down — aggressive drop from top (Gary Vee style)
const slamDownIn: AnimationFn = (p) => {
  if (p < 0.7) {
    return {
      transform: `translateY(${(1 - p / 0.7) * -100}px) rotate(-3deg)`,
      opacity: Math.min(p * 2, 1),
    };
  }
  const bounce = 1 + Math.sin((p - 0.7) / 0.3 * Math.PI) * 0.1;
  return { transform: `translateY(0) rotate(-3deg) scale(${bounce})` };
};
const slamDownOut: AnimationFn = (p) => ({
  transform: `translateY(${p * 50}px) rotate(-3deg)`,
  opacity: 1 - p,
});

// Shake Entry — shake/jitter on entry
const shakeEntryIn: AnimationFn = (p) => {
  const jitter = (1 - p) * 10;
  const x = Math.sin(p * 30) * jitter;
  const y = Math.cos(p * 25) * jitter * 0.5;
  return {
    transform: `translate(${x}px, ${y}px)`,
    opacity: Math.min(p * 2, 1),
  };
};
const shakeEntryOut: AnimationFn = (p) => ({
  transform: `scale(${1 - p * 0.2})`,
  opacity: 1 - p,
});

// Bubble Pop — scale bounce with overshoot (Pastel Bubble style)
const bubblePopIn: AnimationFn = (p) => {
  const scale = p < 0.6
    ? p * 1.5           // 0 → 0.9
    : 0.9 + (p - 0.6) / 0.4 * 0.3; // 0.9 → 1.2 → 1.0
  return {
    transform: `scale(${scale})`,
    opacity: Math.min(p * 2, 1),
  };
};
const bubblePopOut: AnimationFn = (p) => ({
  transform: `scale(${1 - p * 0.4})`,
  opacity: 1 - p,
});

// Wiggle — subtle continuous wiggle
const wiggleActive: AnimationFn = (p) => {
  const rot = Math.sin(p * Math.PI * 12) * 2;
  const x = Math.cos(p * Math.PI * 10) * 2;
  return { transform: `rotate(${rot}deg) translateX(${x}px)` };
};

// Cinematic
const fadeIn: AnimationFn = (p) => ({ opacity: p });
const fadeOut: AnimationFn = (p) => ({ opacity: 1 - p });

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

// Scan Line — retro scan line effect (Vaporwave style)
const scanLineIn: AnimationFn = (p) => ({
  backgroundImage: `repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, transparent 2px, transparent 4px)`,
  clipPath: `inset(${(1 - p) * 100}% 0 0 0)`,
  opacity: Math.min(p * 2, 1),
});
const scanLineOut: AnimationFn = (p) => ({
  backgroundImage: `repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, transparent 2px, transparent 4px)`,
  clipPath: `inset(0 0 ${p * 100}% 0)`,
  opacity: 1 - p,
});

// Hand Draw — handwritten reveal effect (Cottagecore style)
const handDrawIn: AnimationFn = (p) => {
  const wobble = Math.sin(p * Math.PI * 3) * 2;
  return {
    clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`,
    transform: `rotate(${-2 + wobble}deg)`,
    opacity: Math.min(p * 1.5, 1),
  };
};
const handDrawOut: AnimationFn = (p) => ({
  transform: `rotate(${-2 + p * 3}deg)`,
  opacity: 1 - p,
});

// Underline Sweep — animated underline that sweeps (active state for underline-wipe)
const underlineSweepActive: AnimationFn = (p) => ({
  borderBottom: '3px solid #00d9ff',
  borderImage: `linear-gradient(90deg, transparent 0%, #00d9ff ${(p % 1) * 100}%, transparent ${(p % 1) * 100 + 10}%) 1`,
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

// Slide Left — slide from right to left (MKBHD style)
const slideLeftIn: AnimationFn = (p) => ({
  transform: `translateX(${(1 - p) * 50}px)`,
  opacity: Math.min(p * 2, 1),
});
const slideLeftOut: AnimationFn = (p) => ({
  transform: `translateX(${p * -50}px)`,
  opacity: 1 - p,
});

// Motion (AutoAE-inspired)

// Spotlight Reveal — radial gradient mask sweeps across text
const spotlightRevealIn: AnimationFn = (p) => ({
  maskImage: `radial-gradient(circle at ${p * 120 - 10}% 50%, black 20%, transparent 60%)`,
  WebkitMaskImage: `radial-gradient(circle at ${p * 120 - 10}% 50%, black 20%, transparent 60%)`,
  opacity: Math.min(p * 3, 1),
});
const spotlightRevealActive: AnimationFn = (p) => {
  const x = 50 + Math.sin(p * Math.PI * 2) * 30;
  return {
    maskImage: `radial-gradient(circle at ${x}% 50%, black 30%, transparent 70%)`,
    WebkitMaskImage: `radial-gradient(circle at ${x}% 50%, black 30%, transparent 70%)`,
  };
};
const spotlightRevealOut: AnimationFn = (p) => ({
  maskImage: `radial-gradient(circle at 50% 50%, black ${(1 - p) * 40}%, transparent ${(1 - p) * 80}%)`,
  WebkitMaskImage: `radial-gradient(circle at 50% 50%, black ${(1 - p) * 40}%, transparent ${(1 - p) * 80}%)`,
  opacity: 1 - p,
});

// Film Burn — warm color flash + brightness burst on entry
const filmBurnIn: AnimationFn = (p) => {
  const brightness = p < 0.3 ? 1 + (1 - p / 0.3) * 1.5 : 1;
  return {
    filter: `brightness(${brightness}) saturate(${1 + (1 - p) * 0.5})`,
    opacity: Math.min(p * 2.5, 1),
  };
};
const filmBurnOut: AnimationFn = (p) => ({
  filter: `brightness(${1 + p * 1.5}) saturate(${1 + p * 0.5})`,
  opacity: 1 - p,
});

// Glitch — transform offset + clip jitter
const glitchIn: AnimationFn = (p) => {
  const jitter = (1 - p) * 8;
  const x = (Math.sin(p * 40) * jitter);
  return {
    transform: `translate(${x}px, 0)`,
    clipPath: `inset(${Math.random() * (1 - p) * 20}% 0 ${Math.random() * (1 - p) * 20}% 0)`,
    opacity: Math.min(p * 2, 1),
  };
};
const glitchActive: AnimationFn = (p) => {
  const shouldGlitch = Math.sin(p * 50) > 0.9;
  if (!shouldGlitch) return {};
  const x = (Math.random() - 0.5) * 6;
  return {
    transform: `translate(${x}px, 0)`,
    clipPath: `inset(${Math.random() * 10}% 0 ${Math.random() * 10}% 0)`,
  };
};
const glitchOut: AnimationFn = (p) => {
  const jitter = p * 10;
  const x = Math.sin(p * 30) * jitter;
  return {
    transform: `translate(${x}px, 0)`,
    opacity: 1 - p,
  };
};

// Spin Reveal — rotateY 360° entry
const spinRevealIn: AnimationFn = (p) => ({
  transform: `perspective(400px) rotateY(${(1 - p) * 360}deg)`,
  opacity: Math.min(p * 2, 1),
});
const spinRevealOut: AnimationFn = (p) => ({
  transform: `perspective(400px) rotateY(${p * 360}deg)`,
  opacity: 1 - p,
});

// Drop Slam — fast drop from top + scale bounce on landing
const dropSlamIn: AnimationFn = (p) => {
  if (p < 0.6) {
    return {
      transform: `translateY(${(1 - p / 0.6) * -80}px) scale(${0.8 + (p / 0.6) * 0.4})`,
      opacity: Math.min(p * 3, 1),
    };
  }
  const bounce = 1 + Math.sin((p - 0.6) / 0.4 * Math.PI) * 0.15;
  return { transform: `translateY(0) scale(${bounce})` };
};
const dropSlamOut: AnimationFn = (p) => ({
  transform: `translateY(${p * 40}px) scale(${1 - p * 0.3})`,
  opacity: 1 - p,
});

// Wave — sinusoidal translateY oscillation
const waveIn: AnimationFn = (p) => ({
  transform: `translateY(${(1 - p) * 20}px)`,
  opacity: Math.min(p * 2, 1),
});
const waveActive: AnimationFn = (p) => {
  const y = Math.sin(p * Math.PI * 6) * 5;
  return { transform: `translateY(${y}px)` };
};
const waveOut: AnimationFn = (p) => ({
  transform: `translateY(${p * -15}px)`,
  opacity: 1 - p,
});

// Blur Zoom — scale up from 0.5 + blur clearing
const blurZoomIn: AnimationFn = (p) => ({
  transform: `scale(${0.5 + p * 0.5})`,
  filter: `blur(${(1 - p) * 8}px)`,
  opacity: Math.min(p * 2, 1),
});
const blurZoomOut: AnimationFn = (p) => ({
  transform: `scale(${1 + p * 0.3})`,
  filter: `blur(${p * 6}px)`,
  opacity: 1 - p,
});

// Chromatic Split — text-shadow RGB offset that converges
const chromaticSplitIn: AnimationFn = (p) => {
  const offset = (1 - p) * 6;
  return {
    textShadow: `${-offset}px 0 rgba(255,0,0,0.7), ${offset}px 0 rgba(0,255,255,0.7)`,
    opacity: Math.min(p * 2, 1),
  };
};
const chromaticSplitActive: AnimationFn = (p) => {
  const pulse = Math.sin(p * Math.PI * 4) * 2;
  return {
    textShadow: `${-pulse}px 0 rgba(255,0,0,0.5), ${pulse}px 0 rgba(0,255,255,0.5)`,
  };
};
const chromaticSplitOut: AnimationFn = (p) => {
  const offset = p * 8;
  return {
    textShadow: `${-offset}px 0 rgba(255,0,0,0.7), ${offset}px 0 rgba(0,255,255,0.7)`,
    opacity: 1 - p,
  };
};

// Elastic Horizontal — horizontal scale with overshoot (Elastic Stretch style)
const elasticHorizontalIn: AnimationFn = (p) => {
  const scaleX = p < 0.6 ? 1 + p * 0.4 : 1.24 - (p - 0.6) / 0.4 * 0.24;
  return {
    transform: `scaleX(${scaleX})`,
    opacity: Math.min(p * 2, 1),
  };
};
const elasticHorizontalOut: AnimationFn = (p) => ({
  transform: `scaleX(${1 - p * 0.3})`,
  opacity: 1 - p,
});

// Speed Blur — fast motion blur with horizontal movement (Speed Lines style)
const speedBlurIn: AnimationFn = (p) => ({
  transform: `translateX(${(1 - p) * -80}px)`,
  filter: `blur(${(1 - p) * 12}px)`,
  opacity: Math.min(p * 3, 1),
});
const speedBlurOut: AnimationFn = (p) => ({
  transform: `translateX(${p * 80}px)`,
  filter: `blur(${p * 12}px)`,
  opacity: 1 - p,
});

// Particle Explode — explode into particles on exit
const particleExplodeOut: AnimationFn = (p) => {
  const scale = 1 + p * 2;
  const blur = p * 20;
  return {
    transform: `scale(${scale})`,
    filter: `blur(${blur}px)`,
    opacity: Math.max(0, 1 - p * 2),
  };
};

// Gather — gather particles on entry (reverse of explode)
const gatherIn: AnimationFn = (p) => {
  const scale = 3 - p * 2;
  const blur = (1 - p) * 20;
  return {
    transform: `scale(${scale})`,
    filter: `blur(${blur}px)`,
    opacity: Math.min(p * 2, 1),
  };
};

// Blob Morph — liquid morphing effect
const blobMorphIn: AnimationFn = (p) => ({
  borderRadius: `${50 - p * 50}%`,
  transform: `scale(${0.8 + p * 0.2})`,
  filter: `blur(${(1 - p) * 8}px)`,
  opacity: Math.min(p * 2, 1),
});
const blobMorphActive: AnimationFn = (p) => {
  const morph = 50 + Math.sin(p * Math.PI * 4) * 30;
  return {
    borderRadius: `${morph}% ${100 - morph}% ${morph}% ${100 - morph}%`,
  };
};
const blobMorphOut: AnimationFn = (p) => ({
  borderRadius: `${p * 50}%`,
  transform: `scale(${1 - p * 0.2})`,
  filter: `blur(${p * 8}px)`,
  opacity: 1 - p,
});

// Newspaper Rotate — rotating entrance like newspaper headline
const newspaperRotateIn: AnimationFn = (p) => ({
  transform: `rotate(${(1 - p) * 360}deg) scale(${0.3 + p * 0.7})`,
  opacity: Math.min(p * 2, 1),
});
const newspaperRotateOut: AnimationFn = (p) => ({
  transform: `rotate(${p * 360}deg) scale(${1 - p * 0.7})`,
  opacity: 1 - p,
});

// Chrome Reflect — metallic reflection effect (Y2K Chrome style)
const chromeReflectIn: AnimationFn = (p) => ({
  backgroundImage: `linear-gradient(135deg, rgba(255,255,255,${p * 0.3}) 0%, transparent 50%, rgba(255,255,255,${p * 0.2}) 100%)`,
  transform: `scale(${0.8 + p * 0.2})`,
  filter: `brightness(${1 + (1 - p) * 0.5})`,
  opacity: Math.min(p * 2, 1),
});
const chromeReflectOut: AnimationFn = (p) => ({
  backgroundImage: `linear-gradient(135deg, rgba(255,255,255,${(1 - p) * 0.3}) 0%, transparent 50%, rgba(255,255,255,${(1 - p) * 0.2}) 100%)`,
  transform: `scale(${1 + p * 0.2})`,
  filter: `brightness(${1 + p * 0.5})`,
  opacity: 1 - p,
});

// Brutal Slam — harsh slam with hard edges (Brutalist style)
const brutalSlamIn: AnimationFn = (p) => {
  if (p < 0.5) {
    return {
      transform: `translateY(${(1 - p / 0.5) * -150}px) rotate(-8deg)`,
      opacity: Math.min(p * 3, 1),
    };
  }
  return {
    transform: `translateY(0) rotate(-8deg)`,
    opacity: 1,
  };
};
const brutalSlamOut: AnimationFn = (p) => ({
  transform: `translateY(${p * 100}px) rotate(-8deg)`,
  opacity: 1 - p,
});

// Neon Buzz — flickering on/off like broken neon sign
const neonBuzzIn: AnimationFn = (p) => {
  const flicker = Math.floor(p * 15) % 2 === 0 ? 1 : 0.3;
  return {
    opacity: Math.min(p * 2, 1) * flicker,
    filter: `brightness(${1 + (1 - p) * 0.5})`,
  };
};
const neonBuzzOut: AnimationFn = (p) => {
  const flicker = Math.floor(p * 15) % 2 === 0 ? 1 : 0.3;
  return {
    opacity: (1 - p) * flicker,
    filter: `brightness(${1 + p * 0.5})`,
  };
};

// Flicker — continuous random flicker (Neon Flicker active)
const flickerActive: AnimationFn = (p) => {
  const shouldFlicker = Math.sin(p * 100) > 0.85;
  return {
    opacity: shouldFlicker ? 0.4 : 1,
    filter: `brightness(${shouldFlicker ? 1.2 : 1})`,
  };
};

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
  'scale-bounce':   { in: scaleBounceIn, active: none, out: scaleBounceOut },
  'slide-up':       { in: slideUpIn, active: none, out: slideUpOut },
  'weight-shift':   { in: weightShiftIn, active: weightShiftActive, out: none },
  'float':          { in: floatIn, active: floatActive, out: floatOut },
  'rotate-bounce':  { in: rotateBounceIn, active: none, out: rotateBounceOut },
  'constant-wiggle': { in: rotateBounceIn, active: constantWiggleActive, out: rotateBounceOut },
  'slam-down':      { in: slamDownIn, active: none, out: slamDownOut },
  'shake-entry':    { in: shakeEntryIn, active: none, out: shakeEntryOut },
  'bubble-pop':     { in: bubblePopIn, active: none, out: bubblePopOut },
  'wiggle':         { in: shakeEntryIn, active: wiggleActive, out: shakeEntryOut },
  // Cinematic
  'fade':           { in: fadeIn, active: none, out: fadeOut },
  'fade-rise':      { in: fadeRiseIn, active: none, out: fadeRiseOut },
  'typewriter':     { in: typewriterIn, active: typewriterActive, out: typewriterOut },
  'smooth-slide':   { in: smoothSlideIn, active: none, out: smoothSlideOut },
  'soft-scale':     { in: softScaleIn, active: none, out: softScaleOut },
  'underline-wipe': { in: underlineWipeIn, active: none, out: underlineWipeOut },
  'scan-line':      { in: scanLineIn, active: none, out: scanLineOut },
  'hand-draw':      { in: handDrawIn, active: none, out: handDrawOut },
  'underline-sweep': { in: underlineWipeIn, active: underlineSweepActive, out: underlineWipeOut },
  // Ad / Premium
  'apple-fade':      { in: appleFadeIn, active: none, out: appleFadeOut },
  'google-slide':    { in: googleSlideIn, active: none, out: googleSlideOut },
  'clean-scale':     { in: cleanScaleIn, active: none, out: cleanScaleOut },
  'letter-cascade':  { in: letterCascadeIn, active: none, out: letterCascadeOut },
  'smooth-reveal':   { in: smoothRevealIn, active: none, out: smoothRevealOut },
  'slide-left':      { in: slideLeftIn, active: none, out: slideLeftOut },
  // Motion (AutoAE-inspired)
  'spotlight-reveal': { in: spotlightRevealIn, active: spotlightRevealActive, out: spotlightRevealOut },
  'film-burn':        { in: filmBurnIn, active: none, out: filmBurnOut },
  'glitch':           { in: glitchIn, active: glitchActive, out: glitchOut },
  'spin-reveal':      { in: spinRevealIn, active: none, out: spinRevealOut },
  'drop-slam':        { in: dropSlamIn, active: none, out: dropSlamOut },
  'wave':             { in: waveIn, active: waveActive, out: waveOut },
  'blur-zoom':        { in: blurZoomIn, active: none, out: blurZoomOut },
  'chromatic-split':  { in: chromaticSplitIn, active: chromaticSplitActive, out: chromaticSplitOut },
  'elastic-horizontal': { in: elasticHorizontalIn, active: none, out: elasticHorizontalOut },
  'speed-blur':       { in: speedBlurIn, active: none, out: speedBlurOut },
  'particle-explode': { in: gatherIn, active: none, out: particleExplodeOut },
  'gather':           { in: gatherIn, active: none, out: fadeOut },
  'blob-morph':       { in: blobMorphIn, active: blobMorphActive, out: blobMorphOut },
  'newspaper-rotate': { in: newspaperRotateIn, active: none, out: newspaperRotateOut },
  'chrome-reflect':   { in: chromeReflectIn, active: none, out: chromeReflectOut },
  'brutal-slam':      { in: brutalSlamIn, active: none, out: brutalSlamOut },
  'neon-buzz':        { in: neonBuzzIn, active: none, out: neonBuzzOut },
  'flicker':          { in: neonBuzzIn, active: flickerActive, out: neonBuzzOut },
};

export function getAnimation(type: AnimationType, phase: 'in' | 'active' | 'out'): AnimationFn {
  const set = ANIMATION_REGISTRY[type] || ANIMATION_REGISTRY['none'];
  return set[phase];
}
