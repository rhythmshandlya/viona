import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { VoxBlueprintProps } from './schema';
import { VOX_COLORS, VOX_SIZES, VOX_FONTS, sf, voxEaseOut } from '../../vox/constants';
import { voxEntrance, voxExit, voxIdle } from '../../vox/animations';
import { FilmGrain } from '../../vox/effects';
import { useScale } from '../../use-scale';

// Blueprint palette
const BG = '#0a1628';
const LINE = '#4a9eff';
const LINE_DIM = 'rgba(74, 158, 255, 0.35)';
const LINE_FAINT = 'rgba(74, 158, 255, 0.12)';
const ACCENT = '#7fdbff';
const TEXT_COLOR = '#b8d4f0';
const GRID_FINE = 'rgba(74, 158, 255, 0.06)';
const GRID_MAJOR = 'rgba(74, 158, 255, 0.14)';
const HATCH = 'rgba(74, 158, 255, 0.15)';

const VoxBlueprint: React.FC<VoxBlueprintProps> = ({ title, dimensions, detail }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width: W, height: H } = useVideoConfig();
  const s = useScale();

  const entrance = voxEntrance(frame, 3, undefined, 'up', s(15));
  const exitStart = durationInFrames - 10;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };
  const combinedOpacity = entrance.opacity * exit.opacity;
  const idle = voxIdle(frame, 33);

  // Animation phases (layered reveal like real drafting)
  const gridReveal = interpolate(frame, [3, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const centerLineReveal = interpolate(sf(frame), [10, 25], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: voxEaseOut });
  const outlineReveal = interpolate(sf(frame), [18, 55], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: voxEaseOut });
  const hatchReveal = interpolate(frame, [45, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const dimReveal = interpolate(sf(frame), [55, 80], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: voxEaseOut });
  const labelReveal = interpolate(frame, [70, 90], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleBlockReveal = interpolate(sf(frame), [80, 100], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: voxEaseOut });

  // Layout
  const PAD = s(40);
  const SCHEM_CX = W * 0.42;
  const SCHEM_CY = H * 0.44;
  const SCHEM_H = H * 0.52;
  const SCHEM_W = W * 0.38;

  // Rocket proportions
  const rH = SCHEM_H;
  const rW = SCHEM_W * 0.55;
  const hW = rW / 2;
  const topY = SCHEM_CY - rH / 2;
  const botY = SCHEM_CY + rH / 2;
  const cx = SCHEM_CX;

  // Rocket section heights (proportional)
  const escapeH = rH * 0.06;
  const noseH = rH * 0.12;
  const sIVBH = rH * 0.15;
  const sIIH = rH * 0.25;
  const sICH = rH * 0.30;
  const engineH = rH * 0.12;

  // Y coordinates for each section boundary
  const escapeTop = topY;
  const noseTop = escapeTop + escapeH;
  const sIVBTop = noseTop + noseH;
  const sIITop = sIVBTop + sIVBH;
  const sICTop = sIITop + sIIH;
  const engineTop = sICTop + sICH;

  // Width at each section (rocket tapers)
  const noseW = hW * 0.12;
  const sIVBW = hW * 0.55;
  const sIIW = hW * 0.8;
  const sICW = hW * 1.0;
  const engineW = hW * 1.1;
  const finW = hW * 1.5;

  // Main rocket outline path
  const rocketOutline = [
    // Escape tower (thin spike)
    `M ${cx} ${escapeTop}`,
    `L ${cx} ${noseTop - s(2)}`,
    // Nose cone
    `M ${cx} ${noseTop - s(2)}`,
    `L ${cx + noseW} ${noseTop + noseH * 0.3}`,
    `Q ${cx + sIVBW * 0.7} ${noseTop + noseH * 0.7} ${cx + sIVBW} ${sIVBTop}`,
    // S-IVB body
    `L ${cx + sIVBW} ${sIITop}`,
    // Interstage flare to S-II
    `L ${cx + sIIW} ${sIITop + s(6)}`,
    `L ${cx + sIIW} ${sICTop}`,
    // Interstage to S-IC
    `L ${cx + sICW} ${sICTop + s(6)}`,
    `L ${cx + sICW} ${engineTop}`,
    // Engine bell flare
    `L ${cx + engineW} ${botY - s(8)}`,
    // Right fin
    `L ${cx + finW} ${botY}`,
    `L ${cx + finW * 0.85} ${botY}`,
    `L ${cx + sICW * 0.85} ${engineTop + engineH * 0.3}`,
    // Nozzles bottom
    `L ${cx + hW * 0.45} ${botY + s(4)}`,
    `L ${cx + hW * 0.15} ${botY + s(8)}`,
    // Mirror left
    `L ${cx - hW * 0.15} ${botY + s(8)}`,
    `L ${cx - hW * 0.45} ${botY + s(4)}`,
    `L ${cx - sICW * 0.85} ${engineTop + engineH * 0.3}`,
    `L ${cx - finW * 0.85} ${botY}`,
    `L ${cx - finW} ${botY}`,
    `L ${cx - engineW} ${botY - s(8)}`,
    // Left side going up
    `L ${cx - sICW} ${engineTop}`,
    `L ${cx - sICW} ${sICTop + s(6)}`,
    `L ${cx - sIIW} ${sICTop}`,
    `L ${cx - sIIW} ${sIITop + s(6)}`,
    `L ${cx - sIVBW} ${sIITop}`,
    `L ${cx - sIVBW} ${sIVBTop}`,
    `Q ${cx - sIVBW * 0.7} ${noseTop + noseH * 0.7} ${cx - noseW} ${noseTop + noseH * 0.3}`,
    `L ${cx} ${noseTop - s(2)}`,
  ].join(' ');

  // Section separator lines (horizontal dashed)
  const sectionLines = [
    { y: sIVBTop, label: 'S-IVB', w: sIVBW },
    { y: sIITop, label: 'S-II', w: sIIW },
    { y: sICTop, label: 'S-IC', w: sICW },
    { y: engineTop, label: 'F-1 ENGINES', w: sICW },
  ];

  // Total perimeter estimate
  const pathLen = rH * 3 + rW * 8;
  const strokeOffset = pathLen * (1 - outlineReveal);

  // Leader line annotations (right side)
  const annotations = [
    { y: noseTop + noseH * 0.5, text: 'LAUNCH ESCAPE SYSTEM', sub: 'LES TOWER' },
    { y: sIVBTop + sIVBH * 0.5, text: 'THIRD STAGE', sub: 'S-IVB · J-2 ENGINE' },
    { y: sIITop + sIIH * 0.5, text: 'SECOND STAGE', sub: 'S-II · 5× J-2' },
    { y: sICTop + sICH * 0.5, text: 'FIRST STAGE', sub: 'S-IC · 5× F-1' },
  ];

  const leaderStartX = cx + sICW + s(15);
  const leaderEndX = W * 0.62;
  const textX = leaderEndX + s(8);

  // Title block (bottom right)
  const tbW = W * 0.38;
  const tbH = s(110);
  const tbX = W - PAD - tbW;
  const tbY = H - PAD - tbH;

  // Two-tier grid spacing
  const fineGrid = s(12);
  const majorGrid = fineGrid * 5;

  // Flicker effect (subtle CRT simulation)
  const flicker = 0.92 + Math.sin(frame * 0.7) * 0.04 + Math.sin(frame * 2.3) * 0.02;

  return (
    <AbsoluteFill style={{ backgroundColor: BG, overflow: 'hidden' }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          {/* Two-tier grid pattern */}
          <pattern id="bp-fine-grid" width={fineGrid} height={fineGrid} patternUnits="userSpaceOnUse">
            <path d={`M ${fineGrid} 0 L 0 0 0 ${fineGrid}`} fill="none" stroke={GRID_FINE} strokeWidth={0.5} />
          </pattern>
          <pattern id="bp-major-grid" width={majorGrid} height={majorGrid} patternUnits="userSpaceOnUse">
            <rect width={majorGrid} height={majorGrid} fill="url(#bp-fine-grid)" />
            <path d={`M ${majorGrid} 0 L 0 0 0 ${majorGrid}`} fill="none" stroke={GRID_MAJOR} strokeWidth={0.8} />
          </pattern>
          {/* Cross-hatch pattern for section fills */}
          <pattern id="bp-hatch-45" width={s(8)} height={s(8)} patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2={s(8)} stroke={HATCH} strokeWidth={0.6} />
          </pattern>
          <pattern id="bp-hatch-135" width={s(8)} height={s(8)} patternTransform="rotate(135)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2={s(8)} stroke={HATCH} strokeWidth={0.6} />
          </pattern>
          {/* Glow filter */}
          <filter id="bp-glow">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feFlood floodColor={LINE} floodOpacity="0.25" />
            <feComposite in2="blur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Phase 1: Grid */}
        <rect width={W} height={H} fill="url(#bp-major-grid)" opacity={gridReveal * 0.9} />

        {/* Vignette */}
        <radialGradient id="bp-vignette" cx="50%" cy="45%" r="65%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.5" />
        </radialGradient>
        <rect width={W} height={H} fill="url(#bp-vignette)" />

        <g opacity={combinedOpacity * flicker} filter="url(#bp-glow)">
          {/* Phase 2: Center lines (long-dash-short-dash pattern) */}
          <line x1={cx} y1={topY - s(30)} x2={cx} y2={botY + s(30)}
            stroke={LINE_DIM} strokeWidth={0.5}
            strokeDasharray={`${s(14)} ${s(4)} ${s(4)} ${s(4)}`}
            opacity={centerLineReveal}
          />
          <line x1={cx - finW - s(20)} y1={SCHEM_CY} x2={cx + finW + s(20)} y2={SCHEM_CY}
            stroke={LINE_DIM} strokeWidth={0.5}
            strokeDasharray={`${s(14)} ${s(4)} ${s(4)} ${s(4)}`}
            opacity={centerLineReveal}
          />

          {/* Phase 3: Rocket outline — stroke draw-on */}
          <path
            d={rocketOutline}
            fill="none"
            stroke={LINE}
            strokeWidth={s(2.5)}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={pathLen}
            strokeDashoffset={strokeOffset}
          />
          {/* Escape tower spike */}
          <line x1={cx} y1={escapeTop - s(10)} x2={cx} y2={escapeTop}
            stroke={LINE} strokeWidth={s(1.5)} opacity={outlineReveal} />
          <line x1={cx - s(4)} y1={escapeTop} x2={cx + s(4)} y2={escapeTop}
            stroke={LINE} strokeWidth={s(1)} opacity={outlineReveal} />

          {/* Phase 4: Cross-hatching on sections */}
          <clipPath id="bp-rocket-clip">
            <path d={rocketOutline} />
          </clipPath>
          {/* S-IVB hatch (45deg) */}
          <rect x={cx - sIVBW} y={sIVBTop} width={sIVBW * 2} height={sIVBH}
            fill="url(#bp-hatch-45)" clipPath="url(#bp-rocket-clip)" opacity={hatchReveal * 0.7} />
          {/* S-II hatch (135deg) */}
          <rect x={cx - sIIW} y={sIITop} width={sIIW * 2} height={sIIH}
            fill="url(#bp-hatch-135)" clipPath="url(#bp-rocket-clip)" opacity={hatchReveal * 0.7} />
          {/* S-IC hatch (45deg again) */}
          <rect x={cx - sICW} y={sICTop} width={sICW * 2} height={sICH}
            fill="url(#bp-hatch-45)" clipPath="url(#bp-rocket-clip)" opacity={hatchReveal * 0.6} />

          {/* Section separator lines (dashed) */}
          {sectionLines.map((sec, i) => (
            <g key={i} opacity={outlineReveal}>
              <line x1={cx - sec.w} y1={sec.y} x2={cx + sec.w} y2={sec.y}
                stroke={LINE_DIM} strokeWidth={s(0.8)} strokeDasharray={`${s(6)} ${s(3)}`} />
              {/* Section label inside rocket */}
              <text x={cx} y={sec.y + s(16)} textAnchor="middle"
                fontFamily={VOX_FONTS.mono} fontSize={s(9)} fill={LINE_DIM}
                letterSpacing={s(1.5)} opacity={hatchReveal * 0.8}
              >
                {sec.label}
              </text>
            </g>
          ))}

          {/* Center marks (small crosses at key points) */}
          {[noseTop, sIVBTop, sIITop, sICTop, engineTop].map((y, i) => (
            <g key={`cm-${i}`} opacity={centerLineReveal * 0.5}>
              <line x1={cx - s(5)} y1={y} x2={cx + s(5)} y2={y} stroke={LINE_DIM} strokeWidth={0.5} />
              <circle cx={cx} cy={y} r={s(2)} fill="none" stroke={LINE_DIM} strokeWidth={0.5} />
            </g>
          ))}

          {/* Phase 5: Height dimension line (left side) */}
          <g opacity={dimReveal}>
            {/* Extension lines */}
            <line x1={cx - finW - s(5)} y1={escapeTop - s(10)} x2={cx - finW - s(35)} y2={escapeTop - s(10)}
              stroke={ACCENT} strokeWidth={0.5} />
            <line x1={cx - finW - s(5)} y1={botY} x2={cx - finW - s(35)} y2={botY}
              stroke={ACCENT} strokeWidth={0.5} />
            {/* Dimension line */}
            <line x1={cx - finW - s(25)} y1={escapeTop - s(10)}
              x2={cx - finW - s(25)} y2={escapeTop - s(10) + (botY - escapeTop + s(10)) * dimReveal}
              stroke={ACCENT} strokeWidth={0.8} />
            {/* Arrows */}
            <polygon points={`${cx - finW - s(28)},${escapeTop - s(4)} ${cx - finW - s(22)},${escapeTop - s(4)} ${cx - finW - s(25)},${escapeTop - s(10)}`}
              fill={ACCENT} opacity={dimReveal} />
          </g>

          {/* Width dimension line (bottom) */}
          <g opacity={dimReveal}>
            <line x1={cx - sICW} y1={botY + s(15)} x2={cx - sICW} y2={botY + s(30)}
              stroke={ACCENT} strokeWidth={0.5} />
            <line x1={cx + sICW} y1={botY + s(15)} x2={cx + sICW} y2={botY + s(30)}
              stroke={ACCENT} strokeWidth={0.5} />
            <line x1={cx - sICW} y1={botY + s(22)}
              x2={cx - sICW + (sICW * 2) * dimReveal} y2={botY + s(22)}
              stroke={ACCENT} strokeWidth={0.8} />
          </g>

          {/* Phase 6: Leader line annotations (right side) */}
          {annotations.map((ann, i) => {
            const annOpacity = interpolate(frame, [72 + i * 6, 84 + i * 6], [0, 1], {
              extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
            });
            return (
              <g key={`ann-${i}`} opacity={annOpacity * combinedOpacity}>
                {/* Dot at feature */}
                <circle cx={leaderStartX - s(10)} cy={ann.y} r={s(2)} fill={ACCENT} />
                {/* Diagonal leader */}
                <line x1={leaderStartX - s(8)} y1={ann.y} x2={leaderEndX - s(5)} y2={ann.y}
                  stroke={ACCENT} strokeWidth={0.6} />
                {/* Horizontal shelf */}
                <line x1={leaderEndX - s(5)} y1={ann.y} x2={leaderEndX + s(2)} y2={ann.y}
                  stroke={ACCENT} strokeWidth={0.6} />
                {/* Annotation text */}
                <text x={textX} y={ann.y - s(3)} fontFamily={VOX_FONTS.mono}
                  fontSize={s(10)} fill={ACCENT} letterSpacing={s(1)} fontWeight="bold"
                >
                  {ann.text}
                </text>
                <text x={textX} y={ann.y + s(12)} fontFamily={VOX_FONTS.mono}
                  fontSize={s(8)} fill={TEXT_COLOR} letterSpacing={s(0.8)} opacity={0.6}
                >
                  {ann.sub}
                </text>
              </g>
            );
          })}

          {/* Phase 7: Title block (bottom right) */}
          <g opacity={titleBlockReveal * combinedOpacity}>
            <rect x={tbX} y={tbY} width={tbW} height={tbH}
              fill="none" stroke={LINE} strokeWidth={s(1.5)} />
            {/* Internal dividers */}
            <line x1={tbX} y1={tbY + tbH * 0.45} x2={tbX + tbW} y2={tbY + tbH * 0.45}
              stroke={LINE_DIM} strokeWidth={0.5} />
            <line x1={tbX + tbW * 0.55} y1={tbY + tbH * 0.45} x2={tbX + tbW * 0.55} y2={tbY + tbH}
              stroke={LINE_DIM} strokeWidth={0.5} />
            {/* Title */}
            <text x={tbX + s(12)} y={tbY + s(22)} fontFamily={VOX_FONTS.mono}
              fontSize={s(12)} fill={ACCENT} fontWeight="bold" letterSpacing={s(1)}
            >
              {title.toUpperCase()}
            </text>
            {/* Metadata */}
            <text x={tbX + s(12)} y={tbY + tbH * 0.45 + s(18)} fontFamily={VOX_FONTS.mono}
              fontSize={s(8)} fill={TEXT_COLOR} letterSpacing={s(0.5)} opacity={0.7}
            >
              SCALE: NTS
            </text>
            <text x={tbX + s(12)} y={tbY + tbH * 0.45 + s(32)} fontFamily={VOX_FONTS.mono}
              fontSize={s(8)} fill={TEXT_COLOR} letterSpacing={s(0.5)} opacity={0.7}
            >
              DWG NO: VOX-001
            </text>
            <text x={tbX + tbW * 0.55 + s(12)} y={tbY + tbH * 0.45 + s(18)} fontFamily={VOX_FONTS.mono}
              fontSize={s(8)} fill={TEXT_COLOR} letterSpacing={s(0.5)} opacity={0.7}
            >
              REV: A
            </text>
            <text x={tbX + tbW * 0.55 + s(12)} y={tbY + tbH * 0.45 + s(32)} fontFamily={VOX_FONTS.mono}
              fontSize={s(8)} fill={TEXT_COLOR} letterSpacing={s(0.5)} opacity={0.7}
            >
              DATE: 2024-03
            </text>
          </g>

          {/* Dimension data panel (top right) */}
          {dimensions.map((dim, i) => {
            const dimOpacity = interpolate(frame, [75 + i * 5, 88 + i * 5], [0, 1], {
              extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
            });
            const dimY = PAD + s(50) + i * s(50);
            return (
              <g key={`dim-${i}`} opacity={dimOpacity * combinedOpacity}>
                <line x1={W - PAD - s(10)} y1={dimY + s(2)} x2={W - PAD - s(10)} y2={dimY + s(34)}
                  stroke={LINE} strokeWidth={s(2)} />
                <text x={W - PAD - s(20)} y={dimY + s(14)} textAnchor="end"
                  fontFamily={VOX_FONTS.mono} fontSize={s(8)} fill={TEXT_COLOR}
                  letterSpacing={s(1)} opacity={0.6}
                >
                  {dim.label.toUpperCase()}
                </text>
                <text x={W - PAD - s(20)} y={dimY + s(32)} textAnchor="end"
                  fontFamily={VOX_FONTS.body} fontSize={s(16)} fill={ACCENT} fontWeight={700}
                >
                  {dim.value}
                </text>
              </g>
            );
          })}

          {/* Border coordinate ticks */}
          {['A', 'B', 'C', 'D', 'E', 'F'].map((letter, i) => {
            const y = PAD + (i + 0.5) * ((H - PAD * 2) / 6);
            return (
              <g key={`tick-${letter}`} opacity={gridReveal * 0.4}>
                <text x={s(15)} y={y + s(4)} fontFamily={VOX_FONTS.mono} fontSize={s(9)}
                  fill={LINE_DIM} textAnchor="middle">{letter}</text>
                <line x1={s(25)} y1={y} x2={PAD - s(5)} y2={y} stroke={LINE_FAINT} strokeWidth={0.3} />
              </g>
            );
          })}
          {[1, 2, 3, 4, 5].map((num, i) => {
            const x = PAD + (i + 0.5) * ((W - PAD * 2) / 5);
            return (
              <g key={`tick-${num}`} opacity={gridReveal * 0.4}>
                <text x={x} y={s(20)} fontFamily={VOX_FONTS.mono} fontSize={s(9)}
                  fill={LINE_DIM} textAnchor="middle">{num}</text>
                <line x1={x} y1={s(25)} x2={x} y2={PAD - s(5)} stroke={LINE_FAINT} strokeWidth={0.3} />
              </g>
            );
          })}
        </g>
      </svg>

      {/* Detail text overlay */}
      {detail && (
        <div style={{
          position: 'absolute',
          bottom: PAD + s(10),
          left: PAD,
          width: W * 0.5,
          opacity: labelReveal * combinedOpacity,
        }}>
          <span style={{
            fontFamily: VOX_FONTS.mono,
            fontSize: s(VOX_SIZES.tiny * 0.85),
            color: TEXT_COLOR,
            opacity: 0.6,
            letterSpacing: s(0.5),
            textTransform: 'uppercase' as const,
          }}>
            {detail}
          </span>
        </div>
      )}

      <FilmGrain opacity={0.2} seed={7} />
    </AbsoluteFill>
  );
};

export default VoxBlueprint;
