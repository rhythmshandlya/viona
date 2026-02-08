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

// src/proj_312074b0_4baf_49d8_8650_3742a65099b9/index.tsx
var index_exports = {};
__export(index_exports, {
  RemotionRoot: () => RemotionRoot,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_remotion = require("remotion");

// src/proj_312074b0_4baf_49d8_8650_3742a65099b9/constants.ts
var COLORS = {
  primary: "#ff6b6b",
  // Coral - high energy moments
  secondary: "#feca57",
  // Gold - transitions
  accent: "#667eea",
  // Cool Blue - low/calm states
  dark: "#1a1a2e",
  // Deep dark - background/depth
  background: "#1a1a2e"
};
var SPRING_CONFIG = { damping: 22, stiffness: 90, mass: 0.9 };
var VIDEO_CONFIG = {
  fps: 24,
  width: 1080,
  height: 1920,
  durationInFrames: 73
};
var TIMING = {
  // Scene 1: High State
  scene1Start: 0,
  scene1End: 40,
  highWordSync: 34,
  // "High" spoken at frame 34
  // Scene 2: Low State
  scene2Start: 41,
  scene2End: 73,
  andWordSync: 52,
  // "and" spoken at frame 52
  lowWordSync: 55
  // "low" spoken at frame 55
};
var SPHERE_CONFIG = {
  highScale: 1,
  // Full size when high
  lowScale: 0.6,
  // 60% when low
  baseRadius: 80
  // Base radius in pixels
};
var POSITIONS = {
  highY: 0.8,
  // 80% from bottom = high position
  lowY: 0.2
  // 20% from bottom = low position
};

// src/proj_312074b0_4baf_49d8_8650_3742a65099b9/index.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var AnimatedBackground = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { height } = (0, import_remotion.useVideoConfig)();
  const gradientProgress = (0, import_remotion.interpolate)(frame, [0, 73], [0, 1], { extrapolateRight: "clamp" });
  const warmOpacity = (0, import_remotion.interpolate)(gradientProgress, [0, 1], [0.3, 0.1], { extrapolateRight: "clamp" });
  const coolOpacity = (0, import_remotion.interpolate)(gradientProgress, [0, 1], [0.1, 0.3], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: { backgroundColor: COLORS.dark }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: height * 0.5,
          background: `radial-gradient(ellipse at 50% 0%, ${COLORS.primary}${Math.round(warmOpacity * 255).toString(16).padStart(2, "0")} 0%, transparent 70%)`
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: height * 0.5,
          background: `radial-gradient(ellipse at 50% 100%, ${COLORS.accent}${Math.round(coolOpacity * 255).toString(16).padStart(2, "0")} 0%, transparent 70%)`
        }
      }
    )
  ] });
};
var EnergyParticles = ({
  centerX,
  centerY,
  startFrame,
  color,
  count = 12
}) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: Array.from({ length: count }).map((_, i) => {
    const delay = i * 3;
    const particleFrame = frame - startFrame - delay;
    if (particleFrame < 0) return null;
    const angle = i / count * Math.PI * 2;
    const baseRadius = 100;
    const expandProgress = (0, import_remotion.spring)({
      frame: particleFrame,
      fps,
      config: { damping: 25, stiffness: 60, mass: 1.2 }
    });
    const radius = baseRadius + expandProgress * 80;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    const opacity = (0, import_remotion.interpolate)(
      expandProgress,
      [0, 0.3, 1],
      [0, 0.8, 0],
      { extrapolateRight: "clamp" }
    );
    const size = (0, import_remotion.interpolate)(
      expandProgress,
      [0, 0.5, 1],
      [8, 16, 6],
      { extrapolateRight: "clamp" }
    );
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: "50%",
          background: color,
          opacity,
          boxShadow: `0 0 ${size * 2}px ${color}`,
          transform: "translate(-50%, -50%)"
        }
      },
      i
    );
  }) });
};
var LuminousSphere = ({
  x,
  y,
  scale,
  color,
  glowIntensity
}) => {
  const radius = SPHERE_CONFIG.baseRadius * scale;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        width: radius * 2,
        height: radius * 2,
        borderRadius: "50%",
        background: `radial-gradient(circle at 30% 30%,
          ${color}ff 0%,
          ${color}cc 40%,
          ${color}88 70%,
          ${color}44 100%)`,
        transform: "translate(-50%, -50%)",
        boxShadow: `
          0 0 ${40 * glowIntensity}px ${color}88,
          0 0 ${80 * glowIntensity}px ${color}66,
          0 0 ${120 * glowIntensity}px ${color}44
        `
      }
    }
  );
};
var Scene1High = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const entranceProgress = (0, import_remotion.spring)({
    frame,
    fps,
    config: SPRING_CONFIG
  });
  const glowIntensity = (0, import_remotion.interpolate)(
    frame,
    [0, TIMING.highWordSync - 5, TIMING.highWordSync, 40],
    [0.5, 0.8, 1.2, 1],
    { extrapolateRight: "clamp" }
  );
  const sphereX = width / 2;
  const sphereY = height * (1 - POSITIONS.highY);
  const scale = (0, import_remotion.interpolate)(
    entranceProgress,
    [0, 1],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  const textOpacity = (0, import_remotion.interpolate)(
    frame,
    [15, 30],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  const textY = (0, import_remotion.interpolate)(
    frame,
    [15, 30],
    [height * 0.12, height * 0.08],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      EnergyParticles,
      {
        centerX: sphereX,
        centerY: sphereY,
        startFrame: 10,
        color: COLORS.primary,
        count: 12
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      LuminousSphere,
      {
        x: sphereX,
        y: sphereY,
        scale,
        color: COLORS.primary,
        glowIntensity
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: textY,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: textOpacity
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            style: {
              fontSize: height * 0.06,
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "0.15em",
              textShadow: `0 0 30px ${COLORS.primary}, 0 0 60px ${COLORS.primary}88`,
              fontFamily: "system-ui, -apple-system, sans-serif"
            },
            children: "HIGH"
          }
        )
      }
    )
  ] });
};
var TrailingParticles = ({
  startY,
  endY,
  centerX,
  progress,
  count = 8
}) => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: Array.from({ length: count }).map((_, i) => {
    const particleProgress = Math.max(0, progress - i * 0.08);
    const y = (0, import_remotion.interpolate)(
      particleProgress,
      [0, 1],
      [startY, endY],
      { extrapolateRight: "clamp" }
    );
    const opacity = (0, import_remotion.interpolate)(
      i,
      [0, count - 1],
      [0.6, 0.1],
      { extrapolateRight: "clamp" }
    );
    const size = (0, import_remotion.interpolate)(
      i,
      [0, count - 1],
      [20, 8],
      { extrapolateRight: "clamp" }
    );
    const particleColor = particleProgress < 0.5 ? COLORS.primary : COLORS.accent;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: centerX,
          top: y,
          width: size,
          height: size,
          borderRadius: "50%",
          background: particleColor,
          opacity: opacity * (progress > 0.1 ? 1 : 0),
          transform: "translate(-50%, -50%)",
          filter: `blur(${i * 0.5}px)`
        }
      },
      i
    );
  }) });
};
var Scene2Low = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const lowSyncFrame = TIMING.lowWordSync - TIMING.scene2Start;
  const highY = height * (1 - POSITIONS.highY);
  const lowY = height * (1 - POSITIONS.lowY);
  const sphereX = width / 2;
  const descentDuration = lowSyncFrame;
  const descentProgress = (0, import_remotion.interpolate)(
    frame,
    [0, descentDuration],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  const easedProgress = descentProgress * descentProgress;
  const sphereY = (0, import_remotion.interpolate)(
    easedProgress,
    [0, 1],
    [highY, lowY],
    { extrapolateRight: "clamp" }
  );
  const settleProgress = (0, import_remotion.spring)({
    frame: Math.max(0, frame - lowSyncFrame),
    fps,
    config: { damping: 28, stiffness: 120, mass: 0.8 }
  });
  const settleOffset = frame > lowSyncFrame ? (0, import_remotion.interpolate)(settleProgress, [0, 0.5, 1], [10, -5, 0], { extrapolateRight: "clamp" }) : 0;
  const finalY = sphereY + settleOffset;
  const colorProgress = (0, import_remotion.interpolate)(
    frame,
    [0, lowSyncFrame],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  const sphereColor = colorProgress < 0.5 ? COLORS.primary : COLORS.accent;
  const scale = (0, import_remotion.interpolate)(
    frame,
    [0, lowSyncFrame],
    [SPHERE_CONFIG.highScale, SPHERE_CONFIG.lowScale],
    { extrapolateRight: "clamp" }
  );
  const glowIntensity = (0, import_remotion.interpolate)(
    frame,
    [0, lowSyncFrame, lowSyncFrame + 10],
    [1, 0.6, 0.8],
    { extrapolateRight: "clamp" }
  );
  const highTextOpacity = (0, import_remotion.interpolate)(
    frame,
    [0, 10],
    [1, 0],
    { extrapolateRight: "clamp" }
  );
  const lowTextOpacity = (0, import_remotion.interpolate)(
    frame,
    [lowSyncFrame, lowSyncFrame + 15],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  const lowTextY = (0, import_remotion.interpolate)(
    frame,
    [lowSyncFrame, lowSyncFrame + 15],
    [height * 0.88, height * 0.85],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      TrailingParticles,
      {
        startY: highY,
        endY: lowY,
        centerX: sphereX,
        progress: easedProgress,
        count: 8
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      LuminousSphere,
      {
        x: sphereX,
        y: finalY,
        scale,
        color: sphereColor,
        glowIntensity
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.08,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: highTextOpacity
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            style: {
              fontSize: height * 0.06,
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "0.15em",
              textShadow: `0 0 30px ${COLORS.primary}, 0 0 60px ${COLORS.primary}88`,
              fontFamily: "system-ui, -apple-system, sans-serif"
            },
            children: "HIGH"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: lowTextY,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: lowTextOpacity
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            style: {
              fontSize: height * 0.06,
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "0.15em",
              textShadow: `0 0 30px ${COLORS.accent}, 0 0 60px ${COLORS.accent}88`,
              fontFamily: "system-ui, -apple-system, sans-serif"
            },
            children: "LOW"
          }
        )
      }
    )
  ] });
};
var MainComposition = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: { backgroundColor: COLORS.background }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AnimatedBackground, {}, "bg"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 0, durationInFrames: 41, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene1High, {}) }, "scene1-high"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 41, durationInFrames: 32, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene2Low, {}) }, "scene2-low")
  ] });
};
var RemotionRoot = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_remotion.Composition,
    {
      id: "proj_312074b0_4baf_49d8_8650_3742a65099b9",
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
