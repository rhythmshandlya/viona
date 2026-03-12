import type { AnimationConfig } from './types';

export function migrateAnimation(legacy: string): AnimationConfig {
  switch (legacy) {
    case 'pop':
      return { in: 'elastic-pop', active: 'none', out: 'none', easing: 'spring' };
    case 'fade':
      return { in: 'fade-rise', active: 'none', out: 'fade-rise', easing: 'ease-out' };
    case 'highlight':
      return { in: 'soft-scale', active: 'none', out: 'none', easing: 'ease-out' };
    case 'none':
    default:
      return { in: 'none', active: 'none', out: 'none', easing: 'linear' };
  }
}
