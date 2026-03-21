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
import './templates/magazine-dossier/register';
