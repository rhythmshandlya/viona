// Types
export type {
  TemplateMeta,
  CompositionMeta,
  TemplateFile,
  TemplateRegistryEntry,
  TemplateCategory,
  AspectRatio,
  TemplateFilters,
} from './types';

// Registry
export {
  registerTemplate,
  getTemplate,
  listTemplates,
  getTemplateFiles,
} from './registry';

// Scaling
export { useScale } from './use-scale';

// Fonts
export {
  FONTS,
  FONT_PAIRS,
  FONT_WEIGHTS,
  FONT_SIZES,
  getFontPairForContent,
} from './fonts';

// Register all templates
import './templates/headline-storm/register';
import './templates/watercolor-map/register';
import './templates/country-highlight/register';
import './templates/stat-counter/register';
import './templates/stat-bar-chart/register';
import './templates/stat-donut/register';
import './templates/stat-line-chart/register';
import './templates/stat-progress/register';
import './templates/stat-comparison/register';
import './templates/bar-chart-race/register';
import './templates/quote-pulse/register';
import './templates/countdown-reveal/register';
import './templates/before-after-reveal/register';
import './templates/poll-battle/register';
import './templates/fact-flash/register';
import './templates/tier-board/register';
import './templates/logo-stinger/register';
import './templates/process-flow/register';
import './templates/timeline-cascade/register';
import './templates/testimonial-card/register';
import './templates/event-announce/register';
import './templates/feature-list/register';
import './templates/speaker-id/register';
import './templates/social-handle-bar/register';
import './templates/topic-title/register';
import './templates/chapter-card/register';
import './templates/kinetic-caption/register';
import './templates/keyword-pop/register';
import './templates/subscribe-nudge/register';
import './templates/link-callout/register';
import './templates/bullet-stack/register';
import './templates/versus-screen/register';
import './templates/pros-cons/register';
import './templates/channel-intro/register';
import './templates/end-screen/register';
import './templates/popup-fact/register';
import './templates/source-cite/register';
import './templates/product-card/register';
import './templates/definition-tooltip/register';
import './templates/guest-intro-card/register';
import './templates/agenda-tracker/register';
import './templates/qr-code-reveal/register';
import './templates/follower-milestone/register';
import './templates/comment-highlight/register';
import './templates/rating-display/register';
import './templates/step-counter/register';
import './templates/glitch-transition/register';
import './templates/swipe-wipe/register';
import './templates/news-ticker/register';
import './templates/alert-banner/register';
import './templates/coupon-badge/register';
import './templates/emoji-burst/register';
import './templates/score-meter/register';
import './templates/audience-question/register';
import './templates/location-tag/register';
import './templates/credits-roll/register';
import './templates/formula-display/register';
import './templates/emoji-slider-poll/register';
import './templates/number-ticker/register';
import './templates/split-stat/register';
import './templates/indiana-jones/register';
