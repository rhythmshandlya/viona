/**
 * High-quality Remotion code examples for few-shot prompting.
 * These examples demonstrate FULLY RESPONSIVE design that works at any resolution.
 *
 * Key principles:
 * 1. ALL sizes relative to width/height - no hardcoded pixels
 * 2. Proper text handling - wrapping, overflow, alignment
 * 3. Flexbox layouts for consistent alignment
 * 4. Clear visual hierarchy with regions (header, content, footer)
 */

export const DESIGN_SYSTEM = {
  modern: {
    colors: {
      bgDeep: '#0f0f23',
      bgCard: 'rgba(139, 92, 246, 0.1)',
      bgGradient: 'radial-gradient(circle at center, #1a1a3e 0%, #0f0f23 90%)',
      primary: '#8b5cf6',      // Purple
      secondary: '#3b82f6',    // Blue
      accent: '#06b6d4',       // Cyan
      success: '#22c55e',
      white: '#ffffff',
      muted: '#888888',
      glowPrimary: 'rgba(139, 92, 246, 0.4)',
      glowAccent: 'rgba(6, 182, 212, 0.4)',
    },
  },
};

/**
 * RESPONSIVE LAYOUT HELPER
 * This pattern should be used in every composition for consistent responsive design
 */
export const RESPONSIVE_LAYOUT_HELPER = `
// Helper function for responsive values - USE THIS EVERYWHERE
const useResponsive = () => {
  const { width, height } = useVideoConfig();
  const minDim = Math.min(width, height);

  return {
    // Spacing
    padding: minDim * 0.05,
    gap: {
      xs: minDim * 0.01,
      sm: minDim * 0.02,
      md: minDim * 0.03,
      lg: minDim * 0.05,
      xl: minDim * 0.08,
    },
    // Border radius
    radius: {
      sm: minDim * 0.01,
      md: minDim * 0.02,
      lg: minDim * 0.03,
      full: minDim * 0.5,
    },
    // Font sizes (relative to height for readability)
    fontSize: {
      xs: height * 0.018,
      sm: height * 0.022,
      md: height * 0.028,
      lg: height * 0.038,
      xl: height * 0.05,
      xxl: height * 0.07,
    },
    // Element sizes
    size: {
      icon: minDim * 0.06,
      node: minDim * 0.12,
      card: minDim * 0.25,
    },
    // Glow sizes
    glow: {
      sm: minDim * 0.01,
      md: minDim * 0.02,
      lg: minDim * 0.04,
    },
  };
};
`;

/**
 * Reference Example 1: Responsive Flowchart
 * Demonstrates proper layout with flexbox, responsive sizing, and text handling
 */
export const REFERENCE_FLOWCHART = `
// src/\${projectId}/index.tsx
import React from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame, spring, interpolate } from 'remotion';

const COLORS = {
  bgDeep: '#0f0f23',
  bgGradient: 'radial-gradient(ellipse at top, #1a1a3e 0%, #0f0f23 60%)',
  primary: '#8b5cf6',
  secondary: '#3b82f6',
  accent: '#06b6d4',
  glow: 'rgba(139, 92, 246, 0.4)',
  white: '#ffffff',
  muted: '#888888',
};

// Reusable responsive hook
const useResponsive = () => {
  const { width, height } = useVideoConfig();
  const minDim = Math.min(width, height);
  return {
    padding: minDim * 0.05,
    gap: minDim * 0.03,
    radius: minDim * 0.02,
    fontSize: {
      sm: height * 0.022,
      md: height * 0.032,
      lg: height * 0.045,
    },
    glow: minDim * 0.025,
  };
};

const FlowNode: React.FC<{ label: string; index: number }> = ({ label, index }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const r = useResponsive();

  const delay = index * 20;
  const scale = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 80 } });
  const opacity = interpolate(frame - delay, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const glowIntensity = interpolate(Math.sin((frame - delay) * 0.1), [-1, 1], [0.3, 0.8]);

  // ALL SIZES ARE RESPONSIVE
  const nodeWidth = width * 0.85;
  const nodeHeight = height * 0.1;
  const numberSize = height * 0.045;

  return (
    <div style={{
      width: nodeWidth,
      height: nodeHeight,
      background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.05) 100%)',
      border: \`\${Math.max(2, height * 0.002)}px solid \${COLORS.primary}\`,
      borderRadius: r.radius,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: \`0 \${r.padding}px\`,
      gap: r.gap,
      transform: \`scale(\${scale})\`,
      opacity,
      boxShadow: \`0 0 \${r.glow * glowIntensity}px \${COLORS.glow}\`,
      // TEXT OVERFLOW HANDLING
      overflow: 'hidden',
    }}>
      {/* Number badge */}
      <div style={{
        width: numberSize,
        height: numberSize,
        minWidth: numberSize, // Prevent shrinking
        borderRadius: r.radius * 0.5,
        background: COLORS.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: r.fontSize.sm,
        fontWeight: 700,
        color: COLORS.bgDeep,
      }}>
        {index + 1}
      </div>

      {/* Label with proper text handling */}
      <span style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: r.fontSize.md,
        fontWeight: 600,
        color: COLORS.white,
        letterSpacing: '0.02em',
        // CRITICAL: Text overflow handling
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        flex: 1,
      }}>
        {label}
      </span>
    </div>
  );
};

const ConnectorArrow: React.FC<{ index: number }> = ({ index }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const r = useResponsive();

  const delay = index * 20 + 10;
  const progress = spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 60 } });

  // Responsive arrow dimensions
  const arrowHeight = height * 0.04;
  const arrowWidth = height * 0.004;

  return (
    <div style={{
      width: arrowWidth,
      height: arrowHeight * progress,
      background: \`linear-gradient(180deg, \${COLORS.primary} 0%, \${COLORS.accent} 100%)\`,
      borderRadius: arrowWidth / 2,
      boxShadow: \`0 0 \${r.glow * 0.5}px \${COLORS.glow}\`,
    }} />
  );
};

export const \${projectId}: React.FC = () => {
  const { width, height } = useVideoConfig();
  const r = useResponsive();

  const steps = ['Research & Discovery', 'Design & Prototype', 'Build & Launch'];

  return (
    <AbsoluteFill style={{ background: COLORS.bgGradient }}>
      {/* MAIN LAYOUT CONTAINER - Flexbox for alignment */}
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: r.padding,
        gap: r.gap * 0.5,
      }}>
        {steps.map((step, i) => (
          <React.Fragment key={i}>
            {i > 0 && <ConnectorArrow index={i} />}
            <FlowNode label={step} index={i} />
          </React.Fragment>
        ))}
      </div>
    </AbsoluteFill>
  );
};
`;

/**
 * Reference Example 2: Responsive Bar Chart
 * Shows proper flexbox layout with dynamic bar sizing
 */
export const REFERENCE_BAR_CHART = `
// src/\${projectId}/components/AnimatedBarChart.tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

const COLORS = {
  bgDeep: '#0f0f23',
  bgGradient: 'radial-gradient(ellipse at top, #1a1a3e 0%, #0f0f23 60%)',
  primary: '#8b5cf6',
  secondary: '#3b82f6',
  accent: '#06b6d4',
  success: '#22c55e',
  muted: '#888888',
};

const BAR_COLORS = [COLORS.primary, COLORS.secondary, COLORS.accent, COLORS.success];

interface DataPoint {
  label: string;
  value: number;
}

export const AnimatedBarChart: React.FC<{ data: DataPoint[]; title: string }> = ({ data, title }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const minDim = Math.min(width, height);

  // ALL RESPONSIVE VALUES
  const padding = minDim * 0.05;
  const gap = minDim * 0.02;
  const titleSize = height * 0.045;
  const valueSize = height * 0.028;
  const labelSize = height * 0.02;
  const radius = minDim * 0.015;
  const glow = minDim * 0.02;

  const maxValue = Math.max(...data.map(d => d.value));
  const barAreaWidth = width - padding * 2;
  const barWidth = (barAreaWidth - gap * (data.length - 1)) / data.length;
  const maxBarHeight = height * 0.45;

  // Title animation
  const titleScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });

  return (
    <AbsoluteFill style={{ background: COLORS.bgGradient }}>
      {/* STRUCTURED LAYOUT: Title Region + Chart Region */}
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding,
      }}>
        {/* TITLE REGION - Top 15% */}
        <div style={{
          flex: '0 0 15%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <h1 style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: titleSize,
            fontWeight: 700,
            color: '#ffffff',
            textAlign: 'center',
            transform: \`scale(\${titleScale})\`,
            margin: 0,
            // Text handling
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '100%',
          }}>
            {title}
          </h1>
        </div>

        {/* CHART REGION - Bottom 85% */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap,
          paddingBottom: height * 0.1,
        }}>
          {data.map((item, i) => {
            const delay = 15 + i * 12;
            const barProgress = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 80 } });
            const targetHeight = (item.value / maxValue) * maxBarHeight;
            const currentHeight = targetHeight * barProgress;
            const displayValue = Math.round(item.value * barProgress);
            const glowPulse = interpolate(Math.sin((frame - delay) * 0.08), [-1, 1], [0.4, 1]);
            const barColor = BAR_COLORS[i % BAR_COLORS.length];

            return (
              <div key={i} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: gap * 0.5,
                width: barWidth,
                maxWidth: width * 0.2, // Cap bar width
              }}>
                {/* Value label */}
                <div style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: valueSize,
                  fontWeight: 700,
                  color: barColor,
                  textShadow: \`0 0 \${glow}px \${barColor}\`,
                  opacity: barProgress,
                }}>
                  {displayValue}
                </div>

                {/* Bar */}
                <div style={{
                  width: '100%',
                  height: currentHeight,
                  background: \`linear-gradient(180deg, \${barColor} 0%, \${barColor}88 100%)\`,
                  borderRadius: radius,
                  boxShadow: \`0 0 \${glow * glowPulse}px \${barColor}66\`,
                  border: \`\${Math.max(1, minDim * 0.001)}px solid \${barColor}\`,
                }} />

                {/* Label */}
                <div style={{
                  fontFamily: 'system-ui, sans-serif',
                  fontSize: labelSize,
                  color: COLORS.muted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  opacity: barProgress,
                  textAlign: 'center',
                  // Text handling for labels
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%',
                }}>
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
`;

/**
 * Reference Example 3: Responsive Info Card Layout
 * Shows heading + content + footer pattern with proper text wrapping
 */
export const REFERENCE_INFO_CARD = `
// src/\${projectId}/components/InfoCard.tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

const COLORS = {
  bgDeep: '#0f0f23',
  bgGradient: 'radial-gradient(ellipse at center, #1a1a3e 0%, #0f0f23 90%)',
  primary: '#8b5cf6',
  accent: '#06b6d4',
  glow: 'rgba(139, 92, 246, 0.4)',
  white: '#ffffff',
  muted: '#888888',
};

export const InfoCard: React.FC<{
  title: string;
  subtitle: string;
  content: string;
  highlight: string;
}> = ({ title, subtitle, content, highlight }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const minDim = Math.min(width, height);

  // RESPONSIVE DESIGN TOKENS
  const padding = minDim * 0.06;
  const gap = minDim * 0.025;
  const radius = minDim * 0.025;
  const glow = minDim * 0.03;
  const borderWidth = Math.max(2, minDim * 0.003);

  const fontSize = {
    title: height * 0.055,
    subtitle: height * 0.025,
    content: height * 0.032,
    highlight: height * 0.08,
  };

  const cardScale = spring({ frame, fps, config: { damping: 12, stiffness: 60 } });
  const contentOpacity = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: 'clamp' });
  const glowPulse = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.5, 1]);

  return (
    <AbsoluteFill style={{ background: COLORS.bgGradient }}>
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding,
      }}>
        {/* CARD CONTAINER */}
        <div style={{
          width: '100%',
          maxWidth: width * 0.9,
          background: 'rgba(139, 92, 246, 0.08)',
          border: \`\${borderWidth}px solid \${COLORS.primary}\`,
          borderRadius: radius,
          boxShadow: \`0 0 \${glow * glowPulse}px \${COLORS.glow}\`,
          transform: \`scale(\${cardScale})\`,
          overflow: 'hidden', // Prevent content overflow
        }}>
          {/* CARD LAYOUT: Vertical stack with flexbox */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            padding,
            gap,
          }}>
            {/* HEADER REGION */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: gap * 0.3,
            }}>
              <h1 style={{
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: fontSize.title,
                fontWeight: 700,
                color: COLORS.white,
                margin: 0,
                lineHeight: 1.2,
                // Multi-line text handling
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
              }}>
                {title}
              </h1>
              <p style={{
                fontFamily: 'system-ui, sans-serif',
                fontSize: fontSize.subtitle,
                color: COLORS.muted,
                margin: 0,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}>
                {subtitle}
              </p>
            </div>

            {/* HIGHLIGHT NUMBER */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: \`\${gap}px 0\`,
              opacity: contentOpacity,
            }}>
              <span style={{
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: fontSize.highlight,
                fontWeight: 800,
                color: COLORS.primary,
                textShadow: \`0 0 \${glow}px \${COLORS.glow}\`,
              }}>
                {highlight}
              </span>
            </div>

            {/* CONTENT REGION */}
            <p style={{
              fontFamily: 'system-ui, sans-serif',
              fontSize: fontSize.content,
              color: COLORS.white,
              margin: 0,
              lineHeight: 1.5,
              opacity: contentOpacity,
              textAlign: 'center',
              // CRITICAL: Multi-line text handling
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
              hyphens: 'auto',
            }}>
              {content}
            </p>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
`;

/**
 * Reference Example 4: Responsive Stats Display
 * Shows multiple stats in a responsive grid
 */
export const REFERENCE_STATS = `
// src/\${projectId}/components/StatsGrid.tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

const COLORS = {
  bgDeep: '#0f0f23',
  bgGradient: 'radial-gradient(ellipse at top, #1a1a3e 0%, #0f0f23 60%)',
  primary: '#8b5cf6',
  secondary: '#3b82f6',
  accent: '#06b6d4',
  glow: 'rgba(139, 92, 246, 0.4)',
  white: '#ffffff',
  muted: '#888888',
};

interface StatItem {
  value: number;
  suffix?: string;
  label: string;
}

const AnimatedStat: React.FC<{ stat: StatItem; index: number }> = ({ stat, index }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const minDim = Math.min(useVideoConfig().width, height);

  // RESPONSIVE VALUES
  const valueSize = height * 0.07;
  const labelSize = height * 0.022;
  const glow = minDim * 0.025;
  const gap = minDim * 0.01;

  const delay = index * 15;
  const progress = spring({ frame: frame - delay, fps, config: { damping: 20, stiffness: 40 } });
  const scale = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 80 } });
  const displayValue = Math.round(stat.value * progress);
  const glowPulse = interpolate(Math.sin((frame - delay) * 0.08), [-1, 1], [0.5, 1]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap,
      transform: \`scale(\${scale})\`,
    }}>
      <div style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: valueSize,
        fontWeight: 800,
        color: COLORS.primary,
        textShadow: \`0 0 \${glow * glowPulse}px \${COLORS.glow}\`,
        lineHeight: 1,
      }}>
        {displayValue.toLocaleString()}{stat.suffix || ''}
      </div>
      <div style={{
        fontFamily: 'system-ui, sans-serif',
        fontSize: labelSize,
        color: COLORS.muted,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        textAlign: 'center',
        // Text handling
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '100%',
      }}>
        {stat.label}
      </div>
    </div>
  );
};

export const StatsGrid: React.FC<{ title: string; stats: StatItem[] }> = ({ title, stats }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const minDim = Math.min(width, height);

  // RESPONSIVE VALUES
  const padding = minDim * 0.06;
  const gap = minDim * 0.04;
  const titleSize = height * 0.05;

  const titleScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });

  return (
    <AbsoluteFill style={{ background: COLORS.bgGradient }}>
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding,
        gap: gap * 1.5,
      }}>
        {/* TITLE REGION */}
        <div style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <h1 style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: titleSize,
            fontWeight: 700,
            color: COLORS.white,
            textAlign: 'center',
            transform: \`scale(\${titleScale})\`,
            margin: 0,
            wordWrap: 'break-word',
          }}>
            {title}
          </h1>
        </div>

        {/* STATS GRID REGION */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap,
        }}>
          {/* Responsive grid: 2 columns on wide, 1 on narrow */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap,
            width: '100%',
          }}>
            {stats.map((stat, i) => (
              <div key={i} style={{
                flex: width > height ? '0 0 45%' : '0 0 100%',
                display: 'flex',
                justifyContent: 'center',
              }}>
                <AnimatedStat stat={stat} index={i} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
`;

/**
 * Constructs the reference examples section for the prompt
 */
export function buildReferenceExamplesSection(projectId: string): string {
  return `
## 🎨 REFERENCE EXAMPLES - FULLY RESPONSIVE DESIGN

**CRITICAL: Every value must be relative to width/height. NO hardcoded pixels.**

### Responsive Design Helper (USE THIS PATTERN):
\`\`\`tsx
${RESPONSIVE_LAYOUT_HELPER}
\`\`\`

### Example 1: Responsive Flowchart
${REFERENCE_FLOWCHART.replace(/\$\{projectId\}/g, projectId)}

### Example 2: Responsive Bar Chart with Title
${REFERENCE_BAR_CHART}

### Example 3: Info Card with Text Wrapping
${REFERENCE_INFO_CARD}

---

## 📐 MANDATORY LAYOUT RULES

### 1. ALL Sizes Must Be Relative
\`\`\`tsx
// ✅ CORRECT - Responsive
const { width, height } = useVideoConfig();
const minDim = Math.min(width, height);

const padding = minDim * 0.05;
const fontSize = height * 0.035;
const borderRadius = minDim * 0.02;
const gap = minDim * 0.03;
const glowSize = minDim * 0.025;
const borderWidth = Math.max(2, minDim * 0.003);

// ❌ WRONG - Hardcoded pixels
padding: 20,
fontSize: 32,
borderRadius: 16,
gap: 30,
\`\`\`

### 2. Text Overflow Handling
\`\`\`tsx
// For single-line text (titles, labels)
style={{
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '100%',
}}

// For multi-line text (paragraphs, descriptions)
style={{
  wordWrap: 'break-word',
  overflowWrap: 'break-word',
  hyphens: 'auto',
  lineHeight: 1.4,
}}
\`\`\`

### 3. Layout Structure (Flexbox)
\`\`\`tsx
// ALWAYS use flexbox for layout
<div style={{
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  padding: minDim * 0.05,
  gap: minDim * 0.03,
}}>
  {/* Title Region - fixed height */}
  <div style={{ flex: '0 0 15%' }}>...</div>

  {/* Content Region - fills remaining space */}
  <div style={{ flex: 1 }}>...</div>

  {/* Footer Region - fixed height */}
  <div style={{ flex: '0 0 10%' }}>...</div>
</div>
\`\`\`

### 4. Prevent Overflow
\`\`\`tsx
// Container must have overflow: hidden
<div style={{
  overflow: 'hidden',
  // ... other styles
}}>
  {/* Content cannot escape this container */}
</div>
\`\`\`

### 5. Responsive Font Scale
\`\`\`tsx
// Font sizes relative to HEIGHT (maintains readability)
const fontSize = {
  xs: height * 0.018,  // Small labels
  sm: height * 0.022,  // Body text
  md: height * 0.032,  // Subheadings
  lg: height * 0.045,  // Headings
  xl: height * 0.06,   // Large titles
  xxl: height * 0.08,  // Hero numbers
};
\`\`\`

### 6. Glow Effects (Responsive)
\`\`\`tsx
const glow = minDim * 0.025;
const glowPulse = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.5, 1]);

boxShadow: \`0 0 \${glow * glowPulse}px rgba(139, 92, 246, 0.4)\`
\`\`\`

### 7. React key Prop (MANDATORY - NEVER FORGET)
\`\`\`tsx
// ✅ ALWAYS add key when using .map()
{items.map((item, i) => (
  <div key={i}>
    {item.content}
  </div>
))}

// ✅ For multiple elements, use React.Fragment with key
{steps.map((step, i) => (
  <React.Fragment key={i}>
    {i > 0 && <ConnectorArrow />}
    <FlowNode label={step} index={i} />
  </React.Fragment>
))}

// ❌ NEVER omit the key prop - causes React errors
{items.map((item) => <div>{item}</div>)} // WRONG!
\`\`\`

`;
}
