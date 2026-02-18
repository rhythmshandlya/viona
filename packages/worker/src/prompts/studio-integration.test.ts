import { describe, it, expect } from 'vitest';
import { STYLE_GUIDELINES, buildGenerateVisualsPrompt } from './generate-visuals';
import { listTemplates, getTemplate } from '@viona/templates';

describe('Studio theme style guidelines', () => {
  it('STYLE_GUIDELINES includes studio key', () => {
    expect(STYLE_GUIDELINES).toHaveProperty('studio');
  });

  it('studio guidelines have meaningful content', () => {
    const studio = STYLE_GUIDELINES.studio;
    expect(studio.length).toBeGreaterThan(200);
  });

  it('studio guidelines include DotGrid design system', () => {
    const studio = STYLE_GUIDELINES.studio;
    expect(studio).toContain('DotGrid');
    expect(studio).toContain('#0B0F1A');
    expect(studio).toContain('#6366F1');
    expect(studio).toContain('#F8FAFC');
  });

  it('studio guidelines include color palette for dark and light mode', () => {
    const studio = STYLE_GUIDELINES.studio;
    expect(studio).toContain('Dark mode');
    expect(studio).toContain('Light mode');
    expect(studio).toContain('#FFFFFF');
    expect(studio).toContain('#0F172A');
  });

  it('studio guidelines include DotGrid SVG pattern', () => {
    const studio = STYLE_GUIDELINES.studio;
    expect(studio).toContain('<pattern');
    expect(studio).toContain('patternUnits');
    expect(studio).toContain('<circle');
  });

  it('studio guidelines include font pairs', () => {
    const studio = STYLE_GUIDELINES.studio;
    expect(studio).toContain('FONT_PAIRS');
    expect(studio).toContain('Oswald');
    expect(studio).toContain('Inter');
    expect(studio).toContain('Space Grotesk');
  });

  it('studio guidelines include card layout specs', () => {
    const studio = STYLE_GUIDELINES.studio;
    expect(studio).toContain('borderRadius: 20px');
    expect(studio).toContain('padding: 48px');
    expect(studio).toContain('maxWidth: 85%');
  });

  it('studio guidelines include animation config', () => {
    const studio = STYLE_GUIDELINES.studio;
    expect(studio).toContain('spring({ damping: 14, stiffness: 80 })');
    expect(studio).toContain('extrapolateRight');
    expect(studio).toContain('Stagger elements by 8-12 frames');
  });

  it('studio guidelines include template library reference', () => {
    const studio = STYLE_GUIDELINES.studio;
    expect(studio).toContain('template library');
    expect(studio).toContain('USE EXISTING TEMPLATES');
  });
});

describe('Studio theme in prompt builder', () => {
  const baseOptions = {
    transcript: [
      { text: 'Hello', startMs: 0, endMs: 500 },
      { text: 'world.', startMs: 500, endMs: 1000 },
    ],
    projectId: 'test_project',
    stylePreset: 'studio',
    styleGuidelines: STYLE_GUIDELINES.studio,
    durationMs: 60000,
    fps: 30,
    width: 1080,
    height: 1920,
    layoutMode: 'pip' as const,
  };

  it('generates a valid prompt with studio style', () => {
    const prompt = buildGenerateVisualsPrompt(baseOptions);
    expect(prompt).toBeTruthy();
    expect(prompt).toContain('Style: Studio');
    expect(prompt).toContain('DotGrid');
  });

  it('includes studio-specific design tokens in prompt', () => {
    const prompt = buildGenerateVisualsPrompt(baseOptions);
    expect(prompt).toContain('#0B0F1A');
    expect(prompt).toContain('#6366F1');
  });
});

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

  it('listTemplates without theme filter returns all templates', () => {
    const all = listTemplates();
    const studio = listTemplates({ theme: 'studio' });
    // All templates should have studio-theme since we tagged all of them
    expect(studio.length).toBe(all.length);
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

  it('templates expose getFiles and getComponent functions', () => {
    const template = getTemplate('stat-counter');
    expect(template).toBeDefined();
    expect(typeof template!.getFiles).toBe('function');
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
