"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/proj_309316a0_ce4e_4b22_ba9f_f0857e5cf52d/index.tsx
var index_exports = {};
__export(index_exports, {
  RemotionRoot: () => RemotionRoot,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_remotion = require("remotion");
var import_jsx_runtime = require("react/jsx-runtime");
var COLORS = {
  primary: "#ff6b6b",
  // Coral - for "low" warmth
  secondary: "#feca57",
  // Gold - for transition/energy
  accent: "#ff9ff3",
  // Pink - for highlights
  cool: "#667eea",
  // Indigo - for "high" coolness
  dark: "#1a1a2e"
  // Background depth
};
var SPRING_CONFIG = { damping: 22, stiffness: 90, mass: 0.9 };
var TIMING = {
  scene1Start: 0,
  scene1End: 33,
  scene2Start: 34,
  scene2End: 51,
  keyHighFrame: 34,
  scene3Start: 52,
  scene3End: 73,
  keyAndFrame: 52,
  keyLowFrame: 55,
  totalFrames: 73
};
var VIDEO_CONFIG = {
  fps: 24,
  width: 1080,
  height: 1920,
  durationInFrames: 73
};
var AnimatedBackground = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const gradientProgress = (0, import_remotion.interpolate)(
    frame,
    [0, TIMING.scene2Start, TIMING.scene3Start, TIMING.totalFrames],
    [0, 0.3, 0.7, 1],
    { extrapolateRight: "clamp" }
  );
  const topColorStop = (0, import_remotion.interpolate)(
    gradientProgress,
    [0, 0.5, 1],
    [50, 30, 70]
  );
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_remotion.AbsoluteFill,
    {
      style: {
        background: `linear-gradient(
          180deg,
          ${COLORS.cool} 0%,
          ${COLORS.dark} ${topColorStop}%,
          ${COLORS.dark} 100%
        )`
      }
    }
  );
};
var LuminousOrb = ({
  delay,
  baseX,
  baseY,
  size,
  color,
  glowColor,
  glowIntensity = 1
}) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const materialize = (0, import_remotion.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG
  });
  const breathe = 1 + Math.sin((frame + delay * 10) * 0.08) * 0.05;
  const floatY = Math.sin((frame + delay * 15) * 0.06) * (height * 0.01);
  const orbSize = size / 100 * height;
  const x = baseX / 100 * width - orbSize / 2;
  const y = baseY / 100 * height - orbSize / 2 + floatY;
  const scale = materialize * breathe;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        width: orbSize,
        height: orbSize,
        borderRadius: "50%",
        background: `radial-gradient(circle at 35% 35%, white 0%, ${color} 40%, ${glowColor} 100%)`,
        transform: `scale(${scale})`,
        opacity: materialize,
        boxShadow: `
          0 0 ${30 * glowIntensity}px ${glowColor},
          0 0 ${60 * glowIntensity}px ${glowColor},
          0 0 ${90 * glowIntensity}px ${color}
        `
      }
    }
  );
};
var Scene1Anticipation = () => {
  const neutralColor = COLORS.accent;
  const neutralGlow = COLORS.cool;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      LuminousOrb,
      {
        delay: 6,
        baseX: 45,
        baseY: 48,
        size: 8,
        color: neutralColor,
        glowColor: neutralGlow,
        glowIntensity: 0.8
      },
      "orb1"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      LuminousOrb,
      {
        delay: 12,
        baseX: 50,
        baseY: 52,
        size: 8,
        color: neutralColor,
        glowColor: neutralGlow,
        glowIntensity: 0.8
      },
      "orb2"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      LuminousOrb,
      {
        delay: 18,
        baseX: 55,
        baseY: 50,
        size: 8,
        color: neutralColor,
        glowColor: neutralGlow,
        glowIntensity: 0.8
      },
      "orb3"
    )
  ] });
};
var Scene2High = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, height } = (0, import_remotion.useVideoConfig)();
  const riseProgress = (0, import_remotion.spring)({
    frame,
    fps,
    config: { damping: 22, stiffness: 80, mass: 1 }
  });
  const scaleBoost = (0, import_remotion.interpolate)(riseProgress, [0, 1], [1, 1.2], { extrapolateRight: "clamp" });
  const glowBoost = (0, import_remotion.interpolate)(riseProgress, [0, 0.8, 1], [0.8, 1.2, 1.5], { extrapolateRight: "clamp" });
  const yProgress = (0, import_remotion.interpolate)(riseProgress, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const orb1StartY = 48;
  const orb2StartY = 52;
  const orb3StartY = 50;
  const orb1EndY = 20;
  const orb2EndY = 15;
  const orb3EndY = 20;
  const orb1Y = (0, import_remotion.interpolate)(yProgress, [0, 1], [orb1StartY, orb1EndY], { extrapolateRight: "clamp" });
  const orb2Y = (0, import_remotion.interpolate)(yProgress, [0, 1], [orb2StartY, orb2EndY], { extrapolateRight: "clamp" });
  const orb3Y = (0, import_remotion.interpolate)(yProgress, [0, 1], [orb3StartY, orb3EndY], { extrapolateRight: "clamp" });
  const orb1X = (0, import_remotion.interpolate)(yProgress, [0, 1], [45, 40], { extrapolateRight: "clamp" });
  const orb2X = 50;
  const orb3X = (0, import_remotion.interpolate)(yProgress, [0, 1], [55, 60], { extrapolateRight: "clamp" });
  const baseSize = 8;
  const boostedSize = baseSize * scaleBoost;
  const floatY = Math.sin(frame * 0.08) * (height * 5e-3);
  const floatOffset = floatY / height * 100;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      LuminousOrb,
      {
        delay: 0,
        baseX: orb1X,
        baseY: orb1Y + floatOffset,
        size: boostedSize,
        color: COLORS.cool,
        glowColor: COLORS.cool,
        glowIntensity: glowBoost
      },
      "orb1-high"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      LuminousOrb,
      {
        delay: 0,
        baseX: orb2X,
        baseY: orb2Y - floatOffset,
        size: boostedSize,
        color: COLORS.cool,
        glowColor: COLORS.accent,
        glowIntensity: glowBoost * 1.1
      },
      "orb2-high"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      LuminousOrb,
      {
        delay: 0,
        baseX: orb3X,
        baseY: orb3Y + floatOffset * 0.5,
        size: boostedSize,
        color: COLORS.cool,
        glowColor: COLORS.cool,
        glowIntensity: glowBoost
      },
      "orb3-high"
    )
  ] });
};
var Scene3AndLow = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, height } = (0, import_remotion.useVideoConfig)();
  const descendProgress = (0, import_remotion.spring)({
    frame,
    fps,
    config: { damping: 25, stiffness: 70, mass: 1.1 }
  });
  const scaleDown = (0, import_remotion.interpolate)(descendProgress, [0, 1], [1.2, 0.9], { extrapolateRight: "clamp" });
  const glowFade = (0, import_remotion.interpolate)(descendProgress, [0, 0.5, 1], [1.5, 1, 0.7], { extrapolateRight: "clamp" });
  const yProgress = (0, import_remotion.interpolate)(descendProgress, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const orb1StartY = 20;
  const orb2StartY = 15;
  const orb3StartY = 20;
  const orb1EndY = 80;
  const orb2EndY = 85;
  const orb3EndY = 80;
  const orb1Y = (0, import_remotion.interpolate)(yProgress, [0, 1], [orb1StartY, orb1EndY], { extrapolateRight: "clamp" });
  const orb2Y = (0, import_remotion.interpolate)(yProgress, [0, 1], [orb2StartY, orb2EndY], { extrapolateRight: "clamp" });
  const orb3Y = (0, import_remotion.interpolate)(yProgress, [0, 1], [orb3StartY, orb3EndY], { extrapolateRight: "clamp" });
  const orb1X = (0, import_remotion.interpolate)(yProgress, [0, 1], [40, 35], { extrapolateRight: "clamp" });
  const orb2X = 50;
  const orb3X = (0, import_remotion.interpolate)(yProgress, [0, 1], [60, 65], { extrapolateRight: "clamp" });
  const baseSize = 8;
  const reducedSize = baseSize * scaleDown;
  const colorProgress = (0, import_remotion.interpolate)(descendProgress, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const floatY = Math.sin(frame * 0.06) * (height * 3e-3);
  const floatOffset = floatY / height * 100;
  const orbColor = colorProgress > 0.5 ? COLORS.primary : COLORS.cool;
  const orbGlow = colorProgress > 0.5 ? COLORS.secondary : COLORS.cool;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      LuminousOrb,
      {
        delay: 0,
        baseX: orb1X,
        baseY: orb1Y + floatOffset,
        size: reducedSize,
        color: orbColor,
        glowColor: orbGlow,
        glowIntensity: glowFade
      },
      "orb1-low"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      LuminousOrb,
      {
        delay: 0,
        baseX: orb2X,
        baseY: orb2Y - floatOffset,
        size: reducedSize,
        color: COLORS.primary,
        glowColor: COLORS.secondary,
        glowIntensity: glowFade * 0.9
      },
      "orb2-low"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      LuminousOrb,
      {
        delay: 0,
        baseX: orb3X,
        baseY: orb3Y + floatOffset * 0.5,
        size: reducedSize,
        color: orbColor,
        glowColor: orbGlow,
        glowIntensity: glowFade
      },
      "orb3-low"
    )
  ] });
};
var MainComposition = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: { backgroundColor: COLORS.dark }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AnimatedBackground, {}, "bg"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene1Start, durationInFrames: TIMING.scene1End - TIMING.scene1Start + 1, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene1Anticipation, {}) }, "scene1"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene2Start, durationInFrames: TIMING.scene2End - TIMING.scene2Start + 1, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene2High, {}) }, "scene2"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene3Start, durationInFrames: TIMING.scene3End - TIMING.scene3Start + 1, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene3AndLow, {}) }, "scene3")
  ] });
};
var RemotionRoot = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_remotion.Composition,
    {
      id: "proj_309316a0_ce4e_4b22_ba9f_f0857e5cf52d",
      component: MainComposition,
      durationInFrames: VIDEO_CONFIG.durationInFrames,
      fps: VIDEO_CONFIG.fps,
      width: VIDEO_CONFIG.width,
      height: VIDEO_CONFIG.height
    }
  );
};
var index_default = MainComposition;
(0, import_remotion.registerRoot)(RemotionRoot);
