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

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/index.tsx
var index_exports = {};
__export(index_exports, {
  ProjC8fa689fB2c345ffB309F6c1f87ada7d: () => ProjC8fa689fB2c345ffB309F6c1f87ada7d
});
module.exports = __toCommonJS(index_exports);
var import_remotion5 = require("remotion");

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/components/TitleCard.tsx
var import_remotion = require("remotion");

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/constants.ts
var COLORS = {
  bg: "#0f0f23",
  primary: "#8b5cf6",
  // Purple
  secondary: "#3b82f6",
  // Blue
  accent: "#06b6d4",
  // Cyan
  success: "#22c55e",
  // Green
  warning: "#eab308",
  // Yellow
  danger: "#ef4444",
  // Red
  white: "#ffffff",
  text: "#e2e8f0",
  muted: "#64748b",
  glass: "rgba(255, 255, 255, 0.1)",
  glassBorder: "rgba(255, 255, 255, 0.2)"
};
var getResponsiveSizes = (width, height) => {
  const minDim = Math.min(width, height);
  return {
    fontSize: {
      xs: height * 0.018,
      sm: height * 0.022,
      md: height * 0.032,
      lg: height * 0.045,
      xl: height * 0.06,
      xxl: height * 0.08
    },
    spacing: {
      xs: minDim * 0.02,
      sm: minDim * 0.03,
      md: minDim * 0.05,
      lg: minDim * 0.08
    },
    borderRadius: minDim * 0.02,
    iconSize: minDim * 0.08
  };
};

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/components/TitleCard.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var TitleCard = ({ title, subtitle, opacity = 1 }) => {
  const { width, height } = (0, import_remotion.useVideoConfig)();
  const sizes = getResponsiveSizes(width, height);
  const frame = (0, import_remotion.useCurrentFrame)();
  const titleFade = (0, import_remotion.interpolate)(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const subtitleFade = (0, import_remotion.interpolate)(frame, [15, 35], [0, 1], { extrapolateRight: "clamp" });
  const containerY = (0, import_remotion.interpolate)(frame, [0, 30], [20, 0], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    opacity,
    transform: `translateY(${containerY}px)`
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { style: {
      fontSize: sizes.fontSize.xxl,
      color: COLORS.white,
      textAlign: "center",
      margin: 0,
      opacity: titleFade,
      fontWeight: 800,
      background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.accent})`,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent"
    }, children: title }),
    subtitle && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: {
      fontSize: sizes.fontSize.lg,
      color: COLORS.text,
      textAlign: "center",
      marginTop: sizes.spacing.sm,
      opacity: subtitleFade
    }, children: subtitle })
  ] });
};

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/components/TaskQueue.tsx
var import_remotion2 = require("remotion");
var import_jsx_runtime2 = require("react/jsx-runtime");
var TaskQueue = () => {
  const frame = (0, import_remotion2.useCurrentFrame)();
  const { width, height } = (0, import_remotion2.useVideoConfig)();
  const sizes = getResponsiveSizes(width, height);
  const minDim = Math.min(width, height);
  const taskCount = 15;
  const tasks = Array.from({ length: taskCount }, (_, i) => i);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: {
    position: "relative",
    width: "100%",
    height: "100%",
    overflow: "hidden"
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      textAlign: "center",
      zIndex: 10
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
        fontSize: sizes.fontSize.xl,
        fontWeight: "bold",
        color: COLORS.danger
      }, children: Math.floor((0, import_remotion2.interpolate)(frame, [0, 200], [0, 1e7])).toLocaleString() }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { fontSize: sizes.fontSize.sm, color: COLORS.text }, children: "Delayed Tasks" })
    ] }),
    tasks.map((i) => {
      const startFrame = i * 5;
      const progress = (0, import_remotion2.interpolate)(frame - startFrame, [0, 60], [0, 1], { extrapolateRight: "clamp" });
      const xOffset = (i % 3 - 1) * (minDim * 0.2);
      const yStart = -100;
      const yEnd = height * 0.4 + i * minDim * 0.04;
      const currentY = (0, import_remotion2.interpolate)(progress, [0, 1], [yStart, yEnd]);
      const opacity = (0, import_remotion2.interpolate)(progress, [0, 0.2], [0, 1], { extrapolateRight: "clamp" });
      if (frame < startFrame) return null;
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
        "div",
        {
          style: {
            position: "absolute",
            left: "50%",
            top: 0,
            transform: `translate(calc(-50% + ${xOffset}px), ${currentY}px)`,
            width: minDim * 0.6,
            height: minDim * 0.1,
            background: COLORS.glass,
            border: `1px solid ${COLORS.glassBorder}`,
            borderRadius: sizes.borderRadius,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity,
            color: COLORS.text,
            fontSize: sizes.fontSize.sm
          },
          children: [
            "Task #",
            23902 + i,
            " - Expires in ",
            i % 5 + 1,
            "s"
          ]
        },
        i
      );
    })
  ] });
};

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/components/BinaryHeap.tsx
var import_remotion3 = require("remotion");
var import_jsx_runtime3 = require("react/jsx-runtime");
var BinaryHeap = () => {
  const frame = (0, import_remotion3.useCurrentFrame)();
  const { width, height } = (0, import_remotion3.useVideoConfig)();
  const sizes = getResponsiveSizes(width, height);
  const minDim = Math.min(width, height);
  const levels = 4;
  const nodes = [];
  const startY = height * 0.1;
  const levelHeight = height * 0.15;
  for (let l = 0; l < levels; l++) {
    const numNodes = Math.pow(2, l);
    const span = width * 0.8;
    const startX = (width - span) / 2;
    const gap = span / (numNodes + 1);
    for (let n = 0; n < numNodes; n++) {
      nodes.push({
        id: `node-${l}-${n}`,
        level: l,
        x: startX + gap * (n + 1),
        y: startY + l * levelHeight
      });
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { position: "relative", width: "100%", height: "100%" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
      position: "absolute",
      top: 0,
      width: "100%",
      textAlign: "center",
      color: COLORS.primary,
      fontSize: sizes.fontSize.xl,
      fontWeight: "bold"
    }, children: "Priority Queue (Logarithmic)" }),
    nodes.map((node, i) => {
      const delay = node.level * 10 + i % 3 * 5;
      const scale = (0, import_remotion3.interpolate)(frame - delay, [0, 10], [0, 1], { extrapolateRight: "clamp" });
      const isBottleneck = frame > 100;
      const color = isBottleneck && node.level > 2 ? COLORS.danger : COLORS.secondary;
      if (scale <= 0) return null;
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: node.x,
            top: node.y,
            width: minDim * 0.08,
            height: minDim * 0.08,
            borderRadius: "50%",
            background: color,
            transform: `translate(-50%, -50%) scale(${scale})`,
            boxShadow: `0 0 10px ${color}88`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: sizes.fontSize.xs,
            fontWeight: "bold"
          },
          children: i
        },
        node.id
      );
    }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
      position: "absolute",
      bottom: height * 0.1,
      width: "100%",
      textAlign: "center",
      color: COLORS.warning,
      fontSize: sizes.fontSize.lg,
      opacity: (0, import_remotion3.interpolate)(frame, [60, 80], [0, 1], { extrapolateRight: "clamp" })
    }, children: "Rebalancing Overhead: O(log N)" })
  ] });
};

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/components/TimingWheel.tsx
var import_remotion4 = require("remotion");
var import_jsx_runtime4 = require("react/jsx-runtime");
var TimingWheel = ({ hierarchical = false }) => {
  const frame = (0, import_remotion4.useCurrentFrame)();
  const { width, height } = (0, import_remotion4.useVideoConfig)();
  const minDim = Math.min(width, height);
  const sizes = getResponsiveSizes(width, height);
  const slots = 12;
  const radius = minDim * 0.35;
  const center = { x: width / 2, y: height / 2 };
  const rotation = (0, import_remotion4.interpolate)(frame, [0, 300], [0, 360]);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { position: "relative", width: "100%", height: "100%" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
      position: "absolute",
      top: height * 0.1,
      width: "100%",
      textAlign: "center",
      color: COLORS.success,
      fontSize: sizes.fontSize.xl,
      fontWeight: "bold",
      zIndex: 10
    }, children: hierarchical ? "Hierarchical (Scalable)" : "Timing Wheel (O(1))" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: {
      position: "absolute",
      left: center.x,
      top: center.y,
      width: radius * 2,
      height: radius * 2,
      transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
      borderRadius: "50%",
      border: `4px solid ${COLORS.accent}`
    }, children: [
      Array.from({ length: slots }).map((_, i) => {
        const angle = i / slots * 2 * Math.PI;
        const slotX = Math.cos(angle - Math.PI / 2) * (radius * 0.85);
        const slotY = Math.sin(angle - Math.PI / 2) * (radius * 0.85);
        const bucketSize = minDim * 0.1;
        return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(-50%, -50%) translate(${slotX}px, ${slotY}px) rotate(${i / slots * 360}deg)`,
              width: bucketSize,
              height: bucketSize,
              border: `2px solid ${COLORS.glassBorder}`,
              background: COLORS.glass,
              borderRadius: sizes.borderRadius,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: COLORS.accent,
              fontSize: sizes.fontSize.sm
            },
            children: i
          },
          i
        );
      }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
        position: "absolute",
        left: "50%",
        top: "50%",
        width: minDim * 0.05,
        height: minDim * 0.05,
        background: COLORS.white,
        borderRadius: "50%",
        transform: "translate(-50%, -50%)",
        boxShadow: `0 0 20px ${COLORS.white}88`
      } })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
      position: "absolute",
      left: center.x,
      top: center.y - radius - minDim * 0.05,
      transform: "translateX(-50%)",
      width: 0,
      height: 0,
      borderLeft: `${minDim * 0.03}px solid transparent`,
      borderRight: `${minDim * 0.03}px solid transparent`,
      borderTop: `${minDim * 0.05}px solid ${COLORS.danger}`,
      zIndex: 5
    } }),
    Array.from({ length: 5 }).map((_, i) => {
      const dropStart = i * 60;
      if (frame < dropStart) return null;
      const dropProgress = (0, import_remotion4.interpolate)(frame - dropStart, [0, 20], [0, 1], { extrapolateRight: "clamp" });
      const dropY = (0, import_remotion4.interpolate)(dropProgress, [0, 1], [0, center.y - radius + minDim * 0.1]);
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: center.x,
            top: dropY,
            width: minDim * 0.04,
            height: minDim * 0.04,
            background: COLORS.success,
            borderRadius: "50%",
            opacity: (0, import_remotion4.interpolate)(frame - dropStart, [20, 25], [1, 0])
            // Disappear into bucket
          }
        },
        i
      );
    }),
    hierarchical && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
      position: "absolute",
      right: minDim * 0.1,
      bottom: minDim * 0.1,
      width: minDim * 0.3,
      height: minDim * 0.3,
      border: `2px solid ${COLORS.secondary}`,
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      opacity: 0.8
    }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { color: COLORS.secondary, fontSize: sizes.fontSize.xs }, children: "Hour Wheel" }) })
  ] });
};

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/index.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
var ProjC8fa689fB2c345ffB309F6c1f87ada7d = () => {
  const { height } = (0, import_remotion5.useVideoConfig)();
  const frame = (0, import_remotion5.useCurrentFrame)();
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_remotion5.AbsoluteFill, { style: { backgroundColor: COLORS.bg }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_remotion5.Sequence, { from: 0, durationInFrames: 90, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_remotion5.AbsoluteFill, { style: { justifyContent: "center", alignItems: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      TitleCard,
      {
        title: "System Design Challenge",
        subtitle: "Millions of Delayed Tasks?"
      }
    ) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_remotion5.Sequence, { from: 90, durationInFrames: 210, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_remotion5.AbsoluteFill, { children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(TaskQueue, {}) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_remotion5.Sequence, { from: 300, durationInFrames: 300, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_remotion5.AbsoluteFill, { style: { justifyContent: "center", alignItems: "center", padding: 40 }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(BinaryHeap, {}) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_remotion5.Sequence, { from: 600, durationInFrames: 450, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_remotion5.AbsoluteFill, { style: { justifyContent: "center", alignItems: "center", padding: 40 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(BinaryHeap, {}),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: {
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%) rotate(-15deg)",
        border: `8px solid ${COLORS.danger}`,
        padding: 20,
        borderRadius: 20,
        backgroundColor: "rgba(0,0,0,0.8)",
        color: COLORS.danger,
        fontSize: height * 0.08,
        fontWeight: 900,
        opacity: (0, import_remotion5.interpolate)(frame - 600, [0, 20], [0, 1], { extrapolateRight: "clamp" })
      }, children: "BOTTLENECK" })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_remotion5.Sequence, { from: 1050, durationInFrames: 570, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_remotion5.AbsoluteFill, { children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(TimingWheel, { hierarchical: false }) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_remotion5.Sequence, { from: 1620, durationInFrames: 720, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_remotion5.AbsoluteFill, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(TimingWheel, { hierarchical: true }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: {
        position: "absolute",
        bottom: height * 0.15,
        width: "100%",
        textAlign: "center",
        color: COLORS.secondary,
        fontSize: height * 0.03,
        fontWeight: "bold"
      }, children: "Cascading Tasks..." })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_remotion5.Sequence, { from: 2340, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_remotion5.AbsoluteFill, { style: { justifyContent: "center", alignItems: "center" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        TitleCard,
        {
          title: "Apache Kafka & Netty",
          subtitle: "Real-World Architecture"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: {
        marginTop: 100,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20
      }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: {
        fontSize: height * 0.025,
        color: COLORS.text,
        maxWidth: "80%",
        textAlign: "center"
      }, children: "Used for massive throughput without lag." }) })
    ] }) })
  ] });
};
