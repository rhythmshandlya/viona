"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/proj_8e033289_3fc8_4a59_ba0b_bab468e3dccd/Main.tsx
var Main_exports = {};
__export(Main_exports, {
  default: () => Main
});
module.exports = __toCommonJS(Main_exports);
var import_remotion8 = require("remotion");

// src/proj_8e033289_3fc8_4a59_ba0b_bab468e3dccd/scenes/scene_1.tsx
var import_remotion2 = require("remotion");

// src/animations.tsx
var import_react = __toESM(require("react"));
var import_remotion = require("remotion");
var import_jsx_runtime = require("react/jsx-runtime");
var SPRING_CONFIGS = {
  minimal: { damping: 20, stiffness: 60, mass: 1 },
  modern: { damping: 12, stiffness: 80, mass: 1 },
  playful: { damping: 8, stiffness: 200, mass: 1 },
  bold: { damping: 15, stiffness: 150, mass: 1 },
  classic: { damping: 25, stiffness: 50, mass: 1 }
};
var STAGGER_DELAYS = {
  minimal: 20,
  modern: 15,
  playful: 10,
  bold: 12,
  classic: 25
};
var FadeIn = ({
  children,
  delay = 0,
  duration = 20
}) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const opacity = (0, import_remotion.interpolate)(
    frame - delay,
    [0, duration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { opacity }, children });
};
var SlideUp = ({
  children,
  delay = 0,
  distance = 30,
  style = "modern"
}) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const config = SPRING_CONFIGS[style];
  const progress = (0, import_remotion.spring)({
    frame: frame - delay,
    fps,
    config
  });
  const translateY = (0, import_remotion.interpolate)(progress, [0, 1], [distance, 0]);
  const opacity = (0, import_remotion.interpolate)(progress, [0, 1], [0, 1]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
    transform: `translateY(${translateY}px)`,
    opacity
  }, children });
};
var ScaleIn = ({
  children,
  delay = 0,
  from = 0.8,
  style = "modern"
}) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const config = SPRING_CONFIGS[style];
  const progress = (0, import_remotion.spring)({
    frame: frame - delay,
    fps,
    config
  });
  const scale = (0, import_remotion.interpolate)(progress, [0, 1], [from, 1]);
  const opacity = (0, import_remotion.interpolate)(progress, [0, 1], [0, 1]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
    transform: `scale(${scale})`,
    opacity
  }, children });
};
var PopIn = ({
  children,
  delay = 0,
  style = "playful"
}) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const progress = (0, import_remotion.spring)({
    frame: frame - delay,
    fps,
    config: { damping: 8, stiffness: 200, mass: 1 }
  });
  const scale = (0, import_remotion.interpolate)(progress, [0, 1], [0, 1]);
  const opacity = progress > 0 ? 1 : 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
    transform: `scale(${scale})`,
    opacity
  }, children });
};
var PREMIUM_DURATIONS = {
  minimal: { fast: 20, normal: 30, slow: 45 },
  modern: { fast: 15, normal: 24, slow: 36 },
  playful: { fast: 12, normal: 20, slow: 30 },
  bold: { fast: 10, normal: 18, slow: 28 },
  classic: { fast: 24, normal: 36, slow: 48 }
};
var BounceIn = ({
  children,
  delay = 0,
  duration,
  style = "modern",
  speed = "normal"
}) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const dur = duration || PREMIUM_DURATIONS[style][speed];
  const t = Math.max(0, Math.min(1, (frame - delay) / dur));
  if (frame < delay) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { opacity: 0 }, children });
  let scale;
  let opacity;
  if (t < 0.2) {
    scale = (0, import_remotion.interpolate)(t, [0, 0.2], [0.3, 1.1]);
    opacity = (0, import_remotion.interpolate)(t, [0, 0.2], [0, 1]);
  } else if (t < 0.4) {
    scale = (0, import_remotion.interpolate)(t, [0.2, 0.4], [1.1, 0.9]);
    opacity = 1;
  } else if (t < 0.6) {
    scale = (0, import_remotion.interpolate)(t, [0.4, 0.6], [0.9, 1.03]);
    opacity = 1;
  } else if (t < 0.8) {
    scale = (0, import_remotion.interpolate)(t, [0.6, 0.8], [1.03, 0.97]);
    opacity = 1;
  } else {
    scale = (0, import_remotion.interpolate)(t, [0.8, 1], [0.97, 1]);
    opacity = 1;
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { transform: `scale(${scale})`, opacity, transformOrigin: "center" }, children });
};
var FadeInUp = ({
  children,
  delay = 0,
  duration,
  style = "modern",
  speed = "normal",
  distance = 40
}) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const dur = duration || PREMIUM_DURATIONS[style][speed];
  const config = SPRING_CONFIGS[style];
  if (frame < delay) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { opacity: 0 }, children });
  const progress = (0, import_remotion.spring)({ frame: frame - delay, fps, config, durationInFrames: dur });
  const translateY = (0, import_remotion.interpolate)(progress, [0, 1], [distance, 0]);
  const opacity = (0, import_remotion.interpolate)(progress, [0, 0.6], [0, 1], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { transform: `translateY(${translateY}px)`, opacity }, children });
};
var FadeInDown = ({
  children,
  delay = 0,
  duration,
  style = "modern",
  speed = "normal",
  distance = 40
}) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const dur = duration || PREMIUM_DURATIONS[style][speed];
  const config = SPRING_CONFIGS[style];
  if (frame < delay) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { opacity: 0 }, children });
  const progress = (0, import_remotion.spring)({ frame: frame - delay, fps, config, durationInFrames: dur });
  const translateY = (0, import_remotion.interpolate)(progress, [0, 1], [-distance, 0]);
  const opacity = (0, import_remotion.interpolate)(progress, [0, 0.6], [0, 1], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { transform: `translateY(${translateY}px)`, opacity }, children });
};
var ZoomIn = ({
  children,
  delay = 0,
  duration,
  style = "modern",
  speed = "normal"
}) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const dur = duration || PREMIUM_DURATIONS[style][speed];
  if (frame < delay) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { opacity: 0 }, children });
  const progress = (0, import_remotion.spring)({
    frame: frame - delay,
    fps,
    config: { damping: 14, stiffness: 100, mass: 1 },
    durationInFrames: dur
  });
  const scale = (0, import_remotion.interpolate)(progress, [0, 1], [0.3, 1]);
  const opacity = (0, import_remotion.interpolate)(progress, [0, 0.4], [0, 1], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { transform: `scale(${scale})`, opacity, transformOrigin: "center" }, children });
};
var GlowPulse = ({
  children,
  delay = 0,
  duration = 40,
  color = "#3b82f6",
  intensity = 30
}) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  if (frame < delay) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children });
  const t = (frame - delay) % duration / duration;
  const glowSize = (0, import_remotion.interpolate)(
    Math.sin(t * Math.PI * 2),
    [-1, 1],
    [intensity * 0.3, intensity]
  );
  const glowOpacity = (0, import_remotion.interpolate)(
    Math.sin(t * Math.PI * 2),
    [-1, 1],
    [0.3, 0.8]
  );
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
    filter: `drop-shadow(0 0 ${glowSize}px ${color})`,
    opacity: (0, import_remotion.interpolate)(glowOpacity, [0.3, 0.8], [0.85, 1])
  }, children });
};
var SlideInRotate = ({
  children,
  delay = 0,
  duration,
  style = "modern",
  speed = "normal",
  direction = "left",
  distance = 80,
  angle = 8
}) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const dur = duration || PREMIUM_DURATIONS[style][speed];
  if (frame < delay) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { opacity: 0 }, children });
  const progress = (0, import_remotion.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIGS[style],
    durationInFrames: dur
  });
  const dir = direction === "left" ? -1 : 1;
  const translateX = (0, import_remotion.interpolate)(progress, [0, 1], [distance * dir, 0]);
  const rotate = (0, import_remotion.interpolate)(progress, [0, 1], [angle * dir, 0]);
  const opacity = (0, import_remotion.interpolate)(progress, [0, 0.4], [0, 1], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
    transform: `translateX(${translateX}px) rotate(${rotate}deg)`,
    opacity
  }, children });
};
var PremiumStagger = ({
  children,
  delayPerItem,
  startDelay = 0,
  animation = "fadeInUp",
  style = "modern",
  speed = "normal"
}) => {
  const stagger = delayPerItem ?? STAGGER_DELAYS[style];
  const AnimationComponent = {
    fadeInUp: FadeInUp,
    bounceIn: BounceIn,
    zoomIn: ZoomIn,
    slideInRotate: SlideInRotate,
    fadeIn: FadeIn,
    slideUp: SlideUp,
    scaleIn: ScaleIn
  };
  const Comp = AnimationComponent[animation] || FadeInUp;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: import_react.default.Children.map(children, (child, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    Comp,
    {
      delay: startDelay + index * stagger,
      style,
      speed,
      children: child
    },
    index
  )) });
};

// src/proj_8e033289_3fc8_4a59_ba0b_bab468e3dccd/scenes/scene_1.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var PostelLawIntroduction = () => {
  const { width, height, fps } = (0, import_remotion2.useVideoConfig)();
  const frame = (0, import_remotion2.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const TOP_SECTION_HEIGHT = height * 0.15;
  const MIDDLE_SECTION_HEIGHT = height * 0.6;
  const BOTTOM_SECTION_HEIGHT = height * 0.25;
  const centerX = width / 2;
  const centerY = TOP_SECTION_HEIGHT + MIDDLE_SECTION_HEIGHT / 2;
  const gatewayWidth = minDim * 0.15;
  const gatewayHeight = MIDDLE_SECTION_HEIGHT * 0.7;
  const iconSize = minDim * 0.12;
  const clientX = width * 0.15;
  const dbX = width * 0.85;
  const entranceDelay = 10;
  const staggerDelay = 20;
  const funnelWidth = width * 0.25;
  const funnelRightBody = centerX + gatewayWidth / 2;
  const funnelLeftMouth = funnelRightBody + funnelWidth;
  const gridWidth = width * 0.2;
  const gridRightEdge = centerX - gatewayWidth / 2;
  const gridLeftEdge = gridRightEdge - gridWidth;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_remotion2.AbsoluteFill, { style: { backgroundColor: "#0F172A", fontFamily: "sans-serif" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { height: TOP_SECTION_HEIGHT, display: "flex", alignItems: "center", justifyContent: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(FadeInDown, { delay: entranceDelay, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h1", { style: {
      color: "white",
      fontSize: height * 0.045,
      fontWeight: 800,
      textAlign: "center",
      margin: 0,
      textShadow: "0 4px 10px rgba(0,0,0,0.5)"
    }, children: "Postel's Law" }) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { height: MIDDLE_SECTION_HEIGHT, position: "relative" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { style: { position: "absolute", width: "100%", height: "100%", overflow: "visible" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("linearGradient", { id: "trackGradient", x1: "0%", y1: "0%", x2: "100%", y2: "0%", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("stop", { offset: "0%", stopColor: "#3B82F6", stopOpacity: "0.1" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("stop", { offset: "50%", stopColor: "#3B82F6", stopOpacity: "0.3" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("stop", { offset: "100%", stopColor: "#3B82F6", stopOpacity: "0.1" })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "line",
          {
            x1: clientX,
            y1: centerY - TOP_SECTION_HEIGHT,
            x2: dbX,
            y2: centerY - TOP_SECTION_HEIGHT,
            stroke: "url(#trackGradient)",
            strokeWidth: 4,
            strokeDasharray: `${minDim * 0.02} ${minDim * 0.02}`
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { position: "absolute", left: clientX, top: centerY - TOP_SECTION_HEIGHT, transform: "translate(-50%, -50%)" }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(BounceIn, { delay: entranceDelay + staggerDelay, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: minDim * 0.01 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "img",
          {
            src: "https://unpkg.com/lucide-static@latest/icons/monitor.svg",
            style: { width: iconSize, height: iconSize, filter: "brightness(0) invert(1) drop-shadow(0 0 10px #3B82F6)" },
            alt: "Client"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: "white", opacity: 0.7, fontSize: minDim * 0.03 }, children: "Client" })
      ] }) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { position: "absolute", left: dbX, top: centerY - TOP_SECTION_HEIGHT, transform: "translate(-50%, -50%)" }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(BounceIn, { delay: entranceDelay + staggerDelay * 2, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: minDim * 0.01 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "img",
          {
            src: "https://unpkg.com/lucide-static@latest/icons/database.svg",
            style: { width: iconSize, height: iconSize, filter: "brightness(0) invert(1) drop-shadow(0 0 10px #10B981)" },
            alt: "Database"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: "white", opacity: 0.7, fontSize: minDim * 0.03 }, children: "Service" })
      ] }) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { position: "absolute", left: centerX, top: centerY - TOP_SECTION_HEIGHT, transform: "translate(-50%, -50%)" }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(GlowPulse, { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ZoomIn, { delay: entranceDelay + staggerDelay * 3, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: {
        width: gatewayWidth,
        height: gatewayHeight,
        background: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)",
        backdropFilter: "blur(10px)",
        borderRadius: minDim * 0.02,
        border: "2px solid rgba(255,255,255,0.2)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        boxShadow: "0 0 30px rgba(59, 130, 246, 0.3)"
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "img",
          {
            src: "https://unpkg.com/lucide-static@latest/icons/cpu.svg",
            style: { width: iconSize * 0.7, height: iconSize * 0.7, filter: "brightness(0) invert(1)" },
            alt: "API Logic"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { marginTop: 10, color: "white", fontWeight: "bold", fontSize: minDim * 0.025, letterSpacing: 1 }, children: "API GATEWAY" })
      ] }) }) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { style: { position: "absolute", width: "100%", height: "100%", pointerEvents: "none" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("g", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(FadeIn, { delay: 100, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "path",
            {
              d: `M ${funnelLeftMouth} ${centerY - TOP_SECTION_HEIGHT - minDim * 0.15} 
                   L ${funnelRightBody} ${centerY - TOP_SECTION_HEIGHT - minDim * 0.05}
                   L ${funnelRightBody} ${centerY - TOP_SECTION_HEIGHT + minDim * 0.05}
                   L ${funnelLeftMouth} ${centerY - TOP_SECTION_HEIGHT + minDim * 0.15} Z`,
              fill: "url(#liberalGradient)",
              stroke: "#10B981",
              strokeWidth: 2,
              opacity: 0.4
            }
          ) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("linearGradient", { id: "liberalGradient", x1: "0%", y1: "0%", x2: "100%", y2: "0%", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("stop", { offset: "0%", stopColor: "#10B981", stopOpacity: "0.8" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("stop", { offset: "100%", stopColor: "#10B981", stopOpacity: "0.1" })
          ] }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("g", { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(FadeIn, { delay: 120, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "rect",
            {
              x: gridLeftEdge,
              y: centerY - TOP_SECTION_HEIGHT - minDim * 0.05,
              width: gridWidth,
              height: minDim * 0.1,
              rx: minDim * 0.01,
              fill: "none",
              stroke: "#3B82F6",
              strokeWidth: 3
            }
          ),
          [1, 2, 3, 4].map((i) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "line",
            {
              x1: gridLeftEdge + gridWidth / 5 * i,
              y1: centerY - TOP_SECTION_HEIGHT - minDim * 0.05,
              x2: gridLeftEdge + gridWidth / 5 * i,
              y2: centerY - TOP_SECTION_HEIGHT + minDim * 0.05,
              stroke: "#3B82F6",
              strokeWidth: 2,
              opacity: 0.6
            },
            `grid-${i}`
          ))
        ] }) })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
      height: BOTTOM_SECTION_HEIGHT,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-start",
      padding: `0 ${width * 0.05}px`,
      gap: minDim * 0.03
    }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(PremiumStagger, { startDelay: 130, delayPerItem: 40, animation: "fadeInUp", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: {
        background: "rgba(59, 130, 246, 0.1)",
        borderLeft: "4px solid #3B82F6",
        padding: minDim * 0.025,
        borderRadius: minDim * 0.01,
        width: "100%"
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { style: { margin: 0, color: "#3B82F6", fontSize: minDim * 0.04, textTransform: "uppercase" }, children: "Conservative in Send" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: { margin: 5, color: "white", opacity: 0.8, fontSize: minDim * 0.035 }, children: "Strict validation of your API responses." })
      ] }, "cap1"),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: {
        background: "rgba(16, 185, 129, 0.1)",
        borderLeft: "4px solid #10B981",
        padding: minDim * 0.025,
        borderRadius: minDim * 0.01,
        width: "100%"
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { style: { margin: 0, color: "#10B981", fontSize: minDim * 0.04, textTransform: "uppercase" }, children: "Liberal in Accept" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: { margin: 5, color: "white", opacity: 0.8, fontSize: minDim * 0.035 }, children: "Flexible parsing of varying inputs." })
      ] }, "cap2")
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
      position: "absolute",
      top: "50%",
      left: "50%",
      width: minDim * 0.8,
      height: minDim * 0.8,
      background: "radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)",
      transform: `translate(-50%, -50%) scale(${1 + Math.sin(frame / 30) * 0.1})`,
      zIndex: -1
    } })
  ] });
};
var scene_1_default = PostelLawIntroduction;

// src/proj_8e033289_3fc8_4a59_ba0b_bab468e3dccd/scenes/scene_2.tsx
var import_remotion3 = require("remotion");
var import_jsx_runtime3 = require("react/jsx-runtime");
var Scene2 = () => {
  const { width, height, fps } = (0, import_remotion3.useVideoConfig)();
  const frame = (0, import_remotion3.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const centerX = width * 0.5;
  const centerY = height * 0.5;
  const gatewayWidth = width * 0.15;
  const gatewayHeight = height * 0.4;
  const revealProgress = (0, import_remotion3.spring)({
    frame,
    fps,
    config: { damping: 20, stiffness: 60 }
  });
  const uiX = (0, import_remotion3.interpolate)(revealProgress, [0, 1], [-width * 0.3, width * 0.15]);
  const dbX = (0, import_remotion3.interpolate)(revealProgress, [0, 1], [width * 1.3, width * 0.85]);
  const profileFields = [
    { label: "Name", value: "Alex" },
    { label: "Bio", value: "Developer" },
    { label: "Location", value: "NY" }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_remotion3.AbsoluteFill, { style: { backgroundColor: "#0F172A", color: "#ffffff", fontFamily: "sans-serif" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_remotion3.AbsoluteFill, { style: { height: height * 0.15, display: "flex", alignItems: "center", justifyContent: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(FadeInUp, { duration: 20, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h1", { style: {
      fontSize: height * 0.045,
      fontWeight: 800,
      background: "linear-gradient(to right, #3B82F6, #10B981)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      margin: 0
    }, children: "Example: Profile Update" }) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_remotion3.AbsoluteFill, { style: { top: height * 0.15, height: height * 0.6 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
        position: "absolute",
        left: centerX - gatewayWidth / 2,
        top: centerY - gatewayHeight / 2 - height * 0.15,
        width: gatewayWidth,
        height: gatewayHeight,
        background: "rgba(30, 41, 59, 0.8)",
        borderRadius: minDim * 0.02,
        border: "2px solid rgba(59, 130, 246, 0.3)",
        backdropFilter: "blur(8px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: minDim * 0.02,
        zIndex: 10
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { width: "80%", height: "10%", background: "rgba(16, 185, 129, 0.2)", border: "1px solid #10B981", borderRadius: 4 } }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "img",
          {
            src: "https://unpkg.com/lucide-static@latest/icons/cpu.svg",
            width: gatewayWidth * 0.5,
            style: { filter: "brightness(0) invert(1) sepia(1) saturate(5) hue-rotate(190deg)" },
            alt: "API"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { width: "100%", height: "20%", viewBox: "0 0 100 40", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M0 40 L100 40 L80 0 L20 0 Z", fill: "none", stroke: "#F59E0B", strokeWidth: "2", strokeDasharray: "4 2" }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
        position: "absolute",
        left: uiX - width * 0.12,
        top: centerY - height * 0.2 - height * 0.15,
        width: width * 0.25,
        height: height * 0.4,
        background: "#1E293B",
        borderRadius: minDim * 0.02,
        border: "1px solid #334155",
        overflow: "hidden",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)"
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { height: "15%", background: "#334155", display: "flex", alignItems: "center", padding: "0 10%" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { width: 12, height: 12, borderRadius: "50%", background: "#EF4444", marginRight: 6 } }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { width: 12, height: 12, borderRadius: "50%", background: "#F59E0B", marginRight: 6 } })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { padding: minDim * 0.02 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { width: "40%", height: height * 0.015, background: "#475569", marginBottom: minDim * 0.03 } }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(PremiumStagger, { delay: 30, children: profileFields.map((field, i) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { marginBottom: minDim * 0.02 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { fontSize: minDim * 0.015, color: "#94A3B8", marginBottom: 4 }, children: field.label }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { height: height * 0.035, background: "#0F172A", borderRadius: 4, display: "flex", alignItems: "center", paddingLeft: 8, fontSize: minDim * 0.02 }, children: field.value })
          ] }, i)) })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
        position: "absolute",
        left: dbX - width * 0.08,
        top: centerY - height * 0.1 - height * 0.15,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: minDim * 0.02
      }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ScaleIn, { delay: 45, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { textAlign: "center" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "img",
          {
            src: "https://api.iconify.design/mdi/database.svg?color=%233B82F6",
            width: width * 0.12,
            alt: "Database"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { marginTop: 10, fontSize: minDim * 0.02, color: "#3B82F6", fontWeight: "bold" }, children: "DB Cluster" })
      ] }) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(Sequence, { from: 60, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(GlowPulse, { children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
          position: "absolute",
          left: uiX + width * 0.15,
          top: centerY - height * 0.15,
          background: "linear-gradient(45deg, #F59E0B, #D97706)",
          padding: `${minDim * 0.01}px ${minDim * 0.02}px`,
          borderRadius: 8,
          fontSize: minDim * 0.018,
          fontWeight: "bold",
          boxShadow: "0 0 15px rgba(245, 158, 11, 0.4)"
        }, children: "JSON REQUEST" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
          position: "absolute",
          left: dbX - width * 0.08,
          top: centerY + height * 0.05,
          background: "linear-gradient(45deg, #3B82F6, #2563EB)",
          padding: `${minDim * 0.01}px ${minDim * 0.02}px`,
          borderRadius: 8,
          fontSize: minDim * 0.018,
          fontWeight: "bold",
          opacity: (0, import_remotion3.interpolate)(frame, [80, 100], [0, 1], { extrapolateLeft: "clamp" })
        }, children: "USER_RECORD" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_remotion3.AbsoluteFill, { style: { top: height * 0.75, height: height * 0.25, display: "flex", alignItems: "center", justifyContent: "center", padding: `0 ${width * 0.1}px` }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(BounceIn, { delay: 20, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
      background: "rgba(30, 41, 59, 0.6)",
      padding: minDim * 0.04,
      borderRadius: minDim * 0.02,
      border: "1px solid rgba(255,255,255,0.1)",
      textAlign: "center",
      fontSize: height * 0.03,
      lineHeight: 1.4,
      width: "100%"
    }, children: [
      "Imagine building an API for a user to ",
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { color: "#F59E0B", fontWeight: "bold" }, children: "update their profile details." })
    ] }) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("svg", { style: { position: "absolute", width: "100%", height: "100%", pointerEvents: "none" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("linearGradient", { id: "grad1", x1: "0%", y1: "0%", x2: "100%", y2: "0%", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("stop", { offset: "0%", stopColor: "transparent" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("stop", { offset: "50%", stopColor: "#334155" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("stop", { offset: "100%", stopColor: "transparent" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "line",
        {
          x1: uiX + width * 0.13,
          y1: centerY,
          x2: centerX - gatewayWidth / 2,
          y2: centerY,
          stroke: "url(#grad1)",
          strokeWidth: "2",
          strokeDasharray: "10,5"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "line",
        {
          x1: centerX + gatewayWidth / 2,
          y1: centerY,
          x2: dbX - width * 0.08,
          y2: centerY,
          stroke: "url(#grad1)",
          strokeWidth: "2",
          strokeDasharray: "10,5"
        }
      )
    ] })
  ] });
};
var scene_2_default = Scene2;

// src/proj_8e033289_3fc8_4a59_ba0b_bab468e3dccd/scenes/scene_3.tsx
var import_react2 = require("react");
var import_remotion4 = require("remotion");
var import_jsx_runtime4 = require("react/jsx-runtime");
var COLORS = {
  background: "#0F172A",
  primary: "#3B82F6",
  secondary: "#10B981",
  accent: "#F59E0B",
  error: "#EF4444",
  text: "#FFFFFF",
  card: "rgba(30, 41, 59, 0.7)"
};
var DataPacket = ({
  frame,
  index,
  minDim,
  width
}) => {
  const fps = 24;
  const startDelay = index * 60;
  const progress = (0, import_remotion4.interpolate)(
    frame - startDelay,
    [0, 150],
    [width * 0.75, width * 0.15],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const isPassedGateway = progress < width * 0.5;
  const gatewayFrame = frame - startDelay - 75;
  const isValidating = gatewayFrame > 0 && gatewayFrame < 25;
  const scale = (0, import_remotion4.spring)({
    frame: isValidating ? gatewayFrame : 0,
    fps,
    config: { stiffness: 100 }
  });
  const packetSize = minDim * 0.12;
  const isMessy = !isPassedGateway;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: progress,
        top: "45%",
        width: packetSize,
        height: packetSize,
        backgroundColor: COLORS.card,
        borderRadius: minDim * 0.02,
        border: `${minDim * 5e-3}px solid ${isPassedGateway ? COLORS.secondary : COLORS.accent}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: minDim * 0.01,
        boxShadow: isPassedGateway ? `0 0 ${minDim * 0.04}px ${COLORS.secondary}44` : "none",
        transform: `scale(${1 + scale * 0.1})`,
        opacity: progress < width * 0.2 ? (0, import_remotion4.interpolate)(progress, [width * 0.15, width * 0.2], [0, 1]) : 1
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { fontSize: minDim * 0.02, color: COLORS.text, fontWeight: "bold", marginBottom: minDim * 0.01 }, children: isPassedGateway ? "VALID" : "RAW" }),
        isMessy ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { display: "flex", gap: minDim * 5e-3 }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "img",
          {
            src: "https://api.iconify.design/lucide/alert-circle.svg?color=%23F59E0B",
            width: minDim * 0.04,
            height: minDim * 0.04
          }
        ) }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { display: "flex", gap: minDim * 5e-3 }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "img",
          {
            src: "https://api.iconify.design/lucide/check-circle.svg?color=%2310B981",
            width: minDim * 0.04,
            height: minDim * 0.04
          }
        ) })
      ]
    }
  );
};
function PostelLawMomentThree() {
  const { width, height, fps } = (0, import_remotion4.useVideoConfig)();
  const frame = (0, import_remotion4.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const packets = (0, import_react2.useMemo)(() => [0, 1, 2, 3], []);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_remotion4.AbsoluteFill, { style: { backgroundColor: COLORS.background, fontFamily: "sans-serif", overflow: "hidden" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
      height: height * 0.15,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: `0 ${minDim * 0.05}px`
    }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BounceIn, { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h1", { style: {
      color: COLORS.text,
      fontSize: minDim * 0.06,
      textAlign: "center",
      textTransform: "uppercase",
      letterSpacing: minDim * 0.01
    }, children: "Strict Output Validation" }) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { height: height * 0.6, position: "relative" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
        position: "absolute",
        top: "50%",
        left: "10%",
        right: "10%",
        height: minDim * 2e-3,
        background: `linear-gradient(to right, ${COLORS.secondary}22, ${COLORS.accent}22)`,
        transform: "translateY(-50%)"
      } }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: {
        position: "absolute",
        left: width * 0.05,
        top: "35%",
        width: width * 0.2,
        height: height * 0.3,
        border: `${minDim * 5e-3}px solid ${COLORS.primary}44`,
        borderRadius: minDim * 0.02,
        background: "rgba(59, 130, 246, 0.05)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: minDim * 0.02
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("img", { src: "https://api.iconify.design/lucide/monitor.svg?color=%233B82F6", width: minDim * 0.08, height: minDim * 0.08 }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { color: COLORS.primary, fontSize: minDim * 0.025, marginTop: minDim * 0.01 }, children: "Frontend UI" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { width: "100%", marginTop: minDim * 0.03, gap: minDim * 0.01, display: "flex", flexDirection: "column" }, children: [1, 2, 3].map((i) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { height: minDim * 0.01, background: `${COLORS.primary}33`, borderRadius: 10, width: "80%" } }, i)) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: {
        position: "absolute",
        right: width * 0.05,
        top: "35%",
        width: width * 0.2,
        height: height * 0.3,
        border: `${minDim * 5e-3}px solid ${COLORS.accent}44`,
        borderRadius: minDim * 0.02,
        background: "rgba(245, 158, 11, 0.05)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: minDim * 0.02
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("img", { src: "https://api.iconify.design/lucide/database.svg?color=%23F59E0B", width: minDim * 0.08, height: minDim * 0.08 }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { color: COLORS.accent, fontSize: minDim * 0.025, marginTop: minDim * 0.01 }, children: "Database" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { width: "100%", marginTop: minDim * 0.03, display: "grid", gridTemplateColumns: "1fr 1fr", gap: minDim * 0.01 }, children: [1, 2, 3, 4].map((i) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { height: minDim * 0.02, background: `${COLORS.accent}33`, borderRadius: 4 } }, i)) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
        position: "absolute",
        left: "50%",
        top: "20%",
        bottom: "20%",
        width: minDim * 0.15,
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10
      }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: {
        width: "100%",
        height: "100%",
        border: `${minDim * 5e-3}px solid ${COLORS.text}22`,
        borderRadius: minDim * 0.04,
        background: "rgba(255, 255, 255, 0.03)",
        backdropFilter: "blur(8px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: minDim * 0.03
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(GlowPulse, { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("img", { src: "https://api.iconify.design/lucide/shield-check.svg?color=%2310B981", width: minDim * 0.08, height: minDim * 0.08 }) }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
          height: "60%",
          width: minDim * 5e-3,
          background: `linear-gradient(to bottom, transparent, ${COLORS.secondary}, transparent)`
        } }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { color: COLORS.secondary, fontSize: minDim * 0.02, fontWeight: "bold" }, children: "STRICT" })
      ] }) }),
      packets.map((p) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(DataPacket, { index: p, frame, minDim, width }, p))
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
      height: height * 0.25,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: minDim * 0.03,
      padding: `0 ${minDim * 0.1}px`
    }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_remotion4.Sequence, { from: 0, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(PremiumStagger, { speed: "normal", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(FadeIn, { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: {
        background: COLORS.card,
        padding: `${minDim * 0.02}px ${minDim * 0.04}px`,
        borderRadius: minDim * 0.02,
        borderLeft: `${minDim * 0.01}px solid ${COLORS.secondary}`,
        display: "flex",
        alignItems: "center",
        gap: minDim * 0.03
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ScaleIn, { delay: 20, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("img", { src: "https://api.iconify.design/lucide/check-square.svg?color=%2310B981", width: minDim * 0.05, height: minDim * 0.05 }) }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { color: COLORS.text, fontSize: minDim * 0.035, lineHeight: 1.4 }, children: [
          "Ensure ",
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { color: COLORS.secondary, fontWeight: "bold" }, children: "mandatory fields" }),
          " are present"
        ] })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(FadeIn, { delay: 40, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: {
        background: COLORS.card,
        padding: `${minDim * 0.02}px ${minDim * 0.04}px`,
        borderRadius: minDim * 0.02,
        borderLeft: `${minDim * 0.01}px solid ${COLORS.secondary}`,
        display: "flex",
        alignItems: "center",
        gap: minDim * 0.03
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ScaleIn, { delay: 60, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("img", { src: "https://api.iconify.design/lucide/link-2.svg?color=%2310B981", width: minDim * 0.05, height: minDim * 0.05 }) }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { color: COLORS.text, fontSize: minDim * 0.035, lineHeight: 1.4 }, children: [
          "Validate ",
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { color: COLORS.secondary, fontWeight: "bold" }, children: "URL formats" }),
          " & data integrity"
        ] })
      ] }) })
    ] }) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("svg", { style: { position: "absolute", width: "100%", height: "100%", pointerEvents: "none" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("linearGradient", { id: "scan", x1: "0", y1: "0", x2: "0", y2: "1", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("stop", { offset: "0%", stopColor: COLORS.secondary, stopOpacity: "0" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("stop", { offset: "50%", stopColor: COLORS.secondary, stopOpacity: "0.5" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("stop", { offset: "100%", stopColor: COLORS.secondary, stopOpacity: "0" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "rect",
        {
          x: width * 0.425,
          y: height * 0.2 + (Math.sin(frame * 0.1) + 1) * height * 0.3,
          width: width * 0.15,
          height: height * 0.05,
          fill: "url(#scan)",
          style: { opacity: 0.3 }
        }
      )
    ] })
  ] });
}

// src/proj_8e033289_3fc8_4a59_ba0b_bab468e3dccd/scenes/scene_4.tsx
var import_remotion5 = require("remotion");
var import_jsx_runtime5 = require("react/jsx-runtime");
function PostelsLawInputProcessing() {
  const { width, height, fps } = (0, import_remotion5.useVideoConfig)();
  const frame = (0, import_remotion5.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const centerX = width / 2;
  const centerY = height / 2;
  const clientX = width * 0.15;
  const gatewayX = centerX;
  const dbX = width * 0.85;
  const packetY = centerY;
  const slotWidth = width * 0.2;
  const slotHeight = height * 0.08;
  const oversizedWidth = width * 0.35;
  const startReverseFlow = 20;
  const packetEnters = 50;
  const packetAtFunnel = 100;
  const trimAction = 140;
  const packetStored = 200;
  const blockX = (0, import_remotion5.interpolate)(frame, [0, 40], [clientX, clientX - width * 0.1], { extrapolateRight: "clamp" });
  const blockOpacity = (0, import_remotion5.interpolate)(frame, [30, 50], [1, 0], { extrapolateRight: "clamp" });
  const bioX = (0, import_remotion5.interpolate)(frame, [packetEnters, packetAtFunnel, packetStored], [clientX, gatewayX - width * 0.1, dbX], {
    easing: import_remotion5.Easing.bezier(0.33, 1, 0.68, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const bioWidth = (0, import_remotion5.interpolate)(frame, [trimAction, trimAction + 30], [oversizedWidth, slotWidth], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const funnelGlow = (0, import_remotion5.interpolate)(frame, [packetAtFunnel - 10, packetAtFunnel + 20, trimAction + 10], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const bladeYOffset = (0, import_remotion5.interpolate)(frame, [trimAction - 5, trimAction + 5, trimAction + 20], [-100, 0, -100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const bladeOpacity = (0, import_remotion5.interpolate)(frame, [trimAction - 10, trimAction, trimAction + 30], [0, 1, 0]);
  const colors = {
    bg: "#0F172A",
    primary: "#3B82F6",
    secondary: "#10B981",
    accent: "#F59E0B",
    danger: "#EF4444"
  };
  const textStyle = {
    color: "white",
    fontFamily: "sans-serif",
    fontSize: minDim * 0.04,
    fontWeight: "bold",
    textAlign: "center",
    width: "100%"
  };
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_remotion5.AbsoluteFill, { style: { backgroundColor: colors.bg }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { position: "absolute", top: height * 0.05, width: "100%", textAlign: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(FadeIn, { delay: 10, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h1", { style: { ...textStyle, fontSize: minDim * 0.07, margin: 0 }, children: "ROBUSTNESS PRINCIPLE" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { style: { ...textStyle, color: colors.secondary, marginTop: 10 }, children: '"Be liberal in what you accept"' })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("svg", { style: { position: "absolute", width: "100%", height: "100%", opacity: 0.2 }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("line", { x1: clientX, y1: packetY, x2: dbX, y2: packetY, stroke: "white", strokeWidth: 2, strokeDasharray: "10 10" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: {
      position: "absolute",
      left: gatewayX - 2,
      top: height * 0.25,
      width: 4,
      height: height * 0.5,
      background: `linear-gradient(to bottom, transparent, ${colors.primary}, transparent)`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center"
    }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(PopIn, { delay: 0, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: {
      width: minDim * 0.12,
      height: minDim * 0.12,
      borderRadius: "50%",
      background: colors.bg,
      border: `3px solid ${colors.primary}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: `0 0 20px ${colors.primary}44`
    }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("img", { src: "https://unpkg.com/lucide-static@latest/icons/cpu.svg", style: { width: "60%", filter: "brightness(0) invert(1)" }, alt: "Gateway" }) }) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { position: "absolute", left: clientX - minDim * 0.05, top: centerY - minDim * 0.2 }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("img", { src: "https://unpkg.com/lucide-static@latest/icons/monitor.svg", style: { width: minDim * 0.1, filter: "brightness(0) invert(1)", opacity: 0.5 }, alt: "Client" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { position: "absolute", left: dbX - minDim * 0.05, top: centerY - minDim * 0.2 }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("img", { src: "https://unpkg.com/lucide-static@latest/icons/database.svg", style: { width: minDim * 0.1, filter: "brightness(0) invert(1)", opacity: 0.5 }, alt: "DB" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { position: "absolute", left: blockX, top: packetY - slotHeight / 2, opacity: blockOpacity }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: {
      width: slotWidth,
      height: slotHeight,
      background: colors.secondary,
      borderRadius: 8,
      border: "2px solid white",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "white",
      fontSize: 14,
      fontWeight: "bold"
    }, children: "STRICT OUTPUT" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: {
      position: "absolute",
      left: gatewayX - width * 0.2,
      top: packetY - height * 0.15,
      width: width * 0.15,
      height: height * 0.3,
      display: "flex",
      alignItems: "center"
    }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("svg", { width: "100%", height: "100%", viewBox: "0 0 100 200", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "path",
      {
        d: "M 10 20 L 90 70 L 90 130 L 10 180",
        fill: "none",
        stroke: colors.primary,
        strokeWidth: "4",
        strokeLinecap: "round",
        style: { filter: `drop-shadow(0 0 ${funnelGlow * 10}px ${colors.primary})` }
      }
    ) }) }),
    frame >= packetEnters && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: {
      position: "absolute",
      left: bioX - bioWidth / 2,
      top: packetY - slotHeight / 2,
      width: bioWidth,
      height: slotHeight,
      overflow: "hidden",
      borderRadius: 8,
      background: `linear-gradient(90deg, ${colors.primary}, ${colors.accent})`,
      boxShadow: `0 10px 30px rgba(0,0,0,0.5)`,
      display: "flex",
      alignItems: "center",
      border: "2px solid rgba(255,255,255,0.3)",
      zIndex: 10
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { paddingLeft: 20, whiteSpace: "nowrap", color: "white", fontWeight: "bold" }, children: frame < trimAction ? "BIO: 'User profile bio that is way too long for our DB limit...'" : "BIO: 'User profile bio that i...'" }),
      frame < trimAction && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { position: "absolute", right: 5, color: colors.danger, animation: "pulse 1s infinite" }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("img", { src: "https://unpkg.com/lucide-static@latest/icons/alert-triangle.svg", style: { width: 24, filter: "brightness(0) invert(1)" }, alt: "Alert" }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: {
      position: "absolute",
      left: gatewayX + 20,
      top: packetY + bladeYOffset - 40,
      opacity: bladeOpacity,
      zIndex: 20
    }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", flexDirection: "column", alignItems: "center" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { height: 60, width: 4, background: colors.danger } }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "img",
        {
          src: "https://unpkg.com/lucide-static@latest/icons/scissors.svg",
          style: { width: 40, filter: "invert(37%) sepia(93%) saturate(3755%) hue-rotate(339deg) brightness(98%) contrast(92%)" },
          alt: "Trim"
        }
      )
    ] }) }),
    frame > packetStored - 20 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: {
      position: "absolute",
      left: dbX - slotWidth / 2,
      top: packetY - slotHeight / 2
    }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(GlowPulse, { color: colors.secondary, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: {
      width: slotWidth,
      height: slotHeight,
      borderRadius: 8,
      border: `2px solid ${colors.secondary}`,
      background: `${colors.secondary}33`
    } }) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { position: "absolute", bottom: height * 0.1, width: "100%", display: "flex", justifyContent: "center", gap: width * 0.2 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(FadeIn, { delay: 40, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { textAlign: "center" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { ...textStyle, color: colors.primary, fontSize: minDim * 0.035 }, children: "FLEXIBLE INPUT" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { color: "rgba(255,255,255,0.5)", fontSize: minDim * 0.025 }, children: "Accept variations" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(FadeIn, { delay: 120, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { textAlign: "center" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { ...textStyle, color: colors.accent, fontSize: minDim * 0.035 }, children: "NORMALIZATION" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { color: "rgba(255,255,255,0.5)", fontSize: minDim * 0.025 }, children: "Trim & Sanitize" })
      ] }) })
    ] }),
    frame > trimAction && frame < packetStored + 30 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_remotion5.AbsoluteFill, { style: { pointerEvents: "none", display: "flex", justifyContent: "center", alignItems: "center", top: height * 0.15 }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(PopIn, { children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: {
      background: "rgba(255,255,255,0.1)",
      backdropFilter: "blur(10px)",
      padding: "10px 20px",
      borderRadius: 20,
      border: "1px solid rgba(255,255,255,0.2)"
    }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { color: colors.secondary, fontWeight: "bold" }, children: "\u2713 AUTO-TRIMMED TO FIT" }) }) }) })
  ] });
}

// src/proj_8e033289_3fc8_4a59_ba0b_bab468e3dccd/scenes/scene_5.tsx
var import_remotion6 = require("remotion");
var import_jsx_runtime6 = require("react/jsx-runtime");
var Scene5 = () => {
  const { width, height, fps } = (0, import_remotion6.useVideoConfig)();
  const frame = (0, import_remotion6.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const centerX = width * 0.5;
  const clientX = width * 0.15;
  const dbX = width * 0.85;
  const trackY = height * 0.5;
  const gatewayWidth = width * 0.12;
  const cardWidth = width * 0.25;
  const bladeRetraction = (0, import_remotion6.spring)({
    frame,
    fps,
    config: SPRING_CONFIGS.gentle,
    durationInFrames: 30
  });
  const packetEntry = (0, import_remotion6.spring)({
    frame: frame - 30,
    fps,
    config: SPRING_CONFIGS.stiff,
    durationInFrames: 40
  });
  const transformProgress = (0, import_remotion6.interpolate)(frame, [80, 120], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const dbSaveProgress = (0, import_remotion6.spring)({
    frame: frame - 140,
    fps,
    config: SPRING_CONFIGS.slow
  });
  const packetX = (0, import_remotion6.interpolate)(
    frame,
    [30, 70, 140, 180],
    [clientX, centerX - gatewayWidth, centerX + gatewayWidth, dbX],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const packetOpacity = (0, import_remotion6.interpolate)(frame, [0, 20], [1, 1]);
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_remotion6.AbsoluteFill, { style: { backgroundColor: "#0F172A", overflow: "hidden" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
      position: "absolute",
      top: height * 0.05,
      width: "100%",
      textAlign: "center",
      padding: `0 ${width * 0.1}px`
    }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(FadeIn, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h1", { style: {
        color: "white",
        fontSize: height * 0.04,
        fontWeight: 800,
        margin: 0,
        fontFamily: "sans-serif"
      }, children: "FLUID INPUT NORMALIZATION" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { style: {
        color: "#94A3B8",
        fontSize: height * 0.02,
        marginTop: height * 0.01,
        fontFamily: "sans-serif"
      }, children: "Accept diverse cases, store standardized data" })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("svg", { style: { position: "absolute", width: "100%", height: "100%", pointerEvents: "none" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "line",
        {
          x1: clientX,
          y1: trackY,
          x2: dbX,
          y2: trackY,
          stroke: "#1E293B",
          strokeWidth: height * 5e-3,
          strokeDasharray: "10 10"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("linearGradient", { id: "gateGrad", x1: "0%", y1: "0%", x2: "0%", y2: "100%", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("stop", { offset: "0%", stopColor: "#3B82F6", stopOpacity: "0.2" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("stop", { offset: "100%", stopColor: "#3B82F6", stopOpacity: "0" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "path",
        {
          d: `M ${centerX - gatewayWidth} ${trackY - height * 0.15} 
             L ${centerX + gatewayWidth} ${trackY - height * 0.1} 
             L ${centerX + gatewayWidth} ${trackY + height * 0.1} 
             L ${centerX - gatewayWidth} ${trackY + height * 0.15} Z`,
          fill: "url(#gateGrad)",
          stroke: "#3B82F6",
          strokeWidth: "2"
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
      position: "absolute",
      left: clientX - minDim * 0.05,
      top: trackY - minDim * 0.05,
      width: minDim * 0.1,
      height: minDim * 0.1,
      background: "#1E293B",
      borderRadius: minDim * 0.02,
      border: "2px solid #3B82F6",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "img",
      {
        src: "https://unpkg.com/lucide-static@latest/icons/monitor.svg",
        width: minDim * 0.05,
        style: { filter: "brightness(0) invert(1)" },
        alt: "Client"
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
      position: "absolute",
      left: dbX - minDim * 0.05,
      top: trackY - minDim * 0.05,
      width: minDim * 0.1,
      height: minDim * 0.1,
      background: "#1E293B",
      borderRadius: minDim * 0.02,
      border: `2px solid ${dbSaveProgress > 0.1 ? "#10B981" : "#334155"}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "border-color 0.3s ease"
    }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "img",
      {
        src: "https://unpkg.com/lucide-static@latest/icons/database.svg",
        width: minDim * 0.05,
        style: { filter: dbSaveProgress > 0.1 ? "sepia(1) saturate(5) hue-rotate(90deg)" : "brightness(0) invert(1)" },
        alt: "DB"
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
      position: "absolute",
      top: trackY - height * 0.2,
      left: centerX + gatewayWidth * 0.5,
      transform: `translateY(${(1 - bladeRetraction) * -height * 0.1}px)`,
      opacity: 1 - bladeRetraction
    }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "img",
      {
        src: "https://unpkg.com/lucide-static@latest/icons/scissors.svg",
        width: minDim * 0.04,
        style: { filter: "invert(58%) sepia(88%) saturate(464%) hue-rotate(349deg) brightness(101%) contrast(94%)" },
        alt: "Trimmer"
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
      position: "absolute",
      left: packetX - cardWidth / 2,
      top: trackY - height * 0.04,
      width: cardWidth,
      height: height * 0.08,
      background: "rgba(255, 255, 255, 0.05)",
      backdropFilter: "blur(10px)",
      border: `2px solid ${(0, import_remotion6.interpolate)(transformProgress, [0, 1], [16096779, 1096065]) === 16096779 ? "#F59E0B" : "#10B981"}`,
      borderRadius: minDim * 0.01,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      opacity: packetOpacity,
      boxShadow: `0 0 ${(0, import_remotion6.interpolate)(frame, [70, 90, 130], [0, 20, 0])}px rgba(59, 130, 246, 0.5)`
    }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
      fontSize: height * 0.025,
      color: "white",
      fontFamily: "monospace",
      fontWeight: "bold",
      letterSpacing: "2px"
    }, children: transformProgress < 0.5 ? "JOHN_DOE" : "john_doe" }) }),
    frame > 70 && frame < 150 && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: {
      position: "absolute",
      left: centerX - gatewayWidth,
      top: trackY - height * 0.12,
      width: gatewayWidth * 2,
      height: height * 0.24,
      border: "2px solid #3B82F6",
      borderRadius: minDim * 0.02,
      background: "rgba(59, 130, 246, 0.1)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(ScaleIn, { speed: "fast", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: {
        background: "#3B82F6",
        padding: `${height * 5e-3}px ${width * 0.02}px`,
        borderRadius: 100,
        display: "flex",
        alignItems: "center",
        gap: 8
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("img", { src: "https://unpkg.com/lucide-static@latest/icons/type.svg", width: minDim * 0.02, style: { filter: "brightness(0) invert(1)" }, alt: "Type icon" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { color: "white", fontSize: height * 0.015, fontWeight: "bold" }, children: "LOWERCASE()" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
        position: "absolute",
        top: 0,
        left: `${transformProgress * 100}%`,
        width: 2,
        height: "100%",
        background: "#3B82F6",
        boxShadow: "0 0 15px #3B82F6"
      } })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: {
      position: "absolute",
      bottom: height * 0.1,
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: minDim * 0.02
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
        background: "rgba(30, 41, 59, 0.8)",
        padding: `${height * 0.02}px ${width * 0.05}px`,
        borderRadius: minDim * 0.02,
        border: "1px solid rgba(255, 255, 255, 0.1)",
        maxWidth: width * 0.8
      }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { style: {
        color: "#E2E8F0",
        fontSize: height * 0.022,
        lineHeight: 1.5,
        margin: 0,
        textAlign: "center",
        fontFamily: "sans-serif"
      }, children: frame < 80 ? "Input: Flexible (Accepts variants)" : "Processing: Normalizing to business standards" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", gap: width * 0.05 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { width: 12, height: 12, borderRadius: "50%", background: "#F59E0B" } }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { color: "#94A3B8", fontSize: height * 0.015 }, children: "Raw User Input" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { width: 12, height: 12, borderRadius: "50%", background: "#10B981" } }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { color: "#94A3B8", fontSize: height * 0.015 }, children: "Sanitized DB Entry" })
        ] })
      ] })
    ] }),
    frame > 160 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
      position: "absolute",
      left: dbX - minDim * 0.05,
      top: trackY - minDim * 0.05,
      width: minDim * 0.1,
      height: minDim * 0.1
    }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(GlowPulse, { color: "#10B981" }) })
  ] });
};
var scene_5_default = Scene5;

// src/proj_8e033289_3fc8_4a59_ba0b_bab468e3dccd/scenes/scene_6.tsx
var import_remotion7 = require("remotion");
var import_jsx_runtime7 = require("react/jsx-runtime");
var PostelsLawFinal = () => {
  const { width, height, fps } = (0, import_remotion7.useVideoConfig)();
  const frame = (0, import_remotion7.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const colors = {
    bg: "#0F172A",
    primary: "#3B82F6",
    // Blue
    secondary: "#10B981",
    // Green (Liberal/Input)
    accent: "#F59E0B",
    // Amber (Conservative/Output)
    text: "#F8FAFC",
    glass: "rgba(255, 255, 255, 0.05)"
  };
  const API_X = width * 0.5;
  const CLIENT_X = width * 0.15;
  const DB_X = width * 0.85;
  const zoomProgress = (0, import_remotion7.spring)({
    frame: frame - 10,
    fps,
    config: { damping: 20, stiffness: 60 }
  });
  const scale = (0, import_remotion7.interpolate)(zoomProgress, [0, 1], [2.5, 1]);
  const centerY = (0, import_remotion7.interpolate)(zoomProgress, [0, 1], [height * 0.7, height * 0.5]);
  const centerX = (0, import_remotion7.interpolate)(zoomProgress, [0, 1], [DB_X, width * 0.5]);
  const loopDuration = 90;
  const loopProgress = frame % loopDuration / loopDuration;
  const renderDataPacket = (x, y, color, label) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
        padding: `${minDim * 0.01}px ${minDim * 0.02}px`,
        background: color,
        borderRadius: minDim * 0.01,
        color: "white",
        fontSize: minDim * 0.02,
        fontWeight: "bold",
        display: "flex",
        alignItems: "center",
        gap: 8,
        boxShadow: `0 0 20px ${color}66`,
        zIndex: 10
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "img",
          {
            src: "https://unpkg.com/lucide-static@latest/icons/package.svg",
            width: minDim * 0.02,
            height: minDim * 0.02,
            style: { filter: "brightness(0) invert(1)" }
          }
        ),
        label
      ]
    }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_remotion7.AbsoluteFill, { style: { backgroundColor: colors.bg, overflow: "hidden" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          transformOrigin: `${centerX}px ${centerY}px`,
          transform: `scale(${scale})`,
          position: "relative"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("svg", { style: { position: "absolute", width: "100%", height: "100%" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
              "path",
              {
                d: `M ${CLIENT_X} ${height * 0.45} L ${DB_X} ${height * 0.45}`,
                stroke: colors.glass,
                strokeWidth: minDim * 0.01,
                fill: "none",
                strokeDasharray: "10 10"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
              "path",
              {
                d: `M ${DB_X} ${height * 0.65} L ${CLIENT_X} ${height * 0.65}`,
                stroke: colors.glass,
                strokeWidth: minDim * 0.01,
                fill: "none",
                strokeDasharray: "10 10"
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
            "div",
            {
              style: {
                position: "absolute",
                left: DB_X,
                top: height * 0.55,
                transform: "translate(-50%, -50%)",
                textAlign: "center"
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                  "img",
                  {
                    src: "https://api.iconify.design/mdi/database.svg?color=%233B82F6",
                    width: minDim * 0.12,
                    height: minDim * 0.12
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { color: colors.primary, fontSize: minDim * 0.02, marginTop: 10, fontWeight: "bold" }, children: "STORAGE" })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: API_X,
                top: height * 0.55,
                height: height * 0.4,
                width: minDim * 5e-3,
                background: `linear-gradient(to bottom, transparent, ${colors.primary}, transparent)`,
                transform: "translateX(-50%)"
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: API_X,
                top: height * 0.55,
                transform: "translate(-50%, -50%)"
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(GlowPulse, { color: colors.primary, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: {
                width: minDim * 0.15,
                height: minDim * 0.15,
                borderRadius: "50%",
                background: "rgba(15, 23, 42, 0.9)",
                border: `4px solid ${colors.primary}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backdropFilter: "blur(10px)"
              }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                "img",
                {
                  src: "https://unpkg.com/lucide-static@latest/icons/cpu.svg",
                  width: minDim * 0.08,
                  height: minDim * 0.08,
                  style: { filter: "brightness(0) invert(1)" }
                }
              ) }) })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
            "div",
            {
              style: {
                position: "absolute",
                left: CLIENT_X,
                top: height * 0.55,
                transform: "translate(-50%, -50%)"
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                  "img",
                  {
                    src: "https://unpkg.com/lucide-static@latest/icons/layout.svg",
                    width: minDim * 0.1,
                    height: minDim * 0.1,
                    style: { opacity: 0.6, filter: "brightness(0) invert(1)" }
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { color: "white", fontSize: minDim * 0.02, textAlign: "center", opacity: 0.6 }, children: "CLIENT" })
              ]
            }
          ),
          renderDataPacket(
            (0, import_remotion7.interpolate)(loopProgress, [0, 1], [CLIENT_X, DB_X]),
            height * 0.45,
            loopProgress < 0.5 ? colors.secondary : colors.primary,
            loopProgress < 0.5 ? "USER_NAME" : "user_name"
          ),
          renderDataPacket(
            (0, import_remotion7.interpolate)(loopProgress, [0, 1], [DB_X, CLIENT_X]),
            height * 0.65,
            colors.accent,
            "\u2713 valid_json"
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_remotion7.AbsoluteFill, { style: { pointerEvents: "none" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { height: "15%", padding: minDim * 0.05, textAlign: "center" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(BounceIn, { delay: 20, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("h1", { style: {
          color: "white",
          fontSize: minDim * 0.06,
          margin: 0,
          textTransform: "uppercase",
          letterSpacing: 4
        }, children: "Postel's Law" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(FadeIn, { delay: 40, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { style: { color: colors.primary, fontSize: minDim * 0.03, margin: 0, fontWeight: "bold" }, children: "The Robustness Principle" }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: {
        position: "absolute",
        bottom: 0,
        width: "100%",
        height: "25%",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        padding: minDim * 0.04
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(ScaleIn, { delay: 60, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: {
          background: `${colors.secondary}22`,
          borderLeft: `5px solid ${colors.secondary}`,
          padding: minDim * 0.03,
          borderRadius: 8,
          width: width * 0.38
        }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { style: { color: colors.secondary, fontSize: minDim * 0.02, display: "block" }, children: "LIBERAL ACCEPTANCE" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { style: { color: "white", fontSize: minDim * 0.03, fontWeight: "500" }, children: "Parse flexible formats" })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(ScaleIn, { delay: 80, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: {
          background: `${colors.accent}22`,
          borderLeft: `5px solid ${colors.accent}`,
          padding: minDim * 0.03,
          borderRadius: 8,
          width: width * 0.38
        }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { style: { color: colors.accent, fontSize: minDim * 0.02, display: "block" }, children: "STRICT EMISSION" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { style: { color: "white", fontSize: minDim * 0.03, fontWeight: "500" }, children: "Validate perfect output" })
        ] }) })
      ] })
    ] }),
    frame > 140 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(FadeIn, { duration: 30, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: {
      position: "absolute",
      inset: 0,
      boxShadow: `inset 0 0 ${minDim * 0.2}px ${colors.primary}44`,
      pointerEvents: "none"
    } }) })
  ] });
};
var scene_6_default = PostelsLawFinal;

// src/proj_8e033289_3fc8_4a59_ba0b_bab468e3dccd/Main.tsx
var import_jsx_runtime8 = require("react/jsx-runtime");
function Main() {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_remotion8.AbsoluteFill, { style: { background: "#0F172A" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_remotion8.Sequence, { from: 0, durationInFrames: 216, name: "scene_1", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(scene_1_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_remotion8.Sequence, { from: 216, durationInFrames: 144, name: "scene_2", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(scene_2_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_remotion8.Sequence, { from: 360, durationInFrames: 432, name: "scene_3", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(PostelLawMomentThree, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_remotion8.Sequence, { from: 792, durationInFrames: 264, name: "scene_4", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(PostelsLawInputProcessing, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_remotion8.Sequence, { from: 1056, durationInFrames: 192, name: "scene_5", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(scene_5_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_remotion8.Sequence, { from: 1248, durationInFrames: 190, name: "scene_6", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(scene_6_default, {}) })
  ] });
}
