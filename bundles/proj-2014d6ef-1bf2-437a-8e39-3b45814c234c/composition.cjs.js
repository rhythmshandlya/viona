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

// src/proj_2014d6ef_1bf2_437a_8e39_3b45814c234c/index.tsx
var index_exports = {};
__export(index_exports, {
  Proj2014d6ef1bf2437a8e393b45814c234c: () => Proj2014d6ef1bf2437a8e393b45814c234c
});
module.exports = __toCommonJS(index_exports);
var import_remotion5 = require("remotion");

// src/proj_2014d6ef_1bf2_437a_8e39_3b45814c234c/constants.ts
var COLORS = {
  background: "#000000",
  primary: "#ffffff",
  accent: "#ef4444",
  // Red
  secondary: "#eab308",
  // Yellow
  muted: "#444444",
  text: "#ffffff",
  glow: "rgba(239, 68, 68, 0.4)"
};
var TIMING = {
  intro: 60,
  // [0:00 - 0:02]
  priorityQueue: 360,
  // [0:02 - 0:14]
  priorityQueueProblem: 300,
  // [0:14 - 0:24]
  bottleneck: 300,
  // [0:24 - 0:34]
  timingWheelIntro: 210,
  // [0:35 - 0:41]
  clockFace: 360,
  // [0:42 - 0:53]
  hierarchy: 630,
  // [0:54 - 1:15]
  conclusion: 150,
  // [1:15 - 1:20]
  kafkaNetty: 240,
  // [1:20 - 1:28]
  outro: 280
  // [1:28 - 1:37]
};

// src/proj_2014d6ef_1bf2_437a_8e39_3b45814c234c/components/BigTitle.tsx
var import_remotion2 = require("remotion");

// src/proj_2014d6ef_1bf2_437a_8e39_3b45814c234c/components/useResponsive.ts
var import_remotion = require("remotion");
var useResponsive = () => {
  const { width, height } = (0, import_remotion.useVideoConfig)();
  const minDim = Math.min(width, height);
  return {
    padding: minDim * 0.05,
    gap: {
      xs: minDim * 0.01,
      sm: minDim * 0.02,
      md: minDim * 0.03,
      lg: minDim * 0.05,
      xl: minDim * 0.08
    },
    radius: {
      sm: minDim * 0.01,
      md: minDim * 0.02,
      lg: minDim * 0.03,
      full: minDim * 0.5
    },
    fontSize: {
      xs: height * 0.018,
      sm: height * 0.022,
      md: height * 0.028,
      lg: height * 0.038,
      xl: height * 0.05,
      xxl: height * 0.07
    },
    size: {
      icon: minDim * 0.1,
      node: minDim * 0.15,
      card: minDim * 0.3
    },
    glow: {
      sm: minDim * 0.01,
      md: minDim * 0.02,
      lg: minDim * 0.04
    },
    borderWidth: Math.max(2, minDim * 5e-3)
  };
};

// src/proj_2014d6ef_1bf2_437a_8e39_3b45814c234c/components/BigTitle.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var BigTitle = ({ text, color = COLORS.primary, subtitle }) => {
  const frame = (0, import_remotion2.useCurrentFrame)();
  const { fps } = (0, import_remotion2.useVideoConfig)();
  const r = useResponsive();
  const scale = (0, import_remotion2.spring)({ frame, fps, config: { damping: 12, stiffness: 120 } });
  const opacity = (0, import_remotion2.interpolate)(frame, [0, 20], [0, 1]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: r.padding,
    textAlign: "center",
    width: "100%"
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { style: {
      fontSize: r.fontSize.xxl,
      fontWeight: 900,
      color,
      margin: 0,
      textTransform: "uppercase",
      letterSpacing: "-2px",
      lineHeight: 0.9,
      transform: `scale(${scale})`,
      opacity,
      whiteSpace: "pre-wrap",
      wordWrap: "break-word",
      maxWidth: "100%"
    }, children: text }),
    subtitle && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: {
      fontSize: r.fontSize.lg,
      color: COLORS.secondary,
      marginTop: r.gap.sm,
      fontWeight: 700,
      opacity
    }, children: subtitle })
  ] });
};

// src/proj_2014d6ef_1bf2_437a_8e39_3b45814c234c/components/BinaryHeap.tsx
var import_remotion3 = require("remotion");
var import_jsx_runtime2 = require("react/jsx-runtime");
var BinaryHeap = () => {
  const frame = (0, import_remotion3.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion3.useVideoConfig)();
  const r = useResponsive();
  const nodes = [10, 20, 30, 40, 50, 60, 70];
  const nodeRadius = r.size.node * 0.5;
  const pos = [
    { x: 0, y: -0.3 },
    // Root
    { x: -0.2, y: -0.1 },
    { x: 0.2, y: -0.1 },
    // Level 1
    { x: -0.3, y: 0.1 },
    { x: -0.12, y: 0.1 },
    { x: 0.12, y: 0.1 },
    { x: 0.3, y: 0.1 }
    // Level 2
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_remotion3.AbsoluteFill, { style: { display: "flex", alignItems: "center", justifyContent: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { position: "relative", width: "100%", height: "100%" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { style: { position: "absolute", width: "100%", height: "100%" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("line", { x1: width * 0.5 + pos[0].x * width, y1: height * 0.5 + pos[0].y * height, x2: width * 0.5 + pos[1].x * width, y2: height * 0.5 + pos[1].y * height, stroke: COLORS.primary, strokeWidth: r.borderWidth }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("line", { x1: width * 0.5 + pos[0].x * width, y1: height * 0.5 + pos[0].y * height, x2: width * 0.5 + pos[2].x * width, y2: height * 0.5 + pos[2].y * height, stroke: COLORS.primary, strokeWidth: r.borderWidth }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("line", { x1: width * 0.5 + pos[1].x * width, y1: height * 0.5 + pos[1].y * height, x2: width * 0.5 + pos[3].x * width, y2: height * 0.5 + pos[3].y * height, stroke: COLORS.primary, strokeWidth: r.borderWidth }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("line", { x1: width * 0.5 + pos[1].x * width, y1: height * 0.5 + pos[1].y * height, x2: width * 0.5 + pos[4].x * width, y2: height * 0.5 + pos[4].y * height, stroke: COLORS.primary, strokeWidth: r.borderWidth }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("line", { x1: width * 0.5 + pos[2].x * width, y1: height * 0.5 + pos[2].y * height, x2: width * 0.5 + pos[5].x * width, y2: height * 0.5 + pos[5].y * height, stroke: COLORS.primary, strokeWidth: r.borderWidth }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("line", { x1: width * 0.5 + pos[2].x * width, y1: height * 0.5 + pos[2].y * height, x2: width * 0.5 + pos[6].x * width, y2: height * 0.5 + pos[6].y * height, stroke: COLORS.primary, strokeWidth: r.borderWidth })
    ] }),
    pos.map((p, i) => {
      const delay = i * 5;
      const scale = (0, import_remotion3.spring)({ frame: frame - delay, fps, config: { damping: 12, stiffness: 100 } });
      const shake = i === 0 ? Math.sin(frame * 0.5) * 5 * (0, import_remotion3.interpolate)(frame, [100, 150], [0, 1], { extrapolateRight: "clamp" }) : 0;
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: width * 0.5 + p.x * width - nodeRadius + shake,
            top: height * 0.5 + p.y * height - nodeRadius,
            width: r.size.node,
            height: r.size.node,
            borderRadius: r.radius.full,
            background: COLORS.background,
            border: `${r.borderWidth}px solid ${i === 0 && frame > 100 ? COLORS.accent : COLORS.primary}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: i === 0 && frame > 100 ? COLORS.accent : COLORS.primary,
            fontSize: r.fontSize.md,
            fontWeight: 800,
            transform: `scale(${scale})`,
            boxShadow: i === 0 && frame > 100 ? `0 0 ${r.glow.lg}px ${COLORS.accent}` : "none"
          },
          children: nodes[i]
        },
        i
      );
    })
  ] }) });
};

// src/proj_2014d6ef_1bf2_437a_8e39_3b45814c234c/components/TimingWheel.tsx
var import_remotion4 = require("remotion");
var import_jsx_runtime3 = require("react/jsx-runtime");
var TimingWheel = ({ rotationOffset = 0 }) => {
  const frame = (0, import_remotion4.useCurrentFrame)();
  const { width, height } = (0, import_remotion4.useVideoConfig)();
  const r = useResponsive();
  const minDim = Math.min(width, height);
  const wheelSize = minDim * 0.7;
  const slotCount = 12;
  const rotation = frame * 0.5 + rotationOffset;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
    width: wheelSize,
    height: wheelSize,
    borderRadius: "50%",
    border: `${r.borderWidth}px solid ${COLORS.primary}`,
    position: "relative",
    transform: `rotate(${rotation}deg)`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: `0 0 ${r.glow.md}px ${COLORS.primary}44`
  }, children: [
    Array.from({ length: slotCount }).map((_, i) => {
      const angle = i / slotCount * 2 * Math.PI;
      const x = Math.cos(angle) * (wheelSize * 0.4);
      const y = Math.sin(angle) * (wheelSize * 0.4);
      const hasTask = i % 3 === 0;
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: wheelSize * 0.5 + x - r.size.icon * 0.3,
            top: wheelSize * 0.5 + y - r.size.icon * 0.3,
            width: r.size.icon * 0.6,
            height: r.size.icon * 0.6,
            borderRadius: r.radius.sm,
            background: hasTask ? COLORS.accent : "transparent",
            border: `${r.borderWidth * 0.5}px solid ${COLORS.primary}`,
            boxShadow: hasTask ? `0 0 ${r.glow.sm}px ${COLORS.accent}` : "none",
            transform: `rotate(${-rotation}deg)`
            // Keep tasks upright
          }
        },
        i
      );
    }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
      width: r.size.icon * 0.4,
      height: r.size.icon * 0.4,
      borderRadius: "50%",
      background: COLORS.primary
    } }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
      position: "absolute",
      width: r.borderWidth,
      height: wheelSize * 0.45,
      background: COLORS.accent,
      bottom: "50%",
      transformOrigin: "bottom",
      boxShadow: `0 0 ${r.glow.sm}px ${COLORS.accent}`
    } })
  ] });
};
var HierarchicalTimingWheel = () => {
  const frame = (0, import_remotion4.useCurrentFrame)();
  const { width } = (0, import_remotion4.useVideoConfig)();
  const r = useResponsive();
  const moveOut = (0, import_remotion4.interpolate)(frame, [0, 60], [0, 1], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_remotion4.AbsoluteFill, { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: r.gap.xl, flexDirection: "row" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { transform: `translateX(${-moveOut * width * 0.15}px)` }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { color: COLORS.primary, marginBottom: r.gap.sm, textAlign: "center", fontSize: r.fontSize.sm, fontWeight: "bold" }, children: "SECONDS WHEEL" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(TimingWheel, {})
    ] }),
    frame > 30 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { transform: `translateX(${moveOut * width * 0.15}px)`, opacity: moveOut }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { color: COLORS.secondary, marginBottom: r.gap.sm, textAlign: "center", fontSize: r.fontSize.sm, fontWeight: "bold" }, children: "MINUTES WHEEL" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(TimingWheel, { rotationOffset: 45 })
    ] })
  ] });
};

// src/proj_2014d6ef_1bf2_437a_8e39_3b45814c234c/index.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
var Proj2014d6ef1bf2437a8e393b45814c234c = () => {
  const r = useResponsive();
  let currentFrame = 0;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_remotion5.AbsoluteFill, { style: { backgroundColor: COLORS.background, color: COLORS.text, fontFamily: "system-ui, sans-serif", overflow: "hidden" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_remotion5.Sequence, { from: currentFrame, durationInFrames: TIMING.intro, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BigTitle, { text: "SYSTEM DESIGN CHALLENGE", subtitle: "MILLIONS OF TASKS" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_remotion5.Sequence, { from: currentFrame += TIMING.intro, durationInFrames: TIMING.priorityQueue, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", flexDirection: "column", height: "100%" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { flex: "0 0 20%" }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BigTitle, { text: "PRIORITY QUEUE", subtitle: "BINARY HEAP" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { flex: 1, position: "relative" }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BinaryHeap, {}) })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_remotion5.Sequence, { from: currentFrame += TIMING.priorityQueue, durationInFrames: TIMING.priorityQueueProblem, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", flexDirection: "column", height: "100%" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { flex: "0 0 20%" }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BigTitle, { text: "THE TRAP", color: COLORS.accent, subtitle: "O(log n) TIME" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { flex: 1 }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BinaryHeap, {}) })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_remotion5.Sequence, { from: currentFrame += TIMING.priorityQueueProblem, durationInFrames: TIMING.bottleneck, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BigTitle, { text: "BOTTLENECK", color: COLORS.accent, subtitle: "10,000,000 CONNECTIONS" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_remotion5.Sequence, { from: currentFrame += TIMING.bottleneck, durationInFrames: TIMING.timingWheelIntro, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BigTitle, { text: "CONSTANT TIME", color: COLORS.secondary, subtitle: "O(1) COMPLEXITY" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_remotion5.Sequence, { from: currentFrame += TIMING.timingWheelIntro, durationInFrames: TIMING.clockFace + TIMING.hierarchy, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", flexDirection: "column", height: "100%" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { flex: "0 0 20%" }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BigTitle, { text: "TIMING WHEEL", subtitle: "HIERARCHICAL CASCADING" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { flex: 1 }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(HierarchicalTimingWheel, {}) })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_remotion5.Sequence, { from: currentFrame += TIMING.clockFace + TIMING.hierarchy, durationInFrames: TIMING.kafkaNetty, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: r.gap.lg }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BigTitle, { text: "REAL WORLD TECH", color: COLORS.secondary }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", gap: r.gap.xl }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { border: `${r.borderWidth}px solid ${COLORS.primary}`, padding: r.padding, fontSize: r.fontSize.xl, fontWeight: "bold" }, children: "KAFKA" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { border: `${r.borderWidth}px solid ${COLORS.primary}`, padding: r.padding, fontSize: r.fontSize.xl, fontWeight: "bold" }, children: "NETTY" })
      ] })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_remotion5.Sequence, { from: currentFrame += TIMING.kafkaNetty, durationInFrames: TIMING.outro, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BigTitle, { text: "FOLLOW FOR MORE", subtitle: "@PRASANNA - ZOHO" }) })
  ] });
};
