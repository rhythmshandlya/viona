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

// src/proj_16a40972_8dab_47fc_b1ea_d950f04c0cdc/index.tsx
var index_exports = {};
__export(index_exports, {
  RemotionRoot: () => RemotionRoot,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_remotion = require("remotion");

// src/proj_16a40972_8dab_47fc_b1ea_d950f04c0cdc/constants.ts
var COLORS = {
  primary: "#ff6b6b",
  // Coral - for "high" states
  secondary: "#feca57",
  // Gold - for transitions and connections
  accent: "#ff9ff3",
  // Pink - for highlights and emphasis
  dark: "#1a1a2e",
  // Deep navy - for "low" states and background
  backgroundStart: "#1a1a2e",
  backgroundEnd: "#0d0d1a"
};
var SPRING_CONFIG = { damping: 22, stiffness: 90, mass: 0.9 };
var VIDEO_CONFIG = {
  width: 1080,
  height: 1920,
  fps: 24,
  durationInFrames: 73
};
var TIMING = {
  // Scene 1: High State Activation
  scene1Start: 1,
  scene1End: 51,
  scene1KeySync: 34,
  // "High" spoken
  // Scene 2: Connecting Transition
  scene2Start: 52,
  scene2End: 54,
  scene2KeySync: 52,
  // "and" spoken
  // Scene 3: Low State Emphasis
  scene3Start: 55,
  scene3End: 73,
  scene3KeySync: 55
  // "low" spoken
};
var LAYOUT = {
  upperPlatformY: 0.25,
  // 25% from top
  lowerPlatformY: 0.75,
  // 75% from top
  platformWidth: 0.6,
  // 60% of canvas width
  platformHeight: 0.08,
  // 8% of canvas height
  safeMargin: 0.1,
  // 10% safe margins
  titleSize: 0.06,
  // 6% of canvas height
  bodySize: 0.035
  // 3.5% of canvas height
};

// src/proj_16a40972_8dab_47fc_b1ea_d950f04c0cdc/index.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var AnimatedBackground = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const gradientOffset = Math.sin(frame * 0.02) * 5;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_remotion.AbsoluteFill,
    {
      style: {
        background: `linear-gradient(${180 + gradientOffset}deg, ${COLORS.backgroundStart} 0%, ${COLORS.backgroundEnd} 100%)`
      }
    }
  );
};
var Platform = ({
  y,
  isActive,
  activeColor,
  inactiveColor,
  scale = 1,
  glowIntensity = 0
}) => {
  const { width, height } = (0, import_remotion.useVideoConfig)();
  const platformWidth = width * LAYOUT.platformWidth;
  const platformHeight = height * LAYOUT.platformHeight;
  const platformY = height * y - platformHeight / 2;
  const platformX = (width - platformWidth) / 2;
  const color = isActive ? activeColor : inactiveColor;
  const glowColor = isActive ? activeColor : "transparent";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: platformX,
        top: platformY,
        width: platformWidth,
        height: platformHeight,
        borderRadius: 24,
        background: color,
        transform: `scale(${scale})`,
        transformOrigin: "center center",
        boxShadow: glowIntensity > 0 ? `0 0 ${40 * glowIntensity}px ${20 * glowIntensity}px ${glowColor}40, 0 0 ${80 * glowIntensity}px ${40 * glowIntensity}px ${glowColor}20` : "none",
        transition: "background 0.3s ease"
      }
    }
  );
};
var FloatingParticles = ({
  startY,
  direction,
  color,
  count = 12,
  active = true
}) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height } = (0, import_remotion.useVideoConfig)();
  if (!active) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: Array.from({ length: count }).map((_, i) => {
    const seed = i * 137;
    const xOffset = seed * 7 % 300 - 150;
    const startFrame = seed % 30;
    const cycleLength = 60;
    const progress = (frame - startFrame) % cycleLength / cycleLength;
    const yMovement = direction === "up" ? -200 * progress : 200 * progress;
    const opacity = Math.sin(progress * Math.PI) * 0.6;
    const x = width / 2 + xOffset;
    const y = height * startY + yMovement;
    const size = 6 + seed % 10;
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
          opacity: active ? opacity : 0
        }
      },
      i
    );
  }) });
};
var Scene1Content = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, height } = (0, import_remotion.useVideoConfig)();
  const keyFrame = TIMING.scene1KeySync - TIMING.scene1Start;
  const activationProgress = frame >= keyFrame ? (0, import_remotion.spring)({ frame: frame - keyFrame, fps, config: SPRING_CONFIG }) : 0;
  const upperScale = (0, import_remotion.interpolate)(activationProgress, [0, 1], [1, 1.1], { extrapolateRight: "clamp" });
  const glowIntensity = (0, import_remotion.interpolate)(activationProgress, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const textScale = frame >= keyFrame ? (0, import_remotion.spring)({ frame: frame - keyFrame, fps, config: { ...SPRING_CONFIG, damping: 20 } }) : 0;
  const textOpacity = (0, import_remotion.interpolate)(activationProgress, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const textY = height * 0.15;
  const fontSize = height * LAYOUT.titleSize;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      Platform,
      {
        y: LAYOUT.upperPlatformY,
        isActive: activationProgress > 0.1,
        activeColor: COLORS.primary,
        inactiveColor: COLORS.dark,
        scale: upperScale,
        glowIntensity
      },
      "upper-platform-s1"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      Platform,
      {
        y: LAYOUT.lowerPlatformY,
        isActive: false,
        activeColor: COLORS.primary,
        inactiveColor: COLORS.dark,
        scale: 1,
        glowIntensity: 0
      },
      "lower-platform-s1"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      FloatingParticles,
      {
        startY: LAYOUT.upperPlatformY - 0.05,
        direction: "up",
        color: COLORS.primary,
        count: 12,
        active: activationProgress > 0.3
      },
      "particles-s1"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: textY,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          opacity: textOpacity,
          transform: `scale(${textScale})`
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            style: {
              fontSize,
              fontWeight: 800,
              fontFamily: "system-ui, -apple-system, sans-serif",
              color: COLORS.primary,
              textShadow: `0 0 40px ${COLORS.primary}80, 0 0 80px ${COLORS.primary}40`,
              letterSpacing: "0.1em"
            },
            children: "HIGH"
          }
        )
      }
    )
  ] });
};
var ConnectingBeam = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height } = (0, import_remotion.useVideoConfig)();
  const beamProgress = (0, import_remotion.interpolate)(frame, [0, 2], [0, 1], { extrapolateRight: "clamp" });
  const upperY = height * LAYOUT.upperPlatformY;
  const lowerY = height * LAYOUT.lowerPlatformY;
  const beamHeight = (lowerY - upperY) * beamProgress;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: width / 2 - 4,
        top: upperY,
        width: 8,
        height: beamHeight,
        background: `linear-gradient(180deg, ${COLORS.secondary} 0%, ${COLORS.secondary}80 100%)`,
        borderRadius: 4,
        boxShadow: `0 0 20px ${COLORS.secondary}, 0 0 40px ${COLORS.secondary}80`
      }
    }
  );
};
var Scene2Content = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { height } = (0, import_remotion.useVideoConfig)();
  const glowIntensity = (0, import_remotion.interpolate)(frame, [0, 1], [0.8, 1], { extrapolateRight: "clamp" });
  const ampersandOpacity = (0, import_remotion.interpolate)(frame, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const fontSize = height * LAYOUT.titleSize * 0.8;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      Platform,
      {
        y: LAYOUT.upperPlatformY,
        isActive: true,
        activeColor: COLORS.secondary,
        inactiveColor: COLORS.dark,
        scale: 1.05,
        glowIntensity
      },
      "upper-platform-s2"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      Platform,
      {
        y: LAYOUT.lowerPlatformY,
        isActive: true,
        activeColor: COLORS.secondary,
        inactiveColor: COLORS.dark,
        scale: 1.05,
        glowIntensity
      },
      "lower-platform-s2"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConnectingBeam, {}, "beam-s2"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      FloatingParticles,
      {
        startY: LAYOUT.upperPlatformY,
        direction: "down",
        color: COLORS.secondary,
        count: 8,
        active: true
      },
      "particles-s2"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.5 - fontSize / 2,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          opacity: ampersandOpacity
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            style: {
              fontSize,
              fontWeight: 300,
              fontFamily: "Georgia, serif",
              color: COLORS.secondary,
              textShadow: `0 0 30px ${COLORS.secondary}80, 0 0 60px ${COLORS.secondary}40`
            },
            children: "&"
          }
        )
      }
    )
  ] });
};
var SettlingParticles = ({
  centerY,
  color,
  count = 10,
  active = true
}) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height } = (0, import_remotion.useVideoConfig)();
  if (!active) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: Array.from({ length: count }).map((_, i) => {
    const seed = i * 173;
    const xOffset = seed * 11 % 400 - 200;
    const startFrame = seed % 20;
    const cycleLength = 50;
    const progress = (frame - startFrame + cycleLength) % cycleLength / cycleLength;
    const easedProgress = 1 - Math.pow(1 - progress, 2);
    const yMovement = 150 * easedProgress;
    const opacity = Math.sin(progress * Math.PI) * 0.5;
    const x = width / 2 + xOffset;
    const y = height * (centerY - 0.1) + yMovement;
    const size = 5 + seed % 8;
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
          opacity: active ? opacity : 0
        }
      },
      i
    );
  }) });
};
var Scene3Content = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, height } = (0, import_remotion.useVideoConfig)();
  const activationProgress = (0, import_remotion.spring)({ frame, fps, config: SPRING_CONFIG });
  const lowerScale = (0, import_remotion.interpolate)(activationProgress, [0, 1], [1, 1.1], { extrapolateRight: "clamp" });
  const upperDim = (0, import_remotion.interpolate)(frame, [0, 10], [0.8, 0.2], { extrapolateRight: "clamp" });
  const glowIntensity = (0, import_remotion.interpolate)(activationProgress, [0, 1], [0, 0.8], { extrapolateRight: "clamp" });
  const textScale = (0, import_remotion.spring)({ frame, fps, config: { ...SPRING_CONFIG, mass: 1.2, damping: 25 } });
  const textOpacity = (0, import_remotion.interpolate)(activationProgress, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const textY = height * 0.85;
  const fontSize = height * LAYOUT.titleSize;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      Platform,
      {
        y: LAYOUT.upperPlatformY,
        isActive: false,
        activeColor: COLORS.primary,
        inactiveColor: COLORS.dark,
        scale: 1,
        glowIntensity: upperDim * 0.3
      },
      "upper-platform-s3"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      Platform,
      {
        y: LAYOUT.lowerPlatformY,
        isActive: true,
        activeColor: COLORS.accent,
        inactiveColor: COLORS.dark,
        scale: lowerScale,
        glowIntensity
      },
      "lower-platform-s3"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      SettlingParticles,
      {
        centerY: LAYOUT.lowerPlatformY,
        color: COLORS.accent,
        count: 10,
        active: activationProgress > 0.2
      },
      "settling-particles-s3"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: textY,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          opacity: textOpacity,
          transform: `scale(${textScale})`
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            style: {
              fontSize,
              fontWeight: 800,
              fontFamily: "system-ui, -apple-system, sans-serif",
              color: COLORS.accent,
              textShadow: `0 0 40px ${COLORS.accent}80, 0 0 80px ${COLORS.accent}40`,
              letterSpacing: "0.1em"
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
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 0, durationInFrames: 51, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene1Content, {}) }, "scene1"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 51, durationInFrames: 3, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene2Content, {}) }, "scene2"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 54, durationInFrames: 19, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene3Content, {}) }, "scene3")
  ] });
};
var RemotionRoot = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_remotion.Composition,
    {
      id: "proj-16a40972-8dab-47fc-b1ea-d950f04c0cdc",
      component: MainComposition,
      durationInFrames: VIDEO_CONFIG.durationInFrames,
      fps: VIDEO_CONFIG.fps,
      width: VIDEO_CONFIG.width,
      height: VIDEO_CONFIG.height
    }
  );
};
var index_default = MainComposition;
