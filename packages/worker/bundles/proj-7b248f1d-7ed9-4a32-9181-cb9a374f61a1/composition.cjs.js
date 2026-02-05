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

// src/proj_7b248f1d_7ed9_4a32_9181_cb9a374f61a1/Main.tsx
var Main_exports = {};
__export(Main_exports, {
  default: () => Main
});
module.exports = __toCommonJS(Main_exports);
var import_remotion5 = require("remotion");

// src/proj_7b248f1d_7ed9_4a32_9181_cb9a374f61a1/scenes/scene_1.tsx
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

// src/proj_7b248f1d_7ed9_4a32_9181_cb9a374f61a1/scenes/scene_1.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var Scene1 = () => {
  const { width, height, fps } = (0, import_remotion2.useVideoConfig)();
  const frame = (0, import_remotion2.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const membraneY = height * 0.45;
  const capillaryHeight = height * 0.3;
  const capillaryTop = membraneY + height * 0.02;
  const alveolarBottom = membraneY - height * 0.02;
  const cellRadius = minDim * 0.08;
  const moleculeSize = minDim * 0.02;
  const bgColor = "#1A1A1A";
  const deoxygenatedColor = "#5e2b6e";
  const capillaryWallColor = "#333333";
  const co2Color = "#888888";
  const cellFlowSpeed = 4;
  const cells = Array.from({ length: 8 }).map((_, i) => {
    const startX = -cellRadius * 2 - i * cellRadius * 3;
    const progressX = frame * cellFlowSpeed;
    return {
      id: i,
      x: startX + progressX,
      y: capillaryTop + capillaryHeight / 2
    };
  });
  const co2Molecules = Array.from({ length: 15 }).map((_, i) => {
    const seed = i * 13.5;
    const initialCellX = -cellRadius * 2 - Math.floor(i / 2) * cellRadius * 3 + frame * cellFlowSpeed;
    const releaseFrame = 30 + i * 10;
    const migrationProgress = (0, import_remotion2.spring)({
      frame: frame - releaseFrame,
      fps,
      config: { damping: 20, stiffness: 40 }
    });
    const vibrate = Math.sin(frame * 0.2 + seed) * (minDim * 5e-3);
    return {
      id: i,
      startX: initialCellX + Math.cos(seed) * cellRadius * 0.5,
      startY: capillaryTop + capillaryHeight / 2 + Math.sin(seed) * cellRadius * 0.5,
      progress: migrationProgress,
      vibrate
    };
  });
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_remotion2.AbsoluteFill, { style: { backgroundColor: bgColor, overflow: "hidden" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_remotion2.Sequence, { from: 0, durationInFrames: 210, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: {
      position: "absolute",
      top: height * 0.05,
      width: "100%",
      textAlign: "center",
      color: "white",
      fontFamily: "sans-serif",
      zIndex: 10
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(FadeInUp, { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h1", { style: { fontSize: height * 0.04, margin: 0, fontWeight: 800, textTransform: "uppercase", letterSpacing: "2px" }, children: "Gas Exchange Interface" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(FadeIn, { delay: 30, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: { fontSize: height * 0.02, color: co2Color, marginTop: height * 0.01 }, children: "Alveolus \u2022 Capillary Membrane" }) })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { position: "absolute", inset: 0, opacity: 0.1 }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { width: "100%", height: "100%", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("pattern", { id: "grid", width: minDim * 0.1, height: minDim * 0.1, patternUnits: "userSpaceOnUse", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: `M ${minDim * 0.1} 0 L 0 0 0 ${minDim * 0.1}`, fill: "none", stroke: "white", strokeWidth: "1" }) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { width: "100%", height: "100%", fill: "url(#grid)" })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
      position: "absolute",
      top: 0,
      height: alveolarBottom,
      width: "100%",
      background: "linear-gradient(to bottom, #1a1a1a, #252525)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(FadeIn, { delay: 45, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: "#444", fontSize: height * 0.1, fontWeight: 900, opacity: 0.2 }, children: "ALVEOLUS" }) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
      position: "absolute",
      top: membraneY - height * 0.01,
      height: height * 0.02,
      width: "100%",
      background: `repeating-linear-gradient(90deg, transparent, transparent ${minDim * 0.02}px, ${capillaryWallColor} ${minDim * 0.02}px, ${capillaryWallColor} ${minDim * 0.04}px)`,
      borderTop: "2px solid #444",
      borderBottom: "2px solid #444",
      zIndex: 5
    } }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
      position: "absolute",
      top: capillaryTop,
      height: capillaryHeight,
      width: "100%",
      background: "rgba(255, 0, 0, 0.05)"
    }, children: cells.map((cell) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: cell.x,
          top: cell.y - cellRadius,
          width: cellRadius * 2,
          height: cellRadius * 2,
          borderRadius: "50%",
          backgroundColor: deoxygenatedColor,
          border: `4px solid ${deoxygenatedColor}88`,
          boxShadow: "inset 0 0 20px rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
          width: "60%",
          height: "60%",
          borderRadius: "50%",
          background: "rgba(0,0,0,0.2)"
        } })
      },
      cell.id
    )) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { style: { position: "absolute", width: "100%", height: "100%", zIndex: 6, pointerEvents: "none" }, children: co2Molecules.map((m) => {
      const targetY = alveolarBottom - minDim * 0.15;
      const currentY = (0, import_remotion2.interpolate)(m.progress, [0, 1], [m.startY, targetY]);
      const opacity = (0, import_remotion2.interpolate)(m.progress, [0, 0.1, 0.9, 1], [0, 1, 1, 0]);
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("g", { style: { opacity }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "circle",
          {
            cx: m.startX + m.vibrate,
            cy: currentY,
            r: moleculeSize / 2,
            fill: co2Color
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "circle",
          {
            cx: m.startX + m.vibrate + moleculeSize * 0.4,
            cy: currentY + moleculeSize * 0.2,
            r: moleculeSize / 3,
            fill: co2Color
          }
        )
      ] }, m.id);
    }) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
      position: "absolute",
      bottom: height * 0.1,
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: minDim * 0.03
    }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(PremiumStagger, { startDelay: 60, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
        background: "rgba(255, 255, 255, 0.1)",
        padding: `${minDim * 0.02}px ${minDim * 0.04}px`,
        borderRadius: minDim * 0.02,
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        color: "white",
        fontSize: height * 0.025,
        fontWeight: 500
      }, children: "CO\u2082 detaching from hemoglobin" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
        background: "rgba(255, 255, 255, 0.1)",
        padding: `${minDim * 0.02}px ${minDim * 0.04}px`,
        borderRadius: minDim * 0.02,
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        color: co2Color,
        fontSize: height * 0.025,
        fontWeight: 500
      }, children: "Diffusion across capillary wall" })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_remotion2.Sequence, { from: 60, durationInFrames: 150, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(GlowPulse, { speed: "slow", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
      position: "absolute",
      top: membraneY - 2,
      height: 4,
      width: "100%",
      backgroundColor: "rgba(255,255,255,0.3)",
      boxShadow: "0 0 20px rgba(255,255,255,0.5)"
    } }) }) })
  ] });
};
var scene_1_default = Scene1;

// src/proj_7b248f1d_7ed9_4a32_9181_cb9a374f61a1/scenes/scene_2.tsx
var import_remotion3 = require("remotion");
var import_jsx_runtime3 = require("react/jsx-runtime");
function RespirationScene() {
  const { width, height, fps } = (0, import_remotion3.useVideoConfig)();
  const frame = (0, import_remotion3.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const membraneY = height * 0.45;
  const capillaryHeight = height * 0.3;
  const rbcSize = minDim * 0.25;
  const moleculeSize = minDim * 0.04;
  const cameraOffset = frame * (width * 5e-3);
  const oxygenMolecules = Array.from({ length: 12 }).map((_, i) => {
    const startX = width * 0.2 + i * width * 0.15 % (width * 0.8);
    const startY = height * 0.15 + Math.sin(i) * height * 0.05;
    const progress = (0, import_remotion3.spring)({
      frame: frame - i * 3,
      fps,
      config: { damping: 15, stiffness: 60 }
    });
    const targetY = membraneY - moleculeSize * 1.5;
    const y = (0, import_remotion3.interpolate)(progress, [0, 1], [startY, targetY]);
    const x = startX - cameraOffset % width;
    return { x, y, id: i };
  });
  const rbcs = Array.from({ length: 3 }).map((_, i) => {
    const xBase = i * width * 0.5 + width * 0.2;
    const x = (xBase - cameraOffset) % (width * 1.5) - width * 0.2;
    const contactProgress = (0, import_remotion3.spring)({
      frame: frame - 60 - i * 20,
      fps,
      config: { damping: 12 }
    });
    const color = (0, import_remotion3.interpolate)(
      contactProgress,
      [0, 1],
      [0, 1],
      { extrapolateRight: "clamp" }
    );
    return { x, y: membraneY + capillaryHeight * 0.5, colorProgress: color };
  });
  const pulseScale = (0, import_remotion3.interpolate)(
    Math.sin(frame * 0.1),
    [-1, 1],
    [0.95, 1.05]
  );
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_remotion3.AbsoluteFill, { style: { backgroundColor: "#1A1A1A", overflow: "hidden" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
      position: "absolute",
      top: height * 0.05,
      width: "100%",
      textAlign: "center",
      zIndex: 10
    }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(FadeIn, { delay: 10, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h1", { style: {
      color: "#FFFFFF",
      fontSize: height * 0.035,
      fontWeight: 700,
      fontFamily: "sans-serif",
      textTransform: "uppercase",
      letterSpacing: "2px"
    }, children: "Oxygen Diffusion" }) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
      position: "absolute",
      top: 0,
      height: membraneY,
      width: "100%",
      background: "linear-gradient(180deg, rgba(77, 148, 255, 0.1) 0%, rgba(26, 26, 26, 1) 100%)"
    } }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
      position: "absolute",
      top: membraneY,
      height: capillaryHeight,
      width: "100%",
      borderTop: `${minDim * 0.01}px solid rgba(255, 255, 255, 0.2)`,
      borderBottom: `${minDim * 0.01}px solid rgba(255, 255, 255, 0.2)`,
      background: "rgba(255, 77, 77, 0.05)"
    } }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { style: { position: "absolute", width: "100%", height: "100%", opacity: 0.3 }, children: Array.from({ length: 5 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "line",
      {
        x1: 0,
        y1: membraneY - i * height * 0.05,
        x2: width,
        y2: membraneY - i * height * 0.05,
        stroke: "#4D94FF",
        strokeWidth: 2,
        style: { transform: `scaleY(${pulseScale})`, transformOrigin: "center" }
      },
      i
    )) }),
    rbcs.map((rbc, i) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: rbc.x,
          top: rbc.y - rbcSize / 2,
          width: rbcSize,
          height: rbcSize * 0.6,
          borderRadius: "50%",
          backgroundColor: `interpolate(purple, red, ${rbc.colorProgress})`,
          background: `radial-gradient(circle, 
              ${rbc.colorProgress > 0.5 ? "#FF4D4D" : "#4b0082"} 0%, 
              ${rbc.colorProgress > 0.5 ? "#991b1b" : "#2e004f"} 100%
            )`,
          boxShadow: `0 0 ${minDim * 0.05}px rgba(0,0,0,0.5)`,
          border: `${minDim * 5e-3}px solid rgba(255,255,255,0.1)`,
          display: "flex",
          justifyContent: "center",
          alignItems: "center"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
          width: "70%",
          height: "40%",
          border: "2px dashed rgba(255,255,255,0.3)",
          borderRadius: "50%"
        } })
      },
      i
    )),
    oxygenMolecules.map((mol) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: mol.x,
          top: mol.y,
          width: moleculeSize,
          height: moleculeSize
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(GlowPulse, { color: "#4D94FF", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          background: "radial-gradient(circle, #4D94FF 0%, #0044aa 100%)",
          border: "2px solid white",
          boxShadow: "0 0 10px rgba(77, 148, 255, 0.8)"
        } }) })
      },
      mol.id
    )),
    Array.from({ length: 4 }).map((_, i) => {
      const exitY = (0, import_remotion3.interpolate)(frame, [0, 60], [membraneY - 20, -50]);
      const exitX = width * 0.3 + i * width * 0.2;
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: exitX - cameraOffset * 0.2,
            top: exitY,
            width: moleculeSize * 0.8,
            height: moleculeSize * 0.8,
            borderRadius: "50%",
            background: "#888888",
            opacity: (0, import_remotion3.interpolate)(frame, [0, 60], [0.6, 0]),
            filter: "blur(2px)"
          }
        },
        `co2-${i}`
      );
    }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
      position: "absolute",
      bottom: height * 0.1,
      width: "100%",
      padding: `0 ${width * 0.1}px`,
      textAlign: "center"
    }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
      backgroundColor: "rgba(255, 255, 255, 0.05)",
      backdropFilter: "blur(10px)",
      borderRadius: minDim * 0.03,
      padding: minDim * 0.04,
      border: "1px solid rgba(255,255,255,0.1)"
    }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("p", { style: {
      color: "#4D94FF",
      fontSize: height * 0.024,
      fontFamily: "sans-serif",
      margin: 0,
      lineHeight: 1.4
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: "High Concentration:" }),
      " Oxygen moves down the gradient into the deoxygenated RBCs."
    ] }) }) })
  ] });
}

// src/proj_7b248f1d_7ed9_4a32_9181_cb9a374f61a1/scenes/scene_3.tsx
var import_remotion4 = require("remotion");
var import_jsx_runtime4 = require("react/jsx-runtime");
var BACKGROUND_COLOR = "#1A1A1A";
var RBC_DARK = "#800000";
var RBC_BRIGHT = "#FF4D4D";
var CO2_COLOR = "#4D94FF";
var O2_COLOR = "#FFFFFF";
function RespirationScene3() {
  const { width, height, fps } = (0, import_remotion4.useVideoConfig)();
  const frame = (0, import_remotion4.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const capillaryY = height * 0.6;
  const alveolarY = height * 0.35;
  const rbcSize = minDim * 0.18;
  const moleculeSize = minDim * 0.025;
  const exitProgress = (0, import_remotion4.spring)({
    frame,
    fps,
    config: SPRING_CONFIGS.gentle
  });
  const zoomOut = (0, import_remotion4.interpolate)(frame, [60, 150], [1, 0.85], {
    extrapolateRight: "clamp"
  });
  const exhalationProgress = (0, import_remotion4.interpolate)(frame, [0, 120], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const bloodFlow = (f, offset) => {
    const xBase = (f * 5 + offset) % (width + rbcSize * 2) - rbcSize;
    const colorInterpolation = (0, import_remotion4.interpolate)(xBase, [width * 0.3, width * 0.6], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp"
    });
    return { x: xBase, colorIdx: colorInterpolation };
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    import_remotion4.AbsoluteFill,
    {
      style: {
        backgroundColor: BACKGROUND_COLOR,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
        "div",
        {
          style: {
            transform: `scale(${zoomOut})`,
            width: "100%",
            height: "100%",
            position: "relative"
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_remotion4.Sequence, { from: 0, duration: 154, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              "div",
              {
                style: {
                  position: "absolute",
                  top: height * 0.05,
                  width: "100%",
                  textAlign: "center"
                },
                children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(FadeIn, { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                  "h1",
                  {
                    style: {
                      color: "white",
                      fontSize: minDim * 0.06,
                      fontFamily: "sans-serif",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                      margin: 0
                    },
                    children: "Systemic Delivery"
                  }
                ) })
              }
            ) }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
              "svg",
              {
                style: {
                  position: "absolute",
                  width: "100%",
                  height: "100%"
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("filter", { id: "glow", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("feGaussianBlur", { stdDeviation: "5", result: "coloredBlur" }),
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("feMerge", { children: [
                      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("feMergeNode", { in: "coloredBlur" }),
                      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("feMergeNode", { in: "SourceGraphic" })
                    ] })
                  ] }) }),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                    "path",
                    {
                      d: `M 0 ${alveolarY} Q ${width / 2} ${alveolarY - 20} ${width} ${alveolarY}`,
                      stroke: "#555",
                      strokeWidth: height * 0.01,
                      fill: "none",
                      opacity: 0.6
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                    "line",
                    {
                      x1: 0,
                      y1: capillaryY - rbcSize * 0.7,
                      x2: width,
                      y2: capillaryY - rbcSize * 0.7,
                      stroke: "#444",
                      strokeWidth: 4
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                    "line",
                    {
                      x1: 0,
                      y1: capillaryY + rbcSize * 0.7,
                      x2: width,
                      y2: capillaryY + rbcSize * 0.7,
                      stroke: "#444",
                      strokeWidth: 4
                    }
                  )
                ]
              }
            ),
            [0, 400, 800, 1200].map((offset, i) => {
              const { x, colorIdx } = bloodFlow(frame, offset);
              const rbcColor = (0, import_remotion4.interpolate)(colorIdx, [0, 1], [0, 1]);
              return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                "div",
                {
                  style: {
                    position: "absolute",
                    left: x,
                    top: capillaryY - rbcSize / 2,
                    width: rbcSize,
                    height: rbcSize * 0.9,
                    borderRadius: "45%",
                    backgroundColor: rbcColor > 0.5 ? RBC_BRIGHT : RBC_DARK,
                    boxShadow: rbcColor > 0.5 ? `0 0 ${minDim * 0.05}px ${RBC_BRIGHT}` : "none",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    border: "2px solid rgba(255,255,255,0.2)",
                    transform: `rotate(${Math.sin(frame / 10 + i) * 10}deg)`
                  },
                  children: rbcColor > 0.2 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("svg", { width: "60%", height: "60%", viewBox: "0 0 100 100", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("circle", { cx: "20", cy: "50", r: "8", fill: O2_COLOR }),
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("circle", { cx: "80", cy: "50", r: "8", fill: O2_COLOR }),
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("circle", { cx: "50", cy: "20", r: "8", fill: O2_COLOR }),
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("circle", { cx: "50", cy: "80", r: "8", fill: O2_COLOR })
                  ] })
                },
                `rbc-${i}`
              );
            }),
            [...Array(8)].map((_, i) => {
              const xPos = width / 9 * (i + 1);
              const yStart = alveolarY + 50;
              const yCurr = yStart - exhalationProgress * height * 0.4 - i % 3 * 30;
              const opac = (0, import_remotion4.interpolate)(exhalationProgress, [0.7, 1], [0.6, 0]);
              return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                "div",
                {
                  style: {
                    position: "absolute",
                    left: xPos,
                    top: yCurr,
                    opacity: opac
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                    "div",
                    {
                      style: {
                        width: moleculeSize,
                        height: moleculeSize,
                        borderRadius: "50%",
                        background: CO2_COLOR,
                        boxShadow: `0 0 10px ${CO2_COLOR}`
                      }
                    }
                  )
                },
                `co2-${i}`
              );
            }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
              "div",
              {
                style: {
                  position: "absolute",
                  bottom: height * 0.1,
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: minDim * 0.02
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(GlowPulse, { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                    "div",
                    {
                      style: {
                        padding: `${minDim * 0.02}px ${minDim * 0.04}px`,
                        borderRadius: minDim * 0.01,
                        background: "rgba(255, 77, 77, 0.15)",
                        border: `1px solid ${RBC_BRIGHT}`,
                        color: RBC_BRIGHT,
                        fontSize: minDim * 0.035,
                        fontWeight: "600"
                      },
                      children: "Oxygenated blood exits to body"
                    }
                  ) }),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
                    "div",
                    {
                      style: {
                        marginTop: minDim * 0.02,
                        display: "flex",
                        alignItems: "center",
                        gap: minDim * 0.05,
                        opacity: exitProgress
                      },
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 10 }, children: [
                          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                            "div",
                            {
                              style: {
                                width: 12,
                                height: 12,
                                borderRadius: "50%",
                                background: O2_COLOR
                              }
                            }
                          ),
                          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { color: "white", fontSize: minDim * 0.025 }, children: "O\u2082 Bound" })
                        ] }),
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 10 }, children: [
                          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                            "div",
                            {
                              style: {
                                width: 12,
                                height: 12,
                                borderRadius: "50%",
                                background: CO2_COLOR
                              }
                            }
                          ),
                          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { color: "white", fontSize: minDim * 0.025 }, children: "CO\u2082 Exhaled" })
                        ] })
                      ]
                    }
                  )
                ]
              }
            )
          ]
        }
      )
    }
  );
}

// src/proj_7b248f1d_7ed9_4a32_9181_cb9a374f61a1/Main.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
function Main() {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_remotion5.AbsoluteFill, { style: { background: "#1A1A1A" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_remotion5.Sequence, { from: 0, durationInFrames: 210, name: "scene_1", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(scene_1_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_remotion5.Sequence, { from: 210, durationInFrames: 120, name: "scene_2", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(RespirationScene, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_remotion5.Sequence, { from: 330, durationInFrames: 154, name: "scene_3", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(RespirationScene3, {}) })
  ] });
}
