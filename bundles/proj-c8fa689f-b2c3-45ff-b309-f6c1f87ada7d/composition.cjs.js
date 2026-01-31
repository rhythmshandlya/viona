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
  ProjC8fa689fB2c345ffB309F6c1f87ada7d: () => ProjC8fa689fB2c345ffB309F6c1f87ada7d,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_remotion = require("remotion");

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/constants.ts
var COLORS = {
  bg: "#0f0f23",
  primary: "#8b5cf6",
  secondary: "#3b82f6",
  accent: "#06b6d4",
  success: "#22c55e",
  warning: "#eab308",
  danger: "#ef4444",
  white: "#ffffff",
  text: "#e2e8f0",
  muted: "#64748b",
  glass: "rgba(255, 255, 255, 0.1)",
  glassBorder: "rgba(255, 255, 255, 0.2)"
};
var SPRING_CONFIG = { damping: 12, stiffness: 80 };

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/index.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var TitleScene = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height, fps } = (0, import_remotion.useVideoConfig)();
  const minDim = Math.min(width, height);
  const titleOpacity = (0, import_remotion.interpolate)(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });
  const titleY = (0, import_remotion.interpolate)(frame, [0, 25], [minDim * 0.05, 0], { extrapolateRight: "clamp" });
  const titleScale = (0, import_remotion.spring)({ frame, fps, config: SPRING_CONFIG });
  const subtitleOpacity = (0, import_remotion.interpolate)(frame, [15, 35], [0, 1], { extrapolateRight: "clamp" });
  const iconScale = (0, import_remotion.spring)({ frame: frame - 20, fps, config: { damping: 10, stiffness: 100 } });
  const particles = Array.from({ length: 8 }, (_, i) => {
    const angle = i / 8 * Math.PI * 2;
    const baseRadius = minDim * 0.35;
    const pulse = Math.sin(frame * 0.05 + i) * minDim * 0.02;
    return {
      x: Math.cos(angle) * (baseRadius + pulse),
      y: Math.sin(angle) * (baseRadius + pulse),
      size: minDim * 0.015 + Math.sin(frame * 0.1 + i * 0.5) * minDim * 5e-3,
      opacity: 0.3 + Math.sin(frame * 0.08 + i) * 0.2
    };
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: {
    background: `radial-gradient(ellipse at center, #1a1a3e 0%, ${COLORS.bg} 70%)`,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: minDim * 0.05
  }, children: [
    particles.map((p, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      position: "absolute",
      left: `calc(50% + ${p.x}px)`,
      top: `calc(50% + ${p.y}px)`,
      width: p.size,
      height: p.size,
      borderRadius: "50%",
      background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent})`,
      opacity: p.opacity * titleOpacity
    } }, i)),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      fontSize: height * 0.08,
      marginBottom: minDim * 0.03,
      transform: `scale(${Math.max(0, iconScale)})`,
      textShadow: `0 0 ${minDim * 0.04}px ${COLORS.primary}`
    }, children: "\u23F1\uFE0F" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      fontSize: height * 0.048,
      fontWeight: 800,
      color: COLORS.white,
      textAlign: "center",
      opacity: titleOpacity,
      transform: `translateY(${titleY}px) scale(${titleScale})`,
      textShadow: `0 0 ${minDim * 0.03}px ${COLORS.primary}80`
    }, children: "System Design Challenge" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      fontSize: height * 0.032,
      color: COLORS.accent,
      marginTop: minDim * 0.02,
      opacity: subtitleOpacity,
      fontWeight: 600
    }, children: "Scheduling at Scale" })
  ] });
};
var ProblemScene = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height, fps } = (0, import_remotion.useVideoConfig)();
  const minDim = Math.min(width, height);
  const maxTasks = 60;
  const taskAppearProgress = (0, import_remotion.interpolate)(frame, [0, 180], [0, maxTasks], { extrapolateRight: "clamp" });
  const currentTaskCount = Math.floor(taskAppearProgress);
  const titleOpacity = (0, import_remotion.interpolate)(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const containerScale = (0, import_remotion.spring)({ frame: frame - 15, fps, config: SPRING_CONFIG });
  const counterValue = Math.floor((0, import_remotion.interpolate)(frame, [0, 200], [0, 1e7], { extrapolateRight: "clamp" }));
  const stressLevel = (0, import_remotion.interpolate)(frame, [100, 250], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shakeX = Math.sin(frame * 2) * stressLevel * minDim * 6e-3;
  const shakeY = Math.cos(frame * 2.5) * stressLevel * minDim * 4e-3;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: {
    background: `radial-gradient(ellipse at center, #1a1a3e 0%, ${COLORS.bg} 70%)`,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: minDim * 0.04,
    gap: minDim * 0.03
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      fontSize: height * 0.038,
      fontWeight: 700,
      color: COLORS.white,
      opacity: titleOpacity,
      textAlign: "center"
    }, children: "Millions of Delayed Tasks" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
      fontSize: height * 0.065,
      fontWeight: 800,
      background: `linear-gradient(90deg, ${COLORS.warning}, ${COLORS.danger})`,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
      transform: `translate(${shakeX}px, ${shakeY}px)`
    }, children: [
      counterValue.toLocaleString(),
      "+"
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: minDim * 0.012,
      maxWidth: width * 0.85,
      maxHeight: height * 0.4,
      overflow: "hidden",
      transform: `scale(${Math.max(0, containerScale)}) translate(${shakeX}px, ${shakeY}px)`
    }, children: Array.from({ length: currentTaskCount }, (_, i) => {
      const entryDelay = i * 2;
      const entryProgress = (0, import_remotion.interpolate)(frame - entryDelay, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      const yOffset = (0, import_remotion.interpolate)(frame - entryDelay, [0, 15], [-minDim * 0.05, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      const isExpiring = frame > 150 && i < (frame - 150) / 5;
      const expiryPulse = isExpiring ? Math.sin(frame * 0.3 + i) * 0.2 + 0.8 : 1;
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
        width: minDim * 0.065,
        height: minDim * 0.065,
        borderRadius: minDim * 0.012,
        background: isExpiring ? `linear-gradient(135deg, ${COLORS.danger}cc 0%, ${COLORS.warning}cc 100%)` : `linear-gradient(135deg, ${COLORS.primary}88 0%, ${COLORS.secondary}88 100%)`,
        border: `2px solid ${isExpiring ? COLORS.danger : COLORS.glassBorder}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: height * 0.014,
        color: COLORS.white,
        fontWeight: 600,
        opacity: entryProgress * expiryPulse,
        transform: `translateY(${yOffset}px) scale(${expiryPulse})`,
        boxShadow: isExpiring ? `0 0 ${minDim * 0.015}px ${COLORS.danger}` : "none"
      }, children: isExpiring ? "\u26A0\uFE0F" : `T${i + 1}` }, i);
    }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      fontSize: height * 0.022,
      color: COLORS.muted,
      marginTop: minDim * 0.02,
      opacity: titleOpacity
    }, children: "Cache expiry \u2022 Retry delays \u2022 Scheduled jobs" })
  ] });
};
var PriorityQueueScene = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height, fps } = (0, import_remotion.useVideoConfig)();
  const minDim = Math.min(width, height);
  const titleOpacity = (0, import_remotion.interpolate)(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const treeScale = (0, import_remotion.spring)({ frame: frame - 25, fps, config: SPRING_CONFIG });
  const nodes = [
    { x: 0.5, y: 0.12, val: 1, level: 0 },
    { x: 0.28, y: 0.32, val: 3, level: 1 },
    { x: 0.72, y: 0.32, val: 5, level: 1 },
    { x: 0.14, y: 0.52, val: 8, level: 2 },
    { x: 0.36, y: 0.52, val: 12, level: 2 },
    { x: 0.64, y: 0.52, val: 7, level: 2 },
    { x: 0.86, y: 0.52, val: 15, level: 2 }
  ];
  const edges = [
    { from: 0, to: 1 },
    { from: 0, to: 2 },
    { from: 1, to: 3 },
    { from: 1, to: 4 },
    { from: 2, to: 5 },
    { from: 2, to: 6 }
  ];
  const rebalancePhase = Math.floor(frame / 45) % 4;
  const rebalancePath = [
    [6],
    // New node at bottom
    [2, 6],
    // Compare with parent
    [0, 2],
    // Bubble up
    [0]
    // Settled at root
  ];
  const activeNodes = rebalancePath[rebalancePhase] || [];
  const logSteps = Math.floor((0, import_remotion.interpolate)(frame, [100, 350], [0, 20], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const stepPulse = Math.sin(frame * 0.15) * 0.1 + 1;
  const containerHeight = height * 0.38;
  const containerWidth = width * 0.85;
  const nodeSize = minDim * 0.1;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: {
    background: `radial-gradient(ellipse at center, #1a1a3e 0%, ${COLORS.bg} 70%)`,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: minDim * 0.04,
    gap: minDim * 0.025
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      fontSize: height * 0.038,
      fontWeight: 700,
      color: COLORS.white,
      opacity: titleOpacity
    }, children: "Priority Queue (Binary Heap)" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
      position: "relative",
      width: containerWidth,
      height: containerHeight,
      transform: `scale(${Math.max(0, treeScale)})`
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { style: { position: "absolute", width: "100%", height: "100%", overflow: "visible" }, children: edges.map((edge, i) => {
        const from = nodes[edge.from];
        const to = nodes[edge.to];
        const isActive = activeNodes.includes(edge.from) && activeNodes.includes(edge.to);
        return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "line",
          {
            x1: `${from.x * 100}%`,
            y1: `${from.y * 100}%`,
            x2: `${to.x * 100}%`,
            y2: `${to.y * 100}%`,
            stroke: isActive ? COLORS.success : COLORS.muted,
            strokeWidth: isActive ? 4 : 3,
            opacity: isActive ? 1 : 0.5
          },
          i
        );
      }) }),
      nodes.map((node, i) => {
        const isActive = activeNodes.includes(i);
        const nodeSpring = (0, import_remotion.spring)({ frame: frame - 30 - i * 8, fps, config: SPRING_CONFIG });
        const pulseScale = isActive ? 1 + Math.sin(frame * 0.2) * 0.08 : 1;
        return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
          position: "absolute",
          left: `${node.x * 100}%`,
          top: `${node.y * 100}%`,
          transform: `translate(-50%, -50%) scale(${Math.max(0, nodeSpring) * pulseScale})`,
          width: nodeSize,
          height: nodeSize,
          borderRadius: "50%",
          background: isActive ? `linear-gradient(135deg, ${COLORS.success} 0%, ${COLORS.accent} 100%)` : `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.secondary} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: height * 0.028,
          fontWeight: 700,
          color: COLORS.white,
          boxShadow: isActive ? `0 0 ${minDim * 0.035}px ${COLORS.success}` : `0 0 ${minDim * 0.015}px ${COLORS.primary}50`,
          border: `3px solid ${isActive ? COLORS.success : "transparent"}`
        }, children: node.val }, i);
      }),
      frame > 60 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
        position: "absolute",
        right: 0,
        top: "50%",
        transform: "translateY(-50%)",
        background: COLORS.glass,
        border: `2px solid ${COLORS.glassBorder}`,
        borderRadius: minDim * 0.015,
        padding: minDim * 0.02,
        display: "flex",
        flexDirection: "column",
        alignItems: "center"
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: height * 0.016, color: COLORS.muted }, children: "Rebalance ops" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: height * 0.035, fontWeight: 800, color: COLORS.danger }, children: logSteps })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
      display: "flex",
      alignItems: "center",
      gap: minDim * 0.03
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
        fontSize: height * 0.06,
        fontWeight: 800,
        color: COLORS.danger,
        transform: `scale(${stepPulse})`
      }, children: "O(log n)" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
        fontSize: height * 0.022,
        color: COLORS.muted,
        maxWidth: width * 0.4
      }, children: "Every insert requires sorting & rebalancing" })
    ] })
  ] });
};
var BottleneckScene = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height, fps } = (0, import_remotion.useVideoConfig)();
  const minDim = Math.min(width, height);
  const titleOpacity = (0, import_remotion.interpolate)(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const progress = (0, import_remotion.interpolate)(frame, [30, 280], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const questionOpacity = (0, import_remotion.interpolate)(frame, [200, 230], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const questionScale = (0, import_remotion.spring)({ frame: frame - 210, fps, config: { damping: 10, stiffness: 120 } });
  const shakeIntensity = (0, import_remotion.interpolate)(progress, [0.6, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shakeX = Math.sin(frame * 1.8) * shakeIntensity * minDim * 0.012;
  const shakeY = Math.cos(frame * 2.2) * shakeIntensity * minDim * 8e-3;
  const cpuPercent = Math.floor(progress * 100);
  const barColor = progress > 0.85 ? COLORS.danger : progress > 0.6 ? COLORS.warning : COLORS.success;
  const connections = Math.floor((0, import_remotion.interpolate)(progress, [0, 1], [0, 1e7]));
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: {
    background: `radial-gradient(ellipse at center, #1a1a3e 0%, ${COLORS.bg} 70%)`,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: minDim * 0.04,
    gap: minDim * 0.035
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      fontSize: height * 0.038,
      fontWeight: 700,
      color: COLORS.white,
      opacity: titleOpacity,
      transform: `translate(${shakeX}px, ${shakeY}px)`
    }, children: "10 Million Connections" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      fontSize: height * 0.055,
      fontWeight: 800,
      color: barColor,
      transform: `translate(${shakeX}px, ${shakeY}px)`
    }, children: connections.toLocaleString() }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      width: width * 0.75,
      height: minDim * 0.06,
      background: "rgba(255,255,255,0.1)",
      borderRadius: minDim * 0.015,
      overflow: "hidden",
      transform: `translate(${shakeX}px, ${shakeY}px)`,
      border: `2px solid ${COLORS.glassBorder}`
    }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      width: `${progress * 100}%`,
      height: "100%",
      background: `linear-gradient(90deg, ${COLORS.success}, ${COLORS.warning}, ${COLORS.danger})`,
      backgroundSize: "200% 100%",
      backgroundPosition: `${progress * 100}% 0`,
      borderRadius: minDim * 0.012,
      boxShadow: `0 0 ${minDim * 0.02}px ${barColor}`
    } }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
      display: "flex",
      alignItems: "baseline",
      gap: minDim * 0.01,
      transform: `translate(${shakeX}px, ${shakeY}px)`
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: {
        fontSize: height * 0.06,
        fontWeight: 800,
        color: barColor
      }, children: [
        cpuPercent,
        "%"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: height * 0.025, color: COLORS.muted }, children: "CPU Usage" })
    ] }),
    frame > 200 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
      marginTop: minDim * 0.04,
      textAlign: "center",
      opacity: questionOpacity,
      transform: `scale(${Math.max(0, questionScale)})`
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
        fontSize: height * 0.042,
        fontWeight: 700,
        color: COLORS.accent
      }, children: "Can we do better?" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
        fontSize: height * 0.055,
        fontWeight: 800,
        marginTop: minDim * 0.015,
        background: `linear-gradient(90deg, ${COLORS.success}, ${COLORS.accent})`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text"
      }, children: "O(1) Constant Time?" })
    ] })
  ] });
};
var TimingWheelScene = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height, fps } = (0, import_remotion.useVideoConfig)();
  const minDim = Math.min(width, height);
  const titleOpacity = (0, import_remotion.interpolate)(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const wheelScale = (0, import_remotion.spring)({ frame: frame - 25, fps, config: SPRING_CONFIG });
  const rotation = (0, import_remotion.interpolate)(frame, [50, 480], [0, 360], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const slots = 12;
  const radius = minDim * 0.3;
  const activeSlot = Math.floor(rotation / 360 * slots) % slots;
  const taskDrops = [
    { slot: 2, startFrame: 80, label: "2s" },
    { slot: 5, startFrame: 140, label: "5s" },
    { slot: 8, startFrame: 200, label: "8s" }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: {
    background: `radial-gradient(ellipse at center, #1a1a3e 0%, ${COLORS.bg} 70%)`,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: minDim * 0.04,
    gap: minDim * 0.02
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      fontSize: height * 0.042,
      fontWeight: 700,
      color: COLORS.white,
      opacity: titleOpacity
    }, children: "Timing Wheel" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      fontSize: height * 0.024,
      color: COLORS.accent,
      opacity: titleOpacity
    }, children: "Like a clock face with 60 slots" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
      position: "relative",
      width: radius * 2.4,
      height: radius * 2.4,
      transform: `scale(${Math.max(0, wheelScale)})`
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: radius * 2.2,
        height: radius * 2.2,
        borderRadius: "50%",
        background: `radial-gradient(circle, transparent 60%, ${COLORS.primary}20 100%)`
      } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: minDim * 0.1,
        height: minDim * 0.1,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`,
        boxShadow: `0 0 ${minDim * 0.04}px ${COLORS.primary}`,
        zIndex: 10
      } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
        position: "absolute",
        left: "50%",
        top: "50%",
        width: minDim * 0.012,
        height: radius * 0.8,
        background: `linear-gradient(180deg, ${COLORS.accent}, ${COLORS.accent}00)`,
        transformOrigin: "center top",
        transform: `translateX(-50%) rotate(${rotation}deg)`,
        borderRadius: minDim * 6e-3,
        zIndex: 5,
        boxShadow: `0 0 ${minDim * 0.015}px ${COLORS.accent}`
      } }),
      Array.from({ length: slots }, (_, i) => {
        const angle = i / slots * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle) * radius + radius * 1.2;
        const y = Math.sin(angle) * radius + radius * 1.2;
        const isActive = i === activeSlot;
        const taskDrop = taskDrops.find((t) => t.slot === i);
        const hasTask = taskDrop && frame > taskDrop.startFrame;
        const slotScale = isActive ? 1.15 : 1;
        return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
          position: "absolute",
          left: x,
          top: y,
          transform: `translate(-50%, -50%) scale(${slotScale})`,
          width: minDim * 0.085,
          height: minDim * 0.085,
          borderRadius: minDim * 0.015,
          background: isActive ? `linear-gradient(135deg, ${COLORS.success}, ${COLORS.accent})` : hasTask ? `linear-gradient(135deg, ${COLORS.primary}60, ${COLORS.secondary}60)` : "rgba(255,255,255,0.08)",
          border: `2px solid ${isActive ? COLORS.success : hasTask ? COLORS.primary : COLORS.glassBorder}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: height * 0.02,
          fontWeight: 600,
          color: COLORS.white,
          boxShadow: isActive ? `0 0 ${minDim * 0.025}px ${COLORS.success}` : "none"
        }, children: hasTask ? "\u{1F4CB}" : `${i * 5}s` }, i);
      }),
      taskDrops.map((task, i) => {
        if (frame < task.startFrame) return null;
        const dropProgress = (0, import_remotion.interpolate)(frame - task.startFrame, [0, 25], [0, 1], { extrapolateRight: "clamp" });
        const angle = task.slot / slots * Math.PI * 2 - Math.PI / 2;
        const targetX = Math.cos(angle) * radius + radius * 1.2;
        const targetY = Math.sin(angle) * radius + radius * 1.2;
        const startY = -minDim * 0.15;
        const currentY = (0, import_remotion.interpolate)(dropProgress, [0, 1], [startY, targetY]);
        if (dropProgress >= 1) return null;
        return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
          position: "absolute",
          left: targetX,
          top: currentY,
          transform: "translate(-50%, -50%)",
          width: minDim * 0.06,
          height: minDim * 0.06,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${COLORS.warning}, ${COLORS.accent})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: height * 0.018,
          color: COLORS.white,
          boxShadow: `0 0 ${minDim * 0.02}px ${COLORS.warning}`
        }, children: task.label }, i);
      })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
      display: "flex",
      alignItems: "center",
      gap: minDim * 0.03,
      marginTop: minDim * 0.02
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
        fontSize: height * 0.06,
        fontWeight: 800,
        color: COLORS.success,
        textShadow: `0 0 ${minDim * 0.025}px ${COLORS.success}50`
      }, children: "O(1)" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
        fontSize: height * 0.022,
        color: COLORS.muted
      }, children: "Drop directly into bucket \u2014 no sorting!" })
    ] })
  ] });
};
var HierarchicalScene = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height, fps } = (0, import_remotion.useVideoConfig)();
  const minDim = Math.min(width, height);
  const titleOpacity = (0, import_remotion.interpolate)(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const outerScale = (0, import_remotion.spring)({ frame: frame - 25, fps, config: SPRING_CONFIG });
  const innerScale = (0, import_remotion.spring)({ frame: frame - 55, fps, config: SPRING_CONFIG });
  const outerRotation = (0, import_remotion.interpolate)(frame, [80, 550], [0, 60], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const innerRotation = (0, import_remotion.interpolate)(frame, [80, 550], [0, 360], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const outerRadius = minDim * 0.34;
  const innerRadius = minDim * 0.17;
  const outerSlots = 6;
  const innerSlots = 12;
  const cascadePhase = Math.floor(frame / 100) % 6;
  const cascadeActive = cascadePhase === 2 || cascadePhase === 3;
  const cascadeOpacity = cascadeActive ? (0, import_remotion.interpolate)(frame % 100, [0, 20, 80, 100], [0, 1, 1, 0], { extrapolateRight: "clamp" }) : 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: {
    background: `radial-gradient(ellipse at center, #1a1a3e 0%, ${COLORS.bg} 70%)`,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: minDim * 0.03,
    gap: minDim * 0.015
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      fontSize: height * 0.038,
      fontWeight: 700,
      color: COLORS.white,
      opacity: titleOpacity
    }, children: "Hierarchical Timing Wheel" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      fontSize: height * 0.02,
      color: COLORS.accent,
      opacity: titleOpacity
    }, children: "Like minute + second hands on a clock" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
      position: "relative",
      width: outerRadius * 2.4,
      height: outerRadius * 2.4
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: outerRadius * 2.25,
        height: outerRadius * 2.25,
        borderRadius: "50%",
        border: `3px dashed ${COLORS.warning}40`
      } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: innerRadius * 2.3,
        height: innerRadius * 2.3,
        borderRadius: "50%",
        border: `3px dashed ${COLORS.success}40`
      } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate(-50%, -50%) scale(${Math.max(0, outerScale)})`
      }, children: Array.from({ length: outerSlots }, (_, i) => {
        const angle = i / outerSlots * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle) * outerRadius;
        const y = Math.sin(angle) * outerRadius;
        const activeIdx = Math.floor(outerRotation / 60 * outerSlots) % outerSlots;
        const isActive = activeIdx === i;
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
          position: "absolute",
          left: x + outerRadius * 1.2,
          top: y + outerRadius * 1.2,
          transform: `translate(-50%, -50%) scale(${isActive ? 1.1 : 1})`,
          width: minDim * 0.095,
          height: minDim * 0.095,
          borderRadius: minDim * 0.015,
          background: isActive ? `linear-gradient(135deg, ${COLORS.warning}, ${COLORS.danger})` : `rgba(234, 179, 8, 0.15)`,
          border: `2px solid ${isActive ? COLORS.warning : "rgba(234, 179, 8, 0.4)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: height * 0.022,
          color: COLORS.white,
          fontWeight: 600,
          boxShadow: isActive ? `0 0 ${minDim * 0.02}px ${COLORS.warning}` : "none"
        }, children: [
          (i + 1) * 10,
          "m"
        ] }, `outer-${i}`);
      }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate(-50%, -50%) scale(${Math.max(0, innerScale)})`
      }, children: Array.from({ length: innerSlots }, (_, i) => {
        const angle = i / innerSlots * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle) * innerRadius;
        const y = Math.sin(angle) * innerRadius;
        const activeIdx = Math.floor(innerRotation / 360 * innerSlots) % innerSlots;
        const isActive = activeIdx === i;
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
          position: "absolute",
          left: x + outerRadius * 1.2,
          top: y + outerRadius * 1.2,
          transform: `translate(-50%, -50%) scale(${isActive ? 1.15 : 1})`,
          width: minDim * 0.055,
          height: minDim * 0.055,
          borderRadius: "50%",
          background: isActive ? `linear-gradient(135deg, ${COLORS.success}, ${COLORS.accent})` : "rgba(34, 197, 94, 0.15)",
          border: `2px solid ${isActive ? COLORS.success : "rgba(34, 197, 94, 0.4)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: height * 0.014,
          color: COLORS.white,
          fontWeight: 600,
          boxShadow: isActive ? `0 0 ${minDim * 0.015}px ${COLORS.success}` : "none"
        }, children: [
          i * 5,
          "s"
        ] }, `inner-${i}`);
      }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: minDim * 0.07,
        height: minDim * 0.07,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`,
        boxShadow: `0 0 ${minDim * 0.025}px ${COLORS.primary}`,
        zIndex: 10
      } }),
      cascadeActive && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
        position: "absolute",
        left: "50%",
        top: outerRadius * 0.55,
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity: cascadeOpacity
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
          fontSize: height * 0.035
        }, children: "\u2B07\uFE0F" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
          fontSize: height * 0.016,
          color: COLORS.accent,
          fontWeight: 600
        }, children: "Cascade" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
      display: "flex",
      gap: minDim * 0.06,
      marginTop: minDim * 0.02
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { textAlign: "center" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
          width: minDim * 0.025,
          height: minDim * 0.025,
          background: COLORS.warning,
          borderRadius: minDim * 5e-3,
          margin: "0 auto",
          marginBottom: minDim * 8e-3
        } }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: height * 0.018, color: COLORS.muted }, children: "Minutes" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { textAlign: "center" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
          width: minDim * 0.025,
          height: minDim * 0.025,
          background: COLORS.success,
          borderRadius: "50%",
          margin: "0 auto",
          marginBottom: minDim * 8e-3
        } }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: height * 0.018, color: COLORS.muted }, children: "Seconds" })
      ] })
    ] })
  ] });
};
var RealWorldScene = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height, fps } = (0, import_remotion.useVideoConfig)();
  const minDim = Math.min(width, height);
  const titleOpacity = (0, import_remotion.interpolate)(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const kafkaScale = (0, import_remotion.spring)({ frame: frame - 25, fps, config: SPRING_CONFIG });
  const nettyScale = (0, import_remotion.spring)({ frame: frame - 55, fps, config: SPRING_CONFIG });
  const statsScale = (0, import_remotion.spring)({ frame: frame - 85, fps, config: SPRING_CONFIG });
  const throughputCounter = Math.floor((0, import_remotion.interpolate)(frame, [100, 250], [0, 1e6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: {
    background: `radial-gradient(ellipse at center, #1a1a3e 0%, ${COLORS.bg} 70%)`,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: minDim * 0.04,
    gap: minDim * 0.035
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      fontSize: height * 0.04,
      fontWeight: 700,
      color: COLORS.white,
      opacity: titleOpacity
    }, children: "Production Usage" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
      display: "flex",
      flexDirection: "column",
      gap: minDim * 0.03,
      alignItems: "center",
      width: "100%"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
        background: COLORS.glass,
        backdropFilter: "blur(10px)",
        border: `2px solid ${COLORS.glassBorder}`,
        borderRadius: minDim * 0.025,
        padding: minDim * 0.035,
        width: width * 0.8,
        maxWidth: minDim * 0.85,
        transform: `scale(${Math.max(0, kafkaScale)})`,
        display: "flex",
        alignItems: "center",
        gap: minDim * 0.03
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
          width: minDim * 0.12,
          height: minDim * 0.12,
          borderRadius: minDim * 0.02,
          background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: height * 0.045,
          boxShadow: `0 0 ${minDim * 0.02}px ${COLORS.primary}50`
        }, children: "\u{1F4CA}" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: 1 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: height * 0.032, fontWeight: 700, color: COLORS.white }, children: "Apache Kafka" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: height * 0.02, color: COLORS.muted, marginTop: minDim * 5e-3 }, children: "Message scheduling & delayed delivery" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
        background: COLORS.glass,
        backdropFilter: "blur(10px)",
        border: `2px solid ${COLORS.glassBorder}`,
        borderRadius: minDim * 0.025,
        padding: minDim * 0.035,
        width: width * 0.8,
        maxWidth: minDim * 0.85,
        transform: `scale(${Math.max(0, nettyScale)})`,
        display: "flex",
        alignItems: "center",
        gap: minDim * 0.03
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
          width: minDim * 0.12,
          height: minDim * 0.12,
          borderRadius: minDim * 0.02,
          background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.success})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: height * 0.045,
          boxShadow: `0 0 ${minDim * 0.02}px ${COLORS.accent}50`
        }, children: "\u{1F310}" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: 1 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: height * 0.032, fontWeight: 700, color: COLORS.white }, children: "Netty" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: height * 0.02, color: COLORS.muted, marginTop: minDim * 5e-3 }, children: "Connection timeouts & I/O scheduling" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
      marginTop: minDim * 0.02,
      textAlign: "center",
      transform: `scale(${Math.max(0, statsScale)})`
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
        fontSize: height * 0.055,
        fontWeight: 800,
        background: `linear-gradient(90deg, ${COLORS.success}, ${COLORS.accent})`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text"
      }, children: [
        throughputCounter.toLocaleString(),
        "+"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: height * 0.022, color: COLORS.muted }, children: "ops/second without lag" })
    ] })
  ] });
};
var OutroScene = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height, fps } = (0, import_remotion.useVideoConfig)();
  const minDim = Math.min(width, height);
  const titleOpacity = (0, import_remotion.interpolate)(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });
  const titleY = (0, import_remotion.interpolate)(frame, [0, 25], [minDim * 0.03, 0], { extrapolateRight: "clamp" });
  const iconScale = (0, import_remotion.spring)({ frame: frame - 15, fps, config: { damping: 8, stiffness: 100 } });
  const ctaScale = (0, import_remotion.spring)({ frame: frame - 45, fps, config: SPRING_CONFIG });
  const gearRotation = frame * 1.5;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: {
    background: `radial-gradient(ellipse at center, #1a1a3e 0%, ${COLORS.bg} 70%)`,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: minDim * 0.05,
    gap: minDim * 0.035
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      fontSize: height * 0.1,
      transform: `scale(${Math.max(0, iconScale)}) rotate(${gearRotation}deg)`
    }, children: "\u2699\uFE0F" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      fontSize: height * 0.045,
      fontWeight: 800,
      color: COLORS.white,
      textAlign: "center",
      opacity: titleOpacity,
      transform: `translateY(${titleY}px)`
    }, children: "No Sorting, Just Rotating" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      fontSize: height * 0.028,
      color: COLORS.accent,
      textAlign: "center",
      opacity: titleOpacity
    }, children: "A mechanical clock in your code" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
      display: "flex",
      gap: minDim * 0.06,
      marginTop: minDim * 0.02,
      transform: `scale(${Math.max(0, ctaScale)})`
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { textAlign: "center" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
          fontSize: height * 0.04,
          fontWeight: 800,
          color: COLORS.danger,
          textDecoration: "line-through",
          opacity: 0.7
        }, children: "O(log n)" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: height * 0.016, color: COLORS.muted }, children: "Priority Queue" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
        fontSize: height * 0.05,
        color: COLORS.muted,
        display: "flex",
        alignItems: "center"
      }, children: "\u2192" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { textAlign: "center" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
          fontSize: height * 0.045,
          fontWeight: 800,
          color: COLORS.success,
          textShadow: `0 0 ${minDim * 0.02}px ${COLORS.success}50`
        }, children: "O(1)" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: height * 0.016, color: COLORS.muted }, children: "Timing Wheel" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`,
      borderRadius: minDim * 0.02,
      padding: `${minDim * 0.025}px ${minDim * 0.05}px`,
      transform: `scale(${Math.max(0, ctaScale)})`,
      marginTop: minDim * 0.03,
      boxShadow: `0 0 ${minDim * 0.03}px ${COLORS.primary}50`
    }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      fontSize: height * 0.026,
      fontWeight: 600,
      color: COLORS.white
    }, children: "Follow for more engineering insights" }) })
  ] });
};
var ProjC8fa689fB2c345ffB309F6c1f87ada7d = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 0, durationInFrames: 60, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TitleScene, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 60, durationInFrames: 300, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProblemScene, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 360, durationInFrames: 480, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PriorityQueueScene, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 840, durationInFrames: 390, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BottleneckScene, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 1230, durationInFrames: 510, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimingWheelScene, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 1740, durationInFrames: 600, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HierarchicalScene, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 2340, durationInFrames: 300, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RealWorldScene, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 2640, durationInFrames: 327, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OutroScene, {}) })
  ] });
};
var index_default = ProjC8fa689fB2c345ffB309F6c1f87ada7d;
