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
var import_remotion4 = require("remotion");

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/constants.ts
var COLORS = {
  bgDeep: "#050505",
  bgGradient: "radial-gradient(ellipse at top, #111827 0%, #050505 60%)",
  primary: "#00f3ff",
  // Cyan neon
  accent: "#ff0055",
  // Magenta accent
  success: "#00ff9d",
  // Green
  warning: "#ffd700",
  // Gold
  white: "#ffffff",
  glowPrimary: "rgba(0, 243, 255, 0.4)",
  glowAccent: "rgba(255, 0, 85, 0.4)"
};
var TIMING = {
  intro: 0,
  priorityQueue: 270,
  // ~9s
  bottleneck: 600,
  // ~20s
  timingWheel: 1140,
  // ~38s
  hierarchical: 1620,
  // ~54s
  realWorld: 2430,
  // ~81s
  outro: 2760
  // ~92s
};

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/components/Background.tsx
var import_remotion = require("remotion");
var import_jsx_runtime = require("react/jsx-runtime");
var Background = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: {
    background: COLORS.bgGradient,
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      position: "absolute",
      width: "200%",
      height: "200%",
      backgroundImage: `
          linear-gradient(to right, rgba(0, 243, 255, 0.05) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(0, 243, 255, 0.05) 1px, transparent 1px)
        `,
      backgroundSize: "100px 100px",
      transform: `translate(${frame * 0.5 % 100}px, ${frame * 0.5 % 100}px) rotate(${frame * 0.02}deg)`,
      opacity: 0.5
    } }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      position: "absolute",
      width: 800,
      height: 800,
      background: `radial-gradient(circle, ${COLORS.glowPrimary} 0%, transparent 70%)`,
      opacity: (0, import_remotion.interpolate)(Math.sin(frame * 0.05), [-1, 1], [0.3, 0.6]),
      filter: "blur(50px)"
    } })
  ] });
};

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/components/PriorityQueue.tsx
var import_remotion2 = require("remotion");
var import_jsx_runtime2 = require("react/jsx-runtime");
var PriorityQueue = () => {
  const frame = (0, import_remotion2.useCurrentFrame)();
  const { fps, height } = (0, import_remotion2.useVideoConfig)();
  const nodes = [
    { id: 1, val: 5, pos: [0, 0] },
    { id: 2, val: 12, pos: [-1, 1] },
    { id: 3, val: 8, pos: [1, 1] },
    { id: 4, val: 20, pos: [-1.5, 2] },
    { id: 5, val: 15, pos: [-0.5, 2] }
  ];
  const scale = (0, import_remotion2.spring)({ frame, fps, config: { damping: 12, stiffness: 80 } });
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: {
    position: "relative",
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transform: `scale(${scale})`
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: {
      position: "absolute",
      top: "20%",
      color: COLORS.primary,
      fontFamily: "Oswald",
      fontSize: height * 0.06,
      textShadow: `0 0 20px ${COLORS.glowPrimary}`,
      textAlign: "center"
    }, children: [
      "PRIORITY QUEUE",
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("br", {}),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { fontSize: height * 0.03, fontFamily: "JetBrains Mono", color: COLORS.accent }, children: "O(log N) SORTING" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { position: "relative", marginTop: height * 0.1 }, children: nodes.map((node, i) => {
      const nodeDelay = i * 10;
      const nodeScale = (0, import_remotion2.spring)({ frame: frame - nodeDelay, fps, config: { damping: 12 } });
      const [x, y] = node.pos;
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
        position: "absolute",
        left: x * 150,
        top: y * 120,
        width: 80,
        height: 80,
        borderRadius: "50%",
        background: "rgba(0, 243, 255, 0.1)",
        border: `2px solid ${COLORS.primary}`,
        boxShadow: `0 0 20px ${COLORS.glowPrimary}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontFamily: "JetBrains Mono",
        fontSize: 24,
        transform: `translate(-50%, -50%) scale(${nodeScale})`
      }, children: node.val }, node.id);
    }) })
  ] });
};

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/components/TimingWheel.tsx
var import_remotion3 = require("remotion");
var import_jsx_runtime3 = require("react/jsx-runtime");
var TimingWheel = ({ title, radius, slots, activeSlot, color, tasks = [] }) => {
  const frame = (0, import_remotion3.useCurrentFrame)();
  const { fps, height } = (0, import_remotion3.useVideoConfig)();
  const rotation = (0, import_remotion3.interpolate)(activeSlot, [0, slots], [0, 360]);
  const bounce = (0, import_remotion3.spring)({ frame, fps, config: { damping: 12 } });
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
    position: "relative",
    width: radius * 2,
    height: radius * 2,
    transform: `scale(${bounce})`
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
      position: "absolute",
      top: -height * 0.05,
      left: "50%",
      transform: "translateX(-50%)",
      color,
      fontFamily: "Oswald",
      fontSize: height * 0.03,
      whiteSpace: "nowrap",
      textShadow: `0 0 10px ${color}88`
    }, children: title }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
      width: "100%",
      height: "100%",
      borderRadius: "50%",
      border: `3px solid ${color}`,
      position: "relative",
      boxShadow: `0 0 30px ${color}44`,
      background: "rgba(255, 255, 255, 0.05)"
    }, children: [
      Array.from({ length: slots }).map((_, i) => {
        const angle = i / slots * 2 * Math.PI - Math.PI / 2;
        const x = Math.cos(angle) * (radius - 10);
        const y = Math.sin(angle) * (radius - 10);
        const isActive = i === activeSlot % slots;
        return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
          position: "absolute",
          left: `calc(50% + ${x}px)`,
          top: `calc(50% + ${y}px)`,
          width: 10,
          height: 10,
          background: isActive ? color : `${color}44`,
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
          boxShadow: isActive ? `0 0 15px ${color}` : "none"
        }, children: tasks.includes(i) && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
          position: "absolute",
          width: 20,
          height: 20,
          border: `2px solid ${COLORS.accent}`,
          borderRadius: "50%",
          top: -5,
          left: -5,
          animation: "pulse 1s infinite"
        } }) }, i);
      }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
        position: "absolute",
        top: "50%",
        left: "50%",
        width: radius - 20,
        height: 4,
        background: color,
        transformOrigin: "left center",
        transform: `rotate(${rotation - 90}deg)`,
        boxShadow: `0 0 10px ${color}`,
        borderRadius: 2
      } }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
        position: "absolute",
        top: "50%",
        left: "50%",
        width: 20,
        height: 20,
        background: color,
        borderRadius: "50%",
        transform: "translate(-50%, -50%)",
        boxShadow: `0 0 15px ${color}`
      } })
    ] })
  ] });
};

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/components/PerformanceStats.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
var PerformanceStats = ({ connections, cpuUsage, latency }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: {
    padding: 30,
    background: "rgba(0, 243, 255, 0.1)",
    border: `2px solid ${COLORS.primary}`,
    borderRadius: 16,
    boxShadow: `0 0 30px ${COLORS.glowPrimary}`,
    fontFamily: "JetBrains Mono",
    minWidth: 400
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h2", { style: { color: COLORS.primary, margin: "0 0 20px 0", fontFamily: "Oswald" }, children: "SYSTEM LOAD" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 15 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(StatItem, { label: "CONNECTIONS", value: `${connections.toLocaleString()}`, color: COLORS.white }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        StatItem,
        {
          label: "CPU OVERHEAD",
          value: `${cpuUsage.toFixed(1)}%`,
          color: cpuUsage > 80 ? COLORS.accent : COLORS.success,
          progress: cpuUsage
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        StatItem,
        {
          label: "SCHEDULING LATENCY",
          value: `${latency}ms`,
          color: latency > 100 ? COLORS.accent : COLORS.success,
          progress: Math.min(latency, 100)
        }
      )
    ] })
  ] });
};
var StatItem = ({ label, value, color, progress }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 5 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { color: "#888", fontSize: 18 }, children: label }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { color, fontSize: 22, fontWeight: 700 }, children: value })
    ] }),
    progress !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { width: "100%", height: 8, background: "#222", borderRadius: 4 }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
      width: `${progress}%`,
      height: "100%",
      background: color,
      borderRadius: 4,
      boxShadow: `0 0 10px ${color}`
    } }) })
  ] });
};

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/index.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
var ProjC8fa689fB2c345ffB309F6c1f87ada7d = () => {
  const frame = (0, import_remotion4.useCurrentFrame)();
  const { height } = (0, import_remotion4.useVideoConfig)();
  const pqOpacity = (0, import_remotion4.interpolate)(frame, [TIMING.priorityQueue - 15, TIMING.priorityQueue, TIMING.bottleneck, TIMING.bottleneck + 15], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bottleneckOpacity = (0, import_remotion4.interpolate)(frame, [TIMING.bottleneck, TIMING.bottleneck + 15, TIMING.timingWheel, TIMING.timingWheel + 15], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const wheelOpacity = (0, import_remotion4.interpolate)(frame, [TIMING.timingWheel, TIMING.timingWheel + 15, TIMING.realWorld, TIMING.realWorld + 15], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const wheel1Frame = frame - TIMING.timingWheel;
  const wheel1ActiveSlot = Math.floor(wheel1Frame / 10) % 60;
  const wheel2ActiveSlot = Math.floor(wheel1Frame / 600) % 60;
  const isHierarchical = frame > TIMING.hierarchical;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_remotion4.AbsoluteFill, { style: { backgroundColor: COLORS.bgDeep }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Background, {}),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_remotion4.Sequence, { from: 0, durationInFrames: TIMING.priorityQueue, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      height: "100%"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("h1", { style: {
        color: COLORS.primary,
        fontFamily: "Oswald",
        fontSize: height * 0.08,
        textAlign: "center",
        textShadow: `0 0 20px ${COLORS.glowPrimary}`,
        margin: 0
      }, children: [
        "SYSTEM DESIGN",
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("br", {}),
        "CHALLENGE"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h2", { style: {
        color: COLORS.accent,
        fontFamily: "JetBrains Mono",
        fontSize: height * 0.04,
        marginTop: 20
      }, children: "HIGH-THROUGHPUT SCHEDULING" })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { opacity: pqOpacity }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(PriorityQueue, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: {
      opacity: bottleneckOpacity,
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        PerformanceStats,
        {
          connections: (0, import_remotion4.interpolate)(frame, [TIMING.bottleneck, TIMING.timingWheel], [1e6, 1e7]),
          cpuUsage: (0, import_remotion4.interpolate)(frame, [TIMING.bottleneck, TIMING.timingWheel], [40, 98]),
          latency: (0, import_remotion4.interpolate)(frame, [TIMING.bottleneck, TIMING.timingWheel], [5, 250])
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: {
        position: "absolute",
        top: "20%",
        color: COLORS.accent,
        fontFamily: "Oswald",
        fontSize: 80,
        textShadow: `0 0 20px ${COLORS.glowAccent}`,
        transform: `scale(${(0, import_remotion4.interpolate)(Math.sin(frame * 0.2), [-1, 1], [0.9, 1.1])})`
      }, children: "O(log N) BOTTLENECK!" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: {
      opacity: wheelOpacity,
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: isHierarchical ? "row" : "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 100
    }, children: [
      !isHierarchical ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        TimingWheel,
        {
          title: "TIMING WHEEL (1s Resolution)",
          radius: 250,
          slots: 60,
          activeSlot: wheel1ActiveSlot,
          color: COLORS.primary,
          tasks: [5, 12, 18, 45]
        }
      ) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          TimingWheel,
          {
            title: "MINUTES (Outer)",
            radius: 200,
            slots: 60,
            activeSlot: wheel2ActiveSlot,
            color: COLORS.accent,
            tasks: [2, 15]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: {
          fontSize: 50,
          color: COLORS.white,
          fontFamily: "Oswald",
          transform: `scale(${(0, import_remotion4.interpolate)(Math.sin(frame * 0.1), [-1, 1], [0.8, 1.2])})`
        }, children: "\u2794" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          TimingWheel,
          {
            title: "SECONDS (Inner)",
            radius: 200,
            slots: 60,
            activeSlot: wheel1ActiveSlot,
            color: COLORS.primary,
            tasks: [wheel1ActiveSlot + 5, wheel1ActiveSlot + 12]
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: {
        position: "absolute",
        bottom: "10%",
        color: COLORS.success,
        fontFamily: "JetBrains Mono",
        fontSize: 40,
        textShadow: `0 0 10px ${COLORS.glowPrimary}`
      }, children: "CONSTANT TIME O(1)" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_remotion4.Sequence, { from: TIMING.realWorld, durationInFrames: TIMING.outro - TIMING.realWorld, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      height: "100%"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h2", { style: { color: COLORS.white, fontFamily: "Oswald", fontSize: 40 }, children: "USED BY" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", gap: 50, marginTop: 40 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(LogoBox, { name: "APACHE KAFKA" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(LogoBox, { name: "NETTY" })
      ] })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_remotion4.Sequence, { from: TIMING.outro, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      height: "100%"
    }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: {
      padding: 40,
      border: `4px solid ${COLORS.primary}`,
      boxShadow: `0 0 40px ${COLORS.glowPrimary}`,
      textAlign: "center",
      background: "rgba(0, 0, 0, 0.8)"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h1", { style: { color: COLORS.primary, fontFamily: "Oswald", fontSize: 60, margin: 0 }, children: "PRASANNA" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { style: { color: COLORS.white, fontFamily: "JetBrains Mono", fontSize: 24 }, children: "System Architect @ ZOHO" })
    ] }) }) })
  ] });
};
var LogoBox = ({ name }) => {
  const frame = (0, import_remotion4.useCurrentFrame)();
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: {
    padding: "20px 40px",
    background: "rgba(255, 255, 255, 0.05)",
    border: `2px solid ${COLORS.primary}`,
    borderRadius: 8,
    color: COLORS.primary,
    fontFamily: "Oswald",
    fontSize: 32,
    boxShadow: `0 0 20px ${COLORS.glowPrimary}`,
    transform: `translateY(${Math.sin(frame * 0.1) * 10}px)`
  }, children: name });
};
