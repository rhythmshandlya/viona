/**
 * High-quality Remotion code examples for few-shot prompting.
 * These examples show the AI exactly what "good" looks like.
 *
 * Key principles from reel-composer:
 * 1. Show don't tell - actual code beats descriptions
 * 2. Specific design tokens - exact colors, fonts, effects
 * 3. Professional polish - glows, gradients, smooth animations
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
      glowPrimary: 'rgba(139, 92, 246, 0.4)',
      glowAccent: 'rgba(6, 182, 212, 0.4)',
    },
    fonts: {
      heading: "'Inter', 'Segoe UI', sans-serif",
      mono: "'JetBrains Mono', 'Fira Code', monospace",
      body: "'Inter', 'Segoe UI', sans-serif",
    },
    effects: {
      glowBox: '0 0 30px rgba(139, 92, 246, 0.4)',
      glowText: '0 0 20px rgba(139, 92, 246, 0.6)',
      glassBorder: '1px solid rgba(255, 255, 255, 0.1)',
      glassBlur: 'blur(10px)',
    },
  },
  minimal: {
    colors: {
      bgDeep: '#1a1a1a',
      bgCard: 'rgba(255, 255, 255, 0.03)',
      bgGradient: 'linear-gradient(180deg, #1a1a1a 0%, #0f0f0f 100%)',
      primary: '#3b82f6',
      white: '#ffffff',
      muted: '#6b7280',
      glowPrimary: 'rgba(59, 130, 246, 0.3)',
    },
    fonts: {
      heading: "'Inter', 'Segoe UI', sans-serif",
      mono: "'SF Mono', 'Fira Code', monospace",
      body: "'Inter', 'Segoe UI', sans-serif",
    },
    effects: {
      glowBox: '0 0 40px rgba(59, 130, 246, 0.2)',
      glassBorder: '1px solid rgba(255, 255, 255, 0.05)',
    },
  },
};

/**
 * Reference Example 1: Animated Flowchart
 * Shows a 3-step process with staggered spring animations and glow effects
 */
export const REFERENCE_FLOWCHART = `
// src/\${projectId}/index.tsx
import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig, useCurrentFrame, spring, interpolate } from 'remotion';

const COLORS = {
  bgDeep: '#0f0f23',
  bgGradient: 'radial-gradient(ellipse at top, #1a1a3e 0%, #0f0f23 60%)',
  primary: '#8b5cf6',      // Purple
  secondary: '#3b82f6',    // Blue
  accent: '#06b6d4',       // Cyan
  glow: 'rgba(139, 92, 246, 0.4)',
  white: '#ffffff',
};

const FlowNode: React.FC<{
  label: string;
  index: number;
  yPosition: number;
}> = ({ label, index, yPosition }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const delay = index * 20;
  const scale = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 80 } });
  const opacity = interpolate(frame - delay, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const glowIntensity = interpolate(
    Math.sin((frame - delay) * 0.1),
    [-1, 1],
    [0.3, 0.8],
    { extrapolateRight: 'clamp' }
  );

  const nodeWidth = width * 0.7;
  const nodeHeight = height * 0.08;
  const fontSize = height * 0.035;

  return (
    <div style={{
      position: 'absolute',
      left: '50%',
      top: yPosition,
      transform: \`translate(-50%, -50%) scale(\${scale})\`,
      opacity,
      width: nodeWidth,
      height: nodeHeight,
      background: 'linear-gradient(135deg, rgba(0, 243, 255, 0.15) 0%, rgba(0, 243, 255, 0.05) 100%)',
      border: '2px solid ' + COLORS.primary,
      borderRadius: 16,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Oswald', sans-serif",
      fontSize,
      fontWeight: 700,
      color: COLORS.white,
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      boxShadow: \`0 0 \${30 * glowIntensity}px \${COLORS.glow}, inset 0 0 20px rgba(0, 243, 255, 0.1)\`,
    }}>
      <span style={{
        background: COLORS.primary,
        color: COLORS.bgDeep,
        width: height * 0.05,
        height: height * 0.05,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
        fontSize: fontSize * 0.8,
      }}>
        {index + 1}
      </span>
      {label}
    </div>
  );
};

const ConnectorArrow: React.FC<{ fromY: number; toY: number; index: number }> = ({ fromY, toY, index }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();

  const delay = index * 20 + 15;
  const progress = spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 60 } });
  const arrowHeight = (toY - fromY) - height * 0.08;

  return (
    <div style={{
      position: 'absolute',
      left: '50%',
      top: fromY + height * 0.04,
      transform: 'translateX(-50%)',
      width: 4,
      height: arrowHeight * progress,
      background: \`linear-gradient(180deg, \${COLORS.primary} 0%, \${COLORS.accent} 100%)\`,
      borderRadius: 2,
      boxShadow: '0 0 10px ' + COLORS.glow,
    }} />
  );
};

export const \${projectId}: React.FC = () => {
  const { height } = useVideoConfig();

  const steps = ['Research & Discovery', 'Design & Prototype', 'Build & Launch'];
  const positions = [height * 0.25, height * 0.50, height * 0.75];

  return (
    <AbsoluteFill style={{ background: COLORS.bgGradient }}>
      {steps.map((step, i) => (
        <React.Fragment key={i}>
          {i > 0 && <ConnectorArrow fromY={positions[i-1]} toY={positions[i]} index={i} />}
          <FlowNode label={step} index={i} yPosition={positions[i]} />
        </React.Fragment>
      ))}
    </AbsoluteFill>
  );
};
`;

/**
 * Reference Example 2: Animated Data Visualization (Bar Chart)
 * Shows animated bars with value counters and glow effects
 */
export const REFERENCE_BAR_CHART = `
// src/\${projectId}/components/AnimatedBarChart.tsx
import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

const COLORS = {
  bgDeep: '#0f0f23',
  primary: '#8b5cf6',      // Purple
  secondary: '#3b82f6',    // Blue
  accent: '#06b6d4',       // Cyan
  success: '#22c55e',      // Green
  glow: 'rgba(139, 92, 246, 0.3)',
};

const BAR_COLORS = [COLORS.primary, COLORS.secondary, COLORS.accent, COLORS.success];

interface DataPoint {
  label: string;
  value: number;
}

export const AnimatedBarChart: React.FC<{ data: DataPoint[] }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const maxValue = Math.max(...data.map(d => d.value));
  const barWidth = (width * 0.8) / data.length - 20;
  const maxBarHeight = height * 0.5;
  const fontSize = height * 0.025;
  const labelSize = height * 0.02;

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingBottom: height * 0.15,
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 20,
      }}>
        {data.map((item, i) => {
          const delay = i * 12;
          const barProgress = spring({
            frame: frame - delay,
            fps,
            config: { damping: 12, stiffness: 80 }
          });

          const targetHeight = (item.value / maxValue) * maxBarHeight;
          const currentHeight = targetHeight * barProgress;

          const displayValue = Math.round(item.value * barProgress);
          const glowPulse = interpolate(
            Math.sin((frame - delay) * 0.08),
            [-1, 1],
            [0.4, 1],
            { extrapolateRight: 'clamp' }
          );

          const barColor = BAR_COLORS[i % BAR_COLORS.length];

          return (
            <div key={i} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
            }}>
              <div style={{
                fontSize,
                fontWeight: 700,
                color: barColor,
                textShadow: \`0 0 15px \${barColor}\`,
                opacity: barProgress,
              }}>
                {displayValue}
              </div>

              <div style={{
                width: barWidth,
                height: currentHeight,
                background: \`linear-gradient(180deg, \${barColor} 0%, \${barColor}88 100%)\`,
                borderRadius: 8,
                boxShadow: \`0 0 \${20 * glowPulse}px \${barColor}66, inset 0 0 20px rgba(255,255,255,0.1)\`,
                border: \`1px solid \${barColor}\`,
              }} />

              <div style={{
                fontSize: labelSize,
                color: '#888',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                opacity: barProgress,
              }}>
                {item.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
`;

/**
 * Reference Example 3: Concept Visualization with Icons
 * Shows a central concept with orbiting/connected ideas
 */
export const REFERENCE_CONCEPT_MAP = `
// src/\${projectId}/components/ConceptOrbit.tsx
import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

const COLORS = {
  bgDeep: '#0f0f23',
  primary: '#8b5cf6',      // Purple
  secondary: '#3b82f6',    // Blue
  accent: '#06b6d4',       // Cyan
  glow: 'rgba(139, 92, 246, 0.4)',
};

interface ConceptNode {
  icon: string;
  label: string;
}

export const ConceptOrbit: React.FC<{
  centerLabel: string;
  nodes: ConceptNode[];
}> = ({ centerLabel, nodes }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const centerSize = Math.min(width, height) * 0.25;
  const nodeSize = Math.min(width, height) * 0.12;
  const orbitRadius = Math.min(width, height) * 0.32;
  const fontSize = height * 0.022;
  const centerFontSize = height * 0.04;

  const centerScale = spring({ frame, fps, config: { damping: 12, stiffness: 60 } });
  const rotation = interpolate(frame, [0, 300], [0, 360], { extrapolateRight: 'extend' });

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    }}>
      {/* Center Node */}
      <div style={{
        width: centerSize,
        height: centerSize,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 30% 30%, #1a3a4a 0%, #050505 70%)',
        border: \`3px solid \${COLORS.primary}\`,
        boxShadow: \`0 0 40px \${COLORS.glow}, inset 0 0 30px rgba(0, 243, 255, 0.2)\`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: \`scale(\${centerScale})\`,
        fontFamily: "'Oswald', sans-serif",
        fontSize: centerFontSize,
        fontWeight: 700,
        color: COLORS.primary,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        textShadow: \`0 0 20px \${COLORS.glow}\`,
        zIndex: 10,
      }}>
        {centerLabel}
      </div>

      {/* Orbiting Nodes */}
      {nodes.map((node, i) => {
        const angleOffset = (360 / nodes.length) * i;
        const angle = (angleOffset + rotation * 0.3) * (Math.PI / 180);

        const delay = 20 + i * 15;
        const nodeScale = spring({
          frame: frame - delay,
          fps,
          config: { damping: 10, stiffness: 100 }
        });

        const x = Math.cos(angle) * orbitRadius;
        const y = Math.sin(angle) * orbitRadius;

        const pulse = interpolate(
          Math.sin((frame + i * 20) * 0.1),
          [-1, 1],
          [0.9, 1.1],
          { extrapolateRight: 'clamp' }
        );

        return (
          <div key={i} style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: \`translate(-50%, -50%) translate(\${x}px, \${y}px) scale(\${nodeScale * pulse})\`,
          }}>
            {/* Connection Line */}
            <div style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: orbitRadius - nodeSize/2,
              height: 2,
              background: \`linear-gradient(90deg, transparent 0%, \${COLORS.primary}44 50%, \${COLORS.primary} 100%)\`,
              transformOrigin: 'right center',
              transform: \`rotate(\${angle + Math.PI}rad) translateX(\${nodeSize/2}px)\`,
              opacity: nodeScale,
            }} />

            {/* Node */}
            <div style={{
              width: nodeSize,
              height: nodeSize,
              borderRadius: '50%',
              background: 'rgba(0, 243, 255, 0.1)',
              border: \`2px solid \${COLORS.primary}\`,
              boxShadow: \`0 0 20px \${COLORS.glow}\`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}>
              <span style={{ fontSize: nodeSize * 0.35 }}>{node.icon}</span>
              <span style={{
                fontSize,
                color: COLORS.primary,
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                textAlign: 'center',
              }}>
                {node.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
`;

/**
 * Reference Example 4: Animated Counter / Stats Display
 */
export const REFERENCE_STATS = `
// src/\${projectId}/components/AnimatedStat.tsx
import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

const COLORS = {
  primary: '#8b5cf6',      // Purple
  secondary: '#3b82f6',    // Blue
  accent: '#06b6d4',       // Cyan
  glow: 'rgba(139, 92, 246, 0.4)',
};

export const AnimatedStat: React.FC<{
  value: number;
  suffix?: string;
  label: string;
  delay?: number;
}> = ({ value, suffix = '', label, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 20, stiffness: 40 }
  });

  const displayValue = Math.round(value * progress);
  const scale = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 80 } });

  const glowPulse = interpolate(
    Math.sin((frame - delay) * 0.08),
    [-1, 1],
    [0.5, 1],
    { extrapolateRight: 'clamp' }
  );

  const valueSize = height * 0.12;
  const labelSize = height * 0.025;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      transform: \`scale(\${scale})\`,
    }}>
      <div style={{
        fontFamily: "'Oswald', sans-serif",
        fontSize: valueSize,
        fontWeight: 800,
        color: COLORS.primary,
        textShadow: \`0 0 \${40 * glowPulse}px \${COLORS.glow}\`,
        letterSpacing: '-0.02em',
        lineHeight: 1,
      }}>
        {displayValue.toLocaleString()}{suffix}
      </div>
      <div style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: labelSize,
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: '0.15em',
        marginTop: 8,
      }}>
        {label}
      </div>
    </div>
  );
};
`;

/**
 * Constructs the reference examples section for the prompt
 */
export function buildReferenceExamplesSection(projectId: string): string {
  return `
## 🎨 REFERENCE EXAMPLES - MATCH THIS QUALITY

Study these examples carefully. Your output should match this level of visual polish:

### Example 1: Animated Flowchart with Glow Effects
${REFERENCE_FLOWCHART.replace(/\$\{projectId\}/g, projectId)}

### Example 2: Animated Bar Chart with Data Visualization
${REFERENCE_BAR_CHART}

### Key Visual Patterns to Follow:
1. **Glow Effects**: Every important element has \`boxShadow: '0 0 30px rgba(139, 92, 246, 0.4)'\`
2. **Gradient Backgrounds**: Use \`radial-gradient(circle at center, #1a1a3e 0%, #0f0f23 90%)\`
3. **Pulsing Animations**: Use \`Math.sin(frame * 0.1)\` for breathing/pulsing effects
4. **Staggered Entries**: Each element enters 15-20 frames after the previous
5. **Spring Physics**: Use \`spring({ damping: 12, stiffness: 80 })\` for satisfying motion
6. **Typography**: Inter for headings, JetBrains Mono for data
7. **Color Palette**: Primary #8b5cf6 (purple), Secondary #3b82f6 (blue), Accent #06b6d4 (cyan)

`;
}
