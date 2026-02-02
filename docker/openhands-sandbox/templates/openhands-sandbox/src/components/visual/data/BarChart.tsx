import React from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';

interface BarData {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  /** Array of data points */
  data: BarData[];
  /** Frame to start bar growth */
  startFrame: number;
  /** Delay between each bar in frames (default: 5) */
  staggerFrames?: number;
  /** Duration for each bar to grow (default: 30) */
  durationFrames?: number;
  /** Show value labels (default: true) */
  showLabels?: boolean;
  /** Default bar color */
  barColor?: string;
  /** Label color */
  labelColor?: string;
  /** Value label color */
  valueLabelColor?: string;
  /** Orientation: 'horizontal' | 'vertical' (default: 'horizontal') */
  orientation?: 'horizontal' | 'vertical';
  /** Max width/height percentage (default: 80) */
  maxSize?: number;
}

/**
 * BarChart - Animated bar chart with growing bars
 *
 * Use for: comparing values, showing metrics, data visualization
 *
 * @example
 * <BarChart
 *   data={[
 *     { label: 'React', value: 80, color: '#61dafb' },
 *     { label: 'Vue', value: 60, color: '#42b883' },
 *     { label: 'Angular', value: 45, color: '#dd0031' },
 *   ]}
 *   startFrame={30}
 * />
 */
export const BarChart: React.FC<BarChartProps> = ({
  data,
  startFrame,
  staggerFrames = 5,
  durationFrames = 30,
  showLabels = true,
  barColor = '#8b5cf6',
  labelColor = '#ffffff',
  valueLabelColor = '#ffffff',
  orientation = 'horizontal',
  maxSize = 80,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const minDim = Math.min(width, height);

  // Find max value for scaling
  const maxValue = Math.max(...data.map((d) => d.value));

  const isHorizontal = orientation === 'horizontal';
  const barThickness = minDim * 0.04;
  const gap = minDim * 0.02;
  const labelWidth = minDim * 0.15;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isHorizontal ? 'column' : 'row',
        alignItems: isHorizontal ? 'flex-start' : 'flex-end',
        gap,
        width: '100%',
        height: '100%',
        padding: minDim * 0.02,
        boxSizing: 'border-box',
      }}
    >
      {data.map((item, index) => {
        const barStartFrame = startFrame + index * staggerFrames;
        const localFrame = Math.max(0, frame - barStartFrame);

        const growProgress = spring({
          frame: localFrame,
          fps,
          config: { damping: 15, stiffness: 80 },
        });

        const barSize = (item.value / maxValue) * maxSize * growProgress;
        const actualColor = item.color || barColor;

        if (isHorizontal) {
          return (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: minDim * 0.015,
                width: '100%',
              }}
            >
              {/* Label */}
              {showLabels && (
                <div
                  style={{
                    width: labelWidth,
                    color: labelColor,
                    fontSize: minDim * 0.025,
                    fontFamily: 'system-ui, sans-serif',
                    textAlign: 'right',
                    opacity: frame >= barStartFrame ? 1 : 0,
                  }}
                >
                  {item.label}
                </div>
              )}

              {/* Bar */}
              <div
                style={{
                  flex: 1,
                  height: barThickness,
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: barThickness / 2,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${barSize}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${actualColor}, ${actualColor}dd)`,
                    borderRadius: barThickness / 2,
                    boxShadow: `0 0 ${minDim * 0.01}px ${actualColor}80`,
                  }}
                />
              </div>

              {/* Value */}
              {showLabels && (
                <div
                  style={{
                    width: minDim * 0.08,
                    color: valueLabelColor,
                    fontSize: minDim * 0.022,
                    fontFamily: 'system-ui, sans-serif',
                    fontWeight: 'bold',
                    opacity: growProgress,
                  }}
                >
                  {Math.round(item.value * growProgress)}
                </div>
              )}
            </div>
          );
        }

        // Vertical orientation
        return (
          <div
            key={index}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: minDim * 0.01,
              flex: 1,
            }}
          >
            {/* Value */}
            {showLabels && (
              <div
                style={{
                  color: valueLabelColor,
                  fontSize: minDim * 0.02,
                  fontFamily: 'system-ui, sans-serif',
                  fontWeight: 'bold',
                  opacity: growProgress,
                }}
              >
                {Math.round(item.value * growProgress)}
              </div>
            )}

            {/* Bar container */}
            <div
              style={{
                width: barThickness,
                flex: 1,
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: barThickness / 2,
                display: 'flex',
                alignItems: 'flex-end',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: `${barSize}%`,
                  background: `linear-gradient(0deg, ${actualColor}, ${actualColor}dd)`,
                  borderRadius: barThickness / 2,
                  boxShadow: `0 0 ${minDim * 0.01}px ${actualColor}80`,
                }}
              />
            </div>

            {/* Label */}
            {showLabels && (
              <div
                style={{
                  color: labelColor,
                  fontSize: minDim * 0.02,
                  fontFamily: 'system-ui, sans-serif',
                  textAlign: 'center',
                  opacity: frame >= barStartFrame ? 1 : 0,
                }}
              >
                {item.label}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default BarChart;
