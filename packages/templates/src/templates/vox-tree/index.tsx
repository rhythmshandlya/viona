import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxTreeProps } from './schema';
import { VOX_COLORS, VOX_SIZES, VOX_FONTS } from '../../vox/constants';
import { voxEntrance, voxExit, progressiveBuild, popIn, drawOn } from '../../vox/animations';
import { FilmGrain, RoughEdgeMask } from '../../vox/effects';
import { ConstructionPaper } from '../../vox/textures';
import { VoxHeadline } from '../../vox/typography';
import { useScale } from '../../use-scale';

const VoxTree: React.FC<VoxTreeProps> = ({ root, branches, title }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width: W, height: H } = useVideoConfig();
  const s = useScale();

  const entrance = voxEntrance(frame, 5, undefined, 'up', s(20));
  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };
  const combinedOpacity = entrance.opacity * exit.opacity;

  const allBranchItems = branches.map((b) => ({
    label: b.label,
    children: b.children ?? [],
  }));

  const totalBranches = allBranchItems.length;
  const hasChildren = allBranchItems.some((b) => b.children.length > 0);
  const { itemOpacities: branchOpacities } = progressiveBuild(frame, 20, totalBranches);

  // Layout using real canvas pixels — no s() on positions, only on sizes
  const PAD = s(60);
  const CX = W / 2;
  const NODE_H = s(50);
  const ROOT_W = s(160);
  const BRANCH_W = s(140);
  const CHILD_W = s(110);

  // Vertical layout — distribute evenly in available space
  const TITLE_BOTTOM = s(140);
  const BOTTOM_PAD = PAD;
  const levels = hasChildren ? 3 : 2;
  const availableH = H - TITLE_BOTTOM - BOTTOM_PAD;
  const levelGap = availableH / levels;

  const ROOT_Y = TITLE_BOTTOM + levelGap * 0.3;
  const BRANCH_Y = ROOT_Y + NODE_H + levelGap * 0.7;
  const CHILD_Y = hasChildren ? BRANCH_Y + NODE_H + levelGap * 0.7 : BRANCH_Y;

  // Branch X positions — spread evenly, clamped
  const usableW = W - PAD * 2 - BRANCH_W;
  const branchSpread = Math.min(usableW, s(500));
  const branchPositions = allBranchItems.map((_, i) => {
    if (totalBranches === 1) return CX;
    return CX - branchSpread / 2 + (branchSpread / (totalBranches - 1)) * i;
  });

  const clampX = (x: number, halfW: number) =>
    Math.max(PAD + halfW, Math.min(W - PAD - halfW, x));

  // Animations
  const rootAnim = popIn(frame, 15);
  const rootToBranchLines = allBranchItems.map((_, i) =>
    drawOn(frame, 18 + i * 4).progress
  );

  // Child data
  const branchToChildData: Array<{
    branchX: number; branchIdx: number; childX: number;
    childLabel: string; drawProgress: number;
    nodeAnim: { scale: number; opacity: number };
  }> = [];

  allBranchItems.forEach((branch, bi) => {
    const childCount = branch.children.length;
    if (childCount === 0) return;
    const gap = totalBranches > 1 ? branchSpread / (totalBranches - 1) : usableW * 0.5;
    const childSpread = Math.min(gap * 0.8, s(180));

    branch.children.forEach((child, ci) => {
      const rawX = childCount === 1
        ? branchPositions[bi]
        : branchPositions[bi] - childSpread / 2 + (childSpread / (childCount - 1)) * ci;

      branchToChildData.push({
        branchX: branchPositions[bi],
        branchIdx: bi,
        childX: clampX(rawX, CHILD_W / 2),
        childLabel: child,
        drawProgress: drawOn(frame, 28 + bi * 4 + ci * 3).progress,
        nodeAnim: popIn(frame, 32 + bi * 4 + ci * 3),
      });
    });
  });

  // Line endpoints: connect center-bottom of parent to center-top of child
  const rootBottom = ROOT_Y + NODE_H;
  const branchTop = BRANCH_Y;
  const branchBottom = BRANCH_Y + NODE_H;
  const childTop = CHILD_Y;

  return (
    <AbsoluteFill style={{ backgroundColor: VOX_COLORS.offWhite, overflow: 'hidden' }}>
      <ConstructionPaper color={VOX_COLORS.offWhite} opacity={0.3} seed={12} />

      {/* Title */}
      {title && (
        <div style={{
          position: 'absolute',
          top: s(50),
          left: PAD,
          right: PAD,
          opacity: combinedOpacity,
          transform: `translateY(${entrance.translateY + exit.translateY}px)`,
        }}>
          <VoxHeadline text={title} size={s(VOX_SIZES.h3)} color={VOX_COLORS.charcoal} accentBar="left" />
        </div>
      )}

      {/* SVG connector lines — viewBox matches actual canvas */}
      <svg
        style={{ position: 'absolute', inset: 0 }}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
      >
        {/* Root → branches */}
        {allBranchItems.map((_, i) => {
          const bx = branchPositions[i];
          const p = rootToBranchLines[i];
          return (
            <line
              key={`r2b-${i}`}
              x1={CX}
              y1={rootBottom}
              x2={CX + (bx - CX) * p}
              y2={rootBottom + (branchTop - rootBottom) * p}
              stroke={VOX_COLORS.charcoal}
              strokeWidth={s(2)}
              opacity={combinedOpacity * 0.5}
            />
          );
        })}

        {/* Branches → children */}
        {branchToChildData.map((d, idx) => (
          <line
            key={`b2c-${idx}`}
            x1={d.branchX}
            y1={branchBottom}
            x2={d.branchX + (d.childX - d.branchX) * d.drawProgress}
            y2={branchBottom + (childTop - branchBottom) * d.drawProgress}
            stroke={VOX_COLORS.lightGray}
            strokeWidth={s(1.5)}
            opacity={combinedOpacity * branchOpacities[d.branchIdx] * 0.5}
          />
        ))}
      </svg>

      {/* Root node */}
      <div style={{
        position: 'absolute',
        left: CX - ROOT_W / 2,
        top: ROOT_Y,
        width: ROOT_W,
        height: NODE_H,
        opacity: rootAnim.opacity * combinedOpacity,
        transform: `scale(${rootAnim.scale})`,
        transformOrigin: 'center',
      }}>
        <RoughEdgeMask seed={99}>
          <div style={{
            width: ROOT_W, height: NODE_H,
            backgroundColor: VOX_COLORS.charcoal,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxSizing: 'border-box', padding: `0 ${s(8)}px`,
          }}>
            <span style={{
              fontFamily: VOX_FONTS.headline, fontSize: s(VOX_SIZES.label),
              fontWeight: 700, color: VOX_COLORS.offWhite,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {root}
            </span>
          </div>
        </RoughEdgeMask>
      </div>

      {/* Branch nodes */}
      {allBranchItems.map((branch, i) => {
        const branchAnim = popIn(frame, 22 + i * 4);
        return (
          <div key={`branch-${i}`} style={{
            position: 'absolute',
            left: branchPositions[i] - BRANCH_W / 2,
            top: BRANCH_Y,
            width: BRANCH_W,
            height: NODE_H,
            opacity: branchOpacities[i] * branchAnim.opacity * combinedOpacity,
            transform: `scale(${branchAnim.scale})`,
            transformOrigin: 'center',
          }}>
            <RoughEdgeMask seed={i * 23 + 5}>
              <div style={{
                width: BRANCH_W, height: NODE_H,
                backgroundColor: VOX_COLORS.offWhite,
                border: `${s(2)}px solid ${VOX_COLORS.charcoal}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxSizing: 'border-box', padding: `0 ${s(6)}px`,
              }}>
                <span style={{
                  fontFamily: VOX_FONTS.body, fontSize: s(VOX_SIZES.tiny),
                  fontWeight: 600, color: VOX_COLORS.charcoal,
                  textTransform: 'uppercase' as const, letterSpacing: 1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {branch.label}
                </span>
              </div>
            </RoughEdgeMask>
          </div>
        );
      })}

      {/* Child nodes */}
      {branchToChildData.map((d, idx) => (
        <div key={`child-${idx}`} style={{
          position: 'absolute',
          left: d.childX - CHILD_W / 2,
          top: CHILD_Y,
          width: CHILD_W,
          height: NODE_H,
          opacity: d.nodeAnim.opacity * branchOpacities[d.branchIdx] * combinedOpacity,
          transform: `scale(${d.nodeAnim.scale})`,
          transformOrigin: 'center',
        }}>
          <RoughEdgeMask seed={idx * 7 + 31}>
            <div style={{
              width: CHILD_W, height: NODE_H,
              backgroundColor: VOX_COLORS.offWhite,
              border: `${s(1.5)}px solid ${VOX_COLORS.lightGray}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxSizing: 'border-box', padding: `0 ${s(6)}px`,
            }}>
              <span style={{
                fontFamily: VOX_FONTS.body, fontSize: s(VOX_SIZES.tiny),
                fontWeight: 400, color: VOX_COLORS.darkGray,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {d.childLabel}
              </span>
            </div>
          </RoughEdgeMask>
        </div>
      ))}

      <FilmGrain opacity={0.25} />
    </AbsoluteFill>
  );
};

export default VoxTree;
