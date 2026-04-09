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
import './templates/magazine-collage/register';
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
import './templates/magazine-headline/register';
import './templates/magazine-splitquote/register';
import './templates/magazine-countdown/register';
import './templates/magazine-hottake/register';
import './templates/vox-headline/register';
import './templates/vox-highlight/register';
import './templates/vox-definition/register';
import './templates/vox-quote/register';
import './templates/vox-question/register';
import './templates/vox-label/register';
import './templates/vox-stats/register';
import './templates/vox-barchart/register';
import './templates/vox-linechart/register';
import './templates/vox-counter/register';
import './templates/vox-ranking/register';
import './templates/vox-timeline/register';
import './templates/vox-versus/register';
import './templates/vox-beforeafter/register';
import './templates/vox-factcheck/register';
import './templates/vox-proscons/register';
import './templates/vox-spectrum/register';
import './templates/vox-map/register';
import './templates/vox-country/register';
import './templates/vox-process/register';
import './templates/vox-causeeffect/register';
import './templates/vox-funnel/register';
import './templates/vox-checklist/register';
import './templates/vox-cycle/register';
import './templates/vox-tree/register';
import './templates/vox-alert/register';
import './templates/vox-callout/register';
import './templates/vox-takeaway/register';
import './templates/vox-verdict/register';
import './templates/vox-bullets/register';
import './templates/vox-wordswap/register';
import './templates/vox-collage/register';
import './templates/vox-profile/register';
import './templates/vox-source/register';
import './templates/vox-evidence/register';
import './templates/vox-filmstrip/register';
import './templates/vox-metaphor/register';
import './templates/vox-supercut/register';
import './templates/vox-unitchart/register';
import './templates/vox-systemdiagram/register';
import './templates/vox-thennow/register';
import './templates/vox-blueprint/register';
import './templates/vox-areachart/register';
import './templates/vox-donut/register';
import './templates/vox-diverging/register';
import './templates/vox-treemap/register';
