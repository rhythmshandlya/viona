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

// src/proj_a3109385_cd06_40cd_85ef_92dc73a67879/index.tsx
var index_exports = {};
__export(index_exports, {
  RemotionRoot: () => RemotionRoot,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_remotion = require("remotion");

// src/proj_a3109385_cd06_40cd_85ef_92dc73a67879/constants.ts
var COLORS = {
  primary: "#ff6b6b",
  // Coral - for "high" energy
  secondary: "#feca57",
  // Gold - for transitions
  accent: "#ff9ff3",
  // Pink - for highlights
  dark: "#1a1a2e",
  // Deep navy - background
  lowMuted: "#4a4a6a"
  // Muted purple-gray for dimmed low sphere
};
var SPRING_CONFIG = { damping: 22, stiffness: 90, mass: 0.9 };
var VIDEO_CONFIG = {
  width: 1080,
  height: 1920,
  fps: 24,
  durationInFrames: 73
};
var TIMING = {
  scene1Start: 0,
  scene1End: 33,
  scene2Start: 34,
  scene2End: 51,
  scene3Start: 52,
  scene3End: 73,
  // Key sync frames
  highWordFrame: 34,
  andWordFrame: 52,
  lowWordFrame: 55
};
var LAYOUT = {
  safeMargin: 0.1,
  // 10%
  sphereDiameter: 0.15,
  // 15% of canvas height
  titleSize: 0.06,
  // 6% of height
  // Initial positions
  highSphereInitY: 0.45,
  // 45% from top
  lowSphereInitY: 0.55,
  // 55% from top
  // Final positions
  highSphereFinalY: 0.2,
  // 20% from top
  lowSphereFinalY: 0.8,
  // 80% from top
  // Text positions
  highTextY: 0.35,
  // 35% from top
  lowTextY: 0.65
  // 65% from top
};

// src/proj_a3109385_cd06_40cd_85ef_92dc73a67879/index.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var AnimatedBackground = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  (0, import_remotion.useVideoConfig)();
  const pulseOpacity = (0, import_remotion.interpolate)(
    Math.sin(frame * 0.05),
    [-1, 1],
    [0.3, 0.5]
  );
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_remotion.AbsoluteFill,
    {
      style: {
        background: `radial-gradient(ellipse at 50% 40%, rgba(255, 107, 107, ${pulseOpacity}) 0%, ${COLORS.dark} 60%, ${COLORS.dark} 100%)`
      }
    }
  );
};
var GlowingSphere = ({
  yPercent,
  color,
  glowColor,
  glowIntensity,
  scale = 1,
  opacity = 1
}) => {
  const { width, height } = (0, import_remotion.useVideoConfig)();
  const diameter = height * LAYOUT.sphereDiameter;
  const x = width / 2 - diameter / 2;
  const y = height * yPercent - diameter / 2;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        width: diameter,
        height: diameter,
        borderRadius: "50%",
        background: `radial-gradient(circle at 30% 30%, ${color}, ${COLORS.dark})`,
        boxShadow: `
          0 0 ${30 * glowIntensity}px ${10 * glowIntensity}px ${glowColor},
          0 0 ${60 * glowIntensity}px ${20 * glowIntensity}px ${glowColor}40,
          inset 0 0 ${20 * glowIntensity}px ${glowColor}60
        `,
        transform: `scale(${scale})`,
        opacity
      }
    }
  );
};
var Scene1Setup = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const highSphereScale = (0, import_remotion.spring)({
    frame,
    fps,
    config: SPRING_CONFIG
  });
  const lowSphereScale = (0, import_remotion.spring)({
    frame: frame - 6,
    // 6 frame stagger
    fps,
    config: SPRING_CONFIG
  });
  const floatOffset = (0, import_remotion.interpolate)(
    frame,
    [16, 33],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const highFloatY = LAYOUT.highSphereInitY - floatOffset * 0.02;
  const lowFloatY = LAYOUT.lowSphereInitY + floatOffset * 0.02;
  const glowIntensity = (0, import_remotion.interpolate)(
    frame,
    [0, 20],
    [0.5, 1],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      GlowingSphere,
      {
        yPercent: highFloatY,
        color: COLORS.primary,
        glowColor: COLORS.primary,
        glowIntensity,
        scale: highSphereScale
      },
      "high-sphere-s1"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      GlowingSphere,
      {
        yPercent: lowFloatY,
        color: COLORS.primary,
        glowColor: COLORS.primary,
        glowIntensity: glowIntensity * 0.7,
        scale: Math.max(0, lowSphereScale)
      },
      "low-sphere-s1"
    )
  ] });
};
var Scene2High = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, height } = (0, import_remotion.useVideoConfig)();
  const riseProgress = (0, import_remotion.spring)({
    frame,
    fps,
    config: { damping: 24, stiffness: 80, mass: 1 }
  });
  const highSphereY = (0, import_remotion.interpolate)(
    riseProgress,
    [0, 1],
    [LAYOUT.highSphereInitY, LAYOUT.highSphereFinalY],
    { extrapolateRight: "clamp" }
  );
  const lowSphereY = (0, import_remotion.interpolate)(
    riseProgress,
    [0, 1],
    [LAYOUT.lowSphereInitY, 0.7],
    { extrapolateRight: "clamp" }
  );
  const highGlow = (0, import_remotion.interpolate)(
    riseProgress,
    [0, 1],
    [1, 2],
    { extrapolateRight: "clamp" }
  );
  const textProgress = (0, import_remotion.spring)({
    frame: frame - 1,
    fps,
    config: SPRING_CONFIG
  });
  const textOpacity = (0, import_remotion.interpolate)(
    frame,
    [1, 6, 14, 17],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const pulseGlow = (0, import_remotion.interpolate)(
    frame,
    [7, 10, 13, 16],
    [2, 2.5, 2, 2.3],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      GlowingSphere,
      {
        yPercent: highSphereY,
        color: COLORS.primary,
        glowColor: COLORS.primary,
        glowIntensity: frame > 6 ? pulseGlow : highGlow
      },
      "high-sphere-s2"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      GlowingSphere,
      {
        yPercent: lowSphereY,
        color: COLORS.lowMuted,
        glowColor: COLORS.lowMuted,
        glowIntensity: 0.4,
        opacity: 0.7
      },
      "low-sphere-s2"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * LAYOUT.highTextY,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: textOpacity,
          transform: `scale(${textProgress})`
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            style: {
              fontSize: height * LAYOUT.titleSize,
              fontWeight: 800,
              color: COLORS.primary,
              letterSpacing: "0.15em",
              textShadow: `
              0 0 20px ${COLORS.primary},
              0 0 40px ${COLORS.primary}80,
              0 0 60px ${COLORS.primary}40
            `,
              fontFamily: "Inter, system-ui, sans-serif"
            },
            children: "HIGH"
          }
        )
      }
    )
  ] });
};
var Scene3AndLow = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const connectionProgress = (0, import_remotion.spring)({
    frame,
    fps,
    config: { damping: 25, stiffness: 120, mass: 0.8 }
  });
  const connectionOpacity = (0, import_remotion.interpolate)(
    frame,
    [0, 5, 10, 15],
    [0, 0.8, 0.8, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const descentProgress = (0, import_remotion.spring)({
    frame: frame - 3,
    fps,
    config: { damping: 28, stiffness: 70, mass: 1.2 }
  });
  const lowSphereY = (0, import_remotion.interpolate)(
    Math.max(0, descentProgress),
    [0, 1],
    [0.7, LAYOUT.lowSphereFinalY],
    { extrapolateRight: "clamp" }
  );
  const lowOpacity = (0, import_remotion.interpolate)(
    Math.max(0, descentProgress),
    [0, 1],
    [0.7, 0.5],
    { extrapolateRight: "clamp" }
  );
  const highGlow = (0, import_remotion.interpolate)(
    frame,
    [0, 10],
    [2, 1.2],
    { extrapolateRight: "clamp" }
  );
  const lowTextProgress = (0, import_remotion.spring)({
    frame: frame - 3,
    fps,
    config: SPRING_CONFIG
  });
  const lowTextOpacity = (0, import_remotion.interpolate)(
    frame,
    [3, 8, 16, 20],
    [0, 1, 1, 0.8],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const diameter = height * LAYOUT.sphereDiameter;
  const lineStartY = height * LAYOUT.highSphereFinalY + diameter / 2;
  const lineEndY = height * lowSphereY - diameter / 2;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: width / 2 - 2,
          top: lineStartY,
          width: 4,
          height: Math.max(0, (lineEndY - lineStartY) * connectionProgress),
          background: `linear-gradient(to bottom, ${COLORS.secondary}, ${COLORS.accent})`,
          opacity: connectionOpacity,
          boxShadow: `0 0 15px ${COLORS.secondary}, 0 0 30px ${COLORS.accent}60`,
          borderRadius: 2
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      GlowingSphere,
      {
        yPercent: LAYOUT.highSphereFinalY,
        color: COLORS.primary,
        glowColor: COLORS.primary,
        glowIntensity: highGlow
      },
      "high-sphere-s3"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      GlowingSphere,
      {
        yPercent: lowSphereY,
        color: COLORS.lowMuted,
        glowColor: COLORS.lowMuted,
        glowIntensity: 0.3,
        opacity: lowOpacity
      },
      "low-sphere-s3"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * LAYOUT.lowTextY,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: lowTextOpacity,
          transform: `scale(${Math.max(0, lowTextProgress)})`
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            style: {
              fontSize: height * LAYOUT.titleSize,
              fontWeight: 800,
              color: COLORS.lowMuted,
              letterSpacing: "0.15em",
              textShadow: `
              0 0 15px ${COLORS.lowMuted},
              0 0 30px ${COLORS.lowMuted}60
            `,
              fontFamily: "Inter, system-ui, sans-serif"
            },
            children: "LOW"
          }
        )
      }
    )
  ] });
};
var MainComposition = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: { backgroundColor: COLORS.dark }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AnimatedBackground, {}, "bg"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene1Start, durationInFrames: 34, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene1Setup, {}) }, "scene1"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene2Start, durationInFrames: 18, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene2High, {}) }, "scene2"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene3Start, durationInFrames: 22, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene3AndLow, {}) }, "scene3")
  ] });
};
var RemotionRoot = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_remotion.Composition,
    {
      id: "proj-a3109385-cd06-40cd-85ef-92dc73a67879",
      component: MainComposition,
      durationInFrames: VIDEO_CONFIG.durationInFrames,
      fps: VIDEO_CONFIG.fps,
      width: VIDEO_CONFIG.width,
      height: VIDEO_CONFIG.height
    }
  );
};
var index_default = MainComposition;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  RemotionRoot
});
//# sourceMappingURL=index.js.map