import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEMPLATES_DIR = join(__dirname, '..', 'src', 'templates');

// Map slug patterns to categories. Order matters — first match wins.
// Only match on slug to avoid false positives from tag substrings.
function inferCategory(meta: {
  category?: string;
  tags: string[];
  slug: string;
}): string {
  const slug = meta.slug.toLowerCase();
  const tagSet = new Set(meta.tags.map((t) => t.toLowerCase()));

  // Timeline/process — check before geographic (agenda, journey, timeline)
  if (
    [
      'timeline',
      'process-flow',
      'step-counter',
      'agenda',
      'multi-stop-journey',
    ].some((k) => slug.includes(k))
  ) {
    return 'timeline-process';
  }
  // Text/typography — check before geographic (headline)
  if (
    [
      'kinetic',
      'headline',
      'keyword',
      'caption',
      'bullet',
      'formula',
      'definition',
      'news-ticker',
    ].some((k) => slug.includes(k))
  ) {
    return 'text-typography';
  }
  // Data visualization — check before geographic (counter, chart)
  if (
    [
      'stat-',
      'bar-chart',
      'number-ticker',
      'split-stat',
      'score-meter',
      'rating-display',
    ].some((k) => slug.includes(k))
  ) {
    return 'data-visualization';
  }
  // Comparison
  if (
    [
      'versus',
      'pros-cons',
      'before-after',
      'comparison',
      'poll-battle',
      'tier-board',
    ].some((k) => slug.includes(k))
  ) {
    return 'comparison';
  }
  // Social engagement — check before geographic (audience)
  if (
    [
      'subscribe',
      'comment',
      'follower',
      'social',
      'emoji',
      'audience',
      'qr-code',
      'link-callout',
      'coupon',
    ].some((k) => slug.includes(k))
  ) {
    return 'social-engagement';
  }
  // Intro/outro
  if (
    [
      'intro',
      'end-screen',
      'logo-stinger',
      'credits',
      'channel-intro',
      'countdown',
      'alert-banner',
      'chapter-card',
    ].some((k) => slug.includes(k))
  ) {
    return 'intro-outro';
  }
  // Geographic/map templates — slug-only matching
  if (
    [
      'globe',
      'map',
      'road-trip',
      'coverage',
      'compass',
      'elevation',
      'heatmap',
      'neighborhood',
      'pin-drop',
      'postcard',
      'property-spotlight',
      'satellite',
      'territory',
      'timezone',
      'choropleth',
      'hub-spoke',
      'event-locator',
      'split-departure',
      'neon-dark',
      'warm-intro',
      'country-highlight',
      'location-tag',
      'indiana-jones',
      'watercolor',
    ].some((k) => slug.includes(k))
  ) {
    return 'geographic';
  }
  // Media
  if (['youtube', 'video', 'clip'].some((k) => slug.includes(k))) {
    return 'media';
  }
  // Fallback based on existing category
  return meta.category || 'marketing';
}

for (const dir of readdirSync(TEMPLATES_DIR, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const metaPath = join(TEMPLATES_DIR, dir.name, 'meta.json');
  try {
    const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
    meta.category = inferCategory(meta);
    writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf-8');
    console.log(`${dir.name} → ${meta.category}`);
  } catch {
    // Skip dirs without meta.json
  }
}
