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

// src/proj_5328527d_e022_4766_bec9_ac3b8c7d5c17/index.tsx
var index_exports = {};
__export(index_exports, {
  RemotionRoot: () => RemotionRoot,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_remotion8 = require("remotion");

// src/proj_5328527d_e022_4766_bec9_ac3b8c7d5c17/constants.ts
var COLORS = {
  primary: "#2C3E50",
  // Dark Blue-Grey - Trust and professionalism
  secondary: "#8B4513",
  // Saddle Brown - Traditional and stable
  accent: "#B8860B",
  // Dark Goldenrod - Achievement and wisdom
  success: "#228B22",
  // Forest Green - Progress and mastery
  background: "#F8F8FF",
  // Ghost White - Clean and readable
  text: "#1a1a2e",
  // Dark text
  textLight: "#4a4a6a",
  // Lighter text
  white: "#FFFFFF",
  easy: "#228B22",
  // Forest Green for easy problems
  medium: "#B8860B",
  // Dark Goldenrod for medium problems
  hard: "#8B0000"
  // Dark Red for hard problems
};
var SPRING_CONFIG = {
  damping: 22,
  stiffness: 90,
  mass: 0.9
};
var TIMING = {
  scene1: { start: 0, end: 340 },
  scene2: { start: 341, end: 476 },
  scene3: { start: 477, end: 815 },
  scene4: { start: 816, end: 1200 },
  scene5: { start: 1201, end: 1725 },
  scene6: { start: 1726, end: 2138 }
};
var SYNC_POINTS = {
  strategy: 175,
  // Scene 1: Clear path reveals
  step1: 476,
  // Scene 2: First plateau glows
  understanding: 595,
  // Scene 3: Data structures illuminate
  algorithm: 723,
  // Scene 3: Flowcharts appear
  finalStep: 815,
  // Scene 3: Transition to practice
  easyOnes: 885,
  // Scene 4: Easy section highlights
  mediumOnes: 956,
  // Scene 4: Medium section highlights
  hardOnes: 981,
  // Scene 4: Hard section highlights
  eightyPercent: 1120,
  // Scene 4: Progress bar shows 80%
  wholeDay: 1477,
  // Scene 5: Clock spins
  dreams: 1539,
  // Scene 5: Dream clouds appear
  solutions: 1694,
  // Scene 5: Solution scroll unfurls
  workedOut: 1766,
  // Scene 6: Trophy appears
  follow: 2112
  // Scene 6: Future banner unfurls
};
var VIDEO_CONFIG = {
  fps: 30,
  width: 1080,
  height: 1920,
  durationInFrames: 2138
};

// src/proj_5328527d_e022_4766_bec9_ac3b8c7d5c17/components/Background.tsx
var import_remotion = require("remotion");
var import_jsx_runtime = require("react/jsx-runtime");
var Background = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const gradientShift = (0, import_remotion.interpolate)(
    frame % 300,
    [0, 150, 300],
    [0, 10, 0],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    import_remotion.AbsoluteFill,
    {
      style: {
        background: `linear-gradient(
          ${135 + gradientShift}deg,
          ${COLORS.background} 0%,
          #EEE8E4 50%,
          ${COLORS.background} 100%
        )`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: 0.03,
              backgroundImage: `
            radial-gradient(circle at 20% 30%, ${COLORS.primary} 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, ${COLORS.secondary} 0%, transparent 50%)
          `
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CornerDecoration, { position: "top-left", frame }, "k1"),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CornerDecoration, { position: "top-right", frame }, "k2"),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CornerDecoration, { position: "bottom-left", frame }, "k3"),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CornerDecoration, { position: "bottom-right", frame }, "k4")
      ]
    }
  );
};
var CornerDecoration = ({ position, frame }) => {
  const opacity = (0, import_remotion.interpolate)(frame, [0, 30], [0, 0.15], { extrapolateRight: "clamp" });
  const getStyle = () => {
    const baseStyle = {
      position: "absolute",
      width: 120,
      height: 120,
      opacity
    };
    switch (position) {
      case "top-left":
        return { ...baseStyle, top: 20, left: 20 };
      case "top-right":
        return { ...baseStyle, top: 20, right: 20, transform: "scaleX(-1)" };
      case "bottom-left":
        return { ...baseStyle, bottom: 20, left: 20, transform: "scaleY(-1)" };
      case "bottom-right":
        return { ...baseStyle, bottom: 20, right: 20, transform: "scale(-1, -1)" };
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { style: getStyle(), viewBox: "0 0 100 100", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "path",
      {
        d: "M0 0 Q50 0 50 50 Q50 0 100 0",
        fill: "none",
        stroke: COLORS.accent,
        strokeWidth: "1",
        opacity: "0.5"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "path",
      {
        d: "M0 0 Q0 50 50 50 Q0 50 0 100",
        fill: "none",
        stroke: COLORS.accent,
        strokeWidth: "1",
        opacity: "0.5"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "5", cy: "5", r: "3", fill: COLORS.accent, opacity: "0.3" }, "k5")
  ] });
};

// src/proj_5328527d_e022_4766_bec9_ac3b8c7d5c17/scenes/Scene1.tsx
var import_remotion2 = require("remotion");

// src/proj_5328527d_e022_4766_bec9_ac3b8c7d5c17/components/Icons.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var TrophyIcon = ({ size = 64, color = "currentColor", style }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", style, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { fill: color, d: "m15.2 10.7l1.4 5.3l-4.6-3.8L7.4 16l1.4-5.2l-4.2-3.5L10 7l2-5l2 5l5.4.3zM14 19h-1v-3l-1-1l-1 1v3h-1c-1.1 0-2 .9-2 2v1h8v-1a2 2 0 0 0-2-2" }) });
var LaurelWreathIcon = ({ size = 64, color = "currentColor", style }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", style, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("g", { fill: "none", stroke: color, strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", children: [
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { fill: color, d: "M6.436 8A8.6 8.6 0 0 0 6 10.727C6 14.744 8.686 18 12 18s6-3.256 6-7.273A8.6 8.6 0 0 0 17.564 8M14.5 21s-.682-3-2.5-3s-2.5 3-2.5 3m9.02-15.77C18.812 6.896 17.5 8 17.5 8s-1.603-.563-1.895-2.23C15.313 4.104 16.625 3 16.625 3s1.603.563 1.895 2.23" }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { fill: color, d: "M21.094 12.14c-1.281 1.266-3.016.76-3.016.76s-.454-1.772.828-3.04c1.28-1.266 3.016-.76 3.016-.76s.454 1.772-.828 3.04m-3.36 6.686c-1.5-.575-1.734-2.19-1.734-2.19s1.267-1.038 2.767-.462c1.5.575 1.733 2.19 1.733 2.19s-1.267 1.038-2.767.462m-11.466 0c1.5-.575 1.733-2.19 1.733-2.19s-1.267-1.038-2.767-.462c-1.5.575-1.733 2.19-1.733 2.19s1.267 1.038 2.767.462M2.906 12.14c1.281 1.266 3.016.76 3.016.76s.454-1.772-.828-3.04C3.813 8.595 2.078 9.1 2.078 9.1s-.454 1.772.828 3.04M5.48 5.23C5.188 6.896 6.5 8 6.5 8s1.603-.563 1.895-2.23C8.687 4.104 7.375 3 7.375 3s-1.603.563-1.895 2.23" })
] }) });
var CheckmarkIcon = ({ size = 64, color = "currentColor", style }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 512 512", style, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { fill: color, d: "M256 48C141.31 48 48 141.31 48 256s93.31 208 208 208s208-93.31 208-208S370.69 48 256 48m108.25 138.29l-134.4 160a16 16 0 0 1-12 5.71h-.27a16 16 0 0 1-11.89-5.3l-57.6-64a16 16 0 1 1 23.78-21.4l45.29 50.32l122.59-145.91a16 16 0 0 1 24.5 20.58" }) });
var TreeStructureIcon = ({ size = 64, color = "currentColor", style }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 256 256", style, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { fill: color, d: "M144 96V80h-16a8 8 0 0 0-8 8v80a8 8 0 0 0 8 8h16v-16a16 16 0 0 1 16-16h48a16 16 0 0 1 16 16v48a16 16 0 0 1-16 16h-48a16 16 0 0 1-16-16v-16h-16a24 24 0 0 1-24-24v-32H72v8a16 16 0 0 1-16 16H24a16 16 0 0 1-16-16v-32a16 16 0 0 1 16-16h32a16 16 0 0 1 16 16v8h32V88a24 24 0 0 1 24-24h16V48a16 16 0 0 1 16-16h48a16 16 0 0 1 16 16v48a16 16 0 0 1-16 16h-48a16 16 0 0 1-16-16" }) });
var ArrayIcon = ({ size = 64, color = "currentColor", style }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", style, children: [
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { x: "3", y: "8", width: "4", height: "8", rx: "1", fill: color }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { x: "8.5", y: "8", width: "4", height: "8", rx: "1", fill: color }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { x: "14", y: "8", width: "4", height: "8", rx: "1", fill: color }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { x: "19.5", y: "8", width: "1.5", height: "8", rx: "0.5", fill: color, opacity: "0.5" })
] });
var GraphIcon = ({ size = 64, color = "currentColor", style }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", style, children: [
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "6", cy: "6", r: "3", fill: color }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "18", cy: "6", r: "3", fill: color }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "12", cy: "18", r: "3", fill: color }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("line", { x1: "6", y1: "9", x2: "12", y2: "15", stroke: color, strokeWidth: "2" }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("line", { x1: "18", y1: "9", x2: "12", y2: "15", stroke: color, strokeWidth: "2" }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("line", { x1: "6", y1: "6", x2: "18", y2: "6", stroke: color, strokeWidth: "2" })
] });
var LightbulbIcon = ({ size = 64, color = "currentColor", style }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", style, children: [
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { fill: color, d: "M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74c0-3.87-3.13-7-7-7z" }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { x: "9", y: "19", width: "6", height: "2", rx: "1", fill: color }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { x: "10", y: "22", width: "4", height: "1", rx: "0.5", fill: color })
] });
var ScrollIcon = ({ size = 64, color = "currentColor", style }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", style, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { fill: color, d: "M19 3H7c-1.1 0-2 .9-2 2v2c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-2c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 14H7V9h10v8zm2-6h-1V7H7V5h12v6z" }) });

// src/proj_5328527d_e022_4766_bec9_ac3b8c7d5c17/scenes/Scene1.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var FloatingTerm = ({ text, x, y, delay, frame, chaotic = true }) => {
  const adjustedFrame = frame - delay;
  const opacity = (0, import_remotion2.interpolate)(adjustedFrame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp"
  });
  const floatOffset = chaotic ? Math.sin(adjustedFrame * 0.05 + delay) * 15 : 0;
  const rotateOffset = chaotic ? Math.sin(adjustedFrame * 0.03 + delay * 2) * 8 : 0;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: `translateY(${floatOffset}px) rotate(${rotateOffset}deg)`,
        opacity,
        fontSize: 32,
        fontWeight: 600,
        color: COLORS.primary,
        fontFamily: "Georgia, serif",
        textShadow: "0 2px 4px rgba(0,0,0,0.1)",
        whiteSpace: "nowrap"
      },
      children: text
    }
  );
};
var ConfusedStudent = ({ frame }) => {
  const scale = (0, import_remotion2.spring)({
    frame,
    fps: 30,
    config: SPRING_CONFIG
  });
  const headShake = Math.sin(frame * 0.1) * 3;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "22%",
        top: "40%",
        transform: `scale(${scale}) rotate(${headShake}deg)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "div",
          {
            style: {
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: COLORS.secondary,
              marginBottom: 10
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "div",
          {
            style: {
              width: 100,
              height: 120,
              background: COLORS.secondary,
              borderRadius: "20px 20px 10px 10px"
            }
          }
        ),
        [0, 1, 2].map((i) => {
          const qOpacity = (0, import_remotion2.interpolate)(
            (frame + i * 15) % 60,
            [0, 30, 60],
            [0, 1, 0],
            { extrapolateRight: "clamp" }
          );
          return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                top: -30 - i * 20,
                left: 40 + i * 25,
                fontSize: 36 - i * 6,
                color: COLORS.accent,
                fontWeight: "bold",
                fontFamily: "Georgia, serif",
                opacity: qOpacity
              },
              children: "?"
            },
            i
          );
        })
      ]
    }
  );
};
var MountainPath = ({
  frame,
  revealFrame
}) => {
  const { fps } = (0, import_remotion2.useVideoConfig)();
  const revealProgress = (0, import_remotion2.spring)({
    frame: frame - revealFrame,
    fps,
    config: { ...SPRING_CONFIG, damping: 25 }
  });
  const opacity = (0, import_remotion2.interpolate)(
    frame - revealFrame,
    [0, 30],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "55%",
        top: "15%",
        width: "40%",
        height: "70%",
        opacity,
        transform: `scale(${revealProgress})`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
          "svg",
          {
            viewBox: "0 0 200 300",
            style: { width: "100%", height: "100%" },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "path",
                {
                  d: "M100 20 L180 280 L20 280 Z",
                  fill: COLORS.primary,
                  opacity: "0.1"
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "path",
                {
                  d: "M100 270 Q80 220 100 180 Q120 140 100 100 Q80 60 100 30",
                  fill: "none",
                  stroke: COLORS.accent,
                  strokeWidth: "4",
                  strokeDasharray: "8,4"
                }
              )
            ]
          }
        ),
        [
          { num: "I", y: 65, delay: 0 },
          { num: "II", y: 45, delay: 8 },
          { num: "III", y: 25, delay: 16 }
        ].map((plateau, i) => {
          const plateauProgress = (0, import_remotion2.spring)({
            frame: frame - revealFrame - plateau.delay,
            fps,
            config: SPRING_CONFIG
          });
          return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: "50%",
                top: `${plateau.y}%`,
                transform: `translateX(-50%) scale(${plateauProgress})`,
                background: "rgba(255,255,255,0.9)",
                border: `3px solid ${COLORS.accent}`,
                borderRadius: 12,
                padding: "12px 24px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "span",
                {
                  style: {
                    fontSize: 28,
                    fontWeight: 700,
                    color: COLORS.primary,
                    fontFamily: "Georgia, serif"
                  },
                  children: plateau.num
                }
              )
            },
            plateau.num
          );
        }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: "50%",
              top: "8%",
              transform: `translateX(-50%) scale(${revealProgress})`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(LightbulbIcon, { size: 48, color: COLORS.accent })
          }
        )
      ]
    }
  );
};
var TangledPaths = ({ frame }) => {
  const opacity = (0, import_remotion2.interpolate)(frame, [0, 30], [0, 0.6], {
    extrapolateRight: "clamp"
  });
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    "svg",
    {
      style: {
        position: "absolute",
        left: "5%",
        top: "20%",
        width: "40%",
        height: "60%",
        opacity
      },
      viewBox: "0 0 200 300",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "path",
          {
            d: "M20 50 Q80 30 60 100 Q40 170 100 150 Q160 130 140 200",
            fill: "none",
            stroke: COLORS.secondary,
            strokeWidth: "3",
            opacity: "0.5"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "path",
          {
            d: "M180 80 Q120 60 140 130 Q160 200 80 180 Q0 160 40 230",
            fill: "none",
            stroke: COLORS.primary,
            strokeWidth: "3",
            opacity: "0.4"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "path",
          {
            d: "M100 20 Q40 50 80 100 Q120 150 60 180 Q0 210 50 260",
            fill: "none",
            stroke: COLORS.accent,
            strokeWidth: "2",
            opacity: "0.3"
          }
        )
      ]
    }
  );
};
var Scene1 = ({ startFrame = 0 }) => {
  const frame = (0, import_remotion2.useCurrentFrame)();
  const adjustedFrame = frame - startFrame;
  const revealFrame = SYNC_POINTS.strategy - startFrame;
  const chaosOpacity = (0, import_remotion2.interpolate)(
    adjustedFrame - revealFrame,
    [0, 60],
    [1, 0.6],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_remotion2.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          left: 0,
          top: 0,
          width: "50%",
          height: "100%",
          opacity: chaosOpacity
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(TangledPaths, { frame: adjustedFrame }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ConfusedStudent, { frame: adjustedFrame }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(FloatingTerm, { text: "Array", x: 10, y: 25, delay: 0, frame: adjustedFrame }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(FloatingTerm, { text: "Tree", x: 30, y: 55, delay: 8, frame: adjustedFrame }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(FloatingTerm, { text: "Graph", x: 15, y: 70, delay: 16, frame: adjustedFrame }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(FloatingTerm, { text: "Stack", x: 35, y: 35, delay: 24, frame: adjustedFrame }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(FloatingTerm, { text: "Queue", x: 5, y: 45, delay: 32, frame: adjustedFrame }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: "40%",
                top: "20%",
                opacity: (0, import_remotion2.interpolate)(adjustedFrame - 10, [0, 20], [0, 0.7], {
                  extrapolateRight: "clamp",
                  extrapolateLeft: "clamp"
                }),
                transform: `rotate(${Math.sin(adjustedFrame * 0.05) * 10}deg)`
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(TreeStructureIcon, { size: 40, color: COLORS.primary })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: "8%",
                top: "60%",
                opacity: (0, import_remotion2.interpolate)(adjustedFrame - 20, [0, 20], [0, 0.7], {
                  extrapolateRight: "clamp",
                  extrapolateLeft: "clamp"
                }),
                transform: `rotate(${Math.sin(adjustedFrame * 0.04 + 1) * 12}deg)`
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ArrayIcon, { size: 40, color: COLORS.secondary })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: "35%",
                top: "75%",
                opacity: (0, import_remotion2.interpolate)(adjustedFrame - 30, [0, 20], [0, 0.7], {
                  extrapolateRight: "clamp",
                  extrapolateLeft: "clamp"
                }),
                transform: `rotate(${Math.sin(adjustedFrame * 0.06 + 2) * 8}deg)`
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(GraphIcon, { size: 40, color: COLORS.accent })
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: "50%",
          top: "15%",
          width: 2,
          height: "70%",
          background: `linear-gradient(to bottom, transparent, ${COLORS.accent}, transparent)`,
          opacity: 0.3
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(MountainPath, { frame: adjustedFrame, revealFrame }),
    adjustedFrame >= revealFrame && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: "48%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          opacity: (0, import_remotion2.interpolate)(
            adjustedFrame - revealFrame,
            [0, 30],
            [0, 1],
            { extrapolateRight: "clamp" }
          )
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { width: "40", height: "40", viewBox: "0 0 24 24", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "path",
          {
            fill: COLORS.accent,
            d: "M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"
          }
        ) })
      }
    )
  ] });
};

// src/proj_5328527d_e022_4766_bec9_ac3b8c7d5c17/scenes/Scene2.tsx
var import_remotion3 = require("remotion");
var import_jsx_runtime4 = require("react/jsx-runtime");
var Plateau = ({ numeral, x, y, delay, frame, isHighlighted = false }) => {
  const { fps } = (0, import_remotion3.useVideoConfig)();
  const progress = (0, import_remotion3.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG
  });
  const glowIntensity = isHighlighted ? (0, import_remotion3.interpolate)(frame - delay, [0, 20], [0, 1], { extrapolateRight: "clamp" }) : 0;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) scale(${progress})`,
        opacity: progress
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
          "div",
          {
            style: {
              background: `linear-gradient(180deg, #E8E0D5 0%, #D4C8B8 50%, #C0B0A0 100%)`,
              border: `3px solid ${isHighlighted ? COLORS.accent : COLORS.secondary}`,
              borderRadius: 16,
              padding: "20px 40px",
              boxShadow: isHighlighted ? `0 0 30px ${COLORS.accent}60, 0 8px 24px rgba(0,0,0,0.2)` : "0 8px 24px rgba(0,0,0,0.2)",
              position: "relative"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                "div",
                {
                  style: {
                    position: "absolute",
                    left: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 4,
                    height: "60%",
                    background: COLORS.secondary,
                    borderRadius: 2,
                    opacity: 0.3
                  }
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                "div",
                {
                  style: {
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 4,
                    height: "60%",
                    background: COLORS.secondary,
                    borderRadius: 2,
                    opacity: 0.3
                  }
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                "span",
                {
                  style: {
                    fontSize: 48,
                    fontWeight: 700,
                    color: isHighlighted ? COLORS.accent : COLORS.primary,
                    fontFamily: 'Georgia, "Times New Roman", serif',
                    textShadow: isHighlighted ? `0 0 10px ${COLORS.accent}80` : "none"
                  },
                  children: numeral
                }
              )
            ]
          }
        ),
        isHighlighted && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              inset: -20,
              background: `radial-gradient(circle, ${COLORS.accent}30 0%, transparent 70%)`,
              opacity: glowIntensity,
              pointerEvents: "none"
            }
          }
        )
      ]
    }
  );
};
var FloatingIcon = ({ icon, x, y, delay, frame }) => {
  const { fps } = (0, import_remotion3.useVideoConfig)();
  const progress = (0, import_remotion3.spring)({
    frame: frame - delay,
    fps,
    config: { ...SPRING_CONFIG, damping: 25 }
  });
  const floatY = Math.sin((frame - delay) * 0.04) * 8;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) translateY(${floatY}px) scale(${progress})`,
        opacity: progress * 0.9
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              inset: -15,
              background: `radial-gradient(circle, ${COLORS.accent}40 0%, transparent 70%)`,
              borderRadius: "50%"
            }
          }
        ),
        icon
      ]
    }
  );
};
var MountainPath2 = ({ frame }) => {
  const { fps } = (0, import_remotion3.useVideoConfig)();
  const pathProgress = (0, import_remotion3.spring)({
    frame,
    fps,
    config: { ...SPRING_CONFIG, damping: 30 }
  });
  const pathLength = 800;
  const dashOffset = pathLength * (1 - pathProgress);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    "svg",
    {
      viewBox: "0 0 400 700",
      style: {
        position: "absolute",
        left: "50%",
        top: "10%",
        width: "70%",
        height: "80%",
        transform: "translateX(-50%)"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "path",
          {
            d: "M200 50 L350 650 L50 650 Z",
            fill: COLORS.primary,
            opacity: "0.08"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "path",
          {
            d: "M200 620\n           Q140 550 200 480\n           Q260 410 200 340\n           Q140 270 200 200\n           Q260 130 200 60",
            fill: "none",
            stroke: COLORS.accent,
            strokeWidth: "6",
            strokeDasharray: pathLength,
            strokeDashoffset: dashOffset,
            strokeLinecap: "round",
            opacity: "0.7"
          }
        ),
        [0.2, 0.5, 0.8].map((t, i) => {
          const markerOpacity = (0, import_remotion3.interpolate)(
            frame - i * 10,
            [0, 30],
            [0, 0.5],
            { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
          );
          return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "circle",
            {
              cx: 200,
              cy: 620 - t * 560,
              r: "8",
              fill: COLORS.accent,
              opacity: markerOpacity
            },
            i
          );
        })
      ]
    }
  );
};
var Scene2 = ({ startFrame = 0 }) => {
  const frame = (0, import_remotion3.useCurrentFrame)();
  const adjustedFrame = frame - startFrame;
  const sceneStart = TIMING.scene2.start;
  const highlightFrame = SYNC_POINTS.step1 - sceneStart;
  const isStep1Highlighted = adjustedFrame >= highlightFrame - 30;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_remotion3.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(MountainPath2, { frame: adjustedFrame }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      Plateau,
      {
        numeral: "I",
        x: 35,
        y: 70,
        delay: 0,
        frame: adjustedFrame,
        isHighlighted: isStep1Highlighted
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      Plateau,
      {
        numeral: "II",
        x: 50,
        y: 50,
        delay: 12,
        frame: adjustedFrame
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      Plateau,
      {
        numeral: "III",
        x: 65,
        y: 30,
        delay: 24,
        frame: adjustedFrame
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      FloatingIcon,
      {
        icon: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(TreeStructureIcon, { size: 50, color: COLORS.accent }),
        x: 35,
        y: 58,
        delay: 36,
        frame: adjustedFrame
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      FloatingIcon,
      {
        icon: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ArrayIcon, { size: 50, color: COLORS.accent }),
        x: 50,
        y: 38,
        delay: 44,
        frame: adjustedFrame
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      FloatingIcon,
      {
        icon: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(GraphIcon, { size: 50, color: COLORS.accent }),
        x: 65,
        y: 18,
        delay: 52,
        frame: adjustedFrame
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "5%",
          left: "50%",
          transform: "translateX(-50%)",
          opacity: (0, import_remotion3.interpolate)(adjustedFrame, [0, 30], [0, 1], {
            extrapolateRight: "clamp"
          })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "h1",
          {
            style: {
              fontSize: 56,
              fontWeight: 700,
              color: COLORS.primary,
              fontFamily: 'Georgia, "Times New Roman", serif',
              textAlign: "center",
              margin: 0,
              letterSpacing: 2
            },
            children: "The Three Steps"
          }
        )
      }
    ),
    [
      { label: "Understanding", x: 35, y: 78 },
      { label: "Algorithms", x: 50, y: 58 },
      { label: "Practice", x: 65, y: 38 }
    ].map((step, i) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: `${step.x}%`,
          top: `${step.y}%`,
          transform: "translateX(-50%)",
          opacity: (0, import_remotion3.interpolate)(
            adjustedFrame - 60 - i * 10,
            [0, 20],
            [0, 0.8],
            { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
          )
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "span",
          {
            style: {
              fontSize: 28,
              color: COLORS.textLight,
              fontFamily: "Georgia, serif",
              fontStyle: "italic"
            },
            children: step.label
          }
        )
      },
      step.label
    ))
  ] });
};

// src/proj_5328527d_e022_4766_bec9_ac3b8c7d5c17/scenes/Scene3.tsx
var import_remotion4 = require("remotion");
var import_jsx_runtime5 = require("react/jsx-runtime");
var DataStructureCard = ({ icon, label, x, y, delay, frame, isGlowing }) => {
  const { fps } = (0, import_remotion4.useVideoConfig)();
  const progress = (0, import_remotion4.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG
  });
  const glowIntensity = isGlowing ? (0, import_remotion4.interpolate)(frame - delay, [0, 30], [0, 1], { extrapolateRight: "clamp" }) : 0;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) scale(${progress})`,
        opacity: progress
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
          "div",
          {
            style: {
              background: isGlowing ? `linear-gradient(135deg, ${COLORS.accent}30, ${COLORS.accent}10)` : "rgba(255,255,255,0.95)",
              border: `2px solid ${isGlowing ? COLORS.accent : COLORS.secondary}`,
              borderRadius: 12,
              padding: "16px 24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              boxShadow: isGlowing ? `0 0 40px ${COLORS.accent}50, 0 4px 16px rgba(0,0,0,0.15)` : "0 4px 16px rgba(0,0,0,0.1)"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { opacity: isGlowing ? 1 : 0.8 }, children: icon }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                "span",
                {
                  style: {
                    fontSize: 24,
                    fontWeight: 600,
                    color: COLORS.primary,
                    fontFamily: "Georgia, serif"
                  },
                  children: label
                }
              )
            ]
          }
        ),
        isGlowing && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              inset: -20,
              borderRadius: 24,
              background: `radial-gradient(circle, ${COLORS.accent}40 0%, transparent 70%)`,
              opacity: glowIntensity,
              animation: "pulse 2s ease-in-out infinite"
            }
          }
        )
      ]
    }
  );
};
var UnfurlingScroll = ({ content, x, y, delay, frame, isVisible }) => {
  const { fps } = (0, import_remotion4.useVideoConfig)();
  if (!isVisible) return null;
  const unfurlProgress = (0, import_remotion4.spring)({
    frame: frame - delay,
    fps,
    config: { ...SPRING_CONFIG, damping: 25 }
  });
  const scrollHeight = 200 * unfurlProgress;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: "translate(-50%, 0)",
        opacity: unfurlProgress
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              width: 280,
              height: 24,
              background: `linear-gradient(90deg, ${COLORS.secondary} 0%, #A0785C 50%, ${COLORS.secondary} 100%)`,
              borderRadius: 12,
              boxShadow: "0 4px 8px rgba(0,0,0,0.2)"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              width: 260,
              height: scrollHeight,
              marginLeft: 10,
              background: "#FDF5E6",
              borderLeft: `2px solid ${COLORS.secondary}`,
              borderRight: `2px solid ${COLORS.secondary}`,
              overflow: "hidden",
              boxShadow: "inset 0 0 20px rgba(139, 69, 19, 0.1)"
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { padding: 16 }, children: content.map((line, i) => {
              const lineOpacity = (0, import_remotion4.interpolate)(
                unfurlProgress,
                [i * 0.15, i * 0.15 + 0.3],
                [0, 1],
                { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
              );
              return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                "div",
                {
                  style: {
                    fontSize: 20,
                    color: COLORS.primary,
                    fontFamily: "Georgia, serif",
                    marginBottom: 8,
                    opacity: lineOpacity,
                    display: "flex",
                    alignItems: "center",
                    gap: 8
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { color: COLORS.accent }, children: "\u2192" }),
                    line
                  ]
                },
                i
              );
            }) })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              width: 280,
              height: 24,
              background: `linear-gradient(90deg, ${COLORS.secondary} 0%, #A0785C 50%, ${COLORS.secondary} 100%)`,
              borderRadius: 12,
              boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
              transform: `scaleY(${unfurlProgress})`,
              transformOrigin: "top"
            }
          }
        )
      ]
    }
  );
};
var FlowchartConnection = ({ from, to, delay, frame }) => {
  const { fps } = (0, import_remotion4.useVideoConfig)();
  const progress = (0, import_remotion4.spring)({
    frame: frame - delay,
    fps,
    config: { ...SPRING_CONFIG, damping: 30 }
  });
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2 - 5;
  const pathD = `M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`;
  const pathLength = 200;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "svg",
    {
      style: {
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none"
      },
      viewBox: "0 0 100 100",
      preserveAspectRatio: "none",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "path",
          {
            d: pathD,
            fill: "none",
            stroke: COLORS.accent,
            strokeWidth: "0.3",
            strokeDasharray: pathLength,
            strokeDashoffset: pathLength * (1 - progress),
            opacity: 0.7
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "circle",
          {
            cx: to.x,
            cy: to.y,
            r: "1",
            fill: COLORS.accent,
            opacity: progress
          }
        )
      ]
    }
  );
};
var FocusedPlateau = ({ numeral, x, y, delay, frame }) => {
  const { fps } = (0, import_remotion4.useVideoConfig)();
  const progress = (0, import_remotion4.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG
  });
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) scale(${progress})`,
        opacity: progress
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "div",
        {
          style: {
            background: `linear-gradient(180deg, #E8E0D5 0%, #D4C8B8 100%)`,
            border: `3px solid ${COLORS.secondary}`,
            borderRadius: 16,
            padding: "16px 32px",
            boxShadow: "0 6px 20px rgba(0,0,0,0.15)"
          },
          children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
            "span",
            {
              style: {
                fontSize: 40,
                fontWeight: 700,
                color: COLORS.primary,
                fontFamily: "Georgia, serif"
              },
              children: [
                "Step ",
                numeral
              ]
            }
          )
        }
      )
    }
  );
};
var Scene3 = ({ startFrame = 0 }) => {
  const frame = (0, import_remotion4.useCurrentFrame)();
  const adjustedFrame = frame - startFrame;
  const sceneStart = TIMING.scene3.start;
  const understandingFrame = SYNC_POINTS.understanding - sceneStart;
  const algorithmFrame = SYNC_POINTS.algorithm - sceneStart;
  const isUnderstandingPhase = adjustedFrame >= understandingFrame - 20;
  const isAlgorithmPhase = adjustedFrame >= algorithmFrame - 20;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_remotion4.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      FocusedPlateau,
      {
        numeral: "I",
        x: 25,
        y: 25,
        delay: 0,
        frame: adjustedFrame
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      FocusedPlateau,
      {
        numeral: "II",
        x: 75,
        y: 25,
        delay: 10,
        frame: adjustedFrame
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      DataStructureCard,
      {
        icon: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(TreeStructureIcon, { size: 40, color: isUnderstandingPhase ? COLORS.accent : COLORS.primary }),
        label: "Tree",
        x: 15,
        y: 45,
        delay: 20,
        frame: adjustedFrame,
        isGlowing: isUnderstandingPhase
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      DataStructureCard,
      {
        icon: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ArrayIcon, { size: 40, color: isUnderstandingPhase ? COLORS.accent : COLORS.primary }),
        label: "Array",
        x: 35,
        y: 45,
        delay: 28,
        frame: adjustedFrame,
        isGlowing: isUnderstandingPhase
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      DataStructureCard,
      {
        icon: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(GraphIcon, { size: 40, color: isUnderstandingPhase ? COLORS.accent : COLORS.primary }),
        label: "Graph",
        x: 25,
        y: 60,
        delay: 36,
        frame: adjustedFrame,
        isGlowing: isUnderstandingPhase
      }
    ),
    isUnderstandingPhase && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: "25%",
          top: "32%",
          transform: "translate(-50%, -50%)",
          opacity: (0, import_remotion4.interpolate)(
            adjustedFrame - understandingFrame,
            [0, 30],
            [0, 1],
            { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
          )
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(LightbulbIcon, { size: 50, color: COLORS.accent })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      UnfurlingScroll,
      {
        content: [
          "Sort algorithms",
          "Search patterns",
          "Traversal methods",
          "Optimization"
        ],
        x: 75,
        y: 40,
        delay: algorithmFrame,
        frame: adjustedFrame,
        isVisible: isAlgorithmPhase
      }
    ),
    isAlgorithmPhase && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: "75%",
          top: "32%",
          transform: "translate(-50%, -50%)",
          opacity: (0, import_remotion4.interpolate)(
            adjustedFrame - algorithmFrame,
            [0, 30],
            [0, 1],
            { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
          )
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ScrollIcon, { size: 50, color: COLORS.accent })
      }
    ),
    isAlgorithmPhase && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        FlowchartConnection,
        {
          from: { x: 35, y: 45 },
          to: { x: 60, y: 50 },
          delay: algorithmFrame + 20,
          frame: adjustedFrame
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        FlowchartConnection,
        {
          from: { x: 25, y: 55 },
          to: { x: 60, y: 55 },
          delay: algorithmFrame + 30,
          frame: adjustedFrame
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: "25%",
          top: "12%",
          transform: "translateX(-50%)",
          opacity: (0, import_remotion4.interpolate)(adjustedFrame, [10, 40], [0, 1], {
            extrapolateRight: "clamp"
          })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "h2",
          {
            style: {
              fontSize: 36,
              fontWeight: 600,
              color: COLORS.primary,
              fontFamily: "Georgia, serif",
              textAlign: "center"
            },
            children: "Understanding"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: "75%",
          top: "12%",
          transform: "translateX(-50%)",
          opacity: (0, import_remotion4.interpolate)(adjustedFrame - 10, [10, 40], [0, 1], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp"
          })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "h2",
          {
            style: {
              fontSize: 36,
              fontWeight: 600,
              color: COLORS.primary,
              fontFamily: "Georgia, serif",
              textAlign: "center"
            },
            children: "Algorithms"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "10%",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 20,
          opacity: (0, import_remotion4.interpolate)(adjustedFrame, [60, 90], [0, 1], {
            extrapolateRight: "clamp"
          })
        },
        children: ["I", "II", "III"].map((num, i) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              width: 50,
              height: 50,
              borderRadius: "50%",
              background: i < 2 ? COLORS.accent : "transparent",
              border: `3px solid ${i < 2 ? COLORS.accent : COLORS.secondary}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: i < 2 ? "#fff" : COLORS.secondary,
              fontFamily: "Georgia, serif",
              fontSize: 20,
              fontWeight: 700
            },
            children: num
          },
          num
        ))
      }
    )
  ] });
};

// src/proj_5328527d_e022_4766_bec9_ac3b8c7d5c17/scenes/Scene4.tsx
var import_remotion5 = require("remotion");
var import_jsx_runtime6 = require("react/jsx-runtime");
var ProblemBox = ({ difficulty, isCompleted, delay, frame, index }) => {
  const { fps } = (0, import_remotion5.useVideoConfig)();
  const progress = (0, import_remotion5.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG
  });
  const colors = {
    easy: COLORS.easy,
    medium: COLORS.medium,
    hard: COLORS.hard
  };
  const checkProgress = isCompleted ? (0, import_remotion5.spring)({
    frame: frame - delay - 10,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 120 }
  }) : 0;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
    "div",
    {
      style: {
        width: 60,
        height: 60,
        background: isCompleted ? colors[difficulty] : `${colors[difficulty]}30`,
        border: `3px solid ${colors[difficulty]}`,
        borderRadius: 8,
        transform: `scale(${progress})`,
        opacity: progress,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: isCompleted ? `0 0 15px ${colors[difficulty]}50` : "0 2px 8px rgba(0,0,0,0.1)",
        transition: "background 0.3s, box-shadow 0.3s"
      },
      children: [
        isCompleted && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { transform: `scale(${checkProgress})` }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(CheckmarkIcon, { size: 30, color: "#fff" }) }),
        !isCompleted && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "span",
          {
            style: {
              fontSize: 20,
              fontWeight: 600,
              color: colors[difficulty],
              fontFamily: "Georgia, serif"
            },
            children: index + 1
          }
        )
      ]
    }
  );
};
var DifficultySection = ({
  difficulty,
  label,
  y,
  boxCount,
  completedCount,
  delay,
  frame,
  isHighlighted
}) => {
  const { fps } = (0, import_remotion5.useVideoConfig)();
  const labelProgress = (0, import_remotion5.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG
  });
  const colors = {
    easy: COLORS.easy,
    medium: COLORS.medium,
    hard: COLORS.hard
  };
  const highlightGlow = isHighlighted ? (0, import_remotion5.interpolate)(frame - delay, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp"
  }) : 0;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "15%",
        top: `${y}%`,
        width: "70%"
      },
      children: [
        isHighlighted && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              inset: -20,
              background: `radial-gradient(ellipse, ${colors[difficulty]}20 0%, transparent 70%)`,
              opacity: highlightGlow,
              borderRadius: 20
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 16,
              opacity: labelProgress,
              transform: `translateX(${(1 - labelProgress) * -20}px)`
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                "div",
                {
                  style: {
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    background: colors[difficulty]
                  }
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                "span",
                {
                  style: {
                    fontSize: 32,
                    fontWeight: 600,
                    color: COLORS.primary,
                    fontFamily: "Georgia, serif"
                  },
                  children: label
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
                "span",
                {
                  style: {
                    fontSize: 24,
                    color: COLORS.textLight,
                    fontFamily: "Georgia, serif"
                  },
                  children: [
                    "(",
                    completedCount,
                    "/",
                    boxCount,
                    ")"
                  ]
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { display: "flex", gap: 12, flexWrap: "wrap" }, children: Array.from({ length: boxCount }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          ProblemBox,
          {
            difficulty,
            isCompleted: i < completedCount,
            delay: delay + 10 + i * 6,
            frame,
            index: i
          },
          i
        )) })
      ]
    }
  );
};
var ClassicalProgressBar = ({ progress, frame, showPercentage }) => {
  const { fps } = (0, import_remotion5.useVideoConfig)();
  const barEntrance = (0, import_remotion5.spring)({
    frame,
    fps,
    config: SPRING_CONFIG
  });
  const fillProgress = (0, import_remotion5.spring)({
    frame: frame - 30,
    fps,
    config: { ...SPRING_CONFIG, damping: 30 }
  });
  const displayValue = Math.round(progress * fillProgress);
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        bottom: "8%",
        left: "50%",
        transform: `translateX(-50%) scale(${barEntrance})`,
        width: "65%",
        opacity: barEntrance
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 8
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(RomanColumn, { height: 40 }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(RomanColumn, { height: 40 })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "div",
          {
            style: {
              background: "#E8E0D5",
              borderRadius: 12,
              height: 50,
              border: `3px solid ${COLORS.secondary}`,
              overflow: "hidden",
              boxShadow: "inset 0 4px 8px rgba(0,0,0,0.1)"
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              "div",
              {
                style: {
                  width: `${progress * fillProgress}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, ${COLORS.accent} 0%, ${COLORS.success} 100%)`,
                  borderRadius: 8,
                  boxShadow: `0 0 20px ${COLORS.accent}50`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  paddingRight: 16
                },
                children: showPercentage && fillProgress > 0.5 && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
                  "span",
                  {
                    style: {
                      fontSize: 28,
                      fontWeight: 700,
                      color: "#fff",
                      fontFamily: "Georgia, serif",
                      textShadow: "0 2px 4px rgba(0,0,0,0.3)"
                    },
                    children: [
                      displayValue,
                      "%"
                    ]
                  }
                )
              }
            )
          }
        ),
        showPercentage && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "div",
          {
            style: {
              textAlign: "center",
              marginTop: 12,
              opacity: (0, import_remotion5.interpolate)(fillProgress, [0.8, 1], [0, 1], {
                extrapolateRight: "clamp",
                extrapolateLeft: "clamp"
              })
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              "span",
              {
                style: {
                  fontSize: 24,
                  color: COLORS.primary,
                  fontFamily: "Georgia, serif"
                },
                children: "Mastery Level"
              }
            )
          }
        )
      ]
    }
  );
};
var RomanColumn = ({ height }) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
  "div",
  {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    },
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "div",
        {
          style: {
            width: 30,
            height: 8,
            background: COLORS.secondary,
            borderRadius: "4px 4px 0 0"
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "div",
        {
          style: {
            width: 16,
            height: height - 16,
            background: `linear-gradient(90deg, ${COLORS.secondary} 0%, #A0785C 50%, ${COLORS.secondary} 100%)`
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "div",
        {
          style: {
            width: 30,
            height: 8,
            background: COLORS.secondary,
            borderRadius: "0 0 4px 4px"
          }
        }
      )
    ]
  }
);
var Scene4 = ({ startFrame = 0 }) => {
  const frame = (0, import_remotion5.useCurrentFrame)();
  const adjustedFrame = frame - startFrame;
  const sceneStart = TIMING.scene4.start;
  const easyFrame = SYNC_POINTS.easyOnes - sceneStart;
  const mediumFrame = SYNC_POINTS.mediumOnes - sceneStart;
  const hardFrame = SYNC_POINTS.hardOnes - sceneStart;
  const eightyFrame = SYNC_POINTS.eightyPercent - sceneStart;
  const isEasyHighlighted = adjustedFrame >= easyFrame - 10;
  const isMediumHighlighted = adjustedFrame >= mediumFrame - 10;
  const isHardHighlighted = adjustedFrame >= hardFrame - 10;
  const showProgress = adjustedFrame >= eightyFrame - 30;
  const easyCompleted = isEasyHighlighted ? 6 : 0;
  const mediumCompleted = isMediumHighlighted ? 4 : 0;
  const hardCompleted = isHardHighlighted ? 2 : 0;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_remotion5.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "5%",
          left: "50%",
          transform: "translateX(-50%)",
          opacity: (0, import_remotion5.interpolate)(adjustedFrame, [0, 30], [0, 1], {
            extrapolateRight: "clamp"
          })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "h1",
          {
            style: {
              fontSize: 48,
              fontWeight: 700,
              color: COLORS.primary,
              fontFamily: "Georgia, serif",
              textAlign: "center",
              margin: 0
            },
            children: "Step III: Practice"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      DifficultySection,
      {
        difficulty: "easy",
        label: "Easy Problems",
        y: 18,
        boxCount: 6,
        completedCount: easyCompleted,
        delay: 20,
        frame: adjustedFrame,
        isHighlighted: isEasyHighlighted
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      DifficultySection,
      {
        difficulty: "medium",
        label: "Medium Problems",
        y: 40,
        boxCount: 5,
        completedCount: mediumCompleted,
        delay: 50,
        frame: adjustedFrame,
        isHighlighted: isMediumHighlighted
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      DifficultySection,
      {
        difficulty: "hard",
        label: "Hard Problems",
        y: 62,
        boxCount: 4,
        completedCount: hardCompleted,
        delay: 80,
        frame: adjustedFrame,
        isHighlighted: isHardHighlighted
      }
    ),
    showProgress && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      ClassicalProgressBar,
      {
        progress: 80,
        frame: adjustedFrame - eightyFrame + 30,
        showPercentage: true
      }
    )
  ] });
};

// src/proj_5328527d_e022_4766_bec9_ac3b8c7d5c17/scenes/Scene5.tsx
var import_remotion6 = require("remotion");
var import_jsx_runtime7 = require("react/jsx-runtime");
var RomanClock = ({ frame, isSpinning, delay }) => {
  const { fps } = (0, import_remotion6.useVideoConfig)();
  const entrance = (0, import_remotion6.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG
  });
  const hourRotation = isSpinning ? (frame - delay) * 15 : (frame - delay) * 0.5;
  const minuteRotation = isSpinning ? (frame - delay) * 45 : (frame - delay) * 2;
  const romanNumerals = [
    { num: "XII", angle: 0 },
    { num: "I", angle: 30 },
    { num: "II", angle: 60 },
    { num: "III", angle: 90 },
    { num: "IV", angle: 120 },
    { num: "V", angle: 150 },
    { num: "VI", angle: 180 },
    { num: "VII", angle: 210 },
    { num: "VIII", angle: 240 },
    { num: "IX", angle: 270 },
    { num: "X", angle: 300 },
    { num: "XI", angle: 330 }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "30%",
        top: "25%",
        transform: `translate(-50%, -50%) scale(${entrance})`,
        width: 280,
        height: 280
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
          "div",
          {
            style: {
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: "#FDF5E6",
              border: `6px solid ${COLORS.secondary}`,
              boxShadow: isSpinning ? `0 0 40px ${COLORS.accent}60, 0 8px 24px rgba(0,0,0,0.3)` : "0 8px 24px rgba(0,0,0,0.2)",
              position: "relative"
            },
            children: [
              romanNumerals.map(({ num, angle }) => {
                const radians = (angle - 90) * (Math.PI / 180);
                const radius = 100;
                const x = 140 + radius * Math.cos(radians);
                const y = 140 + radius * Math.sin(radians);
                return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                  "span",
                  {
                    style: {
                      position: "absolute",
                      left: x,
                      top: y,
                      transform: "translate(-50%, -50%)",
                      fontSize: num === "XII" || num === "VI" ? 22 : 18,
                      fontWeight: 600,
                      color: COLORS.primary,
                      fontFamily: "Georgia, serif"
                    },
                    children: num
                  },
                  num
                );
              }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                "div",
                {
                  style: {
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: 8,
                    height: 70,
                    background: COLORS.primary,
                    borderRadius: 4,
                    transformOrigin: "center top",
                    transform: `translateX(-50%) rotate(${hourRotation}deg)`
                  }
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                "div",
                {
                  style: {
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: 5,
                    height: 95,
                    background: COLORS.secondary,
                    borderRadius: 3,
                    transformOrigin: "center top",
                    transform: `translateX(-50%) rotate(${minuteRotation}deg)`
                  }
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                "div",
                {
                  style: {
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: 16,
                    height: 16,
                    background: COLORS.accent,
                    borderRadius: "50%",
                    transform: "translate(-50%, -50%)"
                  }
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            style: {
              textAlign: "center",
              marginTop: 20
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
              "span",
              {
                style: {
                  fontSize: 28,
                  fontWeight: 600,
                  color: COLORS.primary,
                  fontFamily: "Georgia, serif"
                },
                children: "Whole Day"
              }
            )
          }
        )
      ]
    }
  );
};
var DreamCloud = ({ x, y, scale, delay, frame, symbols }) => {
  const { fps } = (0, import_remotion6.useVideoConfig)();
  const entrance = (0, import_remotion6.spring)({
    frame: frame - delay,
    fps,
    config: { ...SPRING_CONFIG, damping: 25 }
  });
  const floatY = Math.sin((frame - delay) * 0.03) * 10;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) translateY(${floatY}px) scale(${entrance * scale})`,
        opacity: entrance * 0.9
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("svg", { width: "200", height: "120", viewBox: "0 0 200 120", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("defs", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("filter", { id: "cloud-blur", x: "-20%", y: "-20%", width: "140%", height: "140%", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("feGaussianBlur", { in: "SourceGraphic", stdDeviation: "3" }) }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("linearGradient", { id: "cloud-gradient", x1: "0%", y1: "0%", x2: "100%", y2: "100%", children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("stop", { offset: "0%", stopColor: "#fff", stopOpacity: "0.95" }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("stop", { offset: "100%", stopColor: "#E8E0D5", stopOpacity: "0.85" })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("ellipse", { cx: "100", cy: "70", rx: "80", ry: "40", fill: "url(#cloud-gradient)", filter: "url(#cloud-blur)" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("ellipse", { cx: "60", cy: "60", rx: "50", ry: "30", fill: "url(#cloud-gradient)", filter: "url(#cloud-blur)" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("ellipse", { cx: "140", cy: "60", rx: "50", ry: "30", fill: "url(#cloud-gradient)", filter: "url(#cloud-blur)" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("ellipse", { cx: "100", cy: "50", rx: "60", ry: "35", fill: "url(#cloud-gradient)", filter: "url(#cloud-blur)" })
        ] }),
        symbols.map((symbol, i) => {
          const symbolFloat = Math.sin((frame - delay + i * 20) * 0.05) * 5;
          const symbolX = 50 + (i - 1) * 40;
          return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            "span",
            {
              style: {
                position: "absolute",
                left: symbolX,
                top: 45 + symbolFloat,
                fontSize: 24,
                color: COLORS.accent,
                fontFamily: "Georgia, serif",
                fontWeight: 600,
                opacity: 0.8
              },
              children: symbol
            },
            i
          );
        })
      ]
    }
  );
};
var SolutionScroll = ({ frame, delay, isVisible }) => {
  const { fps } = (0, import_remotion6.useVideoConfig)();
  if (!isVisible) return null;
  const unfurlProgress = (0, import_remotion6.spring)({
    frame: frame - delay,
    fps,
    config: { ...SPRING_CONFIG, damping: 25 }
  });
  const glowIntensity = (0, import_remotion6.interpolate)(
    unfurlProgress,
    [0.5, 1],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "65%",
        transform: "translateX(-50%)",
        width: "55%",
        opacity: unfurlProgress
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              inset: -30,
              background: `radial-gradient(ellipse, ${COLORS.accent}40 0%, transparent 70%)`,
              opacity: glowIntensity,
              borderRadius: 30
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            style: {
              width: "100%",
              height: 30,
              background: `linear-gradient(90deg, ${COLORS.secondary} 0%, #A0785C 50%, ${COLORS.secondary} 100%)`,
              borderRadius: 15,
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            style: {
              width: "calc(100% - 20px)",
              marginLeft: 10,
              height: 180 * unfurlProgress,
              background: "#FDF5E6",
              borderLeft: `3px solid ${COLORS.secondary}`,
              borderRight: `3px solid ${COLORS.secondary}`,
              overflow: "hidden",
              boxShadow: `inset 0 0 30px ${COLORS.accent}20`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { padding: 24 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                "div",
                {
                  style: {
                    fontSize: 28,
                    fontWeight: 700,
                    color: COLORS.accent,
                    fontFamily: "Georgia, serif",
                    marginBottom: 16,
                    textAlign: "center",
                    opacity: (0, import_remotion6.interpolate)(unfurlProgress, [0.3, 0.6], [0, 1], {
                      extrapolateRight: "clamp",
                      extrapolateLeft: "clamp"
                    })
                  },
                  children: "Solutions Revealed"
                }
              ),
              ["Pattern Recognition", "Optimal Approach", "Clean Implementation"].map((item, i) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 12,
                    opacity: (0, import_remotion6.interpolate)(
                      unfurlProgress,
                      [0.4 + i * 0.15, 0.6 + i * 0.15],
                      [0, 1],
                      { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
                    )
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(LightbulbIcon, { size: 24, color: COLORS.accent }),
                    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                      "span",
                      {
                        style: {
                          fontSize: 22,
                          color: COLORS.primary,
                          fontFamily: "Georgia, serif"
                        },
                        children: item
                      }
                    )
                  ]
                },
                item
              ))
            ] })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            style: {
              width: "100%",
              height: 30,
              background: `linear-gradient(90deg, ${COLORS.secondary} 0%, #A0785C 50%, ${COLORS.secondary} 100%)`,
              borderRadius: 15,
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              transform: `scaleY(${unfurlProgress})`,
              transformOrigin: "top"
            }
          }
        )
      ]
    }
  );
};
var Scene5 = ({ startFrame = 0 }) => {
  const frame = (0, import_remotion6.useCurrentFrame)();
  const adjustedFrame = frame - startFrame;
  const sceneStart = TIMING.scene5.start;
  const wholeDayFrame = SYNC_POINTS.wholeDay - sceneStart;
  const dreamsFrame = SYNC_POINTS.dreams - sceneStart;
  const solutionsFrame = SYNC_POINTS.solutions - sceneStart;
  const isClockSpinning = adjustedFrame >= wholeDayFrame - 30;
  const showDreams = adjustedFrame >= dreamsFrame - 20;
  const showSolutions = adjustedFrame >= solutionsFrame - 20;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_remotion6.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "5%",
          left: "50%",
          transform: "translateX(-50%)",
          opacity: (0, import_remotion6.interpolate)(adjustedFrame, [0, 30], [0, 1], {
            extrapolateRight: "clamp"
          })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "h1",
          {
            style: {
              fontSize: 48,
              fontWeight: 700,
              color: COLORS.primary,
              fontFamily: "Georgia, serif",
              textAlign: "center",
              margin: 0
            },
            children: "Deep Persistence"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      RomanClock,
      {
        frame: adjustedFrame,
        isSpinning: isClockSpinning,
        delay: 20
      }
    ),
    showDreams && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        DreamCloud,
        {
          x: 72,
          y: 30,
          scale: 1,
          delay: dreamsFrame,
          frame: adjustedFrame,
          symbols: ["\u2211", "\u2192", "\u221E"]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        DreamCloud,
        {
          x: 78,
          y: 45,
          scale: 0.8,
          delay: dreamsFrame + 15,
          frame: adjustedFrame,
          symbols: ["{}", "[]", "()"]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        DreamCloud,
        {
          x: 68,
          y: 55,
          scale: 0.7,
          delay: dreamsFrame + 30,
          frame: adjustedFrame,
          symbols: ["O(n)", "log"]
        }
      )
    ] }),
    showDreams && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: "75%",
          top: "18%",
          transform: "translateX(-50%)",
          opacity: (0, import_remotion6.interpolate)(
            adjustedFrame - dreamsFrame,
            [0, 30],
            [0, 1],
            { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
          )
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "span",
          {
            style: {
              fontSize: 28,
              fontWeight: 600,
              color: COLORS.primary,
              fontFamily: "Georgia, serif",
              fontStyle: "italic"
            },
            children: "Even in Dreams..."
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      SolutionScroll,
      {
        frame: adjustedFrame,
        delay: solutionsFrame,
        isVisible: showSolutions
      }
    )
  ] });
};

// src/proj_5328527d_e022_4766_bec9_ac3b8c7d5c17/scenes/Scene6.tsx
var import_remotion7 = require("remotion");
var import_jsx_runtime8 = require("react/jsx-runtime");
var CompleteMountain = ({ frame }) => {
  const { fps } = (0, import_remotion7.useVideoConfig)();
  const entrance = (0, import_remotion7.spring)({
    frame,
    fps,
    config: SPRING_CONFIG
  });
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    "svg",
    {
      viewBox: "0 0 400 600",
      style: {
        position: "absolute",
        left: "50%",
        top: "12%",
        width: "80%",
        height: "65%",
        transform: `translateX(-50%) scale(${entrance})`,
        opacity: entrance
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "path",
          {
            d: "M200 30 L380 550 L20 550 Z",
            fill: COLORS.primary,
            opacity: "0.1"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "path",
          {
            d: "M200 520\n           Q120 450 200 380\n           Q280 310 200 240\n           Q120 170 200 100\n           Q280 50 200 30",
            fill: "none",
            stroke: COLORS.success,
            strokeWidth: "8",
            strokeLinecap: "round",
            opacity: "0.8"
          }
        ),
        [
          { y: 400, num: "I" },
          { y: 280, num: "II" },
          { y: 160, num: "III" }
        ].map(({ y, num }, i) => {
          const plateauOpacity = (0, import_remotion7.interpolate)(
            frame - i * 10,
            [0, 30],
            [0, 1],
            { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
          );
          return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("g", { opacity: plateauOpacity, children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              "rect",
              {
                x: 165,
                y: y - 20,
                width: 70,
                height: 40,
                rx: 8,
                fill: "#E8E0D5",
                stroke: COLORS.secondary,
                strokeWidth: "2"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              "text",
              {
                x: 200,
                y: y + 8,
                textAnchor: "middle",
                fill: COLORS.primary,
                fontSize: "24",
                fontFamily: "Georgia, serif",
                fontWeight: "700",
                children: num
              }
            )
          ] }, num);
        })
      ]
    }
  );
};
var PathCheckmarks = ({ frame }) => {
  const checkpoints = [
    { x: 38, y: 60 },
    { x: 55, y: 48 },
    { x: 45, y: 35 }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_jsx_runtime8.Fragment, { children: checkpoints.map((pos, i) => {
    const checkProgress = (0, import_remotion7.spring)({
      frame: frame - 30 - i * 15,
      fps: 30,
      config: { ...SPRING_CONFIG, stiffness: 120 }
    });
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: `${pos.x}%`,
          top: `${pos.y}%`,
          transform: `translate(-50%, -50%) scale(${checkProgress})`,
          opacity: checkProgress
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "div",
          {
            style: {
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: COLORS.success,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 15px ${COLORS.success}50`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(CheckmarkIcon, { size: 24, color: "#fff" })
          }
        )
      },
      i
    );
  }) });
};
var SummitTrophy = ({ frame, delay, isVisible }) => {
  const { fps } = (0, import_remotion7.useVideoConfig)();
  if (!isVisible) return null;
  const entrance = (0, import_remotion7.spring)({
    frame: frame - delay,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 80 }
  });
  const glowPulse = Math.sin((frame - delay) * 0.1) * 0.2 + 0.8;
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "15%",
        transform: `translate(-50%, -50%) scale(${entrance})`,
        opacity: entrance
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              inset: -50,
              background: `radial-gradient(circle, ${COLORS.accent}60 0%, transparent 70%)`,
              opacity: glowPulse,
              borderRadius: "50%"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)"
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(LaurelWreathIcon, { size: 160, color: COLORS.success })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "div",
          {
            style: {
              position: "relative",
              zIndex: 1
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(TrophyIcon, { size: 80, color: COLORS.accent })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "div",
          {
            style: {
              marginTop: 20,
              textAlign: "center"
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              "span",
              {
                style: {
                  fontSize: 36,
                  fontWeight: 700,
                  color: COLORS.accent,
                  fontFamily: "Georgia, serif",
                  textShadow: `0 0 20px ${COLORS.accent}50`
                },
                children: "Success!"
              }
            )
          }
        )
      ]
    }
  );
};
var FutureBanner = ({ frame, delay, isVisible }) => {
  const { fps } = (0, import_remotion7.useVideoConfig)();
  if (!isVisible) return null;
  const unfurlProgress = (0, import_remotion7.spring)({
    frame: frame - delay,
    fps,
    config: { ...SPRING_CONFIG, damping: 25 }
  });
  const textOpacity = (0, import_remotion7.interpolate)(
    unfurlProgress,
    [0.5, 1],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        bottom: "8%",
        left: "50%",
        transform: `translateX(-50%) scaleY(${unfurlProgress})`,
        transformOrigin: "top",
        width: "75%",
        opacity: unfurlProgress
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "div",
          {
            style: {
              height: 20,
              background: `linear-gradient(90deg, ${COLORS.accent} 0%, ${COLORS.secondary} 50%, ${COLORS.accent} 100%)`,
              borderRadius: "10px 10px 0 0"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
          "div",
          {
            style: {
              background: `linear-gradient(180deg, #FDF5E6 0%, #F5ECD9 100%)`,
              border: `3px solid ${COLORS.secondary}`,
              borderTop: "none",
              padding: "30px 40px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                "div",
                {
                  style: {
                    textAlign: "center",
                    opacity: textOpacity
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                    "span",
                    {
                      style: {
                        fontSize: 24,
                        color: COLORS.textLight,
                        fontFamily: "Georgia, serif",
                        fontStyle: "italic"
                      },
                      children: "Coming Soon..."
                    }
                  )
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                "div",
                {
                  style: {
                    textAlign: "center",
                    marginTop: 12,
                    opacity: textOpacity
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                    "span",
                    {
                      style: {
                        fontSize: 40,
                        fontWeight: 700,
                        color: COLORS.primary,
                        fontFamily: "Georgia, serif"
                      },
                      children: "Two-Month"
                    }
                  )
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                "div",
                {
                  style: {
                    textAlign: "center",
                    opacity: textOpacity
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                    "span",
                    {
                      style: {
                        fontSize: 36,
                        fontWeight: 600,
                        color: COLORS.accent,
                        fontFamily: "Georgia, serif"
                      },
                      children: "Preparation Strategy"
                    }
                  )
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                "div",
                {
                  style: {
                    textAlign: "center",
                    marginTop: 20,
                    opacity: textOpacity
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                    "div",
                    {
                      style: {
                        display: "inline-block",
                        background: COLORS.accent,
                        padding: "12px 32px",
                        borderRadius: 8,
                        boxShadow: `0 4px 12px ${COLORS.accent}40`
                      },
                      children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                        "span",
                        {
                          style: {
                            fontSize: 24,
                            fontWeight: 600,
                            color: "#fff",
                            fontFamily: "Georgia, serif"
                          },
                          children: "Follow for More"
                        }
                      )
                    }
                  )
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "svg",
          {
            width: "100%",
            height: "30",
            viewBox: "0 0 100 30",
            preserveAspectRatio: "none",
            children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              "path",
              {
                d: "M0 0 L50 30 L100 0",
                fill: COLORS.secondary
              }
            )
          }
        )
      ]
    }
  );
};
var Scene6 = ({ startFrame = 0 }) => {
  const frame = (0, import_remotion7.useCurrentFrame)();
  const adjustedFrame = frame - startFrame;
  const sceneStart = TIMING.scene6.start;
  const workedOutFrame = SYNC_POINTS.workedOut - sceneStart;
  const followFrame = SYNC_POINTS.follow - sceneStart;
  const showTrophy = adjustedFrame >= workedOutFrame - 20;
  const showBanner = adjustedFrame >= followFrame - 30;
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_remotion7.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "3%",
          left: "50%",
          transform: "translateX(-50%)",
          opacity: (0, import_remotion7.interpolate)(adjustedFrame, [0, 30], [0, 1], {
            extrapolateRight: "clamp"
          })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "h1",
          {
            style: {
              fontSize: 44,
              fontWeight: 700,
              color: COLORS.primary,
              fontFamily: "Georgia, serif",
              textAlign: "center",
              margin: 0
            },
            children: "The Journey Complete"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(CompleteMountain, { frame: adjustedFrame }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(PathCheckmarks, { frame: adjustedFrame }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      SummitTrophy,
      {
        frame: adjustedFrame,
        delay: workedOutFrame,
        isVisible: showTrophy
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      FutureBanner,
      {
        frame: adjustedFrame,
        delay: followFrame,
        isVisible: showBanner
      }
    )
  ] });
};

// src/proj_5328527d_e022_4766_bec9_ac3b8c7d5c17/index.tsx
var import_jsx_runtime9 = require("react/jsx-runtime");
var MainComposition = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_remotion8.AbsoluteFill, { style: { backgroundColor: COLORS.background }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Background, {}, "background"),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      import_remotion8.Sequence,
      {
        from: TIMING.scene1.start,
        durationInFrames: TIMING.scene1.end - TIMING.scene1.start,
        children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Scene1, { startFrame: 0 })
      },
      "scene1"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      import_remotion8.Sequence,
      {
        from: TIMING.scene2.start,
        durationInFrames: TIMING.scene2.end - TIMING.scene2.start,
        children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Scene2, { startFrame: 0 })
      },
      "scene2"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      import_remotion8.Sequence,
      {
        from: TIMING.scene3.start,
        durationInFrames: TIMING.scene3.end - TIMING.scene3.start,
        children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Scene3, { startFrame: 0 })
      },
      "scene3"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      import_remotion8.Sequence,
      {
        from: TIMING.scene4.start,
        durationInFrames: TIMING.scene4.end - TIMING.scene4.start,
        children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Scene4, { startFrame: 0 })
      },
      "scene4"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      import_remotion8.Sequence,
      {
        from: TIMING.scene5.start,
        durationInFrames: TIMING.scene5.end - TIMING.scene5.start,
        children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Scene5, { startFrame: 0 })
      },
      "scene5"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      import_remotion8.Sequence,
      {
        from: TIMING.scene6.start,
        durationInFrames: TIMING.scene6.end - TIMING.scene6.start,
        children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Scene6, { startFrame: 0 })
      },
      "scene6"
    )
  ] });
};
var RemotionRoot = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
    import_remotion8.Composition,
    {
      id: "proj_5328527d_e022_4766_bec9_ac3b8c7d5c17",
      component: MainComposition,
      durationInFrames: VIDEO_CONFIG.durationInFrames,
      fps: VIDEO_CONFIG.fps,
      width: VIDEO_CONFIG.width,
      height: VIDEO_CONFIG.height
    }
  );
};
var index_default = MainComposition;
(0, import_remotion8.registerRoot)(RemotionRoot);
