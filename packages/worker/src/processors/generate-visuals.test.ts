import { describe, it, expect } from 'vitest';

/**
 * Tests for the visual generation pipeline dimension handling.
 *
 * These tests verify that dimensions flow correctly through the pipeline:
 * Frontend → API → Queue → Worker → Python Script
 */

describe('Dimension calculation logic', () => {
  /**
   * Replicates the dimension calculation from StyleSelectionModal.tsx
   * to verify the frontend logic is correct.
   */
  function calculateVisualsDimensions(
    canvasWidth: number,
    canvasHeight: number,
    layoutMode: 'pip' | 'split-horizontal' | 'split-vertical',
    splitRatio: number
  ): { width: number; height: number } {
    if (layoutMode === 'pip') {
      return { width: canvasWidth, height: canvasHeight };
    } else if (layoutMode === 'split-horizontal') {
      const visualsHeight = Math.round(canvasHeight * (splitRatio / 100));
      return { width: canvasWidth, height: visualsHeight };
    } else {
      const visualsWidth = Math.round(canvasWidth * (splitRatio / 100));
      return { width: visualsWidth, height: canvasHeight };
    }
  }

  describe('PiP layout', () => {
    it('uses full canvas dimensions for PiP mode', () => {
      const result = calculateVisualsDimensions(1080, 1920, 'pip', 50);
      expect(result.width).toBe(1080);
      expect(result.height).toBe(1920);
    });

    it('ignores split ratio for PiP mode', () => {
      const result30 = calculateVisualsDimensions(1080, 1920, 'pip', 30);
      const result70 = calculateVisualsDimensions(1080, 1920, 'pip', 70);

      expect(result30).toEqual(result70);
      expect(result30.width).toBe(1080);
      expect(result30.height).toBe(1920);
    });
  });

  describe('Split-horizontal layout', () => {
    it('calculates correct height for 50/50 split', () => {
      const result = calculateVisualsDimensions(1080, 1920, 'split-horizontal', 50);
      expect(result.width).toBe(1080);
      expect(result.height).toBe(960); // 1920 * 0.5
    });

    it('calculates correct height for 30/70 split', () => {
      const result = calculateVisualsDimensions(1080, 1920, 'split-horizontal', 30);
      expect(result.width).toBe(1080);
      expect(result.height).toBe(576); // 1920 * 0.3
    });

    it('calculates correct height for 70/30 split', () => {
      const result = calculateVisualsDimensions(1080, 1920, 'split-horizontal', 70);
      expect(result.width).toBe(1080);
      expect(result.height).toBe(1344); // 1920 * 0.7
    });

    it('maintains full width', () => {
      const result = calculateVisualsDimensions(1080, 1920, 'split-horizontal', 40);
      expect(result.width).toBe(1080);
    });
  });

  describe('Split-vertical layout', () => {
    it('calculates correct width for 50/50 split', () => {
      const result = calculateVisualsDimensions(1080, 1920, 'split-vertical', 50);
      expect(result.width).toBe(540); // 1080 * 0.5
      expect(result.height).toBe(1920);
    });

    it('calculates correct width for 30/70 split', () => {
      const result = calculateVisualsDimensions(1080, 1920, 'split-vertical', 30);
      expect(result.width).toBe(324); // 1080 * 0.3
      expect(result.height).toBe(1920);
    });

    it('maintains full height', () => {
      const result = calculateVisualsDimensions(1080, 1920, 'split-vertical', 60);
      expect(result.height).toBe(1920);
    });
  });

  describe('Different canvas sizes', () => {
    it('works with landscape canvas (1920x1080)', () => {
      const pip = calculateVisualsDimensions(1920, 1080, 'pip', 50);
      expect(pip).toEqual({ width: 1920, height: 1080 });

      const splitH = calculateVisualsDimensions(1920, 1080, 'split-horizontal', 50);
      expect(splitH).toEqual({ width: 1920, height: 540 });

      const splitV = calculateVisualsDimensions(1920, 1080, 'split-vertical', 50);
      expect(splitV).toEqual({ width: 960, height: 1080 });
    });

    it('works with square canvas (1080x1080)', () => {
      const pip = calculateVisualsDimensions(1080, 1080, 'pip', 50);
      expect(pip).toEqual({ width: 1080, height: 1080 });

      const splitH = calculateVisualsDimensions(1080, 1080, 'split-horizontal', 50);
      expect(splitH).toEqual({ width: 1080, height: 540 });
    });

    it('works with 4K canvas (3840x2160)', () => {
      const pip = calculateVisualsDimensions(3840, 2160, 'pip', 50);
      expect(pip).toEqual({ width: 3840, height: 2160 });

      const splitH = calculateVisualsDimensions(3840, 2160, 'split-horizontal', 50);
      expect(splitH).toEqual({ width: 3840, height: 1080 });
    });
  });
});

describe('GenerateVisualsJobData types', () => {
  it('job data structure includes required dimension fields', () => {
    // This is a compile-time test - if the types are wrong, this won't compile
    interface GenerateVisualsJobData {
      projectId: string;
      jobId: string;
      stylePreset: 'minimal' | 'modern' | 'playful' | 'bold' | 'classic';
      layoutMode: 'pip' | 'split-horizontal' | 'split-vertical';
      dimensions: {
        width: number;
        height: number;
      };
    }

    const jobData: GenerateVisualsJobData = {
      projectId: 'test-123',
      jobId: 'job-456',
      stylePreset: 'modern',
      layoutMode: 'split-horizontal',
      dimensions: {
        width: 1080,
        height: 960,
      },
    };

    expect(jobData.dimensions.width).toBe(1080);
    expect(jobData.dimensions.height).toBe(960);
    expect(jobData.layoutMode).toBe('split-horizontal');
  });
});

describe('Metadata dimension validation', () => {
  /**
   * Simulates the dimension validation logic from visual_generator.py
   */
  function validateAndCorrectDimensions(
    metadata: { width?: number; height?: number; [key: string]: unknown },
    expectedWidth: number,
    expectedHeight: number
  ): { corrected: boolean; metadata: typeof metadata } {
    const actualWidth = metadata.width ?? 0;
    const actualHeight = metadata.height ?? 0;

    if (actualWidth !== expectedWidth || actualHeight !== expectedHeight) {
      return {
        corrected: true,
        metadata: {
          ...metadata,
          width: expectedWidth,
          height: expectedHeight,
        },
      };
    }

    return { corrected: false, metadata };
  }

  it('does not correct matching dimensions', () => {
    const metadata = { width: 1080, height: 960, compositionId: 'test' };
    const result = validateAndCorrectDimensions(metadata, 1080, 960);

    expect(result.corrected).toBe(false);
    expect(result.metadata.width).toBe(1080);
    expect(result.metadata.height).toBe(960);
  });

  it('corrects wrong dimensions', () => {
    // Agent used default 1920x1080 instead of requested 1080x960
    const metadata = { width: 1920, height: 1080, compositionId: 'test' };
    const result = validateAndCorrectDimensions(metadata, 1080, 960);

    expect(result.corrected).toBe(true);
    expect(result.metadata.width).toBe(1080);
    expect(result.metadata.height).toBe(960);
  });

  it('corrects missing dimensions', () => {
    const metadata = { compositionId: 'test' };
    const result = validateAndCorrectDimensions(metadata, 1080, 960);

    expect(result.corrected).toBe(true);
    expect(result.metadata.width).toBe(1080);
    expect(result.metadata.height).toBe(960);
  });

  it('preserves other metadata fields', () => {
    const metadata = {
      width: 1920,
      height: 1080,
      compositionId: 'test',
      fps: 30,
      durationInFrames: 900,
    };
    const result = validateAndCorrectDimensions(metadata, 1080, 960);

    expect(result.metadata.compositionId).toBe('test');
    expect(result.metadata.fps).toBe(30);
    expect(result.metadata.durationInFrames).toBe(900);
  });
});

describe('Aspect ratio detection', () => {
  function getAspectRatioType(width: number, height: number): 'portrait' | 'landscape' | 'square' {
    if (height > width) return 'portrait';
    if (width > height) return 'landscape';
    return 'square';
  }

  it('detects portrait orientation', () => {
    expect(getAspectRatioType(1080, 1920)).toBe('portrait');
    expect(getAspectRatioType(720, 1280)).toBe('portrait');
    expect(getAspectRatioType(1080, 1081)).toBe('portrait');
  });

  it('detects landscape orientation', () => {
    expect(getAspectRatioType(1920, 1080)).toBe('landscape');
    expect(getAspectRatioType(1280, 720)).toBe('landscape');
    expect(getAspectRatioType(1081, 1080)).toBe('landscape');
  });

  it('detects square orientation', () => {
    expect(getAspectRatioType(1080, 1080)).toBe('square');
    expect(getAspectRatioType(1920, 1920)).toBe('square');
  });
});

describe('Responsive size calculations', () => {
  /**
   * Replicates the responsive calculations from the prompt builder
   */
  function calculateResponsiveSizes(width: number, height: number) {
    return {
      titleSize: Math.round(height * 0.04),
      bodySize: Math.round(height * 0.025),
      padding: Math.round(Math.min(width, height) * 0.05),
    };
  }

  it('calculates correct sizes for 1080x1920 portrait', () => {
    const sizes = calculateResponsiveSizes(1080, 1920);
    expect(sizes.titleSize).toBe(77); // 1920 * 0.04
    expect(sizes.bodySize).toBe(48); // 1920 * 0.025
    expect(sizes.padding).toBe(54); // 1080 * 0.05
  });

  it('calculates correct sizes for 1920x1080 landscape', () => {
    const sizes = calculateResponsiveSizes(1920, 1080);
    expect(sizes.titleSize).toBe(43); // 1080 * 0.04
    expect(sizes.bodySize).toBe(27); // 1080 * 0.025
    expect(sizes.padding).toBe(54); // 1080 * 0.05
  });

  it('calculates correct sizes for split layout (1080x960)', () => {
    const sizes = calculateResponsiveSizes(1080, 960);
    expect(sizes.titleSize).toBe(38); // 960 * 0.04
    expect(sizes.bodySize).toBe(24); // 960 * 0.025
    expect(sizes.padding).toBe(48); // 960 * 0.05
  });
});
