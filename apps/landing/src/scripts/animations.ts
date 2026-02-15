import { gsap } from "gsap";

// Respect prefers-reduced-motion
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (prefersReducedMotion) {
  gsap.globalTimeline.timeScale(20);
}

export { gsap };
