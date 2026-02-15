import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// Respect prefers-reduced-motion
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (prefersReducedMotion) {
  gsap.globalTimeline.timeScale(20); // effectively skip all animations
}

// Shared defaults
const isMobile = window.innerWidth < 768;

const DEFAULTS = {
  duration: isMobile ? 0.5 : 0.7,
  ease: "power2.out",
  y: isMobile ? 30 : 50,
  stagger: isMobile ? 0.08 : 0.12,
};

/**
 * Fade-up reveal for elements with [data-animate="fade-up"]
 */
export function initFadeUpAnimations() {
  const elements = document.querySelectorAll('[data-animate="fade-up"]');
  elements.forEach((el) => {
    gsap.from(el, {
      scrollTrigger: {
        trigger: el,
        start: "top 90%",
        toggleActions: "play none none none",
      },
      y: DEFAULTS.y,
      opacity: 0,
      duration: DEFAULTS.duration,
      ease: DEFAULTS.ease,
    });
  });
}

/**
 * Staggered children reveal for containers with [data-animate="stagger"]
 */
export function initStaggerAnimations() {
  const containers = document.querySelectorAll('[data-animate="stagger"]');
  containers.forEach((container) => {
    const children = container.children;
    gsap.from(children, {
      scrollTrigger: {
        trigger: container,
        start: "top 85%",
        toggleActions: "play none none none",
      },
      y: DEFAULTS.y,
      opacity: 0,
      duration: DEFAULTS.duration,
      ease: DEFAULTS.ease,
      stagger: DEFAULTS.stagger,
    });
  });
}

/**
 * Slide-in from left for [data-animate="slide-left"]
 */
export function initSlideLeftAnimations() {
  const elements = document.querySelectorAll('[data-animate="slide-left"]');
  elements.forEach((el) => {
    gsap.from(el, {
      scrollTrigger: {
        trigger: el,
        start: "top 85%",
        toggleActions: "play none none none",
      },
      x: -80,
      opacity: 0,
      duration: 0.8,
      ease: DEFAULTS.ease,
    });
  });
}

/**
 * Slide-in from right for [data-animate="slide-right"]
 */
export function initSlideRightAnimations() {
  const elements = document.querySelectorAll('[data-animate="slide-right"]');
  elements.forEach((el) => {
    gsap.from(el, {
      scrollTrigger: {
        trigger: el,
        start: "top 85%",
        toggleActions: "play none none none",
      },
      x: 80,
      opacity: 0,
      duration: 0.8,
      ease: DEFAULTS.ease,
    });
  });
}

/**
 * Scale-in for [data-animate="scale-in"]
 */
export function initScaleAnimations() {
  const elements = document.querySelectorAll('[data-animate="scale-in"]');
  elements.forEach((el) => {
    gsap.from(el, {
      scrollTrigger: {
        trigger: el,
        start: "top 88%",
        toggleActions: "play none none none",
      },
      scale: 0.9,
      opacity: 0,
      duration: 0.6,
      ease: "back.out(1.4)",
    });
  });
}

/**
 * Initialize all shared animations
 */
export function initAllAnimations() {
  initFadeUpAnimations();
  initStaggerAnimations();
  initSlideLeftAnimations();
  initSlideRightAnimations();
  initScaleAnimations();
}

export { gsap, ScrollTrigger, DEFAULTS };
