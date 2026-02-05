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

// src/proj_b69c7daf_56ec_4a4a_9b0c_b49e81302941/Main.tsx
var Main_exports = {};
__export(Main_exports, {
  default: () => Main
});
module.exports = __toCommonJS(Main_exports);
var import_remotion10 = require("remotion");

// src/proj_b69c7daf_56ec_4a4a_9b0c_b49e81302941/scenes/intro_challenge.tsx
var import_react2 = require("react");
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

// src/proj_b69c7daf_56ec_4a4a_9b0c_b49e81302941/scenes/intro_challenge.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var COLORS = {
  background: "#0F172A",
  primary: "#3B82F6",
  secondary: "#10B981",
  accent: "#F59E0B",
  white: "#FFFFFF",
  text: "#E2E8F0"
};
var TaskNode = ({ x, y, size, delay, label, color }) => {
  const frame = (0, import_remotion2.useCurrentFrame)();
  const entry = (0, import_remotion2.spring)({
    frame: frame - delay,
    fps: 30,
    config: SPRING_CONFIGS.gentle
  });
  if (frame < delay) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: size * 0.2,
        transform: `scale(${entry})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 0 ${size * 0.5}px ${color}44`,
        border: `1px solid ${COLORS.white}44`
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "span",
        {
          style: {
            color: COLORS.white,
            fontSize: size * 0.4,
            fontWeight: "bold",
            fontFamily: "sans-serif"
          },
          children: label
        }
      )
    }
  );
};
function IntroChallenge() {
  const { width, height, fps } = (0, import_remotion2.useVideoConfig)();
  const frame = (0, import_remotion2.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const timelineY = height * 0.7;
  const taskCount = 40;
  const tasks = (0, import_react2.useMemo)(() => {
    return Array.from({ length: taskCount }).map((_, i) => ({
      id: i,
      x: width * 0.1 + Math.random() * (width * 0.8),
      y: timelineY - (height * 0.05 + Math.random() * height * 0.4),
      delay: 60 + i * 4,
      label: `T+${Math.floor(Math.random() * 60)}${["s", "m", "h"][Math.floor(Math.random() * 3)]}`,
      color: [COLORS.primary, COLORS.secondary, COLORS.accent][i % 3]
    }));
  }, [width, height, timelineY, taskCount]);
  const timelineWidth = (0, import_remotion2.spring)({
    frame: frame - 20,
    fps,
    config: SPRING_CONFIGS.stiff
  });
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_remotion2.AbsoluteFill, { style: { backgroundColor: COLORS.background, overflow: "hidden" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_remotion2.Sequence, { from: 0, duration: 270, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: height * 0.1,
          gap: minDim * 0.02
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(FadeInUp, { duration: 30, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "h1",
            {
              style: {
                color: COLORS.white,
                fontSize: height * 0.045,
                margin: 0,
                textAlign: "center",
                fontFamily: "system-ui, sans-serif",
                width: width * 0.9
              },
              children: "The Scheduling Challenge"
            }
          ) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(FadeInUp, { delay: 15, duration: 30, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "p",
            {
              style: {
                color: COLORS.primary,
                fontSize: height * 0.025,
                margin: 0,
                textAlign: "center",
                fontFamily: "system-ui, sans-serif",
                fontWeight: 600
              },
              children: "Managing Millions of Delayed Tasks"
            }
          ) })
        ]
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_remotion2.AbsoluteFill, { style: { pointerEvents: "none" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: width / 2 - minDim * 0.075,
            top: height * 0.4,
            width: minDim * 0.15,
            height: minDim * 0.15
          },
          children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ZoomIn, { delay: 30, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(GlowPulse, { color: COLORS.secondary, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "div",
            {
              style: {
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${COLORS.secondary}, #065f46)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `${minDim * 5e-3}px solid ${COLORS.white}33`
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                "svg",
                {
                  viewBox: "0 0 24 24",
                  width: minDim * 0.08,
                  height: minDim * 0.08,
                  fill: "none",
                  stroke: "white",
                  strokeWidth: "2",
                  children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M13 2L3 14h9l-1 8 10-12h-9l1-8z" })
                }
              )
            }
          ) }) })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: width * 0.05,
            top: timelineY,
            width: width * 0.9 * timelineWidth,
            height: height * 5e-3,
            background: `linear-gradient(to right, ${COLORS.primary}, ${COLORS.accent})`,
            borderRadius: 10
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
        "div",
        {
          style: {
            position: "absolute",
            left: width * 0.05,
            top: timelineY + height * 0.02,
            width: width * 0.9,
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "monospace",
            color: COLORS.text,
            fontSize: height * 0.015,
            opacity: timelineWidth
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "NOW" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "+1 MIN" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "+1 HOUR" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "+1 DAY" })
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(PremiumStagger, { delayOffset: 60, interval: 2, children: tasks.map((task) => {
        const dropProgress = (0, import_remotion2.spring)({
          frame: frame - task.delay,
          fps,
          config: { damping: 10, stiffness: 60 }
        });
        const currentY = (0, import_remotion2.interpolate)(dropProgress, [0, 1], [task.y, timelineY - height * 0.02]);
        return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          TaskNode,
          {
            x: task.x,
            y: currentY,
            size: minDim * 0.06,
            delay: task.delay,
            label: task.label,
            color: task.color
          },
          task.id
        );
      }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_remotion2.Sequence, { from: 180, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: height * 0.1,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: height * 0.02
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(FadeIn, { duration: 45, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "div",
            {
              style: {
                backgroundColor: "rgba(255,255,255,0.05)",
                padding: `${height * 0.02}px ${height * 0.04}px`,
                borderRadius: minDim * 0.02,
                backdropFilter: "blur(10px)",
                border: `1px solid ${COLORS.white}22`
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                "span",
                {
                  style: {
                    color: COLORS.white,
                    fontFamily: "system-ui, sans-serif",
                    fontSize: height * 0.022,
                    textAlign: "center"
                  },
                  children: [
                    "Scale: ",
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: COLORS.accent }, children: "10^6+" }),
                    " Concurrent Events"
                  ]
                }
              )
            }
          ) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: minDim * 0.04 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(BounceIn, { delay: 30, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { width: 12, height: 12, borderRadius: "50%", background: COLORS.primary } }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: COLORS.text, fontSize: height * 0.015 }, children: "Cache Keys" })
            ] }) }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(BounceIn, { delay: 45, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { width: 12, height: 12, borderRadius: "50%", background: COLORS.secondary } }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: COLORS.text, fontSize: height * 0.015 }, children: "Retry Logic" })
            ] }) })
          ] })
        ]
      }
    ) })
  ] });
}

// src/proj_b69c7daf_56ec_4a4a_9b0c_b49e81302941/scenes/heap_sorting.tsx
var import_react3 = require("react");
var import_remotion3 = require("remotion");
var import_jsx_runtime3 = require("react/jsx-runtime");
var COLORS2 = {
  background: "#0F172A",
  primary: "#3B82F6",
  secondary: "#10B981",
  accent: "#F59E0B",
  white: "#FFFFFF"
};
function HeapSortingScene() {
  const { width, height, fps } = (0, import_remotion3.useVideoConfig)();
  const frame = (0, import_remotion3.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const tasks = (0, import_react3.useMemo)(() => {
    return Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      time: Math.floor(Math.random() * 60),
      initialX: width / 16 * (i + 1),
      color: i === 0 ? COLORS2.accent : i % 2 === 0 ? COLORS2.primary : COLORS2.secondary
    }));
  }, [width]);
  const getTreeNodePos = (index) => {
    const level = Math.floor(Math.log2(index + 1));
    const itemsInLevel = Math.pow(2, level);
    const indexInLevel = index - (Math.pow(2, level) - 1);
    const yBase = height * 0.25;
    const verticalSpacing = height * 0.12;
    const xCenter = width / 2;
    const levelWidth = width * 0.8 * (1 / Math.pow(1.5, level));
    const xPart = levelWidth / (itemsInLevel + 1);
    return {
      x: xCenter - levelWidth / 2 + xPart * (indexInLevel + 1),
      y: yBase + level * verticalSpacing
    };
  };
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_remotion3.AbsoluteFill, { style: { backgroundColor: COLORS2.background }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(FadeInDown, { frame, delay: 10, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
      paddingTop: height * 0.05,
      textAlign: "center",
      width: "100%"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("h1", { style: {
        color: COLORS2.white,
        fontSize: height * 0.045,
        fontFamily: "sans-serif",
        fontWeight: 800,
        margin: 0
      }, children: [
        "Priority Queue: ",
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { color: COLORS2.accent }, children: "Binary Heap" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { style: {
        color: COLORS2.primary,
        fontSize: height * 0.025,
        fontFamily: "monospace",
        marginTop: height * 0.01
      }, children: "Time Complexity: O(log n) per insertion" })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
      position: "absolute",
      bottom: height * 0.15,
      width: "100%",
      height: height * 5e-3,
      background: COLORS2.white,
      opacity: (0, import_remotion3.interpolate)(frame, [60, 90], [0.3, 0], { extrapolateRight: "clamp" }),
      left: 0
    } }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { style: { position: "absolute", width: "100%", height: "100%", pointerEvents: "none" }, children: tasks.slice(0, 15).map((_, i) => {
      if (i === 0) return null;
      const parentIndex = Math.floor((i - 1) / 2);
      const start = getTreeNodePos(parentIndex);
      const end = getTreeNodePos(i);
      const lineProgress = (0, import_remotion3.spring)({
        frame: frame - (80 + i * 5),
        fps,
        config: { damping: 15 }
      });
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "line",
        {
          x1: start.x,
          y1: start.y,
          x2: (0, import_remotion3.interpolate)(lineProgress, [0, 1], [start.x, end.x]),
          y2: (0, import_remotion3.interpolate)(lineProgress, [0, 1], [start.y, end.y]),
          stroke: COLORS2.primary,
          strokeWidth: height * 3e-3,
          strokeOpacity: (0, import_remotion3.interpolate)(lineProgress, [0, 1], [0, 0.4])
        },
        `edge-${i}`
      );
    }) }),
    tasks.map((task, i) => {
      const flyProgress = (0, import_remotion3.spring)({
        frame: frame - (60 + i * 4),
        fps,
        config: { damping: 12, stiffness: 60 }
      });
      const treePos = getTreeNodePos(i);
      const currentX = (0, import_remotion3.interpolate)(flyProgress, [0, 1], [task.initialX, treePos.x]);
      const currentY = (0, import_remotion3.interpolate)(flyProgress, [0, 1], [height * 0.85, treePos.y]);
      const nodeSize = minDim * 0.08;
      let offsetX = 0;
      let offsetY = 0;
      if (frame > 200 && frame < 350) {
        const swapTime = (frame - 200) % 40;
        if (i === 1 || i === 0 || i === 3) {
          offsetX = Math.sin(frame * 0.2) * (minDim * 0.015);
          offsetY = Math.cos(frame * 0.2) * (minDim * 0.015);
        }
      }
      const isRoot = i === 0;
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
        "div",
        {
          style: {
            position: "absolute",
            left: currentX + offsetX - nodeSize / 2,
            top: currentY + offsetY - nodeSize / 2,
            width: nodeSize,
            height: nodeSize,
            borderRadius: "50%",
            background: flyProgress > 0.8 && isRoot ? COLORS2.accent : task.color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: isRoot ? `0 0 ${minDim * 0.05}px ${COLORS2.accent}66` : "0 4px 12px rgba(0,0,0,0.3)",
            border: `${minDim * 5e-3}px solid ${COLORS2.white}`,
            zIndex: 10
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: {
              color: COLORS2.white,
              fontSize: nodeSize * 0.4,
              fontWeight: "bold",
              fontFamily: "monospace"
            }, children: isRoot ? "T+1" : `T+${task.time}` }),
            isRoot && frame > 120 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { position: "absolute", width: "100%", height: "100%" }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(GlowPulse, { color: COLORS2.accent }) })
          ]
        },
        task.id
      );
    }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
      position: "absolute",
      bottom: height * 0.08,
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: height * 0.02
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(FadeIn, { frame, delay: 220, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
        backgroundColor: "rgba(255,255,255,0.05)",
        padding: `${height * 0.02}px ${width * 0.05}px`,
        borderRadius: minDim * 0.02,
        border: `1px solid ${COLORS2.primary}44`,
        backdropFilter: "blur(10px)",
        maxWidth: "80%"
      }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("p", { style: {
        color: COLORS2.white,
        fontSize: height * 0.024,
        textAlign: "center",
        margin: 0,
        fontFamily: "sans-serif",
        lineHeight: 1.4
      }, children: [
        "Sorting requires ",
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { color: COLORS2.accent, fontWeight: "bold" }, children: "re-balancing" }),
        " the tree every time a task is added."
      ] }) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Sequence, { from: 320, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(BounceIn, { children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
        color: COLORS2.secondary,
        fontSize: height * 0.028,
        fontWeight: "bold",
        fontFamily: "monospace"
      }, children: "LOGARITHMIC OVERHEAD" }) }) })
    ] })
  ] });
}
function FadeInDown({ children, frame, delay = 0 }) {
  const opacity = (0, import_remotion3.interpolate)(frame - delay, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const translateY = (0, import_remotion3.interpolate)(frame - delay, [0, 20], [-20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { opacity, transform: `translateY(${translateY}px)` }, children });
}

// src/proj_b69c7daf_56ec_4a4a_9b0c_b49e81302941/scenes/heap_bottleneck.tsx
var import_remotion4 = require("remotion");
var import_jsx_runtime4 = require("react/jsx-runtime");
var COLORS3 = {
  background: "#0F172A",
  primary: "#3B82F6",
  secondary: "#10B981",
  accent: "#F59E0B",
  danger: "#EF4444",
  white: "#FFFFFF"
};
var TREE_NODES = [
  { id: 0, level: 0, pos: 0 },
  // Root
  { id: 1, level: 1, pos: -1 },
  { id: 2, level: 1, pos: 1 },
  // L1
  { id: 3, level: 2, pos: -1.5 },
  { id: 4, level: 2, pos: -0.5 },
  { id: 5, level: 2, pos: 0.5 },
  { id: 6, level: 2, pos: 1.5 }
  // L2
];
var TREE_CONNECTIONS = [
  [0, 1],
  [0, 2],
  [1, 3],
  [1, 4],
  [2, 5],
  [2, 6]
];
function HeapBottleneck() {
  const { width, height, fps } = (0, import_remotion4.useVideoConfig)();
  const frame = (0, import_remotion4.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const congestionStart = 30;
  const redPhaseStart = 120;
  const chaosPeakStart = 240;
  const congestion = (0, import_remotion4.interpolate)(frame, [congestionStart, 200], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const jitterIntensity = (0, import_remotion4.interpolate)(frame, [congestionStart, chaosPeakStart], [0, 1], {
    extrapolateLeft: "clamp"
  });
  const getJitter = (amplitude) => {
    if (frame < congestionStart) return 0;
    return Math.sin(frame * 0.8) * Math.cos(frame * 1.3) * amplitude * jitterIntensity;
  };
  const nodeSize = minDim * 0.08;
  const levelSpacing = height * 0.15;
  const horizontalSpacing = width * 0.2;
  const treeTop = height * 0.25;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_remotion4.AbsoluteFill, { style: { backgroundColor: COLORS3.background }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_remotion4.AbsoluteFill, { style: { height: height * 0.15, top: height * 0.05, textAlign: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BounceIn, { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
      color: COLORS3.white,
      fontSize: height * 0.045,
      fontWeight: 800,
      textShadow: "0 4px 10px rgba(0,0,0,0.5)"
    }, children: "HEAP OVERHEAD BOTTLE NECK" }) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_remotion4.AbsoluteFill, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("svg", { style: { position: "absolute", width: "100%", height: "100%", overflow: "visible" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("filter", { id: "glow", x: "-20%", y: "-20%", width: "140%", height: "140%", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("feGaussianBlur", { stdDeviation: "5", result: "blur" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("feComposite", { in: "SourceGraphic", in2: "blur", operator: "over" })
        ] }) }),
        TREE_CONNECTIONS.map(([parentIdx, childIdx]) => {
          const p = TREE_NODES[parentIdx];
          const c = TREE_NODES[childIdx];
          const x1 = width / 2 + p.pos * horizontalSpacing + getJitter(5);
          const y1 = treeTop + p.level * levelSpacing + getJitter(5);
          const x2 = width / 2 + c.pos * horizontalSpacing + getJitter(5);
          const y2 = treeTop + c.level * levelSpacing + getJitter(5);
          const lineColor = (0, import_remotion4.interpolate)(
            frame,
            [redPhaseStart, 250],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "line",
            {
              x1,
              y1,
              x2,
              y2,
              stroke: lineColor > 0.5 ? COLORS3.danger : COLORS3.primary,
              strokeWidth: minDim * 8e-3,
              strokeOpacity: 0.6
            },
            `line-${parentIdx}-${childIdx}`
          );
        })
      ] }),
      TREE_NODES.map((node) => {
        const x = width / 2 + node.pos * horizontalSpacing + getJitter(12);
        const y = treeTop + node.level * levelSpacing + getJitter(12);
        const redFactor = (0, import_remotion4.interpolate)(
          frame,
          [redPhaseStart + node.id * 10, redPhaseStart + 60 + node.id * 10],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        const nodeColor = redFactor > 0.5 ? COLORS3.danger : COLORS3.primary;
        return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: x - nodeSize / 2,
              top: y - nodeSize / 2,
              width: nodeSize,
              height: nodeSize,
              borderRadius: "50%",
              background: nodeColor,
              border: `${minDim * 5e-3}px solid ${COLORS3.white}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: redFactor > 0.5 ? `0 0 ${20 * redFactor}px ${COLORS3.danger}` : "0 4px 15px rgba(0,0,0,0.3)",
              transition: "background-color 0.2s ease"
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
              width: nodeSize * 0.4,
              height: nodeSize * 0.4,
              background: COLORS3.white,
              opacity: 0.3,
              borderRadius: "2px",
              transform: `rotate(${frame * 5}deg)`
            } })
          },
          `node-${node.id}`
        );
      }),
      congestion > 0.5 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
        position: "absolute",
        top: treeTop + levelSpacing * 0.5,
        left: width * 0.2,
        right: width * 0.2,
        height: levelSpacing * 2,
        background: `radial-gradient(circle, ${COLORS3.danger}22 0%, transparent 70%)`,
        filter: "blur(20px)",
        opacity: (0, import_remotion4.interpolate)(frame, [200, 250], [0, 0.4], { extrapolateLeft: "clamp" })
      } })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_remotion4.AbsoluteFill, { style: { top: height * 0.75, height: height * 0.2, display: "flex", flexDirection: "column", alignItems: "center", gap: minDim * 0.02 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(FadeInUp, { delay: 60, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
        fontSize: height * 0.08,
        fontWeight: 900,
        color: COLORS3.danger,
        fontFamily: "monospace",
        backgroundColor: "rgba(0,0,0,0.4)",
        padding: `${height * 0.01}px ${width * 0.05}px`,
        borderRadius: minDim * 0.02,
        border: `${minDim * 5e-3}px solid ${COLORS3.danger}`,
        boxShadow: `0 0 40px ${COLORS3.danger}44`
      }, children: "O(log N)" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(GlowPulse, { speed: "fast", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
        fontSize: height * 0.025,
        color: COLORS3.white,
        fontWeight: 500,
        opacity: (0, import_remotion4.interpolate)(frame, [100, 130], [0, 1], { extrapolateLeft: "clamp" }),
        textAlign: "center",
        maxWidth: "80%"
      }, children: frame > 200 ? "MASSIVE REBALANCING OVERHEAD AT SCALE" : "SEARCH & SWAP OPERATIONS GROW WITH N" }) })
    ] }),
    Array.from({ length: 12 }).map((_, i) => {
      const tDelay = i * 20;
      const progress = (0, import_remotion4.interpolate)((frame - tDelay) % 60, [0, 60], [0, 1]);
      const startX = i * 0.15 * width % width;
      const currentY = (0, import_remotion4.interpolate)(progress, [0, 1], [-100, treeTop]);
      const opacity = (0, import_remotion4.interpolate)(progress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);
      if (frame < tDelay) return null;
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: startX,
            top: currentY,
            width: minDim * 0.03,
            height: minDim * 0.03,
            backgroundColor: COLORS3.accent,
            borderRadius: "2px",
            opacity,
            boxShadow: `0 0 10px ${COLORS3.accent}`,
            transform: `scale(${1 + jitterIntensity * 0.5})`
          }
        },
        `task-${i}`
      );
    }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
      position: "absolute",
      inset: 0,
      backgroundColor: COLORS3.danger,
      opacity: (0, import_remotion4.interpolate)(
        frame,
        [chaosPeakStart, chaosPeakStart + 5, chaosPeakStart + 10, chaosPeakStart + 15],
        [0, 0.1, 0, 0.05],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      ),
      pointerEvents: "none"
    } })
  ] });
}

// src/proj_b69c7daf_56ec_4a4a_9b0c_b49e81302941/scenes/timing_wheel_intro.tsx
var import_remotion5 = require("remotion");
var import_jsx_runtime5 = require("react/jsx-runtime");
var COLORS4 = {
  background: "#0F172A",
  primary: "#3B82F6",
  secondary: "#10B981",
  accent: "#F59E0B",
  error: "#ef4444",
  text: "#ffffff"
};
var TreeToCircle = () => {
  const { width, height, fps } = (0, import_remotion5.useVideoConfig)();
  const frame = (0, import_remotion5.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const startMorphFrame = 45;
  const morphDuration = 90;
  const pointerAppearFrame = 150;
  const nodes = [
    { id: 0, level: 0, x: 0.5, y: 0.3 },
    { id: 1, level: 1, x: 0.3, y: 0.45 },
    { id: 2, level: 1, x: 0.7, y: 0.45 },
    { id: 3, level: 2, x: 0.2, y: 0.6 },
    { id: 4, level: 2, x: 0.4, y: 0.6 },
    { id: 5, level: 2, x: 0.6, y: 0.6 },
    { id: 6, level: 2, x: 0.8, y: 0.6 }
  ];
  const morphProgress = (0, import_remotion5.spring)({
    frame: frame - startMorphFrame,
    fps,
    config: SPRING_CONFIGS.slow
  });
  const circleRadius = minDim * 0.35;
  const centerX = width / 2;
  const centerY = height * 0.5;
  const logNLabelOpacity = (0, import_remotion5.interpolate)(
    frame,
    [startMorphFrame, startMorphFrame + 20],
    [1, 0]
  );
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_remotion5.AbsoluteFill, { style: { backgroundColor: COLORS4.background }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.05,
          width: "100%",
          textAlign: "center"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_remotion5.Sequence, { from: 0, duration: startMorphFrame + 30, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "div",
            {
              style: {
                color: COLORS4.error,
                fontSize: minDim * 0.06,
                fontWeight: "bold",
                opacity: logNLabelOpacity
              },
              children: "O(log N) CONGESTION"
            }
          ) }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_remotion5.Sequence, { from: startMorphFrame + 30, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(BounceIn, { delay: 0, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "div",
            {
              style: {
                color: COLORS4.secondary,
                fontSize: minDim * 0.07,
                fontWeight: "800",
                textShadow: `0 0 ${minDim * 0.02}px rgba(16, 185, 129, 0.4)`
              },
              children: "O(1) TIMING WHEEL"
            }
          ) }) })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_remotion5.AbsoluteFill, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
        "svg",
        {
          style: {
            position: "absolute",
            width: "100%",
            height: "100%",
            overflow: "visible"
          },
          children: [
            morphProgress < 0.9 && [
              [0, 1],
              [0, 2],
              [1, 3],
              [1, 4],
              [2, 5],
              [2, 6]
            ].map(([p, c], i) => {
              const parent = nodes[p];
              const child = nodes[c];
              const lineOpacity = (0, import_remotion5.interpolate)(morphProgress, [0, 0.5], [0.6, 0]);
              return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                "line",
                {
                  x1: parent.x * width,
                  y1: parent.y * height,
                  x2: child.x * width,
                  y2: child.y * height,
                  stroke: COLORS4.error,
                  strokeWidth: minDim * 0.01,
                  opacity: lineOpacity
                },
                `edge-${i}`
              );
            }),
            Array.from({ length: 60 }).map((_, i) => {
              const angle = i / 60 * Math.PI * 2 - Math.PI / 2;
              const x = centerX + Math.cos(angle) * circleRadius;
              const y = centerY + Math.sin(angle) * circleRadius;
              const segmentScale = (0, import_remotion5.spring)({
                frame: frame - (startMorphFrame + i * 1.5),
                fps,
                config: SPRING_CONFIGS.playful
              });
              const segmentOpacity = (0, import_remotion5.interpolate)(
                frame,
                [startMorphFrame + i, startMorphFrame + i + 20],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
              );
              if (frame < startMorphFrame + i) return null;
              return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                "rect",
                {
                  x: x - minDim * 0.015 / 2,
                  y: y - minDim * 0.04 / 2,
                  width: minDim * 0.015,
                  height: minDim * 0.04,
                  rx: minDim * 5e-3,
                  fill: COLORS4.primary,
                  transform: `rotate(${angle * 180 / Math.PI + 90}, ${x}, ${y})`,
                  opacity: segmentOpacity,
                  style: { transform: `scale(${segmentScale})` }
                },
                `slot-${i}`
              );
            }),
            frame > pointerAppearFrame && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("g", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                "line",
                {
                  x1: centerX,
                  y1: centerY,
                  x2: centerX,
                  y2: centerY - circleRadius * 0.8,
                  stroke: COLORS4.accent,
                  strokeWidth: minDim * 0.015,
                  strokeLinecap: "round",
                  transform: `rotate(${(frame - pointerAppearFrame) * 2}, ${centerX}, ${centerY})`
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("circle", { cx: centerX, cy: centerY, r: minDim * 0.02, fill: COLORS4.accent })
            ] })
          ]
        }
      ),
      nodes.map((node, i) => {
        const angle = i / nodes.length * Math.PI * 2 - Math.PI / 2;
        const targetX = centerX + Math.cos(angle) * circleRadius;
        const targetY = centerY + Math.sin(angle) * circleRadius;
        const currentX = (0, import_remotion5.interpolate)(
          morphProgress,
          [0, 1],
          [node.x * width, targetX]
        );
        const currentY = (0, import_remotion5.interpolate)(
          morphProgress,
          [0, 1],
          [node.y * height, targetY]
        );
        const nodeColor = (0, import_remotion5.interpolate)(
          morphProgress,
          [0, 0.8],
          [0, 1]
        ) > 0.5 ? COLORS4.secondary : COLORS4.error;
        const glow = (0, import_remotion5.interpolate)(
          Math.sin(frame * 0.2),
          [-1, 1],
          [10, 25]
        );
        return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: currentX - minDim * 0.025,
              top: currentY - minDim * 0.025,
              width: minDim * 0.05,
              height: minDim * 0.05,
              borderRadius: "50%",
              background: nodeColor,
              boxShadow: `0 0 ${glow}px ${nodeColor}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
              opacity: (0, import_remotion5.interpolate)(morphProgress, [0.8, 1], [1, 0])
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { color: "white", fontWeight: "bold", fontSize: minDim * 0.02 }, children: i })
          },
          `node-${i}`
        );
      })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: height * 0.1,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          padding: `0 ${width * 0.1}px`
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(PremiumStagger, { speed: "fast", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(FadeIn, { delay: 0, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              background: "rgba(255, 255, 255, 0.05)",
              backdropFilter: "blur(10px)",
              padding: minDim * 0.04,
              borderRadius: minDim * 0.02,
              border: "1px solid rgba(255, 255, 255, 0.1)",
              width: width * 0.8
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "span",
              {
                style: {
                  color: COLORS4.text,
                  fontSize: minDim * 0.035,
                  lineHeight: 1.4,
                  textAlign: "center",
                  display: "block"
                },
                children: frame < 100 ? "Heap operations scale with O(log N). At high loads, costs spike." : "A Timing Wheel uses fixed slots. Access is O(1) regardless of load."
              }
            )
          }
        ) }) })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_remotion5.Sequence, { from: 200, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(GlowPulse, { children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: centerX - minDim * 0.4,
          top: centerY - minDim * 0.4,
          width: minDim * 0.8,
          height: minDim * 0.8,
          borderRadius: "50%",
          border: `2px solid ${COLORS4.secondary}22`,
          pointerEvents: "none"
        }
      }
    ) }) })
  ] });
};
var timing_wheel_intro_default = TreeToCircle;

// src/proj_b69c7daf_56ec_4a4a_9b0c_b49e81302941/scenes/direct_insertion.tsx
var import_remotion6 = require("remotion");
var import_jsx_runtime6 = require("react/jsx-runtime");
var TimingWheelScene = () => {
  const { width, height, fps } = (0, import_remotion6.useVideoConfig)();
  const frame = (0, import_remotion6.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const centerX = width / 2;
  const centerY = height * 0.45;
  const wheelRadius = minDim * 0.35;
  const numBuckets = 12;
  const taskSize = minDim * 0.08;
  const colors = {
    background: "#0F172A",
    primary: "#3B82F6",
    secondary: "#10B981",
    accent: "#F59E0B",
    white: "#FFFFFF"
  };
  const rotation = (0, import_remotion6.interpolate)(frame, [0, 240], [0, 360]);
  const taskFlyProgress = (0, import_remotion6.spring)({
    frame: frame - 30,
    fps,
    config: SPRING_CONFIGS.gentle
  });
  const targetBucketIndex = 5;
  const angleRad = (targetBucketIndex * (360 / numBuckets) - 90) * (Math.PI / 180);
  const bucketX = centerX + Math.cos(angleRad) * wheelRadius;
  const bucketY = centerY + Math.sin(angleRad) * wheelRadius;
  const taskX = (0, import_remotion6.interpolate)(taskFlyProgress, [0, 1], [width * 0.8, bucketX]);
  const taskY = (0, import_remotion6.interpolate)(taskFlyProgress, [0, 1], [height * 0.2, bucketY]);
  const taskScale = (0, import_remotion6.interpolate)(taskFlyProgress, [0, 1], [0.5, 1]);
  const isPointerAtBucket = frame > 95 && frame < 115;
  const bucketHighlight = (0, import_remotion6.spring)({
    frame: frame - 95,
    fps,
    config: SPRING_CONFIGS.stiff
  });
  const executeProgress = (0, import_remotion6.spring)({
    frame: frame - 110,
    fps,
    config: SPRING_CONFIGS.wobbly
  });
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_remotion6.AbsoluteFill, { style: { backgroundColor: colors.background }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_remotion6.Sequence, { from: 0, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: {
      position: "absolute",
      top: height * 0.05,
      width: "100%",
      textAlign: "center",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: minDim * 0.02
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(BounceIn, { delay: 10, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h1", { style: {
        fontSize: height * 0.045,
        color: colors.white,
        margin: 0,
        fontWeight: 800,
        textShadow: `0 0 20px ${colors.primary}55`
      }, children: "DIRECT INDEXING" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(FadeIn, { delay: 40, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
        background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})`,
        padding: `${minDim * 0.01}px ${minDim * 0.04}px`,
        borderRadius: minDim * 0.01,
        color: colors.white,
        fontSize: height * 0.025,
        fontWeight: 600
      }, children: "O(1) COMPLEXITY" }) })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { position: "absolute", width: "100%", height: "100%" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("svg", { style: { position: "absolute", width: "100%", height: "100%" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "circle",
          {
            cx: centerX,
            cy: centerY,
            r: wheelRadius,
            fill: "none",
            stroke: `${colors.primary}33`,
            strokeWidth: minDim * 0.06
          }
        ),
        Array.from({ length: numBuckets }).map((_, i) => {
          const angle = (i * (360 / numBuckets) - 90) * (Math.PI / 180);
          const x = centerX + Math.cos(angle) * wheelRadius;
          const y = centerY + Math.sin(angle) * wheelRadius;
          const isTarget = i === targetBucketIndex;
          return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("g", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              "circle",
              {
                cx: x,
                cy: y,
                r: minDim * 0.04,
                fill: isTarget && isPointerAtBucket ? colors.primary : colors.background,
                stroke: isTarget ? colors.accent : colors.primary,
                strokeWidth: 3,
                style: {
                  filter: isTarget && isPointerAtBucket ? `drop-shadow(0 0 15px ${colors.accent})` : "none"
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
              "text",
              {
                x,
                y: y + 5,
                textAnchor: "middle",
                fill: colors.white,
                fontSize: minDim * 0.025,
                fontWeight: "bold",
                style: { pointerEvents: "none" },
                children: [
                  i,
                  "s"
                ]
              }
            )
          ] }, i);
        }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "line",
          {
            x1: centerX,
            y1: centerY,
            x2: centerX + Math.cos((rotation - 90) * (Math.PI / 180)) * (wheelRadius - 20),
            y2: centerY + Math.sin((rotation - 90) * (Math.PI / 180)) * (wheelRadius - 20),
            stroke: colors.accent,
            strokeWidth: 6,
            strokeLinecap: "round"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("circle", { cx: centerX, cy: centerY, r: 8, fill: colors.accent })
      ] }),
      frame >= 30 && frame < 125 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
        position: "absolute",
        left: taskX - taskSize / 2,
        top: taskY - taskSize / 2,
        width: taskSize,
        height: taskSize,
        background: `linear-gradient(135deg, ${colors.accent}, #ea580c)`,
        borderRadius: minDim * 0.015,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 10px 20px rgba(0,0,0,0.3)`,
        transform: `scale(${taskScale}) rotate(${taskFlyProgress * 360}deg)`,
        border: `2px solid ${colors.white}`,
        zIndex: 10
      }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { color: "white", fontWeight: "bold", fontSize: taskSize * 0.4 }, children: "5s" }) }),
      frame >= 110 && frame < 150 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
        position: "absolute",
        left: bucketX,
        top: bucketY,
        transform: "translate(-50%, -50%)"
      }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Tada, { children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
        width: minDim * 0.2,
        height: minDim * 0.2,
        borderRadius: "50%",
        border: `4px solid ${colors.secondary}`,
        opacity: 1 - executeProgress
      } }) }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_remotion6.AbsoluteFill, { style: { top: height * 0.75, height: height * 0.25, justifyContent: "center", alignItems: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(PremiumStagger, { delayPerItem: 30, startDelay: 100, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { width: width * 0.8 }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
        background: "rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(10px)",
        border: `1px solid ${colors.primary}44`,
        padding: minDim * 0.03,
        borderRadius: minDim * 0.02,
        textAlign: "center"
      }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("p", { style: {
        color: colors.white,
        fontSize: height * 0.028,
        margin: 0,
        lineHeight: 1.4
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { color: colors.accent, fontWeight: 800 }, children: "No Sorting Required:" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("br", {}),
        "Task maps directly to ",
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { color: colors.secondary }, children: "Index [5]" })
      ] }) }) }, "label1"),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { marginTop: minDim * 0.03 }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(GlowPulse, { children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
        color: colors.secondary,
        fontWeight: 900,
        fontSize: height * 0.04,
        fontFamily: "monospace"
      }, children: frame > 60 ? "array[5].push(task)" : "" }) }) }, "label2")
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
      position: "absolute",
      width: "100%",
      height: "100%",
      opacity: 0.1,
      pointerEvents: "none",
      background: `radial-gradient(circle at ${centerX}px ${centerY}px, ${colors.primary}, transparent)`
    } })
  ] });
};
var direct_insertion_default = TimingWheelScene;

// src/proj_b69c7daf_56ec_4a4a_9b0c_b49e81302941/scenes/hierarchy_expansion.tsx
var import_react4 = require("react");
var import_remotion7 = require("remotion");
var import_jsx_runtime7 = require("react/jsx-runtime");
var COLORS5 = {
  background: "#0F172A",
  inner: "#3B82F6",
  // Blue
  middle: "#10B981",
  // Emerald
  outer: "#F59E0B",
  // Amber
  text: "#FFFFFF",
  task: "#F472B6"
};
function HierarchyExpansion() {
  const { width, height, fps } = (0, import_remotion7.useVideoConfig)();
  const frame = (0, import_remotion7.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const zoomStart = 30;
  const middleWheelStart = 60;
  const outerWheelStart = 150;
  const taskDriftStart = 240;
  const zoom = (0, import_remotion7.spring)({
    frame: frame - zoomStart,
    fps,
    config: { damping: 20, stiffness: 60 }
  });
  const cameraScale = (0, import_remotion7.interpolate)(zoom, [0, 1], [1.2, 0.45]);
  const containerTranslateY = (0, import_remotion7.interpolate)(zoom, [0, 1], [0, -height * 0.05]);
  const middleReveal = (0, import_remotion7.spring)({
    frame: frame - middleWheelStart,
    fps,
    config: { damping: 15, stiffness: 100 }
  });
  const outerReveal = (0, import_remotion7.spring)({
    frame: frame - outerWheelStart,
    fps,
    config: { damping: 15, stiffness: 100 }
  });
  const rotationInner = frame * 1.5 % 360;
  const rotationMiddle = frame * 0.25 % 360;
  const rotationOuter = frame * 0.05 % 360;
  const innerRadius = minDim * 0.35;
  const middleRadius = minDim * 0.65;
  const outerRadius = minDim * 0.95;
  const wheelThickness = minDim * 0.08;
  const tasks = (0, import_react4.useMemo)(() => [
    { id: 1, angle: 45, wheel: "inner" },
    { id: 2, angle: 180, wheel: "middle" },
    { id: 3, angle: 290, wheel: "outer" },
    { id: 4, angle: 10, wheel: "outer" }
  ], []);
  const renderWheel = (radius, color, opacity, segments) => {
    return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("g", { opacity, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "circle",
        {
          cx: width / 2,
          cy: height / 2,
          r: radius,
          fill: "none",
          stroke: color,
          strokeWidth: wheelThickness,
          strokeOpacity: 0.15
        }
      ),
      Array.from({ length: segments }).map((_, i) => {
        const angle = i * 360 / segments;
        const x2 = width / 2 + (radius + wheelThickness / 2) * Math.cos(angle * Math.PI / 180);
        const y2 = height / 2 + (radius + wheelThickness / 2) * Math.sin(angle * Math.PI / 180);
        const x1 = width / 2 + (radius - wheelThickness / 2) * Math.cos(angle * Math.PI / 180);
        const y1 = height / 2 + (radius - wheelThickness / 2) * Math.sin(angle * Math.PI / 180);
        return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "line",
          {
            x1,
            y1,
            x2,
            y2,
            stroke: color,
            strokeWidth: 2,
            strokeOpacity: 0.4
          },
          i
        );
      })
    ] });
  };
  const renderHand = (radius, rotation, color) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("g", { transform: `rotate(${rotation}, ${width / 2}, ${height / 2})`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "line",
      {
        x1: width / 2,
        y1: height / 2,
        x2: width / 2,
        y2: height / 2 - radius,
        stroke: color,
        strokeWidth: 4,
        strokeLinecap: "round"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "circle",
      {
        cx: width / 2,
        cy: height / 2 - radius,
        r: minDim * 0.015,
        fill: color
      }
    )
  ] });
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_remotion7.AbsoluteFill, { style: { backgroundColor: COLORS5.background }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: {
      position: "absolute",
      top: height * 0.05,
      width: "100%",
      textAlign: "center",
      zIndex: 10,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: minDim * 0.02
    }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(FadeIn, { delay: 10, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("h1", { style: {
      color: COLORS5.text,
      fontSize: height * 0.045,
      fontWeight: 800,
      margin: 0,
      textShadow: "0 0 20px rgba(59, 130, 246, 0.5)"
    }, children: "Hierarchical Timing Wheels" }) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: {
      flex: 1,
      transform: `translateY(${containerTranslateY}px) scale(${cameraScale})`,
      transformOrigin: "center center",
      position: "relative"
    }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("svg", { width, height, viewBox: `0 0 ${width} ${height}`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("radialGradient", { id: "innerGlow", cx: "50%", cy: "50%", r: "50%", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("stop", { offset: "0%", stopColor: COLORS5.inner, stopOpacity: "0.2" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("stop", { offset: "100%", stopColor: COLORS5.inner, stopOpacity: "0" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("circle", { cx: width / 2, cy: height / 2, r: innerRadius * 1.5, fill: "url(#innerGlow)" }),
      renderWheel(innerRadius, COLORS5.inner, 1, 60),
      renderWheel(middleRadius, COLORS5.middle, middleReveal, 60),
      renderWheel(outerRadius, COLORS5.outer, outerReveal, 60),
      renderHand(innerRadius, rotationInner, COLORS5.inner),
      middleReveal > 0 && renderHand(middleRadius, rotationMiddle, COLORS5.middle),
      outerReveal > 0 && renderHand(outerRadius, rotationOuter, COLORS5.outer),
      tasks.map((task) => {
        let radius = innerRadius;
        let opacity = 1;
        let color = COLORS5.inner;
        if (task.wheel === "middle") {
          radius = middleRadius;
          opacity = middleReveal;
          color = COLORS5.middle;
        } else if (task.wheel === "outer") {
          radius = outerRadius;
          opacity = outerReveal;
          color = COLORS5.outer;
        }
        const driftProgress = (0, import_remotion7.spring)({
          frame: frame - taskDriftStart - task.id * 10,
          fps,
          config: { damping: 12 }
        });
        const currentRadius = (0, import_remotion7.interpolate)(driftProgress, [0, 1], [radius, radius * 0.85]);
        const taskX = width / 2 + currentRadius * Math.cos((task.angle - 90) * Math.PI / 180);
        const taskY = height / 2 + currentRadius * Math.sin((task.angle - 90) * Math.PI / 180);
        return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("g", { opacity, children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            "rect",
            {
              x: taskX - 10,
              y: taskY - 10,
              width: 20,
              height: 20,
              fill: COLORS5.task,
              rx: 4,
              transform: `rotate(${task.angle}, ${taskX}, ${taskY})`
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("circle", { cx: taskX, cy: taskY, r: 15, fill: "none", stroke: color, strokeWidth: 2, opacity: driftProgress })
        ] }, task.id);
      })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: {
      position: "absolute",
      bottom: height * 0.08,
      width: "100%",
      display: "flex",
      justifyContent: "center",
      padding: `0 ${width * 0.1}px`
    }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(PremiumStagger, { startDelay: 100, delayPerItem: 40, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: {
      display: "flex",
      gap: minDim * 0.04,
      background: "rgba(255,255,255,0.05)",
      padding: `${minDim * 0.02}px ${minDim * 0.04}px`,
      borderRadius: minDim * 0.02,
      backdropFilter: "blur(10px)",
      border: "1px solid rgba(255,255,255,0.1)"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { color: COLORS5.inner, fontWeight: "bold" }, children: "Seconds" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: {
        color: COLORS5.middle,
        fontWeight: "bold",
        opacity: (0, import_remotion7.interpolate)(frame, [middleWheelStart, middleWheelStart + 20], [0, 1])
      }, children: "Minutes" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: {
        color: COLORS5.outer,
        fontWeight: "bold",
        opacity: (0, import_remotion7.interpolate)(frame, [outerWheelStart, outerWheelStart + 20], [0, 1])
      }, children: "Hours" })
    ] }) }) }),
    frame > 280 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: {
      position: "absolute",
      bottom: height * 0.25,
      left: "50%",
      transform: "translateX(-50%)"
    }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(GlowPulse, { children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: {
      background: COLORS5.middle,
      color: COLORS5.background,
      padding: `${minDim * 0.01}px ${minDim * 0.05}px`,
      borderRadius: "99px",
      fontWeight: 900,
      fontSize: height * 0.03
    }, children: "CONSTANT TIME O(1)" }) }) })
  ] });
}

// src/proj_b69c7daf_56ec_4a4a_9b0c_b49e81302941/scenes/the_cascade.tsx
var import_remotion8 = require("remotion");
var import_jsx_runtime8 = require("react/jsx-runtime");
var COLORS6 = {
  bg: "#0F172A",
  primary: "#3B82F6",
  secondary: "#10B981",
  accent: "#F59E0B",
  white: "#FFFFFF",
  ring: "rgba(255, 255, 255, 0.1)"
};
var WheelRing = ({
  radius,
  strokeWidth,
  label,
  rotation,
  buckets = 12
}) => {
  const { height } = (0, import_remotion8.useVideoConfig)();
  const minDim = Math.min((0, import_remotion8.useVideoConfig)().width, height);
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("g", { style: { transform: `rotate(${rotation - 90}deg)`, transformOrigin: "center" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      "circle",
      {
        cx: "50%",
        cy: "50%",
        r: radius,
        fill: "none",
        stroke: COLORS6.ring,
        strokeWidth
      }
    ),
    Array.from({ length: buckets }).map((_, i) => {
      const angle = i * 360 / buckets;
      const x1 = 50 + (radius / minDim * 100 - strokeWidth / minDim * 50) * Math.cos(angle * Math.PI / 180);
      const y1 = 50 + (radius / minDim * 100 - strokeWidth / minDim * 50) * Math.sin(angle * Math.PI / 180);
      const x2 = 50 + (radius / minDim * 100 + strokeWidth / minDim * 50) * Math.cos(angle * Math.PI / 180);
      const y2 = 50 + (radius / minDim * 100 + strokeWidth / minDim * 50) * Math.sin(angle * Math.PI / 180);
      return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        "line",
        {
          x1: `${x1}%`,
          y1: `${y1}%`,
          x2: `${x2}%`,
          y2: `${y2}%`,
          stroke: COLORS6.ring,
          strokeWidth: 2
        },
        i
      );
    }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      "line",
      {
        x1: "50%",
        y1: "50%",
        x2: `${50 + (radius / minDim * 100 + 2) * Math.cos(0)}%`,
        y2: `${50 + (radius / minDim * 100 + 2) * Math.sin(0)}%`,
        stroke: COLORS6.accent,
        strokeWidth: 4,
        strokeLinecap: "round"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      "text",
      {
        x: `${50 + (radius / minDim * 100 + 8)}%`,
        y: "50%",
        fill: COLORS6.white,
        fontSize: height * 0.015,
        fontWeight: "bold",
        textAnchor: "start",
        alignmentBaseline: "middle",
        style: { transform: `rotate(${90 - rotation}deg)`, transformOrigin: `${50 + (radius / minDim * 100 + 8)}% 50%` },
        children: label
      }
    )
  ] });
};
function HierarchicalCascade() {
  const { width, height, fps } = (0, import_remotion8.useVideoConfig)();
  const frame = (0, import_remotion8.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const ringWidth = minDim * 0.08;
  const rSeconds = minDim * 0.15;
  const rMinutes = minDim * 0.25;
  const rHours = minDim * 0.35;
  const secRotation = frame * 6 % 360;
  const minRotation = frame * 0.1 % 360;
  const hourRotation = frame * 0.01 % 360;
  const cascadeTriggers = [360, 720, 1080, 1440];
  const cascades = cascadeTriggers.map((trigger) => {
    const progress = (0, import_remotion8.interpolate)(frame, [trigger, trigger + 45], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: import_remotion8.Easing.bezier(0.34, 1.56, 0.64, 1)
    });
    return progress;
  });
  const task1Pos = 120;
  const task1Executed = frame > 120 / 6 * 10 ? 1 : 0;
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_remotion8.AbsoluteFill, { style: { backgroundColor: COLORS6.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: {
      position: "absolute",
      top: height * 0.05,
      width: "100%",
      textAlign: "center"
    }, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(FadeIn, { delay: 10, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("h1", { style: {
        color: COLORS6.white,
        fontSize: height * 0.04,
        margin: 0,
        fontFamily: "sans-serif"
      }, children: "Hierarchical Cascade" }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { style: { color: COLORS6.primary, fontSize: height * 0.02, marginTop: height * 0.01 }, children: "O(1) Scheduling Across Time Scales" })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { position: "relative", width: "100%", height: height * 0.6 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("svg", { width: "100%", height: "100%", viewBox: `0 0 ${width} ${height * 0.6}`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "circle",
          {
            cx: "50%",
            cy: "50%",
            r: minDim * 0.04,
            fill: COLORS6.bg,
            stroke: COLORS6.secondary,
            strokeWidth: 3
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "text",
          {
            x: "50%",
            y: "50%",
            fill: COLORS6.secondary,
            fontSize: height * 0.012,
            textAnchor: "middle",
            alignmentBaseline: "middle",
            children: "EXECUTE"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(WheelRing, { radius: rSeconds, strokeWidth: ringWidth, label: "SECONDS", rotation: secRotation }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(WheelRing, { radius: rMinutes, strokeWidth: ringWidth, label: "MINUTES", rotation: minRotation }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(WheelRing, { radius: rHours, strokeWidth: ringWidth, label: "HOURS", rotation: hourRotation }),
        cascadeTriggers.map((trigger, idx) => {
          const progress = cascades[idx];
          if (progress <= 0 || progress >= 1 && frame > trigger + 150) return null;
          const angle = (minRotation - 90) * (Math.PI / 180);
          const startR = rMinutes;
          const endR = rSeconds;
          const currentR = (0, import_remotion8.interpolate)(progress, [0, 1], [startR, endR]);
          const x = width / 2 + currentR * Math.cos(angle);
          const y = height * 0.6 / 2 + currentR * Math.sin(angle);
          return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("g", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              "rect",
              {
                x: x - 10,
                y: y - 10,
                width: 20,
                height: 20,
                rx: 4,
                fill: COLORS6.accent,
                style: { opacity: (0, import_remotion8.interpolate)(progress, [0, 0.1, 0.9, 1], [0, 1, 1, 0.8]) }
              }
            ),
            progress > 0.8 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("circle", { cx: x, cy: y, r: (0, import_remotion8.interpolate)(progress, [0.8, 1], [0, 40]), fill: "none", stroke: COLORS6.accent, strokeWidth: 2, style: { opacity: 1 - progress } })
          ] }, `cascade-${trigger}`);
        }),
        Array.from({ length: 5 }).map((_, i) => {
          const taskAngle = i * 72;
          const isHit = Math.abs(secRotation - taskAngle) < 10;
          const opacity = (0, import_remotion8.interpolate)(frame % 300, [0, 250], [1, 1]);
          const x = width / 2 + rSeconds * Math.cos((taskAngle - 90) * Math.PI / 180);
          const y = height * 0.6 / 2 + rSeconds * Math.sin((taskAngle - 90) * Math.PI / 180);
          return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("g", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              "rect",
              {
                x: x - 8,
                y: y - 8,
                width: 16,
                height: 16,
                rx: 2,
                fill: isHit ? COLORS6.secondary : COLORS6.primary,
                style: { opacity }
              }
            ),
            isHit && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              "line",
              {
                x1: x,
                y1: y,
                x2: "50%",
                y2: "50%",
                stroke: COLORS6.secondary,
                strokeWidth: 2,
                strokeDasharray: "4 4"
              }
            )
          ] }, `sec-task-${i}`);
        })
      ] }),
      secRotation % 72 < 5 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_remotion8.AbsoluteFill, { style: { pointerEvents: "none", justifyContent: "center", alignItems: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(GlowPulse, { color: COLORS6.secondary, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: {
        width: minDim * 0.1,
        height: minDim * 0.1,
        borderRadius: "50%",
        border: `2px solid ${COLORS6.secondary}`
      } }) }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: {
      position: "absolute",
      bottom: height * 0.1,
      width: "80%",
      backgroundColor: "rgba(255, 255, 255, 0.05)",
      backdropFilter: "blur(10px)",
      padding: minDim * 0.03,
      borderRadius: minDim * 0.02,
      border: "1px solid rgba(255, 255, 255, 0.1)",
      display: "flex",
      flexDirection: "column",
      gap: minDim * 0.02
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: minDim * 0.02 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { width: 15, height: 15, backgroundColor: COLORS6.accent, borderRadius: 3 } }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { color: COLORS6.white, fontSize: height * 0.02, fontFamily: "sans-serif" }, children: 'Tasks "Cascade" from outer wheels on every tick' })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: minDim * 0.02 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { width: 15, height: 15, backgroundColor: COLORS6.secondary, borderRadius: 3 } }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { color: COLORS6.white, fontSize: height * 0.02, fontFamily: "sans-serif" }, children: "Inner wheel handles sub-second execution" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: minDim * 0.02 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { width: 15, height: 15, border: `2px solid ${COLORS6.accent}`, borderRadius: "50%" } }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { color: COLORS6.white, fontSize: height * 0.02, fontFamily: "sans-serif" }, children: "O(1) constant time: No sorting required" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: {
      position: "absolute",
      bottom: height * 0.03,
      left: "10%",
      width: "80%",
      height: 4,
      backgroundColor: "rgba(255,255,255,0.1)",
      borderRadius: 2
    }, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: {
      width: `${frame / 1620 * 100}%`,
      height: "100%",
      backgroundColor: COLORS6.primary,
      boxShadow: `0 0 10px ${COLORS6.primary}`,
      borderRadius: 2
    } }) })
  ] });
}

// src/proj_b69c7daf_56ec_4a4a_9b0c_b49e81302941/scenes/real_world_usage.tsx
var import_react5 = require("react");
var import_remotion9 = require("remotion");
var import_jsx_runtime9 = require("react/jsx-runtime");
var COLORS7 = {
  background: "#0F172A",
  primary: "#3B82F6",
  secondary: "#10B981",
  accent: "#F59E0B",
  white: "#FFFFFF",
  text: "#94A3B8",
  kafka: "#FFFFFF",
  netty: "#00A1CC"
};
var KafkaLogo = ({ size, color }) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: color, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("path", { d: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" }) });
var NettyLogo = ({ size }) => /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("svg", { viewBox: "0 0 100 100", width: size, height: size, children: [
  /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("path", { d: "M20,50 L50,20 L80,50 L50,80 Z", fill: "none", stroke: COLORS7.netty, strokeWidth: "6" }),
  /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("circle", { cx: "50", cy: "50", r: "15", fill: COLORS7.netty })
] });
var HierarchicalTimingWheelFinal = () => {
  const { width, height, fps } = (0, import_remotion9.useVideoConfig)();
  const frame = (0, import_remotion9.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const rotationCycle = 600;
  const rotationBase = frame / rotationCycle * 360;
  const uiEvolutionStart = 60;
  const uiIn = (0, import_remotion9.spring)({
    frame: frame - uiEvolutionStart,
    fps,
    config: { damping: 15 }
  });
  const wheels = [
    { radius: minDim * 0.4, speed: 1, label: "HOURS", color: COLORS7.accent },
    { radius: minDim * 0.28, speed: 12, label: "MINUTES", color: COLORS7.primary },
    { radius: minDim * 0.16, speed: 60, label: "SECONDS", color: COLORS7.secondary }
  ];
  const tasks = (0, import_react5.useMemo)(() => {
    return Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      wheelIdx: i % 3,
      angle: i * 137.5 % 360,
      // Phyllotaxis distribution
      offset: (Math.random() - 0.5) * 20
    }));
  }, []);
  const centerX = width / 2;
  const centerY = height * 0.45;
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_remotion9.AbsoluteFill, { style: { backgroundColor: COLORS7.background, color: COLORS7.white, fontFamily: "sans-serif" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_remotion9.Sequence, { from: 0, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: {
      position: "absolute",
      top: height * 0.05,
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: minDim * 0.02
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(FadeIn, { duration: 30, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("h1", { style: {
        fontSize: minDim * 0.07,
        fontWeight: 800,
        margin: 0,
        letterSpacing: "-0.02em",
        background: `linear-gradient(to right, ${COLORS7.primary}, ${COLORS7.secondary})`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent"
      }, children: "ZERO-OVERHEAD SCHEDULING" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: {
        display: "flex",
        gap: minDim * 0.05,
        marginTop: minDim * 0.02,
        opacity: uiIn
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(KafkaLogo, { size: minDim * 0.06, color: COLORS7.kafka }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { style: { fontSize: minDim * 0.035, fontWeight: 600 }, children: "Apache Kafka" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(NettyLogo, { size: minDim * 0.06 }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { style: { fontSize: minDim * 0.035, fontWeight: 600 }, children: "Netty" })
        ] })
      ] })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("svg", { width, height, style: { overflow: "visible" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("defs", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("filter", { id: "glow", x: "-20%", y: "-20%", width: "140%", height: "140%", children: [
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("feGaussianBlur", { stdDeviation: "5", result: "blur" }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("feComposite", { in: "SourceGraphic", in2: "blur", operator: "over" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("linearGradient", { id: "wheelGrad", x1: "0%", y1: "0%", x2: "100%", y2: "100%", children: [
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("stop", { offset: "0%", stopColor: COLORS7.primary, stopOpacity: "0.2" }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("stop", { offset: "100%", stopColor: COLORS7.secondary, stopOpacity: "0.05" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(GlowPulse, { color: COLORS7.secondary, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          "circle",
          {
            cx: centerX,
            cy: centerY,
            r: minDim * 0.05,
            fill: COLORS7.secondary,
            fillOpacity: 0.2,
            stroke: COLORS7.secondary,
            strokeWidth: 3
          }
        ) }),
        wheels.map((wheel, i) => {
          const rotation = rotationBase * wheel.speed;
          const glassBorderOpacity = (0, import_remotion9.interpolate)(uiIn, [0, 1], [0.1, 0.4]);
          return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("g", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
              "circle",
              {
                cx: centerX,
                cy: centerY,
                r: wheel.radius,
                fill: "none",
                stroke: wheel.color,
                strokeWidth: 2,
                strokeOpacity: glassBorderOpacity,
                strokeDasharray: "4 8"
              }
            ),
            Array.from({ length: 12 }).map((_, j) => {
              const angle = (j * 30 + rotation) * (Math.PI / 180);
              const x = centerX + Math.cos(angle) * wheel.radius;
              const y = centerY + Math.sin(angle) * wheel.radius;
              return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                "circle",
                {
                  cx: x,
                  cy: y,
                  r: 4,
                  fill: wheel.color,
                  opacity: 0.3 + uiIn * 0.4
                },
                j
              );
            }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
              "line",
              {
                x1: centerX,
                y1: centerY,
                x2: centerX + Math.cos(rotation * (Math.PI / 180)) * wheel.radius,
                y2: centerY + Math.sin(rotation * (Math.PI / 180)) * wheel.radius,
                stroke: wheel.color,
                strokeWidth: 2,
                strokeOpacity: 0.6 * uiIn
              }
            )
          ] }, i);
        }),
        tasks.map((task) => {
          const wheel = wheels[task.wheelIdx];
          const currentRotation = rotationBase * wheel.speed;
          const finalAngle = (task.angle + currentRotation) * (Math.PI / 180);
          const x = centerX + Math.cos(finalAngle) * (wheel.radius + task.offset);
          const y = centerY + Math.sin(finalAngle) * (wheel.radius + task.offset);
          return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            "circle",
            {
              cx: x,
              cy: y,
              r: minDim * 6e-3,
              fill: wheel.color,
              filter: "url(#glow)"
            },
            task.id
          );
        })
      ] }),
      wheels.map((wheel, i) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: {
        position: "absolute",
        left: centerX + wheel.radius + 10,
        top: centerY - 10,
        opacity: uiIn,
        fontSize: minDim * 0.02,
        color: wheel.color,
        fontWeight: "bold",
        letterSpacing: "0.1em"
      }, children: wheel.label }, i))
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_remotion9.Sequence, { from: 150, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: {
      position: "absolute",
      bottom: height * 0.1,
      width: "100%",
      display: "flex",
      justifyContent: "center",
      gap: minDim * 0.04
    }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(PremiumStagger, { speed: "fast", children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: {
        background: "rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(10px)",
        padding: `${minDim * 0.02}px ${minDim * 0.04}px`,
        borderRadius: minDim * 0.02,
        border: `1px solid rgba(255, 255, 255, 0.1)`,
        textAlign: "center"
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: { color: COLORS7.text, fontSize: minDim * 0.025, marginBottom: 5 }, children: "COMPLEXITY" }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: { color: COLORS7.secondary, fontSize: minDim * 0.05, fontWeight: "bold" }, children: "O(1)" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: {
        background: "rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(10px)",
        padding: `${minDim * 0.02}px ${minDim * 0.04}px`,
        borderRadius: minDim * 0.02,
        border: `1px solid rgba(255, 255, 255, 0.1)`,
        textAlign: "center"
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: { color: COLORS7.text, fontSize: minDim * 0.025, marginBottom: 5 }, children: "MEMORY" }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: { color: COLORS7.primary, fontSize: minDim * 0.05, fontWeight: "bold" }, children: "CONSTANT" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: {
        background: "rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(10px)",
        padding: `${minDim * 0.02}px ${minDim * 0.04}px`,
        borderRadius: minDim * 0.02,
        border: `1px solid rgba(255, 255, 255, 0.1)`,
        textAlign: "center"
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: { color: COLORS7.text, fontSize: minDim * 0.025, marginBottom: 5 }, children: "LOCKING" }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: { color: COLORS7.accent, fontSize: minDim * 0.05, fontWeight: "bold" }, children: "MINIMAL" })
      ] })
    ] }) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_remotion9.Sequence, { from: 400, children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: {
        position: "absolute",
        bottom: height * 0.3,
        width: "100%",
        textAlign: "center"
      }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(BounceIn, { delay: 20, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: {
        display: "inline-block",
        padding: "10px 30px",
        borderRadius: 100,
        backgroundColor: COLORS7.secondary,
        color: "#000",
        fontWeight: 900,
        fontSize: minDim * 0.04,
        boxShadow: `0 0 40px ${COLORS7.secondary}44`
      }, children: "READY FOR MILLIONS OF TASKS/S" }) }) }),
      frame > 450 && frame % 30 < 15 && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_remotion9.AbsoluteFill, { style: { border: `10px solid ${COLORS7.secondary}`, opacity: 0.1 } })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: {
      position: "absolute",
      bottom: height * 0.03,
      width: "100%",
      textAlign: "center",
      color: COLORS7.text,
      fontSize: minDim * 0.03,
      padding: `0 ${minDim * 0.05}px`
    }, children: "Zero sorting. Zero overhead. The core of modern high-performance architectures." })
  ] });
};
var real_world_usage_default = HierarchicalTimingWheelFinal;

// src/proj_b69c7daf_56ec_4a4a_9b0c_b49e81302941/Main.tsx
var import_jsx_runtime10 = require("react/jsx-runtime");
function Main() {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_remotion10.AbsoluteFill, { style: { background: "#0F172A" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_remotion10.Sequence, { from: 0, durationInFrames: 270, name: "intro_challenge", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(IntroChallenge, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_remotion10.Sequence, { from: 270, durationInFrames: 420, name: "heap_sorting", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(HeapSortingScene, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_remotion10.Sequence, { from: 690, durationInFrames: 330, name: "heap_bottleneck", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(HeapBottleneck, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_remotion10.Sequence, { from: 1020, durationInFrames: 330, name: "timing_wheel_intro", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(timing_wheel_intro_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_remotion10.Sequence, { from: 1350, durationInFrames: 240, name: "direct_insertion", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(direct_insertion_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_remotion10.Sequence, { from: 1590, durationInFrames: 330, name: "hierarchy_expansion", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(HierarchyExpansion, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_remotion10.Sequence, { from: 1920, durationInFrames: 1620, name: "the_cascade", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(HierarchicalCascade, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_remotion10.Sequence, { from: 3540, durationInFrames: 600, name: "real_world_usage", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(real_world_usage_default, {}) })
  ] });
}
