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

// src/proj_62946154_dd37_47a1_951b_4a32500eacea/index.tsx
var index_exports = {};
__export(index_exports, {
  RemotionRoot: () => RemotionRoot,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_remotion = require("remotion");

// src/proj_62946154_dd37_47a1_951b_4a32500eacea/constants.ts
var COLORS = {
  primary: "#ff6b6b",
  // Coral - for "High" element
  secondary: "#feca57",
  // Gold - for connecting elements
  accent: "#ff9ff3",
  // Pink - for "Low" element
  background: "#1a1a2e",
  // Dark background
  backgroundLight: "#2a2a4e",
  // Slightly lighter for gradient
  text: "#ffffff"
};
var SPRING_CONFIG = { damping: 22, stiffness: 90, mass: 0.9 };
var TIMING = {
  // Scene 1: High Demonstration
  scene1Start: 0,
  scene1End: 50,
  highBarAnimStart: 20,
  // Bar starts rising at frame 20
  highKeySync: 34,
  // "High" spoken, bar reaches full height
  // Scene 2: Low Contrast
  scene2Start: 51,
  scene2End: 73,
  andKeySync: 52,
  // "and" spoken, golden arc appears
  lowKeySync: 55,
  // "low" spoken, short bar rises
  // Total
  totalFrames: 73
};
var SIZING = {
  barWidth: 0.15,
  // 15% of canvas width per bar
  highBarHeight: 0.7,
  // 70% of canvas height
  lowBarHeight: 0.25,
  // 25% of canvas height
  leftBarX: 0.25,
  // Position for left bar center
  rightBarX: 0.75,
  // Position for right bar center
  safeMargin: 0.1,
  // 10% safe area
  titleSize: 0.08,
  // 8% of height for title text
  borderRadius: 20
};

// src/proj_62946154_dd37_47a1_951b_4a32500eacea/index.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var AnimatedBackground = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  (0, import_remotion.useVideoConfig)();
  const pulse = Math.sin(frame * 0.03) * 0.02;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_remotion.AbsoluteFill,
    {
      style: {
        background: `linear-gradient(180deg, ${COLORS.background} 0%, ${COLORS.backgroundLight} 100%)`,
        opacity: 1 + pulse
      }
    }
  );
};
var HighBar = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const animationProgress = (0, import_remotion.spring)({
    frame: frame - TIMING.highBarAnimStart,
    fps,
    config: SPRING_CONFIG
  });
  const progress = frame < TIMING.highBarAnimStart ? 0 : animationProgress;
  const barWidth = width * SIZING.barWidth;
  const barHeight = height * SIZING.highBarHeight * progress;
  const barX = width * SIZING.leftBarX - barWidth / 2;
  const glowIntensity = (0, import_remotion.interpolate)(progress, [0, 1], [0, 30], {
    extrapolateRight: "clamp"
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        bottom: height * SIZING.safeMargin,
        left: barX,
        width: barWidth,
        height: barHeight,
        background: `linear-gradient(180deg, ${COLORS.primary} 0%, #ff4757 100%)`,
        borderRadius: `${SIZING.borderRadius}px ${SIZING.borderRadius}px 0 0`,
        boxShadow: `0 0 ${glowIntensity}px ${COLORS.primary}, 0 0 ${glowIntensity * 2}px ${COLORS.primary}50`
      }
    }
  );
};
var HighText = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const textProgress = (0, import_remotion.spring)({
    frame: frame - TIMING.highKeySync,
    fps,
    config: { damping: 20, stiffness: 100, mass: 0.8 }
  });
  const opacity = frame < TIMING.highKeySync ? 0 : (0, import_remotion.interpolate)(textProgress, [0, 1], [0, 1], {
    extrapolateRight: "clamp"
  });
  const scale = frame < TIMING.highKeySync ? 0 : (0, import_remotion.interpolate)(textProgress, [0, 1], [0.8, 1], {
    extrapolateRight: "clamp"
  });
  const textY = height * 0.15;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        top: textY,
        left: width * SIZING.leftBarX,
        transform: `translateX(-50%) scale(${scale})`,
        opacity,
        fontSize: height * SIZING.titleSize,
        fontWeight: 800,
        fontFamily: "Inter, system-ui, sans-serif",
        color: COLORS.text,
        textShadow: `0 0 20px ${COLORS.primary}, 0 0 40px ${COLORS.primary}50`,
        letterSpacing: "0.1em"
      },
      children: "HIGH"
    }
  );
};
var LowBar = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const animationProgress = (0, import_remotion.spring)({
    frame: frame - TIMING.andKeySync,
    fps,
    config: { damping: 25, stiffness: 120, mass: 0.7 }
    // Slightly faster spring
  });
  const progress = frame < TIMING.andKeySync ? 0 : animationProgress;
  const barWidth = width * SIZING.barWidth;
  const barHeight = height * SIZING.lowBarHeight * progress;
  const barX = width * SIZING.rightBarX - barWidth / 2;
  const glowIntensity = (0, import_remotion.interpolate)(progress, [0, 1], [0, 30], {
    extrapolateRight: "clamp"
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        bottom: height * SIZING.safeMargin,
        left: barX,
        width: barWidth,
        height: barHeight,
        background: `linear-gradient(180deg, ${COLORS.accent} 0%, #f368e0 100%)`,
        borderRadius: `${SIZING.borderRadius}px ${SIZING.borderRadius}px 0 0`,
        boxShadow: `0 0 ${glowIntensity}px ${COLORS.accent}, 0 0 ${glowIntensity * 2}px ${COLORS.accent}50`
      }
    }
  );
};
var GoldenArc = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const arcProgress = (0, import_remotion.spring)({
    frame: frame - TIMING.andKeySync,
    fps,
    config: { damping: 22, stiffness: 80, mass: 0.9 }
  });
  const opacity = frame < TIMING.andKeySync ? 0 : (0, import_remotion.interpolate)(arcProgress, [0, 1], [0, 1], {
    extrapolateRight: "clamp"
  });
  const leftBarTopX = width * SIZING.leftBarX;
  const leftBarTopY = height * (1 - SIZING.safeMargin - SIZING.highBarHeight);
  const rightBarTopX = width * SIZING.rightBarX;
  const rightBarTopY = height * (1 - SIZING.safeMargin - SIZING.lowBarHeight);
  const controlY = Math.min(leftBarTopY, rightBarTopY) - height * 0.15;
  const pathD = `M ${leftBarTopX} ${leftBarTopY} Q ${width * 0.5} ${controlY} ${rightBarTopX} ${rightBarTopY}`;
  const pathLength = 800;
  const dashOffset = (0, import_remotion.interpolate)(arcProgress, [0, 1], [pathLength, 0], {
    extrapolateRight: "clamp"
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "svg",
    {
      width,
      height,
      style: {
        position: "absolute",
        top: 0,
        left: 0,
        opacity
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("defs", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", { id: "goldenGradient", x1: "0%", y1: "0%", x2: "100%", y2: "0%", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", { offset: "0%", stopColor: COLORS.primary }, "k1"),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", { offset: "50%", stopColor: COLORS.secondary }, "k2"),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", { offset: "100%", stopColor: COLORS.accent }, "k3")
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("filter", { id: "glow", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("feGaussianBlur", { stdDeviation: "8", result: "coloredBlur" }, "k4"),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("feMerge", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("feMergeNode", { in: "coloredBlur" }, "k5"),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("feMergeNode", { in: "SourceGraphic" }, "k6")
            ] })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "path",
          {
            d: pathD,
            fill: "none",
            stroke: "url(#goldenGradient)",
            strokeWidth: 6,
            strokeLinecap: "round",
            strokeDasharray: pathLength,
            strokeDashoffset: dashOffset,
            filter: "url(#glow)"
          }
        )
      ]
    }
  );
};
var LowText = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const textProgress = (0, import_remotion.spring)({
    frame: frame - TIMING.lowKeySync,
    fps,
    config: { damping: 20, stiffness: 100, mass: 0.8 }
  });
  const opacity = frame < TIMING.lowKeySync ? 0 : (0, import_remotion.interpolate)(textProgress, [0, 1], [0, 1], {
    extrapolateRight: "clamp"
  });
  const scale = frame < TIMING.lowKeySync ? 0 : (0, import_remotion.interpolate)(textProgress, [0, 1], [0.8, 1], {
    extrapolateRight: "clamp"
  });
  const textY = height * (1 - SIZING.safeMargin - SIZING.lowBarHeight) - height * 0.08;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        top: textY,
        left: width * SIZING.rightBarX,
        transform: `translateX(-50%) scale(${scale})`,
        opacity,
        fontSize: height * SIZING.titleSize,
        fontWeight: 800,
        fontFamily: "Inter, system-ui, sans-serif",
        color: COLORS.text,
        textShadow: `0 0 20px ${COLORS.accent}, 0 0 40px ${COLORS.accent}50`,
        letterSpacing: "0.1em"
      },
      children: "LOW"
    }
  );
};
var MainComposition = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: { backgroundColor: COLORS.background }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AnimatedBackground, {}, "bg"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HighBar, {}, "high-bar"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HighText, {}, "high-text"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GoldenArc, {}, "golden-arc"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LowBar, {}, "low-bar"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LowText, {}, "low-text")
  ] });
};
var RemotionRoot = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_remotion.Composition,
    {
      id: "proj_62946154_dd37_47a1_951b_4a32500eacea",
      component: MainComposition,
      durationInFrames: TIMING.totalFrames,
      fps: 24,
      width: 1080,
      height: 1920
    }
  );
};
var index_default = MainComposition;
