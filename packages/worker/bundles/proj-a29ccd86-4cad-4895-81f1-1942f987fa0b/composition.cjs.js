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

// src/proj_a29ccd86_4cad_4895_81f1_1942f987fa0b/Main.tsx
var Main_exports = {};
__export(Main_exports, {
  default: () => Main
});
module.exports = __toCommonJS(Main_exports);
var import_remotion10 = require("remotion");

// src/proj_a29ccd86_4cad_4895_81f1_1942f987fa0b/scenes/intro_problem.tsx
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
var Tada = ({
  children,
  delay = 0,
  duration = 30
}) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  if (frame < delay) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children });
  const elapsed = frame - delay;
  if (elapsed > duration) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children });
  const t = elapsed / duration;
  let scale;
  let rotate;
  if (t < 0.1) {
    scale = (0, import_remotion.interpolate)(t, [0, 0.1], [1, 0.9]);
    rotate = (0, import_remotion.interpolate)(t, [0, 0.1], [0, -3]);
  } else if (t < 0.3) {
    scale = (0, import_remotion.interpolate)(t, [0.1, 0.2], [0.9, 1.1]);
    rotate = Math.sin((t - 0.1) * Math.PI * 15) * 3;
  } else if (t < 0.8) {
    scale = 1.1;
    rotate = Math.sin((t - 0.1) * Math.PI * 10) * 3 * (1 - (t - 0.3) / 0.5);
  } else {
    scale = (0, import_remotion.interpolate)(t, [0.8, 1], [1.1, 1]);
    rotate = 0;
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
    transform: `scale(${scale}) rotate(${rotate}deg)`,
    transformOrigin: "center"
  }, children });
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

// src/proj_a29ccd86_4cad_4895_81f1_1942f987fa0b/scenes/intro_problem.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var COLORS = {
  background: "#0F172A",
  primary: "#3B82F6",
  secondary: "#10B981",
  accent: "#F59E0B",
  error: "#EF4444",
  white: "#FFFFFF",
  text: "#E2E8F0"
};
var DataBlock = ({
  index,
  width,
  height,
  offset
}) => {
  const minDim = Math.min(width, height);
  const blockSize = minDim * 0.12;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "div",
    {
      style: {
        width: blockSize,
        height: blockSize,
        background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`,
        borderRadius: minDim * 0.02,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontWeight: "bold",
        fontSize: minDim * 0.045,
        boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
        transform: `translateX(${offset}px)`,
        position: "absolute",
        top: height * 0.45,
        left: index * blockSize * 1.4 % (width * 1.5)
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { opacity: 0.8 }, children: "#" }),
        1e3 + index % 899
      ]
    }
  );
};
var ReservoirSamplingIntro = () => {
  const { width, height, fps } = (0, import_remotion2.useVideoConfig)();
  const frame = (0, import_remotion2.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const streamSpeed = width * 0.6;
  const streamOffset = -(frame * (streamSpeed / fps));
  const ramEntranceTrigger = 60;
  const errorStrikeProgress = (0, import_remotion2.spring)({
    frame: frame - ramEntranceTrigger - 30,
    fps,
    config: { stiffness: 200, damping: 10 }
  });
  const titleSpring = (0, import_remotion2.spring)({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 }
  });
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_remotion2.AbsoluteFill, { style: { backgroundColor: COLORS.background, overflow: "hidden" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "div",
      {
        style: {
          height: height * 0.15,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: height * 0.05
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(BounceIn, { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "h1",
            {
              style: {
                margin: 0,
                color: COLORS.white,
                fontSize: minDim * 0.08,
                textAlign: "center",
                fontWeight: 900,
                letterSpacing: "-0.02em",
                textShadow: `0 0 20px ${COLORS.primary}44`
              },
              children: "RESERVOIR SAMPLING"
            }
          ) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(FadeInUp, { delay: 20, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "p",
            {
              style: {
                margin: 0,
                color: COLORS.secondary,
                fontSize: minDim * 0.04,
                fontWeight: 500
              },
              children: "Infinite Stream \u2022 Single Winner"
            }
          ) })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { height: height * 0.6, position: "relative" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            width: "200%",
            height: "100%",
            transform: `scale(${(0, import_remotion2.interpolate)(titleSpring, [0, 1], [0.8, 1])})`
          },
          children: [...Array(20)].map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            DataBlock,
            {
              index: i,
              width,
              height,
              offset: streamOffset
            },
            i
          ))
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
        "div",
        {
          style: {
            position: "absolute",
            left: "50%",
            top: height * 0.45,
            transform: "translate(-50%, -50%)"
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(GlowPulse, { color: COLORS.accent, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "div",
              {
                style: {
                  width: minDim * 0.25,
                  height: minDim * 0.25,
                  border: `${minDim * 0.01}px dashed ${COLORS.accent}`,
                  borderRadius: minDim * 0.03,
                  background: `${COLORS.accent}11`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backdropFilter: "blur(4px)"
                },
                children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                  "span",
                  {
                    style: {
                      color: COLORS.accent,
                      fontSize: minDim * 0.1,
                      fontWeight: "bold"
                    },
                    children: "?"
                  }
                )
              }
            ) }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "div",
              {
                style: {
                  position: "absolute",
                  bottom: -minDim * 0.08,
                  width: "100%",
                  textAlign: "center",
                  color: COLORS.accent,
                  fontSize: minDim * 0.035,
                  fontWeight: 700
                },
                children: "RESERVOIR (K=1)"
              }
            )
          ]
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      import_remotion2.AbsoluteFill,
      {
        style: {
          top: height * 0.75,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: minDim * 0.03
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { position: "relative" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ZoomIn, { delay: ramEntranceTrigger, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "div",
              {
                style: {
                  padding: minDim * 0.04,
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: minDim * 0.03,
                  border: `1px solid ${COLORS.text}33`,
                  display: "flex",
                  alignItems: "center",
                  gap: minDim * 0.03
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                    "svg",
                    {
                      viewBox: "0 0 24 24",
                      width: minDim * 0.08,
                      height: minDim * 0.08,
                      stroke: COLORS.text,
                      strokeWidth: "2",
                      fill: "none",
                      children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M2 9h20v6H2zM6 9v6M10 9v6M14 9v6M18 9v6" })
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                    "span",
                    {
                      style: {
                        color: COLORS.text,
                        fontSize: minDim * 0.04,
                        fontWeight: 600
                      },
                      children: "Limited RAM"
                    }
                  )
                ]
              }
            ) }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "svg",
              {
                style: {
                  position: "absolute",
                  top: -minDim * 0.02,
                  left: -minDim * 0.02,
                  width: minDim * 0.4,
                  height: minDim * 0.15,
                  pointerEvents: "none"
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                    "line",
                    {
                      x1: "10%",
                      y1: "20%",
                      x2: "90%",
                      y2: "80%",
                      stroke: COLORS.error,
                      strokeWidth: minDim * 0.015,
                      strokeLinecap: "round",
                      style: {
                        strokeDasharray: 1e3,
                        strokeDashoffset: (1 - errorStrikeProgress) * 1e3
                      }
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                    "line",
                    {
                      x1: "10%",
                      y1: "80%",
                      x2: "90%",
                      y2: "20%",
                      stroke: COLORS.error,
                      strokeWidth: minDim * 0.015,
                      strokeLinecap: "round",
                      style: {
                        strokeDasharray: 1e3,
                        strokeDashoffset: (1 - errorStrikeProgress) * 1e3
                      }
                    }
                  )
                ]
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(PremiumStagger, { startDelay: 120, children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "div",
              {
                style: {
                  color: COLORS.text,
                  fontSize: minDim * 0.045,
                  maxWidth: "80%",
                  textAlign: "center",
                  lineHeight: 1.4
                },
                children: "Millions of items incoming..."
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "div",
              {
                style: {
                  color: COLORS.error,
                  fontSize: minDim * 0.05,
                  fontWeight: 800
                },
                children: "CANNOT STORE ALL DATA"
              }
            )
          ] })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "svg",
      {
        width: "100%",
        height: "100%",
        style: { position: "absolute", zIndex: -1, opacity: 0.1 },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "pattern",
            {
              id: "grid",
              width: minDim * 0.1,
              height: minDim * 0.1,
              patternUnits: "userSpaceOnUse",
              children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                "path",
                {
                  d: `M ${minDim * 0.1} 0 L 0 0 0 ${minDim * 0.1}`,
                  fill: "none",
                  stroke: COLORS.primary,
                  strokeWidth: "1"
                }
              )
            }
          ) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { width: "100%", height: "100%", fill: "url(#grid)" })
        ]
      }
    )
  ] });
};
var intro_problem_default = ReservoirSamplingIntro;

// src/proj_a29ccd86_4cad_4895_81f1_1942f987fa0b/scenes/constraints.tsx
var import_remotion3 = require("remotion");
var import_jsx_runtime3 = require("react/jsx-runtime");
var ReservoirSamplingSceneTwo = () => {
  const { width, height, fps } = (0, import_remotion3.useVideoConfig)();
  const frame = (0, import_remotion3.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const blockSize = minDim * 0.15;
  const blockGap = minDim * 0.05;
  const streamY = height * 0.5;
  const reservoirX = width * 0.5;
  const speed = (blockSize + blockGap) * 4 / fps;
  const streamOffset = frame * speed % (blockSize + blockGap);
  const panProgress = (0, import_remotion3.spring)({
    frame: frame - 30,
    fps,
    config: { damping: 15, stiffness: 60 }
  });
  const cameraX = (0, import_remotion3.interpolate)(panProgress, [0, 1], [0, -width * 0.2]);
  const fogIntensity = (0, import_remotion3.interpolate)(frame, [60, 180], [0, 1], {
    extrapolateRight: "clamp"
  });
  const blocks = Array.from({ length: 12 }).map((_, i) => ({
    id: 100 + i - Math.floor(frame * 4 / fps)
  }));
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_remotion3.AbsoluteFill, { style: { backgroundColor: "#0F172A", overflow: "hidden" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_remotion3.AbsoluteFill, { style: { height: height * 0.15, top: height * 0.05 }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(FadeIn, { children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "h1",
      {
        style: {
          color: "white",
          fontSize: minDim * 0.06,
          textAlign: "center",
          fontFamily: "sans-serif",
          fontWeight: 800,
          margin: 0
        },
        children: "UNBOUNDED DATA STREAM"
      }
    ) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          width: "100%",
          height: "100%",
          transform: `translateX(${cameraX}px)`
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: reservoirX - blockSize * 1.2 / 2,
                top: streamY - blockSize * 1.2 / 2,
                width: blockSize * 1.2,
                height: blockSize * 1.2,
                border: `${minDim * 8e-3}px solid #3B82F6`,
                borderRadius: minDim * 0.02,
                boxShadow: "0 0 20px rgba(59, 130, 246, 0.3)",
                zIndex: 5
              }
            }
          ),
          blocks.map((block, i) => {
            const xPos = i * (blockSize + blockGap) - streamOffset;
            return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
              "div",
              {
                style: {
                  position: "absolute",
                  left: xPos,
                  top: streamY - blockSize / 2,
                  width: blockSize,
                  height: blockSize,
                  background: "linear-gradient(135deg, #1E293B, #334155)",
                  borderRadius: minDim * 0.015,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#94A3B8",
                  fontSize: blockSize * 0.3,
                  border: "1px solid rgba(255,255,255,0.1)",
                  opacity: (0, import_remotion3.interpolate)(xPos, [width * 0.7, width * 0.9], [1, 0], { extrapolateLeft: "clamp" })
                },
                children: [
                  "#",
                  block.id
                ]
              },
              block.id
            );
          }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                right: -width * 0.2,
                top: 0,
                bottom: 0,
                width: width * 0.6,
                background: "linear-gradient(to right, transparent, #0F172A 80%)",
                opacity: fogIntensity,
                zIndex: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { transform: `scale(${(0, import_remotion3.interpolate)(fogIntensity, [0, 1], [0.5, 1.2])})` }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(GlowPulse, { color: "#F59E0B", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { viewBox: "0 0 24 24", width: minDim * 0.3, height: minDim * 0.3, fill: "#F59E0B", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M18.18 8.05c-1.12 0-2.18.42-2.98 1.19l-3.2 3.08-3.2-3.08c-.8-.77-1.87-1.19-2.99-1.19-2.31 0-4.19 1.88-4.19 4.19s1.88 4.19 4.19 4.19c1.12 0 2.19-.42 2.99-1.19l3.2-3.08 3.2 3.08c.8.77 1.87 1.19 2.99 1.19 2.31 0 4.19-1.88 4.19-4.19s-1.88-4.19-4.19-4.19zm-13.37 6.38c-.59 0-1.13-.23-1.53-.63-.4-.4-.63-.94-.63-1.53s.23-1.13.63-1.53c.4-.4.94-.63 1.53-.63s1.13.23 1.53.63l2.25 2.16-2.25 2.16c-.4.4-.94.63-1.53.63zm13.37 0c-.59 0-1.13-.23-1.53-.63l-2.25-2.16 2.25-2.16c.4-.4.94-.63 1.53-.63s1.13.23 1.53.63c.4.4.63.94.63 1.53s-.23 1.13-.63 1.53c-.4.4-.94.63-1.53.63z" }) }) }) })
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.25,
          right: width * 0.1,
          opacity: (0, import_remotion3.interpolate)(frame, [0, 60], [1, 0.2]),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: minDim * 0.02
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { position: "relative" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("svg", { width: minDim * 0.15, height: minDim * 0.15, viewBox: "0 0 24 24", fill: "none", stroke: "#64748B", strokeWidth: "2", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("rect", { x: "2", y: "5", width: "20", height: "14", rx: "2" }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M6 5v2M10 5v2M14 5v2M18 5v2" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { color: "#EF4444", fontSize: minDim * 0.12, fontWeight: 900 }, children: "\u2715" }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { color: "#64748B", fontSize: minDim * 0.03 }, children: "Limited RAM" })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_remotion3.AbsoluteFill, { style: { top: height * 0.75, height: height * 0.2 }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          gap: minDim * 0.1
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(PremiumStagger, { speed: "fast", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { textAlign: "center" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { color: "#94A3B8", fontSize: minDim * 0.04 }, children: "Current Item Seen" }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { color: "#F59E0B", fontSize: minDim * 0.08, fontWeight: "bold" }, children: [
              "n = ",
              1e3 + Math.floor(frame / 2)
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { textAlign: "center" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { color: "#94A3B8", fontSize: minDim * 0.04 }, children: "Total Stream Size" }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { position: "relative", display: "flex", justifyContent: "center" }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "div",
                {
                  style: {
                    color: "#64748B",
                    fontSize: minDim * 0.08,
                    fontWeight: "bold",
                    opacity: (0, import_remotion3.interpolate)(frame, [90, 120], [1, 0.3])
                  },
                  children: "N = ???"
                }
              ),
              frame > 110 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { position: "absolute", top: -minDim * 0.02 }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(BounceIn, { delay: 120, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { fontSize: minDim * 0.1, color: "#F59E0B", fontWeight: 900 }, children: "?" }) }) })
            ] })
          ] })
        ] })
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_remotion3.AbsoluteFill, { style: { top: "unset", bottom: height * 0.05, height: "auto" }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(PopIn, { delay: 40, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        style: {
          margin: "0 auto",
          padding: `${minDim * 0.02}px ${minDim * 0.04}px`,
          backgroundColor: "rgba(30, 41, 59, 0.8)",
          border: "1px solid #3B82F6",
          borderRadius: minDim * 0.05,
          backdropFilter: "blur(10px)",
          color: "white",
          fontSize: minDim * 0.035,
          textAlign: "center",
          maxWidth: "80%"
        },
        children: "Problem: Total stream size (N) is unknown until it ends."
      }
    ) }) })
  ] });
};
var constraints_default = ReservoirSamplingSceneTwo;

// src/proj_a29ccd86_4cad_4895_81f1_1942f987fa0b/scenes/the_challenge.tsx
var import_remotion4 = require("remotion");
var import_jsx_runtime4 = require("react/jsx-runtime");
var ReservoirSamplingScene = () => {
  const { width, height, fps } = (0, import_remotion4.useVideoConfig)();
  const frame = (0, import_remotion4.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const COLORS5 = {
    background: "#0F172A",
    primary: "#3B82F6",
    secondary: "#10B981",
    accent: "#F59E0B",
    white: "#FFFFFF",
    text: "#94A3B8"
  };
  const nodeSize = minDim * 0.15;
  const reservoirWidth = minDim * 0.25;
  const reservoirHeight = minDim * 0.25;
  const fogOpacity = (0, import_remotion4.interpolate)(frame, [0, 60], [0.8, 0], {
    extrapolateRight: "clamp"
  });
  const streamSpeed = 4;
  const streamOffset = frame * streamSpeed;
  const reservoirY = (0, import_remotion4.spring)({
    frame,
    fps,
    from: -reservoirHeight,
    to: height * 0.45,
    config: SPRING_CONFIGS.modern
  });
  const block1X = width * 0.2 + streamOffset;
  const block1InReservoir = block1X > width * 0.5 - nodeSize / 2;
  const largeN = 1e6;
  const millionthBlockX = width * 0.5 + largeN * (nodeSize * 1.5) - streamOffset;
  const titleOpacity = (0, import_remotion4.interpolate)(frame, [20, 50], [0, 1]);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_remotion4.AbsoluteFill, { style: { backgroundColor: COLORS5.background }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.08,
          width: "100%",
          textAlign: "center",
          opacity: titleOpacity
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "h1",
            {
              style: {
                color: COLORS5.white,
                fontSize: height * 0.04,
                fontWeight: 800,
                margin: 0,
                fontFamily: "sans-serif",
                textTransform: "uppercase",
                letterSpacing: "2px"
              },
              children: "Reservoir Sampling"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "p",
            {
              style: {
                color: COLORS5.text,
                fontSize: height * 0.02,
                marginTop: height * 0.01
              },
              children: "Fairness across an infinite stream"
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          left: width * 0.5 - reservoirWidth / 2,
          top: reservoirY,
          width: reservoirWidth,
          height: reservoirHeight,
          borderRadius: minDim * 0.03,
          border: `${minDim * 8e-3}px solid ${COLORS5.primary}`,
          background: "rgba(59, 130, 246, 0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 0 ${minDim * 0.05}px rgba(59, 130, 246, 0.3)`
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(GlowPulse, { color: COLORS5.primary, speed: "slow", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "div",
            {
              style: {
                fontSize: minDim * 0.02,
                color: COLORS5.primary,
                fontWeight: "bold",
                position: "absolute",
                bottom: -minDim * 0.05
              },
              children: "RESERVOIR (K=1)"
            }
          ) }),
          block1InReservoir && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ScaleIn, { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "div",
            {
              style: {
                width: nodeSize,
                height: nodeSize,
                backgroundColor: COLORS5.secondary,
                borderRadius: "20%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: nodeSize * 0.4,
                fontWeight: "900",
                boxShadow: "0 10px 20px rgba(0,0,0,0.3)"
              },
              children: "1"
            }
          ) })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { position: "absolute", top: height * 0.75, width: "100%" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
        "div",
        {
          style: {
            position: "absolute",
            left: millionthBlockX > width ? width - 100 : millionthBlockX,
            opacity: (0, import_remotion4.interpolate)(millionthBlockX, [width + 200, width], [0, 1]),
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: minDim * 0.02
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              "div",
              {
                style: {
                  width: nodeSize,
                  height: nodeSize,
                  backgroundColor: COLORS5.accent,
                  borderRadius: "20%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: nodeSize * 0.3,
                  fontWeight: "900"
                },
                children: "1M"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              "div",
              {
                style: {
                  color: COLORS5.accent,
                  fontSize: minDim * 0.02,
                  fontWeight: "bold",
                  whiteSpace: "nowrap"
                },
                children: "Millionth Entry"
              }
            )
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "svg",
        {
          style: {
            position: "absolute",
            width: "100%",
            height: 100,
            overflow: "visible"
          },
          children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "line",
            {
              x1: "0",
              y1: "50",
              x2: "100%",
              y2: "50",
              stroke: COLORS5.text,
              strokeWidth: "2",
              strokeDasharray: "10 10",
              opacity: "0.3"
            }
          )
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: height * 0.1,
          width: "80%",
          left: "10%",
          backgroundColor: "rgba(15, 23, 42, 0.8)",
          padding: minDim * 0.04,
          borderRadius: minDim * 0.02,
          border: `1px solid rgba(255,255,255,0.1)`,
          backdropFilter: "blur(10px)"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(FadeIn, { delay: 40, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
          "div",
          {
            style: {
              color: COLORS5.white,
              fontSize: height * 0.025,
              lineHeight: 1.5,
              textAlign: "center",
              fontFamily: "sans-serif"
            },
            children: [
              "Whether it's the ",
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { color: COLORS5.secondary, fontWeight: "bold" }, children: "first" }),
              " data point or the ",
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { color: COLORS5.accent, fontWeight: "bold" }, children: "millionth" }),
              ", the mathematical chance of being selected remains ",
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { color: COLORS5.primary, fontWeight: "bold" }, children: "identical" }),
              "."
            ]
          }
        ) })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: 0,
          right: 0,
          width: "100%",
          height: "100%",
          background: `linear-gradient(to left, ${COLORS5.background}, transparent)`,
          opacity: fogOpacity,
          pointerEvents: "none"
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          width: "100%",
          height: "100%",
          border: `${minDim * 0.02}px solid ${COLORS5.primary}`,
          opacity: (0, import_remotion4.interpolate)(frame, [0, 20], [0, 0.15]),
          pointerEvents: "none"
        }
      }
    )
  ] });
};
var the_challenge_default = ReservoirSamplingScene;

// src/proj_a29ccd86_4cad_4895_81f1_1942f987fa0b/scenes/the_solution_logic.tsx
var import_remotion5 = require("remotion");
var import_jsx_runtime5 = require("react/jsx-runtime");
var ReservoirSamplingSceneFour = () => {
  const { width, height, fps } = (0, import_remotion5.useVideoConfig)();
  const frame = (0, import_remotion5.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const bgColor = "#0f172a";
  const primaryColor = "#3b82f6";
  const secondaryColor = "#10b981";
  const accentColor = "#f59e0b";
  const reservoirSize = minDim * 0.4;
  const blockSize = reservoirSize * 0.7;
  const springConfig = { damping: 12, stiffness: 80 };
  const labelEntrance = (0, import_remotion5.spring)({
    frame: frame - 15,
    fps,
    config: springConfig
  });
  const streamY = height * 0.55;
  const speed = 4;
  const blockGap = minDim * 0.25;
  const futureBlocks = [2, 3, 4, 5, 6];
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_remotion5.AbsoluteFill, { style: { backgroundColor: bgColor, color: "white", fontFamily: "sans-serif" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.05,
          width: "100%",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          gap: height * 0.01
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(BounceIn, { delay: 10, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "h1",
          {
            style: {
              fontSize: height * 0.045,
              fontWeight: 800,
              margin: 0,
              color: "white",
              textTransform: "uppercase",
              letterSpacing: "2px"
            },
            children: "Reservoir Sampling"
          }
        ) })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_remotion5.AbsoluteFill, { style: { display: "flex", alignItems: "center", justifyContent: "center" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
        "div",
        {
          style: {
            width: reservoirSize,
            height: reservoirSize,
            border: `${minDim * 0.01}px solid ${primaryColor}`,
            borderRadius: minDim * 0.04,
            position: "absolute",
            top: height * 0.5 - reservoirSize * 0.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(59, 130, 246, 0.05)",
            boxShadow: `0 0 ${minDim * 0.05}px rgba(59, 130, 246, 0.2)`
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(GlowPulse, { color: primaryColor, speed: "slow", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { width: reservoirSize, height: reservoirSize, borderRadius: minDim * 0.04 } }) }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
              "div",
              {
                style: {
                  width: blockSize,
                  height: blockSize,
                  background: `linear-gradient(135deg, ${primaryColor}, #1d4ed8)`,
                  borderRadius: minDim * 0.02,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 10px 20px rgba(0,0,0,0.3)",
                  zIndex: 10,
                  position: "relative"
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontSize: blockSize * 0.4, fontWeight: "bold" }, children: "1" }),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: {
                    position: "absolute",
                    inset: 0,
                    borderRadius: minDim * 0.02,
                    boxShadow: `inset 0 0 ${minDim * 0.02}px rgba(255,255,255,0.3)`
                  } })
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "div",
              {
                style: {
                  position: "absolute",
                  top: -height * 0.1,
                  whiteSpace: "nowrap",
                  transform: `scale(${labelEntrance}) translateY(${(1 - labelEntrance) * 20}px)`,
                  opacity: labelEntrance
                },
                children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(GlowPulse, { color: accentColor, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: {
                  padding: `${height * 0.01}px ${width * 0.04}px`,
                  backgroundColor: accentColor,
                  borderRadius: minDim * 0.01,
                  color: bgColor,
                  fontWeight: "bold",
                  fontSize: height * 0.025,
                  textTransform: "uppercase"
                }, children: "Current Winner" }) })
              }
            )
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { position: "absolute", top: streamY, width: "100%", overflow: "visible" }, children: futureBlocks.map((num, i) => {
        const offset = (i + 1) * blockGap - frame * speed % (blockGap * 10);
        if (offset < -blockGap) return null;
        return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: width + offset,
              width: blockSize * 0.6,
              height: blockSize * 0.6,
              backgroundColor: "rgba(255,255,255,0.1)",
              border: `2px solid rgba(255,255,255,0.2)`,
              borderRadius: minDim * 0.015,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,0.4)",
              fontSize: blockSize * 0.25
            },
            children: num
          },
          num
        );
      }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: height * 0.1,
          width: "100%",
          padding: `0 ${width * 0.1}px`,
          boxSizing: "border-box",
          textAlign: "center"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
          "div",
          {
            style: {
              backgroundColor: "rgba(30, 41, 59, 0.7)",
              backdropFilter: "blur(10px)",
              padding: minDim * 0.04,
              borderRadius: minDim * 0.03,
              border: "1px solid rgba(255,255,255,0.1)",
              display: "flex",
              flexDirection: "column",
              gap: minDim * 0.02
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                "span",
                {
                  style: {
                    fontSize: height * 0.028,
                    color: secondaryColor,
                    fontWeight: "bold"
                  },
                  children: "Constant Memory Insight"
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                "span",
                {
                  style: {
                    fontSize: height * 0.022,
                    color: "rgba(255,255,255,0.8)",
                    lineHeight: 1.4
                  },
                  children: [
                    "Regardless of the stream size, you only ever need to track the",
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { style: { color: "white" }, children: " current winner" }),
                    "."
                  ]
                }
              )
            ]
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: height * 0.03,
          right: width * 0.05,
          display: "flex",
          alignItems: "baseline",
          gap: 8
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontSize: height * 0.02, color: "rgba(255,255,255,0.5)" }, children: "Items processed (n):" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontSize: height * 0.035, fontWeight: "bold", color: secondaryColor }, children: "1" })
        ]
      }
    )
  ] });
};
var the_solution_logic_default = ReservoirSamplingSceneFour;

// src/proj_a29ccd86_4cad_4895_81f1_1942f987fa0b/scenes/the_mechanism.tsx
var import_remotion6 = require("remotion");
var import_jsx_runtime6 = require("react/jsx-runtime");
var COLORS2 = {
  background: "#0F172A",
  primary: "#3B82F6",
  secondary: "#10B981",
  accent: "#F59E0B",
  white: "#FFFFFF",
  text: "#E2E8F0"
};
var DataBlock2 = ({ val, size, x, y, color, opacity = 1, highlight = false }) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
  "div",
  {
    style: {
      position: "absolute",
      width: size,
      height: size,
      left: x - size / 2,
      top: y - size / 2,
      backgroundColor: color,
      borderRadius: size * 0.2,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "white",
      fontWeight: "bold",
      fontSize: size * 0.4,
      boxShadow: highlight ? `0 0 ${size * 0.3}px ${color}` : `0 4px 10px rgba(0,0,0,0.3)`,
      opacity,
      border: `2px solid ${highlight ? COLORS2.white : "transparent"}`
    },
    children: val
  }
);
var Die = ({ size, value, x, y, opacity }) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
  "div",
  {
    style: {
      position: "absolute",
      width: size,
      height: size,
      left: x - size / 2,
      top: y - size / 2,
      backgroundColor: COLORS2.white,
      borderRadius: size * 0.15,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: COLORS2.background,
      fontWeight: "900",
      fontSize: size * 0.5,
      boxShadow: "0 10px 20px rgba(0,0,0,0.4)",
      opacity,
      transform: `rotate(${(0, import_remotion6.interpolate)(opacity, [0, 1], [45, 0])}deg)`
    },
    children: value
  }
);
function ReservoirSamplingMechanism() {
  const { width, height, fps } = (0, import_remotion6.useVideoConfig)();
  const frame = (0, import_remotion6.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const reservoirSize = minDim * 0.25;
  const blockSize = minDim * 0.18;
  const centerY = height * 0.52;
  const reservoirX = width * 0.5;
  const block2ArrivalFrame = 30;
  const block2RollFrame = 60;
  const block2ExitFrame = 100;
  const block3ArrivalFrame = 140;
  const block3RollFrame = 170;
  const block3SwapFrame = 210;
  const b1Spring = (0, import_remotion6.spring)({
    frame: frame - block3SwapFrame,
    fps,
    config: { damping: 12, stiffness: 60 }
  });
  const b1X = (0, import_remotion6.interpolate)(b1Spring, [0, 1], [reservoirX, reservoirX - width * 0.6]);
  const b1Y = (0, import_remotion6.interpolate)(b1Spring, [0, 0.5, 1], [centerY, centerY - height * 0.1, centerY + height * 0.2]);
  const b1Opacity = (0, import_remotion6.interpolate)(b1Spring, [0.8, 1], [1, 0]);
  const b2EntrySpring = (0, import_remotion6.spring)({
    frame: frame - block2ArrivalFrame,
    fps,
    config: SPRING_CONFIGS.gentle
  });
  const b2ExitSpring = (0, import_remotion6.spring)({
    frame: frame - block2ExitFrame,
    fps,
    config: { damping: 15, stiffness: 40 }
  });
  const b2BaseX = (0, import_remotion6.interpolate)(b2EntrySpring, [0, 1], [width + blockSize, reservoirX + blockSize * 1.5]);
  const b2X = (0, import_remotion6.interpolate)(b2ExitSpring, [0, 1], [b2BaseX, width + blockSize]);
  const b3EntrySpring = (0, import_remotion6.spring)({
    frame: frame - block3ArrivalFrame,
    fps,
    config: SPRING_CONFIGS.gentle
  });
  const b3SwapSpring = (0, import_remotion6.spring)({
    frame: frame - block3SwapFrame,
    fps,
    config: { damping: 12, stiffness: 90 }
  });
  const b3BaseX = (0, import_remotion6.interpolate)(b3EntrySpring, [0, 1], [width + blockSize, reservoirX + blockSize * 1.5]);
  const b3X = (0, import_remotion6.interpolate)(b3SwapSpring, [0, 1], [b3BaseX, reservoirX]);
  const p2Opacity = (0, import_remotion6.interpolate)(frame, [block2ArrivalFrame, block2ArrivalFrame + 15, block2ExitFrame, block2ExitFrame + 10], [0, 1, 1, 0]);
  const p3Opacity = (0, import_remotion6.interpolate)(frame, [block3ArrivalFrame, block3ArrivalFrame + 15, block3SwapFrame, block3SwapFrame + 10], [0, 1, 1, 0]);
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_remotion6.AbsoluteFill, { style: { backgroundColor: COLORS2.background, fontFamily: "system-ui, sans-serif" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { height: height * 0.15, paddingTop: height * 0.05, textAlign: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(FadeIn, { children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h1", { style: { color: COLORS2.white, fontSize: height * 0.04, margin: 0 }, children: "The Selection Rule" }) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_remotion6.AbsoluteFill, { style: { top: height * 0.15, height: height * 0.6 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
        position: "absolute",
        width: reservoirSize,
        height: reservoirSize,
        left: reservoirX - reservoirSize / 2,
        top: centerY - reservoirSize / 2,
        border: `4px dashed ${COLORS2.primary}`,
        borderRadius: minDim * 0.04,
        backgroundColor: "rgba(59, 130, 246, 0.05)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        paddingBottom: minDim * 0.02
      }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { color: COLORS2.primary, fontSize: minDim * 0.03, fontWeight: "bold", opacity: 0.6 }, children: "RESERVOIR" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_remotion6.Sequence, { from: block2RollFrame, duration: 50, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Die, { size: minDim * 0.1, value: 2, x: b2X, y: centerY - blockSize, opacity: 1 }),
        frame > block2RollFrame + 15 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { position: "absolute", left: b2X - 50, top: centerY - blockSize * 1.8, color: COLORS2.accent, fontWeight: "bold", fontSize: minDim * 0.04 }, children: "FAIL" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_remotion6.Sequence, { from: block3RollFrame, duration: 50, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Die, { size: minDim * 0.1, value: 1, x: b3X, y: centerY - blockSize, opacity: 1 }),
        frame > block3RollFrame + 15 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Tada, { children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { position: "absolute", left: b3X - 50, top: centerY - blockSize * 1.8, color: COLORS2.secondary, fontWeight: "bold", fontSize: minDim * 0.04 }, children: "SUCCESS!" }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { position: "absolute", left: b2X - 40, top: centerY - blockSize * 0.8, opacity: p2Opacity, color: COLORS2.accent, fontWeight: "bold", fontSize: minDim * 0.04 }, children: "P = 1/2" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { position: "absolute", left: b3X - 40, top: centerY - blockSize * 0.8, opacity: p3Opacity, color: COLORS2.accent, fontWeight: "bold", fontSize: minDim * 0.04 }, children: "P = 1/3" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        DataBlock2,
        {
          val: 1,
          size: blockSize,
          x: b1X,
          y: b1Y,
          color: COLORS2.primary,
          opacity: b1Opacity,
          highlight: frame < block3SwapFrame
        }
      ),
      frame >= block2ArrivalFrame && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(DataBlock2, { val: 2, size: blockSize, x: b2X, y: centerY, color: "#475569" }),
      frame >= block3ArrivalFrame && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        DataBlock2,
        {
          val: 3,
          size: blockSize,
          x: b3X,
          y: centerY,
          color: COLORS2.primary,
          highlight: frame >= block3SwapFrame
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_remotion6.AbsoluteFill, { style: { top: height * 0.75, height: height * 0.25, padding: minDim * 0.05 }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: {
      background: "rgba(255, 255, 255, 0.05)",
      backdropFilter: "blur(10px)",
      borderRadius: minDim * 0.03,
      padding: minDim * 0.04,
      border: "1px solid rgba(255,255,255,0.1)"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_remotion6.Sequence, { from: 0, duration: block3ArrivalFrame, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { color: COLORS2.text, fontSize: height * 0.025, lineHeight: 1.4 }, children: [
        "For item ",
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { color: COLORS2.accent, fontWeight: "bold" }, children: "n=2" }),
        ", roll a die.",
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("br", {}),
        "Probability of replacement: ",
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { color: COLORS2.accent }, children: "1/2" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_remotion6.Sequence, { from: block3ArrivalFrame, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { color: COLORS2.text, fontSize: height * 0.025, lineHeight: 1.4 }, children: [
        "For item ",
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { color: COLORS2.accent, fontWeight: "bold" }, children: "n=3" }),
        ", roll again.",
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("br", {}),
        "Probability of replacement: ",
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { color: COLORS2.accent }, children: "1/3" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { marginTop: minDim * 0.03, display: "flex", gap: minDim * 0.04 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(GlowPulse, { speed: "slow", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: {
          color: b1Opacity > 0.5 ? COLORS2.primary : COLORS2.secondary,
          fontSize: minDim * 0.03,
          fontWeight: "bold",
          padding: "4px 12px",
          background: "rgba(59, 130, 246, 0.1)",
          borderRadius: 8
        }, children: [
          "Current Winner: #",
          frame < block3SwapFrame + 5 ? "1" : "3"
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { color: COLORS2.accent, fontSize: minDim * 0.03, fontWeight: "bold" }, children: [
          "n = ",
          frame < block3ArrivalFrame ? "2" : "3"
        ] })
      ] })
    ] }) })
  ] });
}

// src/proj_a29ccd86_4cad_4895_81f1_1942f987fa0b/scenes/mathematical_proof.tsx
var import_react2 = require("react");
var import_remotion7 = require("remotion");
var import_jsx_runtime7 = require("react/jsx-runtime");
var COLORS3 = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];
function ReservoirSamplingFinalState() {
  const { width, height, fps } = (0, import_remotion7.useVideoConfig)();
  const frame = (0, import_remotion7.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const reservoirY = height * 0.45;
  const reservoirSize = minDim * 0.25;
  const blockSize = minDim * 0.18;
  const streamY = height * 0.45;
  const zoom = (0, import_remotion7.interpolate)(frame, [0, 300], [1, 0.6], {
    easing: import_remotion7.Easing.bezier(0.4, 0, 0.2, 1)
  });
  const speed = (0, import_remotion7.interpolate)(frame, [0, 300], [0.1, 0.5]);
  const currentN = Math.floor((0, import_remotion7.interpolate)(frame, [0, 300], [4, 1500], {
    easing: import_remotion7.Easing.inOut(import_remotion7.Easing.quad)
  }));
  const occupantId = (0, import_react2.useMemo)(() => {
    if (frame < 50) return 3;
    if (frame < 180) return 142;
    if (frame < 260) return 890;
    return 1204;
  }, [frame]);
  const renderReservoir = () => {
    const isReplacing = [50, 180, 260].includes(frame);
    return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: width / 2 - reservoirSize * zoom / 2,
          top: reservoirY - reservoirSize * zoom / 2,
          width: reservoirSize * zoom,
          height: reservoirSize * zoom,
          border: `${minDim * 0.01}px solid #3B82F6`,
          borderRadius: minDim * 0.03,
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: isReplacing ? `0 0 ${minDim * 0.1}px #10B981` : "none",
          transition: "box-shadow 0.1s ease-out",
          zIndex: 10
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: {
          width: blockSize * zoom,
          height: blockSize * zoom,
          backgroundColor: COLORS3[occupantId % COLORS3.length],
          borderRadius: minDim * 0.02,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: minDim * 0.05 * zoom,
          fontWeight: "bold",
          boxShadow: "0 10px 20px rgba(0,0,0,0.3)"
        }, children: [
          "#",
          occupantId
        ] })
      }
    );
  };
  const renderStream = () => {
    const blocks = Array.from({ length: 8 }).map((_, i) => {
      const offset = (frame * speed + i * 1.5) % 8;
      const xPos = width + blockSize * 2 - offset * width * 0.3 * zoom;
      const id = currentN + i;
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
        "div",
        {
          style: {
            position: "absolute",
            left: xPos,
            top: streamY - blockSize * zoom / 2,
            width: blockSize * zoom,
            height: blockSize * zoom,
            backgroundColor: COLORS3[id % COLORS3.length],
            borderRadius: minDim * 0.02,
            opacity: 0.6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: minDim * 0.04 * zoom,
            fontWeight: "bold"
          },
          children: [
            "#",
            id
          ]
        },
        i
      );
    });
    return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_jsx_runtime7.Fragment, { children: blocks });
  };
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_remotion7.AbsoluteFill, { style: { backgroundColor: "#0F172A", overflow: "hidden" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: {
      paddingTop: height * 0.05,
      textAlign: "center",
      zIndex: 20
    }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(FadeInUp, { delay: 0, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("h1", { style: {
      color: "white",
      fontSize: minDim * 0.06,
      margin: 0,
      fontFamily: "sans-serif",
      fontWeight: 800,
      textTransform: "uppercase",
      letterSpacing: "2px"
    }, children: "Uniform Probability" }) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { flex: 1, position: "relative" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: {
        position: "absolute",
        top: height * 0.25,
        left: 0,
        right: 0,
        textAlign: "center"
      }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(GlowPulse, { speed: "slow", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: {
        fontSize: minDim * 0.08 * (1 + (1 - zoom) * 0.5),
        color: "#F59E0B",
        fontWeight: "bold",
        fontFamily: "monospace"
      }, children: [
        "P = 1 / ",
        currentN.toLocaleString()
      ] }) }) }),
      renderReservoir(),
      renderStream(),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("svg", { style: { position: "absolute", width: "100%", height: "100%", pointerEvents: "none" }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "line",
        {
          x1: "0",
          y1: streamY,
          x2: width,
          y2: streamY,
          stroke: "rgba(255,255,255,0.1)",
          strokeWidth: 2,
          strokeDasharray: "10 10"
        }
      ) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: {
      position: "absolute",
      bottom: height * 0.1,
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: minDim * 0.02
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: {
        padding: `${minDim * 0.02}px ${minDim * 0.05}px`,
        background: "rgba(255,255,255,0.05)",
        borderRadius: minDim * 0.05,
        border: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(10px)",
        color: "#10B981",
        fontSize: minDim * 0.04,
        fontWeight: "600",
        fontFamily: "sans-serif"
      }, children: [
        "Stream Size (n): ",
        currentN.toLocaleString()
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("p", { style: {
        color: "rgba(255,255,255,0.7)",
        fontSize: minDim * 0.035,
        width: "80%",
        textAlign: "center",
        lineHeight: 1.5,
        fontFamily: "sans-serif"
      }, children: [
        "Every item processed has exactly ",
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { style: { color: "#F59E0B", fontWeight: "bold" }, children: "k/n" }),
        " chance of being in the final sample."
      ] })
    ] }),
    [50, 180, 260].map((swapFrame) => {
      const opacity = (0, import_remotion7.interpolate)(frame, [swapFrame, swapFrame + 10], [0.4, 0], {
        extrapolateRight: "clamp"
      });
      if (frame < swapFrame || frame > swapFrame + 10) return null;
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_remotion7.AbsoluteFill, { style: { backgroundColor: "#10B981", opacity, pointerEvents: "none" } }, swapFrame);
    })
  ] });
}

// src/proj_a29ccd86_4cad_4895_81f1_1942f987fa0b/scenes/the_puzzle.tsx
var import_remotion8 = require("remotion");
var import_jsx_runtime8 = require("react/jsx-runtime");
var COLORS4 = {
  background: "#0F172A",
  primary: "#3B82F6",
  secondary: "#10B981",
  accent: "#F59E0B",
  white: "#ffffff",
  text: "#F8FAFC"
};
function ReservoirExpansionScene() {
  const { width, height, fps } = (0, import_remotion8.useVideoConfig)();
  const frame = (0, import_remotion8.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const expansionStart = 30;
  const expansionDuration = 60;
  const formulaShiftFrame = 90;
  const expansionProgress = (0, import_remotion8.spring)({
    frame: frame - expansionStart,
    fps,
    config: { damping: 15, stiffness: 60 }
  });
  const formulaShift = (0, import_remotion8.spring)({
    frame: frame - formulaShiftFrame,
    fps,
    config: { damping: 12, stiffness: 80 }
  });
  const speed = 8;
  const streamOffset = frame * speed % (width * 0.4);
  const reservoirWidth = width * 0.18;
  const expandedReservoirWidth = width * 0.85;
  const currentReservoirWidth = (0, import_remotion8.interpolate)(
    expansionProgress,
    [0, 1],
    [reservoirWidth, expandedReservoirWidth]
  );
  const slotWidth = (expandedReservoirWidth - minDim * 0.08) / 5;
  const showSlots = expansionProgress > 0.5;
  const denominatorValue = Math.floor((0, import_remotion8.interpolate)(frame, [0, 1500], [1e3, 5e3]));
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_remotion8.AbsoluteFill, { style: { backgroundColor: COLORS4.background, color: COLORS4.text, fontFamily: "sans-serif" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: {
      height: height * 0.15,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      paddingTop: height * 0.05
    }, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(FadeInUp, { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("h1", { style: {
      fontSize: height * 0.045,
      margin: 0,
      fontWeight: 800,
      background: `linear-gradient(to right, ${COLORS4.primary}, ${COLORS4.secondary})`,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      textAlign: "center"
    }, children: "SAMPLED SET" }) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: {
      height: height * 0.6,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      position: "relative"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: {
        marginBottom: height * 0.05,
        fontSize: height * 0.06,
        fontWeight: "bold",
        display: "flex",
        alignItems: "center",
        gap: minDim * 0.02
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { position: "relative" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: {
            opacity: 1 - formulaShift,
            position: "absolute",
            left: 0,
            color: COLORS4.accent
          }, children: "1" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: {
            opacity: formulaShift,
            color: COLORS4.accent,
            transform: `scale(${(0, import_remotion8.interpolate)(formulaShift, [0, 1], [0.5, 1])})`
          }, children: "k" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { color: COLORS4.white }, children: "/" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { color: COLORS4.white }, children: denominatorValue }),
        formulaShift > 0.8 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(BounceIn, { delay: 10, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { color: COLORS4.accent, marginLeft: minDim * 0.02 }, children: "?" }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: {
        width: currentReservoirWidth,
        height: height * 0.15,
        borderRadius: minDim * 0.02,
        border: `4px solid ${COLORS4.primary}`,
        background: "rgba(59, 130, 246, 0.1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        boxShadow: expansionProgress > 0 ? `0 0 ${20 * expansionProgress}px ${COLORS4.primary}44` : "none"
      }, children: !showSlots ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(GlowPulse, { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: {
        width: reservoirWidth * 0.7,
        height: height * 0.08,
        backgroundColor: COLORS4.secondary,
        borderRadius: minDim * 0.01,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontSize: height * 0.04,
        fontWeight: "bold"
      }, children: denominatorValue % 50 }) }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: {
        display: "flex",
        gap: minDim * 0.015,
        padding: minDim * 0.01
      }, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(PremiumStagger, { speed: "fast", children: [1, 2, 3, 4, 5].map((i) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: {
        width: slotWidth,
        height: height * 0.1,
        backgroundColor: i === 1 ? COLORS4.secondary : "rgba(255,255,255,0.05)",
        border: `2px dashed ${i === 1 ? COLORS4.secondary : "rgba(255,255,255,0.2)"}`,
        borderRadius: minDim * 0.01,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: height * 0.03,
        color: "white",
        fontWeight: "bold"
      }, children: i === 1 ? denominatorValue % 50 : "?" }, i)) }) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: {
        position: "absolute",
        bottom: height * 0.05,
        width: "100%",
        height: height * 0.08,
        display: "flex",
        gap: minDim * 0.02,
        transform: `translateX(${-streamOffset}px)`,
        opacity: 0.4
      }, children: Array.from({ length: 12 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: {
        minWidth: width * 0.15,
        height: "100%",
        backgroundColor: "rgba(255,255,255,0.1)",
        borderRadius: minDim * 0.01,
        border: "1px solid rgba(255,255,255,0.2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: height * 0.02,
        color: "rgba(255,255,255,0.5)"
      }, children: denominatorValue + i }, i)) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: {
      height: height * 0.25,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: `0 ${width * 0.1}px`,
      textAlign: "center",
      gap: minDim * 0.03
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: {
        padding: `${minDim * 0.02}px ${minDim * 0.04}px`,
        backgroundColor: "rgba(255,255,255,0.05)",
        borderRadius: minDim * 0.02,
        borderLeft: `4px solid ${COLORS4.accent}`,
        backdropFilter: "blur(10px)"
      }, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("p", { style: {
        fontSize: height * 0.028,
        lineHeight: 1.4,
        margin: 0,
        color: COLORS4.white
      }, children: [
        "The algorithm works for one winner.",
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("strong", { style: { color: COLORS4.accent, display: "block", marginTop: minDim * 0.01 }, children: "How do we modify it for FIVE winners?" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: {
        display: "flex",
        gap: minDim * 0.05,
        opacity: (0, import_remotion8.interpolate)(frame, [0, 30], [0, 1])
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { width: 12, height: 12, borderRadius: "50%", backgroundColor: COLORS4.accent } }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { fontSize: height * 0.015, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1 }, children: "Target (k)" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { width: 12, height: 12, borderRadius: "50%", backgroundColor: COLORS4.primary } }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { fontSize: height * 0.015, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1 }, children: "Reservoir" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("svg", { style: { position: "absolute", width: "100%", height: "100%", pointerEvents: "none", top: 0, left: 0 }, children: expansionProgress > 0.9 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("g", { style: { opacity: formulaShift }, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      "path",
      {
        d: `M ${width / 2 - 20} ${height * 0.3} L ${width / 2} ${height * 0.35} L ${width / 2 + 20} ${height * 0.3}`,
        fill: "none",
        stroke: COLORS4.accent,
        strokeWidth: "4",
        strokeLinecap: "round"
      }
    ) }) })
  ] });
}

// src/proj_a29ccd86_4cad_4895_81f1_1942f987fa0b/scenes/outro.tsx
var import_remotion9 = require("remotion");
var import_jsx_runtime9 = require("react/jsx-runtime");
var ReservoirSamplingOutro = () => {
  const { width, height, fps } = (0, import_remotion9.useVideoConfig)();
  const frame = (0, import_remotion9.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const slotCount = 5;
  const slotSize = width * 0.15;
  const slotGap = width * 0.02;
  const totalWidth = slotSize * slotCount + slotGap * (slotCount - 1);
  const reservoirY = height * 0.55;
  const streamSpeed = 5;
  const blockWidth = width * 0.12;
  const blockGap = width * 0.05;
  const mainScale = (0, import_remotion9.interpolate)(frame, [0, 60], [1, 0.85], { extrapolateRight: "clamp" });
  const mainTranslateY = (0, import_remotion9.interpolate)(frame, [0, 60], [0, height * 0.05], { extrapolateRight: "clamp" });
  const socialIcons = [
    { label: "Follow", color: "#3B82F6" },
    { label: "Share", color: "#10B981" },
    { label: "Comment", color: "#F59E0B" }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_remotion9.AbsoluteFill, { style: { backgroundColor: "#0F172A", fontFamily: "sans-serif" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_remotion9.AbsoluteFill, { style: { top: height * 0.1, textAlign: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(BounceIn, { delay: 20, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("h1", { style: {
      color: "white",
      fontSize: height * 0.045,
      fontWeight: "bold",
      margin: 0,
      textShadow: "0 4px 20px rgba(59, 130, 246, 0.5)"
    }, children: "RESERVOIR SAMPLING" }) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: {
      transform: `translateY(${mainTranslateY}px) scale(${mainScale})`,
      transformOrigin: "center center",
      width: "100%",
      height: "100%"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: { position: "absolute", top: reservoirY - height * 0.15, width: "100%" }, children: [...Array(8)].map((_, i) => {
        const xPos = (width + i * (blockWidth + blockGap) - frame * streamSpeed) % (width + blockWidth + blockGap);
        const itemNumber = 100 + Math.floor((frame * streamSpeed + (width - xPos)) / (blockWidth + blockGap));
        return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
          "div",
          {
            style: {
              position: "absolute",
              left: xPos,
              width: blockWidth,
              height: blockWidth,
              background: "linear-gradient(135deg, #1E293B, #334155)",
              borderRadius: minDim * 0.02,
              border: "2px solid rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,0.5)",
              fontSize: minDim * 0.03
            },
            children: [
              "#",
              itemNumber
            ]
          },
          i
        );
      }) }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: {
        position: "absolute",
        top: reservoirY,
        left: (width - totalWidth) / 2,
        display: "flex",
        gap: slotGap
      }, children: [...Array(slotCount)].map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(GlowPulse, { speed: "slow", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: {
        width: slotSize,
        height: slotSize,
        borderRadius: minDim * 0.02,
        background: "rgba(59, 130, 246, 0.15)",
        border: `3px solid #3B82F6`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 0 20px rgba(59, 130, 246, 0.3)",
        position: "relative"
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: {
          width: "60%",
          height: "60%",
          background: "linear-gradient(45deg, #3B82F6, #10B981)",
          borderRadius: "50%",
          opacity: 0.8
        } }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: {
          position: "absolute",
          top: -slotSize * 0.4,
          fontSize: slotSize * 0.25,
          color: "#10B981",
          fontWeight: "bold"
        }, children: [
          i + 1,
          "/n"
        ] })
      ] }) }, i)) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_remotion9.AbsoluteFill, { style: {
      top: height * 0.7,
      padding: `0 ${width * 0.1}px`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: minDim * 0.04
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(FadeInUp, { delay: 60, style: { width: "100%" }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: {
        background: "rgba(30, 41, 59, 0.7)",
        backdropFilter: "blur(10px)",
        borderRadius: minDim * 0.03,
        padding: minDim * 0.04,
        border: "1px solid rgba(255,255,255,0.1)",
        display: "flex",
        alignItems: "center",
        gap: minDim * 0.04,
        width: "100%"
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: {
          width: minDim * 0.12,
          height: minDim * 0.12,
          borderRadius: "50%",
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: "black",
          fontSize: minDim * 0.05,
          color: "#EF4444"
        }, children: "Z" }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: { color: "white", fontWeight: "bold", fontSize: minDim * 0.045 }, children: "Prasanna" }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: { color: "#94A3B8", fontSize: minDim * 0.035 }, children: "Technical Architect @ Zoho" })
        ] })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: {
        display: "flex",
        justifyContent: "space-between",
        width: "100%",
        marginTop: minDim * 0.02
      }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(PremiumStagger, { delay: 120, interval: 15, children: socialIcons.map((social, i) => /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: {
          width: minDim * 0.15,
          height: minDim * 0.15,
          borderRadius: "30%",
          background: `${social.color}22`,
          border: `2px solid ${social.color}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("svg", { viewBox: "0 0 24 24", width: minDim * 0.08, height: minDim * 0.08, fill: "none", stroke: social.color, strokeWidth: "2.5", children: [
          i === 0 && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("path", { d: "M12 5v14M5 12h14" }),
          i === 1 && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("path", { d: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" }),
          i === 2 && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { style: { color: "white", fontSize: minDim * 0.03, fontWeight: "500" }, children: social.label })
      ] }, i)) }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: {
      position: "absolute",
      bottom: height * 0.05,
      width: "100%",
      textAlign: "center"
    }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(FadeInUp, { delay: 200, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: {
      display: "inline-block",
      padding: `${minDim * 0.015}px ${minDim * 0.05}px`,
      borderRadius: minDim * 0.05,
      background: "linear-gradient(90deg, #F59E0B, #D97706)",
      color: "white",
      fontWeight: "bold",
      fontSize: minDim * 0.03,
      boxShadow: "0 4px 15px rgba(245, 158, 11, 0.4)"
    }, children: "Check the Pinned Solution \u2193" }) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("svg", { style: { position: "absolute", width: "100%", height: "100%", opacity: 0.3, pointerEvents: "none" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("radialGradient", { id: "grad1", cx: "50%", cy: "50%", r: "50%", children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("stop", { offset: "0%", stopColor: "#3B82F6", stopOpacity: "0.3" }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("stop", { offset: "100%", stopColor: "#0F172A", stopOpacity: "0" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("circle", { cx: "50%", cy: "60%", r: minDim * 0.6, fill: "url(#grad1)" })
    ] })
  ] });
};
var outro_default = ReservoirSamplingOutro;

// src/proj_a29ccd86_4cad_4895_81f1_1942f987fa0b/Main.tsx
var import_jsx_runtime10 = require("react/jsx-runtime");
function Main() {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_remotion10.AbsoluteFill, { style: { background: "#0F172A" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_remotion10.Sequence, { from: 0, durationInFrames: 300, name: "intro_problem", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(intro_problem_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_remotion10.Sequence, { from: 300, durationInFrames: 240, name: "constraints", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(constraints_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_remotion10.Sequence, { from: 540, durationInFrames: 270, name: "the_challenge", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(the_challenge_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_remotion10.Sequence, { from: 810, durationInFrames: 210, name: "the_solution_logic", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(the_solution_logic_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_remotion10.Sequence, { from: 1020, durationInFrames: 270, name: "the_mechanism", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(ReservoirSamplingMechanism, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_remotion10.Sequence, { from: 1290, durationInFrames: 300, name: "mathematical_proof", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(ReservoirSamplingFinalState, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_remotion10.Sequence, { from: 1590, durationInFrames: 1500, name: "the_puzzle", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(ReservoirExpansionScene, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_remotion10.Sequence, { from: 3090, durationInFrames: 420, name: "outro", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(outro_default, {}) })
  ] });
}
