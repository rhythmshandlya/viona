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
      expect(prompt).toContain('MUST render at exactly 1080x1920 pixels');

      // Check metadata.json example has correct dimensions
      expect(prompt).toContain('"width": 1080');
      expect(prompt).toContain('"height": 1920');
    });

    it('includes correct dimensions for stacked layout', () => {
      const prompt = buildGenerateVisualsPrompt({
        ...baseOptions,
        width: 1080,
        height: 960, // 50% of 1920 for stacked
        layoutMode: 'stacked',
      });

      expect(prompt).toContain('Resolution: 1080x960');
      expect(prompt).toContain('MUST render at exactly 1080x960 pixels');
      expect(prompt).toContain('"width": 1080');
      expect(prompt).toContain('"height": 960');
    });

    it('handles landscape dimensions correctly', () => {
      const prompt = buildGenerateVisualsPrompt({
        ...baseOptions,
        width: 1920,
        height: 1080,
        layoutMode: 'pip',
      });

      expect(prompt).toContain('Resolution: 1920x1080');
      expect(prompt).toContain('HORIZONTAL/Landscape');
    });

    it('handles portrait dimensions correctly', () => {
      const prompt = buildGenerateVisualsPrompt({
        ...baseOptions,
        width: 1080,
        height: 1920,
        layoutMode: 'pip',
      });

      expect(prompt).toContain('VERTICAL/Portrait');
    });

    it('handles square dimensions correctly', () => {
      const prompt = buildGenerateVisualsPrompt({
        ...baseOptions,
        width: 1080,
        height: 1080,
        layoutMode: 'pip',
      });

      expect(prompt).toContain('SQUARE');
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

      expect(prompt).toContain('Full-screen visuals');
      expect(prompt).toContain('PiP window');
    });

    it('provides correct context for stacked mode', () => {
      const prompt = buildGenerateVisualsPrompt({
        ...baseOptions,
        width: 1080,
        height: 960,
        layoutMode: 'stacked',
      });

      expect(prompt).toContain('Stacked layout');
      expect(prompt).toContain('REDUCED HEIGHT');
    });
  });

  describe('responsive design guidance', () => {
    it('includes responsive sizing guidance', () => {
      const prompt = buildGenerateVisualsPrompt({
        ...baseOptions,
        width: 1080,
        height: 1920,
        layoutMode: 'pip',
      });

      // Check for responsive sizing section (renamed from "Responsive Value Pattern")
      expect(prompt).toContain('Responsive Sizing');
      expect(prompt).toContain('Math.min(width, height)');
    });

    it('includes font size calculations relative to height', () => {
      const prompt = buildGenerateVisualsPrompt({
        ...baseOptions,
        width: 1080,
        height: 1920,
        layoutMode: 'pip',
      });

      expect(prompt).toContain('height * 0.022');
      expect(prompt).toContain('height * 0.032');
      expect(prompt).toContain('height * 0.045');
    });
  });

  describe('metadata requirements', () => {
    it('includes metadata.json format requirements', () => {
      const prompt = buildGenerateVisualsPrompt({
        ...baseOptions,
        width: 1080,
        height: 1920,
        layoutMode: 'pip',
      });

      expect(prompt).toContain('metadata.json');
      expect(prompt).toContain('"width": 1080');
      expect(prompt).toContain('"height": 1920');
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

      expect(prompt).toContain('Duration:**');
      expect(prompt).toContain('60000ms');
      expect(prompt).toContain('1800 frames'); // 60s * 30fps
      expect(prompt).toContain('30 FPS');
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

      expect(prompt).toContain('const { width, height, fps } = useVideoConfig()');
      expect(prompt).toContain('NEVER hardcode');
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
    expect(STYLE_GUIDELINES).toHaveProperty('studio');
  });

  it('each style has meaningful content', () => {
    Object.values(STYLE_GUIDELINES).forEach((guideline) => {
      expect(guideline.length).toBeGreaterThan(50);
      expect(guideline).toContain('Style:');
    });
  });

  it('includes design and animation sections in each style', () => {
    Object.values(STYLE_GUIDELINES).forEach((guideline) => {
      expect(guideline).toContain('**DESIGN:**');
      expect(guideline).toContain('**ANIMATION:**');
      expect(guideline).toContain('**COLOR PALETTE:**');
    });
  });
});

describe('visualization guidance', () => {
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

  it('provides correct layout context based on layout mode', () => {
    const pipPrompt = buildGenerateVisualsPrompt({ ...baseOptions, layoutMode: 'pip' });
    expect(pipPrompt).toContain('Full-screen visuals');
    expect(pipPrompt).toContain('PiP window');

    const stackedPrompt = buildGenerateVisualsPrompt({ ...baseOptions, layoutMode: 'stacked' });
    expect(stackedPrompt).toContain('Stacked layout');
    expect(stackedPrompt).toContain('REDUCED HEIGHT');
  });

  it('includes visualization mapping table', () => {
    const prompt = buildGenerateVisualsPrompt(baseOptions);

    expect(prompt).toContain('Steps/Process');
    expect(prompt).toContain('Animated flowchart');
    expect(prompt).toContain('Statistics/Numbers');
    expect(prompt).toContain('Comparisons');
    expect(prompt).toContain('Concepts/Frameworks');
  });

  it('emphasizes visual representation over text', () => {
    const prompt = buildGenerateVisualsPrompt(baseOptions);

    expect(prompt).toContain("Don't just put text on screen");
    expect(prompt).toContain('CREATE A VISUAL REPRESENTATION');
  });

  it('includes self-healing workflow guidance', () => {
    const prompt = buildGenerateVisualsPrompt(baseOptions);

    expect(prompt).toContain('SELF-HEALING WORKFLOW');
    expect(prompt).toContain('TypeScriptValidatorTool');
    expect(prompt).toContain('ZERO TypeScript errors');
  });
});

describe('Animation Philosophy', () => {
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

  it('includes the Three Laws of Meaningful Animation', () => {
    const prompt = buildGenerateVisualsPrompt(baseOptions);

    expect(prompt).toContain('CONTINUOUS MOTION');
    expect(prompt).toContain('CONCEPTUAL, NOT LITERAL');
    expect(prompt).toContain('ZERO TEXT OVERLAYS');
  });

  it('provides examples of conceptual vs literal animations', () => {
    const prompt = buildGenerateVisualsPrompt(baseOptions);

    expect(prompt).toContain('Binary tree is slow here');
    expect(prompt).toContain('O(n) counter climbing');
  });

  it('explicitly forbids text overlays', () => {
    const prompt = buildGenerateVisualsPrompt(baseOptions);

    expect(prompt).toContain('Subtitles handle all text');
    expect(prompt).toContain('PURE VISUAL STORYTELLING');
  });
});

describe('Scene Planning', () => {
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

  it('requires scene planning before code', () => {
    const prompt = buildGenerateVisualsPrompt(baseOptions);

    expect(prompt).toContain('SCENE PLANNING WITH REASONING');
    expect(prompt).toContain('REQUIRED FIRST STEP');
  });

  it('includes Chain of Thought reasoning fields', () => {
    const prompt = buildGenerateVisualsPrompt(baseOptions);

    expect(prompt).toContain('whatIsBeingExplained');
    expect(prompt).toContain('whyNotLiteral');
    expect(prompt).toContain('whatWouldMakeItClick');
    expect(prompt).toContain('howAnimationAddsUnderstanding');
  });

  it('provides reference examples with reasoning', () => {
    const prompt = buildGenerateVisualsPrompt(baseOptions);

    // Reference examples now demonstrate reasoning patterns
    expect(prompt).toContain('What it demonstrates');
    expect(prompt).toContain('Key insight');
  });
});
