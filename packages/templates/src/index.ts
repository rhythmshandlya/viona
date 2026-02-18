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
