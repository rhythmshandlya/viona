import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { useAudioData, visualizeAudio } from '@remotion/media-utils';

type WaveformStyle = 'bars' | 'line' | 'circular' | 'dots';

interface AudioWaveformProps {
  /** Path to audio file (use staticFile() for local files) */
  audioSrc: string;
  /** Waveform visualization style */
  style?: WaveformStyle;
  /** Primary color */
  color?: string;
  /** Secondary color for gradient */
  secondaryColor?: string;
  /** Width of the visualization */
  width?: number;
  /** Height of the visualization */
  height?: number;
  /** Number of frequency samples (default: 64) */
  numberOfSamples?: number;
  /** Enable smoothing of audio visualization */
  smoothing?: boolean;
  /** Bar width for 'bars' style */
  barWidth?: number;
  /** Gap between bars for 'bars' style */
  barGap?: number;
  /** Show glow effect */
  glow?: boolean;
  /** Mirror the waveform */
  mirror?: boolean;
}

/**
 * AudioWaveform - Audio visualization using @remotion/media-utils
 *
 * Renders frequency data from audio as animated bars, lines, or circles.
 * Automatically syncs with the audio playback.
 *
 * @example
 * <AudioWaveform
 *   audioSrc={staticFile('audio.mp3')}
 *   style="bars"
 *   color="#8b5cf6"
 *   numberOfSamples={32}
 * />
 */
export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  audioSrc,
  style = 'bars',
  color = '#8b5cf6',
  secondaryColor,
  width,
  height,
  numberOfSamples = 64,
  smoothing = true,
  barWidth,
  barGap = 2,
  glow = true,
  mirror = false,
}) => {
  const frame = useCurrentFrame();
  const { fps, width: videoWidth, height: videoHeight } = useVideoConfig();

  const effectiveWidth = width || videoWidth * 0.8;
  const effectiveHeight = height || videoHeight * 0.3;

  // Load audio data
  const audioData = useAudioData(audioSrc);

  if (!audioData) {
    return null; // Loading
  }

  // Visualize audio at current frame
  const visualization = visualizeAudio({
    fps,
    frame,
    audioData,
    numberOfSamples,
    smoothing,
  });

  const effectiveBarWidth = barWidth || (effectiveWidth - (numberOfSamples - 1) * barGap) / numberOfSamples;
  const actualSecondaryColor = secondaryColor || color;

  // Glow filter
  const glowFilter = glow
    ? `drop-shadow(0 0 ${effectiveBarWidth}px ${color}80)`
    : undefined;

  const renderBars = () => (
    <svg width={effectiveWidth} height={effectiveHeight} style={{ filter: glowFilter }}>
      <defs>
        <linearGradient id="barGradient" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={actualSecondaryColor} />
        </linearGradient>
      </defs>
      {visualization.map((amplitude, index) => {
        const barHeight = amplitude * effectiveHeight * 0.9;
        const x = index * (effectiveBarWidth + barGap);
        const y = mirror
          ? (effectiveHeight - barHeight) / 2
          : effectiveHeight - barHeight;

        return (
          <rect
            key={index}
            x={x}
            y={y}
            width={effectiveBarWidth}
            height={mirror ? barHeight : barHeight}
            rx={effectiveBarWidth / 2}
            fill="url(#barGradient)"
          />
        );
      })}
      {mirror &&
        visualization.map((amplitude, index) => {
          const barHeight = amplitude * effectiveHeight * 0.45;
          const x = index * (effectiveBarWidth + barGap);
          const y = effectiveHeight / 2;

          return (
            <rect
              key={`mirror-${index}`}
              x={x}
              y={y}
              width={effectiveBarWidth}
              height={barHeight}
              rx={effectiveBarWidth / 2}
              fill="url(#barGradient)"
              opacity={0.5}
            />
          );
        })}
    </svg>
  );

  const renderLine = () => {
    const points = visualization
      .map((amplitude, index) => {
        const x = (index / (visualization.length - 1)) * effectiveWidth;
        const y = effectiveHeight - amplitude * effectiveHeight * 0.9;
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <svg width={effectiveWidth} height={effectiveHeight} style={{ filter: glowFilter }}>
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={actualSecondaryColor} />
          </linearGradient>
        </defs>
        <polyline
          points={points}
          fill="none"
          stroke="url(#lineGradient)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Filled area below line */}
        <polygon
          points={`0,${effectiveHeight} ${points} ${effectiveWidth},${effectiveHeight}`}
          fill="url(#lineGradient)"
          opacity={0.2}
        />
      </svg>
    );
  };

  const renderCircular = () => {
    const centerX = effectiveWidth / 2;
    const centerY = effectiveHeight / 2;
    const baseRadius = Math.min(effectiveWidth, effectiveHeight) * 0.3;

    return (
      <svg width={effectiveWidth} height={effectiveHeight} style={{ filter: glowFilter }}>
        <defs>
          <linearGradient id="circularGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={actualSecondaryColor} />
          </linearGradient>
        </defs>
        {visualization.map((amplitude, index) => {
          const angle = (index / visualization.length) * Math.PI * 2 - Math.PI / 2;
          const innerRadius = baseRadius;
          const outerRadius = baseRadius + amplitude * baseRadius;

          const x1 = centerX + Math.cos(angle) * innerRadius;
          const y1 = centerY + Math.sin(angle) * innerRadius;
          const x2 = centerX + Math.cos(angle) * outerRadius;
          const y2 = centerY + Math.sin(angle) * outerRadius;

          return (
            <line
              key={index}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="url(#circularGradient)"
              strokeWidth={3}
              strokeLinecap="round"
            />
          );
        })}
        <circle
          cx={centerX}
          cy={centerY}
          r={baseRadius * 0.3}
          fill="url(#circularGradient)"
        />
      </svg>
    );
  };

  const renderDots = () => (
    <svg width={effectiveWidth} height={effectiveHeight} style={{ filter: glowFilter }}>
      <defs>
        <linearGradient id="dotGradient" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={actualSecondaryColor} />
        </linearGradient>
      </defs>
      {visualization.map((amplitude, index) => {
        const x = (index / (visualization.length - 1)) * effectiveWidth;
        const y = effectiveHeight - amplitude * effectiveHeight * 0.8;
        const radius = 3 + amplitude * 10;

        return (
          <circle
            key={index}
            cx={x}
            cy={y}
            r={radius}
            fill="url(#dotGradient)"
          />
        );
      })}
    </svg>
  );

  switch (style) {
    case 'line':
      return renderLine();
    case 'circular':
      return renderCircular();
    case 'dots':
      return renderDots();
    case 'bars':
    default:
      return renderBars();
  }
};

export default AudioWaveform;
