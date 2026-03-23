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
import './templates/globe-spin/register';
import './templates/watercolor-map/register';
import './templates/country-highlight/register';
import './templates/magazine-newspaper/register';
import './templates/magazine-collage/register';
import './templates/magazine-inkmap/register';
import './templates/magazine-typewriter/register';
import './templates/magazine-checklist/register';
import './templates/magazine-timeline/register';
import './templates/magazine-stats/register';
import './templates/magazine-comparison/register';
import './templates/magazine-factfile/register';
import './templates/magazine-ranking/register';
import './templates/magazine-steps/register';
import './templates/magazine-proscons/register';
import './templates/magazine-verdict/register';
import './templates/magazine-mythfact/register';
import './templates/magazine-beforeafter/register';
import './templates/magazine-definition/register';
import './templates/magazine-takeaways/register';
import './templates/magazine-quote/register';
import './templates/magazine-versus/register';
import './templates/magazine-alert/register';
import './templates/magazine-didyouknow/register';
import './templates/magazine-profile/register';
import './templates/magazine-trivia/register';
import './templates/magazine-pricetag/register';
import './templates/magazine-warning/register';
import './templates/magazine-chart/register';
import './templates/magazine-agenda/register';
import './templates/magazine-location/register';
import './templates/magazine-country/register';
import './templates/explainer-definition/register';
import './templates/explainer-process/register';
import './templates/explainer-cause-effect/register';
import './templates/explainer-analogy/register';
import './templates/explainer-howitworks/register';
import './templates/explainer-stats/register';
import './templates/explainer-barchart/register';
import './templates/explainer-comparison/register';
import './templates/explainer-ranking/register';
import './templates/explainer-timeline/register';
