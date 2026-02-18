import { describe, it, expect } from 'vitest';
import { buildStudioTemplateCatalog } from './studio-templates';

describe('buildStudioTemplateCatalog', () => {
  it('returns a non-empty catalog string', () => {
    const catalog = buildStudioTemplateCatalog();
    expect(catalog).toBeTruthy();
    expect(catalog.length).toBeGreaterThan(100);
  });

  it('includes the TEMPLATE LIBRARY header', () => {
    const catalog = buildStudioTemplateCatalog();
    expect(catalog).toContain('## TEMPLATE LIBRARY (Studio Theme)');
  });

  it('includes usage instructions', () => {
    const catalog = buildStudioTemplateCatalog();
    expect(catalog).toContain('How to use templates');
    expect(catalog).toContain('src/.templates/{slug}/');
    expect(catalog).toContain('1080x1080 @ 30fps');
  });

  it('includes fallback instructions for when no template fits', () => {
    const catalog = buildStudioTemplateCatalog();
    expect(catalog).toContain('When NO template fits');
    expect(catalog).toContain('DotGrid SVG background');
    expect(catalog).toContain('FONT_PAIRS');
  });

  it('lists real templates with their slugs', () => {
    const catalog = buildStudioTemplateCatalog();
    // These are known templates that should be registered
    expect(catalog).toContain('stat-counter');
    expect(catalog).toContain('stat-bar-chart');
    expect(catalog).toContain('poll-battle');
    expect(catalog).toContain('quote-pulse');
  });

  it('reports the correct template count', () => {
    const catalog = buildStudioTemplateCatalog();
    // Should have "You have access to N pre-built templates"
    const match = catalog.match(/You have access to (\d+) pre-built templates/);
    expect(match).toBeTruthy();
    const count = parseInt(match![1], 10);
    // We tagged 60 templates with studio-theme
    expect(count).toBeGreaterThanOrEqual(50);
  });

  it('each template entry has name, slug, description, and tags', () => {
    const catalog = buildStudioTemplateCatalog();
    // Template entries follow the format: - **Name** (`slug`): Description | Tags: ...
    const templateLines = catalog.split('\n').filter(l => l.startsWith('- **'));
    expect(templateLines.length).toBeGreaterThan(0);

    for (const line of templateLines) {
      // Has bold name
      expect(line).toMatch(/\*\*[^*]+\*\*/);
      // Has slug in backticks
      expect(line).toMatch(/`[a-z0-9-]+`/);
      // Has description after colon
      expect(line).toContain(':');
      // Has tags section
      expect(line).toContain('Tags:');
      // Has studio-theme tag
      expect(line).toContain('studio-theme');
    }
  });
});
