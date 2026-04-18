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

// Runtime registry (api-backed) — the primary public API
export {
  listTemplates,
  getTemplateSummary,
  loadTemplate,
  clearTemplateRuntimeCache,
  type TemplateSummary,
  type LoadedTemplate,
} from './runtime-registry';

// Legacy sync registry — kept for StaticTemplateRenderer and other consumers
// that use getTemplate(slug) / registerTemplate() directly.
// NOTE: listTemplates (sync) is intentionally NOT re-exported here to avoid
// collision with the async listTemplates above. Use listTemplates() from
// runtime-registry, or import listTemplates directly from './registry' if you
// need the sync build-time version.
export {
  registerTemplate,
  getTemplate,
  getTemplateFiles,
} from './registry';

// Shared runtime utilities (used by built template bundles via externals, and
// by consumers rendering alongside templates)
export { useScale } from './use-scale';
export {
  FONTS,
  FONT_PAIRS,
  FONT_WEIGHTS,
  FONT_SIZES,
  getFontPairForContent,
} from './fonts';

// NOTE: template source (src/templates/*) is NOT re-exported here.
// It is build-input only for scripts/build-templates.ts, which produces
// per-template ESM bundles uploaded to S3 via scripts/upload-templates.ts.
// Consumers load templates at runtime via loadTemplate(slug) above.
