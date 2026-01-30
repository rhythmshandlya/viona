import { describe, it, expect } from 'vitest';
import { buildGenerateVisualsPrompt, STYLE_GUIDELINES } from './generate-visuals';

describe('buildGenerateVisualsPrompt', () => {
  const baseOptions = {
    transcript: [
      { text: 'Hello', startMs: 0, endMs: 500 },
      { text: 'world.', startMs: 500, endMs: 1000 },
    ],
    projectId: 'test_project',
    stylePreset: 'modern',
    styleGuidelines: STYLE_GUIDELINES.modern,
    durationMs: 60000,
    fps: 30,
  };

  describe('dimension handling', () => {
    it('includes correct dimensions for PiP layout (full screen)', () => {
      const prompt = buildGenerateVisualsPrompt({
        ...baseOptions,
        width: 1080,
        height: 1920,
        layoutMode: 'pip',
      });

      // Check resolution line
      expect(prompt).toContain('Resolution: 1080x1920');

      // Check CRITICAL section mentions exact dimensions
      expect(prompt).toContain('MUST be designed for 1080x1920 pixels');

      // Check metadata.json example has correct dimensions
      expect(prompt).toContain('"width": 1080');
      expect(prompt).toContain('"height": 1920');
    });

    it('includes correct dimensions for split-horizontal layout', () => {
      const prompt = buildGenerateVisualsPrompt({
        ...baseOptions,
        width: 1080,
        height: 960, // 50% of 1920 for split
        layoutMode: 'split-horizontal',
      });

      expect(prompt).toContain('Resolution: 1080x960');
      expect(prompt).toContain('MUST be designed for 1080x960 pixels');
      expect(prompt).toContain('"width": 1080');
      expect(prompt).toContain('"height": 960');
    });

    it('includes correct dimensions for split-vertical layout', () => {
      const prompt = buildGenerateVisualsPrompt({
        ...baseOptions,
        width: 540, // 50% of 1080 for vertical split
        height: 1920,
        layoutMode: 'split-vertical',
      });

      expect(prompt).toContain('Resolution: 540x1920');
      expect(prompt).toContain('MUST be designed for 540x1920 pixels');
      expect(prompt).toContain('"width": 540');
      expect(prompt).toContain('"height": 1920');
    });

    it('handles landscape dimensions correctly', () => {
      const prompt = buildGenerateVisualsPrompt({
        ...baseOptions,
        width: 1920,
        height: 1080,
        layoutMode: 'pip',
      });

      expect(prompt).toContain('Resolution: 1920x1080');
      expect(prompt).toContain('HORIZONTAL (landscape) format');
      expect(prompt).toContain('Arrange elements HORIZONTALLY');
    });

    it('handles portrait dimensions correctly', () => {
      const prompt = buildGenerateVisualsPrompt({
        ...baseOptions,
        width: 1080,
        height: 1920,
        layoutMode: 'pip',
      });

      expect(prompt).toContain('VERTICAL (portrait) format');
      expect(prompt).toContain('Stack elements VERTICALLY');
    });

    it('handles square dimensions correctly', () => {
      const prompt = buildGenerateVisualsPrompt({
        ...baseOptions,
        width: 1080,
        height: 1080,
        layoutMode: 'pip',
      });

      expect(prompt).toContain('SQUARE format');
    });
  });

  describe('layout context', () => {
    it('provides correct context for PiP mode', () => {
      const prompt = buildGenerateVisualsPrompt({
        ...baseOptions,
        width: 1080,
        height: 1920,
        layoutMode: 'pip',
      });

      expect(prompt).toContain('Full-screen visuals (video will be overlaid as a small picture-in-picture window)');
    });

    it('provides correct context for split-horizontal mode', () => {
      const prompt = buildGenerateVisualsPrompt({
        ...baseOptions,
        width: 1080,
        height: 960,
        layoutMode: 'split-horizontal',
      });

      expect(prompt).toContain('Top portion of split screen (video will appear below)');
      expect(prompt).toContain('SPLIT layout');
    });

    it('provides correct context for split-vertical mode', () => {
      const prompt = buildGenerateVisualsPrompt({
        ...baseOptions,
        width: 540,
        height: 1920,
        layoutMode: 'split-vertical',
      });

      expect(prompt).toContain('Left portion of split screen (video will appear on the right)');
    });
  });

  describe('responsive design guidance', () => {
    it('calculates proportional font sizes based on height', () => {
      const prompt = buildGenerateVisualsPrompt({
        ...baseOptions,
        width: 1080,
        height: 1920,
        layoutMode: 'pip',
      });

      // Title size should be ~4% of height = ~77px
      expect(prompt).toContain('titles ~77px');
      // Body size should be ~2.5% of height = ~48px
      expect(prompt).toContain('body ~48px');
    });

    it('calculates proportional margins based on smaller dimension', () => {
      const prompt = buildGenerateVisualsPrompt({
        ...baseOptions,
        width: 1080,
        height: 1920,
        layoutMode: 'pip',
      });

      // Margins should be ~5% of smaller dimension (1080) = ~54px
      expect(prompt).toContain('Margins/padding: ~54px');
    });
  });

  describe('quality checklist', () => {
    it('includes dimension verification in checklist', () => {
      const prompt = buildGenerateVisualsPrompt({
        ...baseOptions,
        width: 1080,
        height: 1920,
        layoutMode: 'pip',
      });

      expect(prompt).toContain('metadata.json has width: 1080, height: 1920');
      expect(prompt).toContain('Design fits 1080x1920 - no hardcoded 1920x1080!');
    });
  });

  describe('video properties', () => {
    it('includes all video properties', () => {
      const prompt = buildGenerateVisualsPrompt({
        ...baseOptions,
        width: 1080,
        height: 1920,
        layoutMode: 'pip',
      });

      expect(prompt).toContain('Duration: 60000ms');
      expect(prompt).toContain('1800 frames'); // 60s * 30fps
      expect(prompt).toContain('FPS: 30');
    });
  });

  describe('example code', () => {
    it('shows useVideoConfig for dimensions', () => {
      const prompt = buildGenerateVisualsPrompt({
        ...baseOptions,
        width: 1080,
        height: 1920,
        layoutMode: 'pip',
      });

      expect(prompt).toContain('const { width, height } = useVideoConfig()');
      expect(prompt).toContain('NEVER hardcode');
      expect(prompt).toContain('const isPortrait = height > width');
    });
  });
});

describe('STYLE_GUIDELINES', () => {
  it('has all required style presets', () => {
    expect(STYLE_GUIDELINES).toHaveProperty('minimal');
    expect(STYLE_GUIDELINES).toHaveProperty('modern');
    expect(STYLE_GUIDELINES).toHaveProperty('playful');
    expect(STYLE_GUIDELINES).toHaveProperty('bold');
    expect(STYLE_GUIDELINES).toHaveProperty('classic');
  });

  it('each style has meaningful content', () => {
    Object.values(STYLE_GUIDELINES).forEach((guideline) => {
      expect(guideline.length).toBeGreaterThan(50);
      expect(guideline).toContain('Style:');
    });
  });

  it('includes diagram and animation style in each style', () => {
    Object.values(STYLE_GUIDELINES).forEach((guideline) => {
      expect(guideline).toContain('Diagram style:');
      expect(guideline).toContain('Animation style:');
      expect(guideline).toContain('Best for:');
    });
  });
});

describe('short-form social media context', () => {
  const baseOptions = {
    transcript: [{ text: 'Test', startMs: 0, endMs: 1000 }],
    projectId: 'test_project',
    stylePreset: 'modern',
    styleGuidelines: STYLE_GUIDELINES.modern,
    durationMs: 60000,
    fps: 30,
    width: 1080,
    height: 1920,
    layoutMode: 'pip' as const,
  };

  it('mentions short-form social media platforms', () => {
    const prompt = buildGenerateVisualsPrompt(baseOptions);

    expect(prompt).toContain('SHORT-FORM SOCIAL MEDIA');
    expect(prompt).toContain('Instagram Reels');
    expect(prompt).toContain('TikTok');
    expect(prompt).toContain('YouTube Shorts');
  });

  it('explains the talking head video format', () => {
    const prompt = buildGenerateVisualsPrompt(baseOptions);

    expect(prompt).toContain('Talking head');
    expect(prompt).toContain('person is speaking directly to camera');
  });

  it('emphasizes visual content over text', () => {
    const prompt = buildGenerateVisualsPrompt(baseOptions);

    expect(prompt).toContain('SUBTITLES ARE SEPARATE');
    expect(prompt).toContain('VISUAL, NOT TEXTUAL');
    expect(prompt).toContain('Minimize text');
    expect(prompt).toContain('shapes, icons, diagrams, illustrations');
  });

  it('explains complex visualization goals', () => {
    const prompt = buildGenerateVisualsPrompt(baseOptions);

    expect(prompt).toContain('RICH, COMPLEX animated visuals');
    expect(prompt).toContain('animated infographics');
    expect(prompt).toContain('Flowcharts with elements appearing in sequence');
    expect(prompt).toContain('Data visualizations');
  });

  it('provides correct speaker position based on layout mode', () => {
    const pipPrompt = buildGenerateVisualsPrompt({ ...baseOptions, layoutMode: 'pip' });
    expect(pipPrompt).toContain('BEHIND the speaker (who appears as a small PiP overlay)');

    const splitHPrompt = buildGenerateVisualsPrompt({ ...baseOptions, layoutMode: 'split-horizontal' });
    expect(splitHPrompt).toContain('ABOVE the speaker (split screen)');

    const splitVPrompt = buildGenerateVisualsPrompt({ ...baseOptions, layoutMode: 'split-vertical' });
    expect(splitVPrompt).toContain('BESIDE the speaker (split screen)');
  });

  it('includes visualization categories', () => {
    const prompt = buildGenerateVisualsPrompt(baseOptions);

    expect(prompt).toContain('PROCESSES & WORKFLOWS');
    expect(prompt).toContain('DATA & COMPARISONS');
    expect(prompt).toContain('CONCEPTS & FRAMEWORKS');
    expect(prompt).toContain('VISUAL METAPHORS');
  });

  it('explains what NOT to create', () => {
    const prompt = buildGenerateVisualsPrompt(baseOptions);

    expect(prompt).toContain('What NOT to Create');
    expect(prompt).toContain('Text captions or subtitles');
    expect(prompt).toContain('Simple text overlays');
    expect(prompt).toContain('Static images');
  });

  it('includes quality checks for animated visualizations', () => {
    const prompt = buildGenerateVisualsPrompt(baseOptions);

    expect(prompt).toContain('ANIMATED (not static images)');
    expect(prompt).toContain('elements build progressively');
    expect(prompt).toContain('Minimal text - diagrams and shapes convey meaning');
    expect(prompt).toContain('Educational value');
  });
});
