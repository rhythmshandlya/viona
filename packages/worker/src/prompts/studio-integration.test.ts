import { describe, it, expect } from 'vitest';
import { STYLE_GUIDELINES, buildGenerateVisualsPrompt } from './generate-visuals';
import { listTemplates, getTemplate } from '@viona/templates';

// ---------------------------------------------------------------------------
// 1. STYLE_GUIDELINES keys — only studio-dark and studio-light exist
// ---------------------------------------------------------------------------

describe('STYLE_GUIDELINES: studio-dark / studio-light only', () => {
  it('contains exactly studio-dark and studio-light keys', () => {
    const keys = Object.keys(STYLE_GUIDELINES);
    expect(keys).toEqual(expect.arrayContaining(['studio-dark', 'studio-light']));
    expect(keys).toHaveLength(2);
  });

  it('does NOT contain old preset keys', () => {
    const removed = ['minimal', 'modern', 'playful', 'bold', 'classic', 'apple', 'google', 'studio', 'kinetic-typography'];
    for (const key of removed) {
      expect(STYLE_GUIDELINES).not.toHaveProperty(key);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Studio-dark guideline content
// ---------------------------------------------------------------------------

describe('studio-dark style guideline', () => {
  const dark = STYLE_GUIDELINES['studio-dark'];

  it('has meaningful content', () => {
    expect(dark.length).toBeGreaterThan(200);
  });

  it('includes dark mode color palette', () => {
    expect(dark).toContain('#0B0F1A');
    expect(dark).toContain('#FFFFFF');
    expect(dark).toContain('rgba(255,255,255,0.04)');
    expect(dark).toContain('rgba(255,255,255,0.06)');
    expect(dark).toContain('rgba(255,255,255,0.10)');
  });

  it('includes accent colors', () => {
    expect(dark).toContain('#6366F1');
    expect(dark).toContain('#EC4899');
  });

  it('includes DotGrid SVG pattern with dark colors', () => {
    expect(dark).toContain('<pattern');
    expect(dark).toContain('patternUnits');
    expect(dark).toContain('fill="#0B0F1A"');
    expect(dark).toContain('fill="rgba(255,255,255,0.04)"');
  });

  it('includes font pairs', () => {
    expect(dark).toContain('FONT_PAIRS');
    expect(dark).toContain('Bebas Neue');
    expect(dark).toContain('Roboto');
  });

  it('includes card layout specs', () => {
    expect(dark).toContain('borderRadius: 20px');
    expect(dark).toContain('padding: 48px');
    expect(dark).toContain('maxWidth: 85%');
  });

  it('includes animation config', () => {
    expect(dark).toContain('spring({ damping: 22, stiffness: 100 })');
    expect(dark).toContain('extrapolateRight');
    expect(dark).toContain('Stagger elements by 8-12 frames');
  });

  it('includes template library reference', () => {
    expect(dark).toContain('template library');
    expect(dark).toContain('USE EXISTING TEMPLATES');
  });

  it('references BACKGROUNDS.dark variant', () => {
    expect(dark).toContain('BACKGROUNDS.dark');
  });
});

// ---------------------------------------------------------------------------
// 3. Studio-light guideline content
// ---------------------------------------------------------------------------

describe('studio-light style guideline', () => {
  const light = STYLE_GUIDELINES['studio-light'];

  it('has meaningful content', () => {
    expect(light.length).toBeGreaterThan(200);
  });

  it('includes light mode color palette', () => {
    expect(light).toContain('#F8F9FB');
    expect(light).toContain('#111827');
    expect(light).toContain('rgba(0,0,0,0.04)');
    expect(light).toContain('rgba(0,0,0,0.08)');
  });

  it('includes DotGrid SVG pattern with light colors', () => {
    expect(light).toContain('fill="#F8F9FB"');
    expect(light).toContain('fill="rgba(0,0,0,0.04)"');
  });

  it('references BACKGROUNDS.light variant', () => {
    expect(light).toContain('BACKGROUNDS.light');
  });

  it('does NOT contain dark-mode colors', () => {
    expect(light).not.toContain('#0B0F1A');
    expect(light).not.toContain('rgba(255,255,255,0.04)');
  });
});

// ---------------------------------------------------------------------------
// 4. Prompt builder — buildGenerateVisualsPrompt with studio presets
// ---------------------------------------------------------------------------

describe('buildGenerateVisualsPrompt with studio presets', () => {
  const baseOptions = {
    transcript: [
      { text: 'Hello', startMs: 0, endMs: 500 },
      { text: 'world.', startMs: 500, endMs: 1000 },
    ],
    projectId: 'test_project',
    durationMs: 60000,
    fps: 30,
    width: 1080,
    height: 1920,
    layoutMode: 'pip' as const,
  };

  it('generates prompt with studio-dark style', () => {
    const prompt = buildGenerateVisualsPrompt({
      ...baseOptions,
      stylePreset: 'studio-dark',
      styleGuidelines: STYLE_GUIDELINES['studio-dark'],
    });
    expect(prompt).toBeTruthy();
    expect(prompt).toContain('Style: Studio Dark');
    expect(prompt).toContain('#0B0F1A');
    expect(prompt).toContain('BACKGROUNDS.dark');
  });

  it('generates prompt with studio-light style', () => {
    const prompt = buildGenerateVisualsPrompt({
      ...baseOptions,
      stylePreset: 'studio-light',
      styleGuidelines: STYLE_GUIDELINES['studio-light'],
    });
    expect(prompt).toBeTruthy();
    expect(prompt).toContain('Style: Studio Light');
    expect(prompt).toContain('#F8F9FB');
    expect(prompt).toContain('BACKGROUNDS.light');
  });

  it('prompt includes transcript content', () => {
    const prompt = buildGenerateVisualsPrompt({
      ...baseOptions,
      stylePreset: 'studio-dark',
      styleGuidelines: STYLE_GUIDELINES['studio-dark'],
    });
    expect(prompt).toContain('Hello');
    expect(prompt).toContain('world.');
  });

  it('prompt includes video specs', () => {
    const prompt = buildGenerateVisualsPrompt({
      ...baseOptions,
      stylePreset: 'studio-dark',
      styleGuidelines: STYLE_GUIDELINES['studio-dark'],
    });
    expect(prompt).toContain('1080x1920');
    expect(prompt).toContain('test_project');
  });
});

// ---------------------------------------------------------------------------
// 5. Template registry: studio theme filtering
// ---------------------------------------------------------------------------

describe('Template registry: studio theme filtering', () => {
  it('listTemplates returns all templates with studio theme', () => {
    const templates = listTemplates({ theme: 'studio' });
    expect(templates.length).toBeGreaterThanOrEqual(50);
  });

  it('all studio-themed templates have the studio-theme tag', () => {
    const templates = listTemplates({ theme: 'studio' });
    for (const t of templates) {
      expect(t.meta.tags).toContain('studio-theme');
    }
  });

  it('each template has required metadata fields', () => {
    const templates = listTemplates({ theme: 'studio' });
    for (const t of templates) {
      expect(t.meta.slug).toBeTruthy();
      expect(t.meta.name).toBeTruthy();
      expect(t.meta.description).toBeTruthy();
      expect(t.meta.category).toBeTruthy();
      expect(t.meta.tags).toBeInstanceOf(Array);
      expect(t.meta.tags.length).toBeGreaterThan(0);
    }
  });

  it('specific known templates are accessible by slug', () => {
    const slugs = ['stat-counter', 'stat-bar-chart', 'poll-battle', 'quote-pulse', 'headline-storm'];
    for (const slug of slugs) {
      const template = getTemplate(slug);
      expect(template).toBeDefined();
      expect(template!.meta.slug).toBe(slug);
      expect(template!.meta.tags).toContain('studio-theme');
    }
  });

  it('templates expose getComponent function', () => {
    const template = getTemplate('stat-counter');
    expect(template).toBeDefined();
    expect(typeof template!.getComponent).toBe('function');
  });

  it('templates have valid composition metadata', () => {
    const template = getTemplate('stat-counter');
    expect(template).toBeDefined();
    expect(template!.compositionMeta.fps).toBe(30);
    expect(template!.compositionMeta.width).toBeGreaterThan(0);
    expect(template!.compositionMeta.height).toBeGreaterThan(0);
    expect(template!.compositionMeta.durationInFrames).toBeGreaterThan(0);
  });

  it('tag-based filtering works alongside theme filter', () => {
    const statsTemplates = listTemplates({ theme: 'studio', tags: ['stats'] });
    expect(statsTemplates.length).toBeGreaterThan(0);
    for (const t of statsTemplates) {
      expect(t.meta.tags).toContain('stats');
      expect(t.meta.tags).toContain('studio-theme');
    }
  });
});
