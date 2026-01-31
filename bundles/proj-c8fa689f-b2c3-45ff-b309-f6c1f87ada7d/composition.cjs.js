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

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/index.tsx
var index_exports = {};
__export(index_exports, {
  ProjC8fa689fB2c345ffB309F6c1f87ada7d: () => ProjC8fa689fB2c345ffB309F6c1f87ada7d
});
module.exports = __toCommonJS(index_exports);
var import_react = __toESM(require("react"));
var import_remotion = require("remotion");

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/constants.ts
var COLORS = {
  bg: "#1a1a2e",
  primary: "#f97316",
  // Orange
  secondary: "#eab308",
  // Yellow
  accent: "#ec4899",
  // Pink
  success: "#22c55e",
  // Green
  danger: "#ef4444",
  // Red
  purple: "#8b5cf6",
  blue: "#3b82f6",
  cyan: "#06b6d4",
  white: "#ffffff",
  text: "#f1f5f9",
  muted: "#94a3b8",
  glass: "rgba(255, 255, 255, 0.1)",
  glassBorder: "rgba(255, 255, 255, 0.2)",
  darkBg: "#0f0f23"
};
var SPRING_CONFIGS = {
  // Primary config - elegant deceleration, no bounce
  settled: { damping: 22, stiffness: 90, mass: 0.9 },
  // Responsive but controlled
  responsive: { damping: 20, stiffness: 100, mass: 0.8 },
  // For subtle entrances
  gentle: { damping: 25, stiffness: 70, mass: 1 }
};

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/index.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var FloatingParticles = ({ count, color, baseOpacity = 0.3 }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height } = (0, import_remotion.useVideoConfig)();
  const minDim = Math.min(width, height);
  const particles = import_react.default.useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: i * 73 % 100 / 100,
      y: (i * 47 + 13) % 100 / 100,
      size: 3e-3 + i * 31 % 50 / 1e4,
      speed: 0.3 + i * 17 % 50 / 100,
      phase: i * 29 % 100
    }));
  }, [count]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: particles.map((p) => {
    const floatY = (0, import_remotion.interpolate)(
      (frame * p.speed + p.phase) % 200,
      [0, 100, 200],
      [0, -15, 0]
    );
    const opacity = (0, import_remotion.interpolate)(
      (frame * p.speed * 0.5 + p.phase) % 150,
      [0, 75, 150],
      [baseOpacity * 0.5, baseOpacity, baseOpacity * 0.5]
    );
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: p.x * width,
          top: p.y * height + floatY,
          width: minDim * p.size,
          height: minDim * p.size,
          borderRadius: "50%",
          background: color,
          opacity,
          boxShadow: `0 0 ${minDim * p.size * 2}px ${color}`
        }
      },
      p.id
    );
  }) });
};
var AnimatedBackground = ({ baseHue, hueRange = 15, children }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { durationInFrames } = (0, import_remotion.useVideoConfig)();
  const hueShift = (0, import_remotion.interpolate)(frame, [0, durationInFrames], [0, hueRange]);
  const satShift = (0, import_remotion.interpolate)(
    frame % 120,
    [0, 60, 120],
    [0, 3, 0]
  );
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_remotion.AbsoluteFill,
    {
      style: {
        background: `linear-gradient(
          135deg,
          hsl(${baseHue + hueShift}, ${35 + satShift}%, 12%),
          hsl(${baseHue + hueShift + 20}, ${30 + satShift}%, 8%)
        )`
      },
      children
    }
  );
};
var IntroScene = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const minDim = Math.min(width, height);
  const titleProgress = (0, import_remotion.spring)({
    frame,
    fps,
    config: SPRING_CONFIGS.settled
  });
  const titleOpacity = (0, import_remotion.interpolate)(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const titleY = (0, import_remotion.interpolate)(titleProgress, [0, 1], [40, 0]);
  const subtitleDelay = 20;
  const subtitleProgress = (0, import_remotion.spring)({
    frame: Math.max(0, frame - subtitleDelay),
    fps,
    config: SPRING_CONFIGS.settled
  });
  const subtitleOpacity = (0, import_remotion.interpolate)(frame, [subtitleDelay, subtitleDelay + 15], [0, 1], { extrapolateRight: "clamp" });
  const subtitleY = (0, import_remotion.interpolate)(subtitleProgress, [0, 1], [30, 0]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AnimatedBackground, { baseHue: 270, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FloatingParticles, { count: 20, color: COLORS.primary, baseOpacity: 0.25 }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: minDim * 0.04
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.055,
                fontWeight: 800,
                color: COLORS.primary,
                textAlign: "center",
                transform: `translateY(${titleY}px)`,
                opacity: titleOpacity,
                textShadow: `0 0 ${minDim * 0.04}px ${COLORS.primary}66`
              },
              children: "System Design"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.08,
                fontWeight: 900,
                color: COLORS.secondary,
                textAlign: "center",
                transform: `translateY(${titleY}px)`,
                opacity: titleOpacity,
                textShadow: `0 0 ${minDim * 0.05}px ${COLORS.secondary}66`
              },
              children: "CHALLENGE"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.028,
                fontWeight: 600,
                color: COLORS.accent,
                opacity: subtitleOpacity,
                transform: `translateY(${subtitleY}px)`,
                marginTop: minDim * 0.02
              },
              children: "Can you build this?"
            }
          )
        ]
      }
    )
  ] });
};
var ProblemScene = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const minDim = Math.min(width, height);
  const taskCount = Math.min(Math.floor(frame / 3), 40);
  const tasks = Array.from({ length: taskCount }, (_, i) => ({
    id: i,
    x: 15 + i % 7 * 12,
    delay: i * 3
  }));
  const counterValue = Math.floor(
    (0, import_remotion.interpolate)(frame, [0, 120], [0, 1e7], { extrapolateRight: "clamp" })
  );
  const titleProgress = (0, import_remotion.spring)({
    frame,
    fps,
    config: SPRING_CONFIGS.settled
  });
  const titleOpacity = (0, import_remotion.interpolate)(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const titleY = (0, import_remotion.interpolate)(titleProgress, [0, 1], [20, 0]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AnimatedBackground, { baseHue: 270, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FloatingParticles, { count: 15, color: COLORS.danger, baseOpacity: 0.2 }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: minDim * 0.05
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.04,
                fontWeight: 700,
                color: COLORS.text,
                textAlign: "center",
                opacity: titleOpacity,
                transform: `translateY(${titleY}px)`,
                marginTop: height * 0.08
              },
              children: "Millions of Delayed Tasks"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                flex: 1,
                position: "relative",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                overflow: "hidden"
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "div",
                {
                  style: {
                    width: width * 0.7,
                    height: height * 0.35,
                    background: COLORS.glass,
                    border: `${minDim * 3e-3}px solid ${COLORS.glassBorder}`,
                    borderRadius: minDim * 0.02,
                    position: "relative",
                    overflow: "hidden"
                  },
                  children: tasks.map((task) => {
                    const taskProgress = (0, import_remotion.spring)({
                      frame: Math.max(0, frame - task.delay),
                      fps,
                      config: SPRING_CONFIGS.settled
                    });
                    const yPos = (0, import_remotion.interpolate)(taskProgress, [0, 1], [-50, 0], { extrapolateRight: "clamp" });
                    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "div",
                      {
                        style: {
                          position: "absolute",
                          left: `${task.x}%`,
                          top: `${15 + task.id % 8 * 10}%`,
                          width: minDim * 0.06,
                          height: minDim * 0.06,
                          background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.secondary} 100%)`,
                          borderRadius: minDim * 0.01,
                          opacity: taskProgress,
                          transform: `translateY(${yPos}px)`,
                          boxShadow: `0 0 ${minDim * 0.01}px ${COLORS.primary}66`
                        }
                      },
                      task.id
                    );
                  })
                }
              )
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "div",
            {
              style: {
                textAlign: "center",
                marginBottom: height * 0.1
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "div",
                  {
                    style: {
                      fontSize: height * 0.07,
                      fontWeight: 900,
                      color: COLORS.danger,
                      fontFamily: "monospace",
                      textShadow: `0 0 ${minDim * 0.03}px ${COLORS.danger}66`
                    },
                    children: counterValue.toLocaleString()
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "div",
                  {
                    style: {
                      fontSize: height * 0.022,
                      color: COLORS.muted,
                      marginTop: minDim * 0.01
                    },
                    children: "tasks flooding in"
                  }
                )
              ]
            }
          )
        ]
      }
    )
  ] });
};
var PriorityQueueScene = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const minDim = Math.min(width, height);
  const titleProgress = (0, import_remotion.spring)({
    frame,
    fps,
    config: SPRING_CONFIGS.settled
  });
  const titleOpacity = (0, import_remotion.interpolate)(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const titleY = (0, import_remotion.interpolate)(titleProgress, [0, 1], [20, 0]);
  const heapNodes = [
    { id: 0, value: 1, level: 0, pos: 0.5 },
    { id: 1, value: 3, level: 1, pos: 0.3 },
    { id: 2, value: 5, level: 1, pos: 0.7 },
    { id: 3, value: 7, level: 2, pos: 0.15 },
    { id: 4, value: 9, level: 2, pos: 0.45 },
    { id: 5, value: 11, level: 2, pos: 0.55 },
    { id: 6, value: 13, level: 2, pos: 0.85 }
  ];
  const nodeSize = minDim * 0.1;
  const levelHeight = height * 0.12;
  const edges = [
    { from: 0, to: 1 },
    { from: 0, to: 2 },
    { from: 1, to: 3 },
    { from: 1, to: 4 },
    { from: 2, to: 5 },
    { from: 2, to: 6 }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AnimatedBackground, { baseHue: 220, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FloatingParticles, { count: 18, color: COLORS.purple, baseOpacity: 0.2 }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: minDim * 0.05
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.04,
                fontWeight: 700,
                color: COLORS.text,
                textAlign: "center",
                opacity: titleOpacity,
                transform: `translateY(${titleY}px)`,
                marginTop: height * 0.06
              },
              children: "Priority Queue"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.028,
                fontWeight: 600,
                color: COLORS.purple,
                textAlign: "center",
                opacity: titleOpacity,
                marginTop: minDim * 0.01
              },
              children: "Binary Heap Structure"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "div",
            {
              style: {
                flex: 1,
                position: "relative",
                display: "flex",
                justifyContent: "center",
                alignItems: "center"
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "svg",
                  {
                    style: {
                      position: "absolute",
                      width: width * 0.8,
                      height: height * 0.5,
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)"
                    },
                    children: edges.map((edge, i) => {
                      const fromNode = heapNodes[edge.from];
                      const toNode = heapNodes[edge.to];
                      const edgeDelay = 30 + i * 8;
                      const edgeProgress = (0, import_remotion.spring)({
                        frame: Math.max(0, frame - edgeDelay),
                        fps,
                        config: SPRING_CONFIGS.settled
                      });
                      const x1 = fromNode.pos * width * 0.8;
                      const y1 = height * 0.15 + fromNode.level * levelHeight;
                      const x2 = toNode.pos * width * 0.8;
                      const y2 = height * 0.15 + toNode.level * levelHeight;
                      const lineLength = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
                      const dashOffset = lineLength * (1 - edgeProgress);
                      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        "line",
                        {
                          x1,
                          y1,
                          x2,
                          y2,
                          stroke: COLORS.glassBorder,
                          strokeWidth: minDim * 3e-3,
                          strokeDasharray: lineLength,
                          strokeDashoffset: dashOffset
                        },
                        `edge-${i}`
                      );
                    })
                  }
                ),
                heapNodes.map((node, i) => {
                  const nodeDelay = i * 8;
                  const nodeProgress = (0, import_remotion.spring)({
                    frame: Math.max(0, frame - nodeDelay),
                    fps,
                    config: SPRING_CONFIGS.settled
                  });
                  const nodeScale = (0, import_remotion.interpolate)(nodeProgress, [0, 1], [0.5, 1], { extrapolateRight: "clamp" });
                  const nodeOpacity = (0, import_remotion.interpolate)(nodeProgress, [0, 1], [0, 1], { extrapolateRight: "clamp" });
                  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    "div",
                    {
                      style: {
                        position: "absolute",
                        left: `${node.pos * 80 + 10}%`,
                        top: height * 0.25 + node.level * levelHeight,
                        width: nodeSize,
                        height: nodeSize,
                        borderRadius: "50%",
                        background: `linear-gradient(135deg, ${COLORS.purple} 0%, ${COLORS.blue} 100%)`,
                        border: `${minDim * 3e-3}px solid ${COLORS.glassBorder}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: height * 0.025,
                        fontWeight: 700,
                        color: COLORS.white,
                        transform: `translate(-50%, -50%) scale(${nodeScale})`,
                        opacity: nodeOpacity,
                        boxShadow: `0 0 ${minDim * 0.02}px ${COLORS.purple}66`
                      },
                      children: node.value
                    },
                    node.id
                  );
                })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.022,
                color: COLORS.muted,
                textAlign: "center",
                marginBottom: height * 0.08
              },
              children: "Most immediate tasks at the top"
            }
          )
        ]
      }
    )
  ] });
};
var LogarithmicTrapScene = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const minDim = Math.min(width, height);
  const titleProgress = (0, import_remotion.spring)({
    frame,
    fps,
    config: SPRING_CONFIGS.settled
  });
  const titleOpacity = (0, import_remotion.interpolate)(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const titleY = (0, import_remotion.interpolate)(titleProgress, [0, 1], [20, 0]);
  const steps = [1e6, 5e5, 25e4, 125e3, 62500, 31250, 15625, 7812, 3906, 1953, 976, 488, 244, 122, 61, 30, 15, 7, 3, 1];
  const currentStep = Math.min(Math.floor(frame / 12), steps.length - 1);
  const counterProgress = (0, import_remotion.spring)({
    frame: Math.max(0, frame - 60),
    fps,
    config: SPRING_CONFIGS.settled
  });
  const counterOpacity = (0, import_remotion.interpolate)(counterProgress, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AnimatedBackground, { baseHue: 30, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FloatingParticles, { count: 15, color: COLORS.secondary, baseOpacity: 0.2 }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: minDim * 0.05
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.04,
                fontWeight: 700,
                color: COLORS.danger,
                textAlign: "center",
                opacity: titleOpacity,
                transform: `translateY(${titleY}px)`
              },
              children: "The Trap"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.028,
                color: COLORS.secondary,
                textAlign: "center",
                opacity: titleOpacity
              },
              children: "Logarithmic Time O(log n)"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "div",
            {
              style: {
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: minDim * 0.015,
                marginTop: minDim * 0.04,
                opacity: counterOpacity
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "div",
                  {
                    style: {
                      fontSize: height * 0.08,
                      fontWeight: 900,
                      color: COLORS.primary,
                      fontFamily: "monospace",
                      textShadow: `0 0 ${minDim * 0.03}px ${COLORS.primary}66`
                    },
                    children: steps[currentStep].toLocaleString()
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                  "div",
                  {
                    style: {
                      fontSize: height * 0.025,
                      color: COLORS.muted
                    },
                    children: [
                      "remaining after ",
                      currentStep + 1,
                      " operations"
                    ]
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                width: width * 0.7,
                height: minDim * 0.02,
                background: COLORS.glass,
                borderRadius: minDim * 0.01,
                overflow: "hidden",
                marginTop: minDim * 0.03
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "div",
                {
                  style: {
                    width: `${currentStep / (steps.length - 1) * 100}%`,
                    height: "100%",
                    background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.secondary})`,
                    borderRadius: minDim * 0.01
                  }
                }
              )
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.022,
                color: COLORS.muted,
                marginTop: minDim * 0.02
              },
              children: "Every insert requires sorting and rebalancing"
            }
          )
        ]
      }
    )
  ] });
};
var BottleneckScene = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const minDim = Math.min(width, height);
  const titleProgress = (0, import_remotion.spring)({
    frame,
    fps,
    config: SPRING_CONFIGS.settled
  });
  const titleOpacity = (0, import_remotion.interpolate)(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const titleY = (0, import_remotion.interpolate)(titleProgress, [0, 1], [20, 0]);
  const connections = Math.floor(
    (0, import_remotion.interpolate)(frame, [30, 180], [0, 1e7], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  );
  const stressLevel = (0, import_remotion.interpolate)(frame, [60, 300], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const stressColor = stressLevel > 0.7 ? COLORS.danger : stressLevel > 0.4 ? COLORS.secondary : COLORS.success;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AnimatedBackground, { baseHue: 0, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FloatingParticles, { count: 20, color: COLORS.danger, baseOpacity: 0.15 + stressLevel * 0.1 }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: minDim * 0.04
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.04,
                fontWeight: 700,
                color: COLORS.text,
                textAlign: "center",
                opacity: titleOpacity,
                transform: `translateY(${titleY}px)`
              },
              children: "The Bottleneck"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.1,
                fontWeight: 900,
                color: stressColor,
                fontFamily: "monospace",
                textShadow: `0 0 ${minDim * 0.04}px ${stressColor}66`
              },
              children: connections.toLocaleString()
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.025,
                color: COLORS.muted
              },
              children: "connections"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                width: width * 0.6,
                height: minDim * 0.04,
                background: COLORS.glass,
                borderRadius: minDim * 0.02,
                overflow: "hidden",
                marginTop: minDim * 0.04,
                border: `${minDim * 2e-3}px solid ${COLORS.glassBorder}`
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "div",
                {
                  style: {
                    width: `${stressLevel * 100}%`,
                    height: "100%",
                    background: `linear-gradient(90deg, ${COLORS.success}, ${COLORS.secondary}, ${COLORS.danger})`,
                    borderRadius: minDim * 0.015,
                    boxShadow: `0 0 ${minDim * 0.02}px ${stressColor}66`
                  }
                }
              )
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.028,
                color: COLORS.danger,
                fontWeight: 700,
                marginTop: minDim * 0.03
              },
              children: "Sorting overhead becomes a bottleneck"
            }
          )
        ]
      }
    )
  ] });
};
var TransitionScene = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const minDim = Math.min(width, height);
  const questionProgress = (0, import_remotion.spring)({
    frame,
    fps,
    config: SPRING_CONFIGS.settled
  });
  const questionY = (0, import_remotion.interpolate)(questionProgress, [0, 1], [40, 0]);
  const questionOpacity = (0, import_remotion.interpolate)(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const answerDelay = 60;
  const answerProgress = (0, import_remotion.spring)({
    frame: Math.max(0, frame - answerDelay),
    fps,
    config: SPRING_CONFIGS.settled
  });
  const answerOpacity = (0, import_remotion.interpolate)(frame, [answerDelay, answerDelay + 20], [0, 1], { extrapolateRight: "clamp" });
  const answerY = (0, import_remotion.interpolate)(answerProgress, [0, 1], [30, 0]);
  const o1Delay = 100;
  const o1Progress = (0, import_remotion.spring)({
    frame: Math.max(0, frame - o1Delay),
    fps,
    config: SPRING_CONFIGS.settled
  });
  const o1Scale = (0, import_remotion.interpolate)(o1Progress, [0, 1], [0.5, 1], { extrapolateRight: "clamp" });
  const o1Opacity = (0, import_remotion.interpolate)(o1Progress, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AnimatedBackground, { baseHue: 140, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FloatingParticles, { count: 25, color: COLORS.success, baseOpacity: 0.25 }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: minDim * 0.06
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.045,
                fontWeight: 700,
                color: COLORS.text,
                textAlign: "center",
                transform: `translateY(${questionY}px)`,
                opacity: questionOpacity
              },
              children: "Can we do better?"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.035,
                color: COLORS.success,
                textAlign: "center",
                opacity: answerOpacity,
                transform: `translateY(${answerY}px)`
              },
              children: "Constant Time Complexity"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.12,
                fontWeight: 900,
                color: COLORS.success,
                textAlign: "center",
                transform: `scale(${o1Scale})`,
                opacity: o1Opacity,
                textShadow: `0 0 ${minDim * 0.05}px ${COLORS.success}66`
              },
              children: "O(1)"
            }
          )
        ]
      }
    )
  ] });
};
var TimingWheelIntroScene = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const minDim = Math.min(width, height);
  const titleProgress = (0, import_remotion.spring)({
    frame,
    fps,
    config: SPRING_CONFIGS.settled
  });
  const titleY = (0, import_remotion.interpolate)(titleProgress, [0, 1], [40, 0]);
  const titleOpacity = (0, import_remotion.interpolate)(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const wheelDelay = 40;
  const wheelProgress = (0, import_remotion.spring)({
    frame: Math.max(0, frame - wheelDelay),
    fps,
    config: SPRING_CONFIGS.settled
  });
  const wheelScale = (0, import_remotion.interpolate)(wheelProgress, [0, 1], [0.7, 1], { extrapolateRight: "clamp" });
  const wheelOpacity = (0, import_remotion.interpolate)(wheelProgress, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const numSlots = 12;
  const wheelRadius = minDim * 0.22;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AnimatedBackground, { baseHue: 200, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FloatingParticles, { count: 18, color: COLORS.cyan, baseOpacity: 0.2 }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: minDim * 0.05
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.045,
                fontWeight: 700,
                color: COLORS.cyan,
                textAlign: "center",
                opacity: titleOpacity,
                transform: `translateY(${titleY}px)`,
                marginTop: height * 0.08,
                textShadow: `0 0 ${minDim * 0.03}px ${COLORS.cyan}66`
              },
              children: "Hierarchical Timing Wheel"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                flex: 1,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                transform: `scale(${wheelScale})`,
                opacity: wheelOpacity
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: wheelRadius * 2.4, height: wheelRadius * 2.4, children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "circle",
                  {
                    cx: wheelRadius * 1.2,
                    cy: wheelRadius * 1.2,
                    r: wheelRadius,
                    fill: "none",
                    stroke: COLORS.glassBorder,
                    strokeWidth: minDim * 4e-3
                  }
                ),
                Array.from({ length: numSlots }).map((_, i) => {
                  const angle = i / numSlots * 2 * Math.PI - Math.PI / 2;
                  const x = wheelRadius * 1.2 + Math.cos(angle) * wheelRadius * 0.75;
                  const y = wheelRadius * 1.2 + Math.sin(angle) * wheelRadius * 0.75;
                  const slotDelay = wheelDelay + i * 6;
                  const slotProgress = (0, import_remotion.spring)({
                    frame: Math.max(0, frame - slotDelay),
                    fps,
                    config: SPRING_CONFIGS.settled
                  });
                  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "circle",
                      {
                        cx: x,
                        cy: y,
                        r: minDim * 0.03 * slotProgress,
                        fill: COLORS.glass,
                        stroke: COLORS.cyan,
                        strokeWidth: minDim * 2e-3
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "text",
                      {
                        x,
                        y: y + minDim * 0.01,
                        textAnchor: "middle",
                        fill: COLORS.text,
                        fontSize: height * 0.02,
                        fontWeight: 600,
                        opacity: slotProgress,
                        children: i
                      }
                    )
                  ] }, i);
                }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "text",
                  {
                    x: wheelRadius * 1.2,
                    y: wheelRadius * 1.2 + minDim * 0.01,
                    textAnchor: "middle",
                    fill: COLORS.cyan,
                    fontSize: height * 0.025,
                    fontWeight: 700,
                    children: "60 slots"
                  }
                )
              ] })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.025,
                color: COLORS.muted,
                textAlign: "center",
                marginBottom: height * 0.08
              },
              children: "Picture a simple clock face with 60 slots"
            }
          )
        ]
      }
    )
  ] });
};
var DropToSlotScene = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const minDim = Math.min(width, height);
  const numSlots = 12;
  const wheelRadius = minDim * 0.25;
  const centerX = width / 2;
  const centerY = height * 0.5;
  const targetSlot = 5;
  const targetAngle = targetSlot / numSlots * 2 * Math.PI - Math.PI / 2;
  const dropDelay = 30;
  const dropProgress = (0, import_remotion.spring)({
    frame: Math.max(0, frame - dropDelay),
    fps,
    config: SPRING_CONFIGS.settled
  });
  const targetX = centerX + Math.cos(targetAngle) * wheelRadius * 0.75;
  const targetY = centerY + Math.sin(targetAngle) * wheelRadius * 0.75;
  const taskY = (0, import_remotion.interpolate)(dropProgress, [0, 1], [height * 0.1, targetY], { extrapolateRight: "clamp" });
  const taskOpacity = (0, import_remotion.interpolate)(frame, [dropDelay, dropDelay + 20], [0, 1], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AnimatedBackground, { baseHue: 200, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FloatingParticles, { count: 15, color: COLORS.success, baseOpacity: 0.2 }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.035,
                fontWeight: 700,
                color: COLORS.text,
                textAlign: "center",
                marginTop: height * 0.06
              },
              children: "Drop directly to bucket"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "svg",
            {
              style: {
                position: "absolute",
                top: centerY - wheelRadius,
                left: centerX - wheelRadius,
                width: wheelRadius * 2,
                height: wheelRadius * 2
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "circle",
                  {
                    cx: wheelRadius,
                    cy: wheelRadius,
                    r: wheelRadius * 0.9,
                    fill: "none",
                    stroke: COLORS.glassBorder,
                    strokeWidth: minDim * 3e-3
                  }
                ),
                Array.from({ length: numSlots }).map((_, i) => {
                  const angle = i / numSlots * 2 * Math.PI - Math.PI / 2;
                  const x = wheelRadius + Math.cos(angle) * wheelRadius * 0.75;
                  const y = wheelRadius + Math.sin(angle) * wheelRadius * 0.75;
                  const isTarget = i === targetSlot;
                  const slotDelay = i * 6;
                  const slotProgress = (0, import_remotion.spring)({
                    frame: Math.max(0, frame - slotDelay),
                    fps,
                    config: SPRING_CONFIGS.settled
                  });
                  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "circle",
                      {
                        cx: x,
                        cy: y,
                        r: minDim * 0.025 * slotProgress,
                        fill: isTarget ? COLORS.success : COLORS.glass,
                        stroke: isTarget ? COLORS.success : COLORS.glassBorder,
                        strokeWidth: minDim * 2e-3
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "text",
                      {
                        x,
                        y: y + minDim * 8e-3,
                        textAnchor: "middle",
                        fill: COLORS.text,
                        fontSize: height * 0.018,
                        fontWeight: 600,
                        opacity: slotProgress,
                        children: i
                      }
                    )
                  ] }, i);
                })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: targetX - minDim * 0.04,
                top: taskY - minDim * 0.04,
                width: minDim * 0.08,
                height: minDim * 0.08,
                background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.secondary} 100%)`,
                borderRadius: minDim * 0.015,
                opacity: taskOpacity,
                boxShadow: `0 0 ${minDim * 0.02}px ${COLORS.primary}66`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: height * 0.02,
                fontWeight: 700,
                color: COLORS.white
              },
              children: "5s"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                bottom: height * 0.1,
                fontSize: height * 0.025,
                color: COLORS.success,
                fontWeight: 600
              },
              children: "No sorting - O(1) insertion!"
            }
          )
        ]
      }
    )
  ] });
};
var HierarchyScene = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const minDim = Math.min(width, height);
  const titleProgress = (0, import_remotion.spring)({
    frame,
    fps,
    config: SPRING_CONFIGS.settled
  });
  const titleOpacity = (0, import_remotion.interpolate)(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const titleY = (0, import_remotion.interpolate)(titleProgress, [0, 1], [20, 0]);
  const outerRadius = minDim * 0.2;
  const innerRadius = minDim * 0.12;
  const outerCenterX = width * 0.35;
  const outerCenterY = height * 0.55;
  const innerCenterX = width * 0.65;
  const innerCenterY = height * 0.55;
  const outerDelay = 30;
  const outerProgress = (0, import_remotion.spring)({
    frame: Math.max(0, frame - outerDelay),
    fps,
    config: SPRING_CONFIGS.settled
  });
  const innerDelay = 80;
  const innerProgress = (0, import_remotion.spring)({
    frame: Math.max(0, frame - innerDelay),
    fps,
    config: SPRING_CONFIGS.settled
  });
  const arrowDelay = 150;
  const arrowProgress = (0, import_remotion.spring)({
    frame: Math.max(0, frame - arrowDelay),
    fps,
    config: SPRING_CONFIGS.settled
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AnimatedBackground, { baseHue: 260, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FloatingParticles, { count: 20, color: COLORS.purple, baseOpacity: 0.2 }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.035,
                fontWeight: 700,
                color: COLORS.text,
                textAlign: "center",
                marginTop: height * 0.05,
                opacity: titleOpacity,
                transform: `translateY(${titleY}px)`
              },
              children: "The Real Genius: Hierarchy"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "svg",
            {
              style: {
                position: "absolute",
                top: outerCenterY - outerRadius,
                left: outerCenterX - outerRadius,
                width: outerRadius * 2,
                height: outerRadius * 2,
                transform: `scale(${outerProgress})`,
                opacity: outerProgress
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "circle",
                  {
                    cx: outerRadius,
                    cy: outerRadius,
                    r: outerRadius * 0.9,
                    fill: "none",
                    stroke: COLORS.purple,
                    strokeWidth: minDim * 4e-3,
                    opacity: 0.6
                  }
                ),
                Array.from({ length: 12 }).map((_, i) => {
                  const angle = i / 12 * 2 * Math.PI - Math.PI / 2;
                  const x = outerRadius + Math.cos(angle) * outerRadius * 0.75;
                  const y = outerRadius + Math.sin(angle) * outerRadius * 0.75;
                  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    "circle",
                    {
                      cx: x,
                      cy: y,
                      r: minDim * 0.02,
                      fill: COLORS.glass,
                      stroke: COLORS.purple,
                      strokeWidth: minDim * 2e-3
                    },
                    i
                  );
                }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "text",
                  {
                    x: outerRadius,
                    y: outerRadius + minDim * 0.01,
                    textAnchor: "middle",
                    fill: COLORS.purple,
                    fontSize: height * 0.025,
                    fontWeight: 700,
                    children: "MINUTE"
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "svg",
            {
              style: {
                position: "absolute",
                top: innerCenterY - innerRadius,
                left: innerCenterX - innerRadius,
                width: innerRadius * 2,
                height: innerRadius * 2,
                transform: `scale(${innerProgress})`,
                opacity: innerProgress
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "circle",
                  {
                    cx: innerRadius,
                    cy: innerRadius,
                    r: innerRadius * 0.9,
                    fill: "none",
                    stroke: COLORS.cyan,
                    strokeWidth: minDim * 4e-3,
                    opacity: 0.6
                  }
                ),
                Array.from({ length: 12 }).map((_, i) => {
                  const angle = i / 12 * 2 * Math.PI - Math.PI / 2;
                  const x = innerRadius + Math.cos(angle) * innerRadius * 0.65;
                  const y = innerRadius + Math.sin(angle) * innerRadius * 0.65;
                  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    "circle",
                    {
                      cx: x,
                      cy: y,
                      r: minDim * 0.015,
                      fill: COLORS.glass,
                      stroke: COLORS.cyan,
                      strokeWidth: minDim * 2e-3
                    },
                    i
                  );
                }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "text",
                  {
                    x: innerRadius,
                    y: innerRadius + minDim * 8e-3,
                    textAnchor: "middle",
                    fill: COLORS.cyan,
                    fontSize: height * 0.02,
                    fontWeight: 700,
                    children: "SECOND"
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "svg",
            {
              style: {
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none"
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "marker",
                  {
                    id: "arrowhead",
                    markerWidth: "10",
                    markerHeight: "7",
                    refX: "9",
                    refY: "3.5",
                    orient: "auto",
                    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("polygon", { points: "0 0, 10 3.5, 0 7", fill: COLORS.success })
                  }
                ) }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "line",
                  {
                    x1: outerCenterX + outerRadius * 0.6,
                    y1: outerCenterY,
                    x2: innerCenterX - innerRadius * 0.6,
                    y2: innerCenterY,
                    stroke: COLORS.success,
                    strokeWidth: minDim * 4e-3,
                    markerEnd: "url(#arrowhead)",
                    opacity: arrowProgress
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                bottom: height * 0.1,
                fontSize: height * 0.022,
                color: COLORS.muted,
                textAlign: "center"
              },
              children: "Tasks cascade from outer wheel to inner wheel"
            }
          )
        ]
      }
    )
  ] });
};
var CascadeScene = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const minDim = Math.min(width, height);
  const titleProgress = (0, import_remotion.spring)({
    frame,
    fps,
    config: SPRING_CONFIGS.settled
  });
  const titleOpacity = (0, import_remotion.interpolate)(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const titleY = (0, import_remotion.interpolate)(titleProgress, [0, 1], [20, 0]);
  const phase1 = frame < 100;
  const phase2 = frame >= 100 && frame < 200;
  const phase3 = frame >= 200;
  const taskStartX = width * 0.3;
  const taskStartY = height * 0.45;
  const taskEndX = width * 0.7;
  const taskEndY = height * 0.55;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AnimatedBackground, { baseHue: 180, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FloatingParticles, { count: 20, color: COLORS.cyan, baseOpacity: 0.2 }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.035,
                fontWeight: 700,
                color: COLORS.text,
                textAlign: "center",
                marginTop: height * 0.05,
                opacity: titleOpacity,
                transform: `translateY(${titleY}px)`
              },
              children: "Cascade Mechanism"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: width * 0.2,
                top: height * 0.35,
                fontSize: height * 0.03,
                fontWeight: 700,
                color: COLORS.purple,
                opacity: phase1 ? 1 : 0.5
              },
              children: "Minute Wheel"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                right: width * 0.15,
                top: height * 0.35,
                fontSize: height * 0.03,
                fontWeight: 700,
                color: COLORS.cyan,
                opacity: phase3 ? 1 : 0.5
              },
              children: "Second Wheel"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: width * 0.2,
                top: height * 0.45,
                width: minDim * 0.25,
                height: minDim * 0.25,
                borderRadius: "50%",
                border: `${minDim * 4e-3}px solid ${COLORS.purple}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: height * 0.025,
                color: COLORS.purple,
                fontWeight: 700,
                background: phase1 ? `${COLORS.purple}22` : "transparent"
              },
              children: phase1 ? "TICK!" : "MIN"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                right: width * 0.2,
                top: height * 0.5,
                width: minDim * 0.18,
                height: minDim * 0.18,
                borderRadius: "50%",
                border: `${minDim * 4e-3}px solid ${COLORS.cyan}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: height * 0.022,
                color: COLORS.cyan,
                fontWeight: 700,
                background: phase3 ? `${COLORS.cyan}22` : "transparent"
              },
              children: "SEC"
            }
          ),
          (phase2 || phase3) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: [0, 1, 2].map((i) => {
            const taskDelay = i * 15;
            const individualProgress = (0, import_remotion.interpolate)(frame - 100 - taskDelay, [0, 80], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp"
            });
            const tx = (0, import_remotion.interpolate)(individualProgress, [0, 1], [taskStartX, taskEndX]);
            const ty = (0, import_remotion.interpolate)(individualProgress, [0, 0.5, 1], [taskStartY + i * 30, height * 0.35, taskEndY + i * 25]);
            return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "div",
              {
                style: {
                  position: "absolute",
                  left: tx,
                  top: ty,
                  width: minDim * 0.05,
                  height: minDim * 0.05,
                  background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.secondary} 100%)`,
                  borderRadius: minDim * 0.01,
                  boxShadow: `0 0 ${minDim * 0.015}px ${COLORS.primary}66`,
                  opacity: individualProgress > 0 ? 1 : 0
                }
              },
              i
            );
          }) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                bottom: height * 0.12,
                fontSize: height * 0.025,
                color: COLORS.success,
                fontWeight: 600
              },
              children: "When minute ticks \u2192 tasks cascade down"
            }
          )
        ]
      }
    )
  ] });
};
var MechanismScene = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const minDim = Math.min(width, height);
  const titleProgress = (0, import_remotion.spring)({
    frame,
    fps,
    config: SPRING_CONFIGS.settled
  });
  const titleOpacity = (0, import_remotion.interpolate)(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const titleY = (0, import_remotion.interpolate)(titleProgress, [0, 1], [20, 0]);
  const points = [
    { text: "No sorting needed", color: COLORS.success, delay: 40 },
    { text: "Just rotation", color: COLORS.cyan, delay: 70 },
    { text: "Like a real clock", color: COLORS.purple, delay: 100 }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AnimatedBackground, { baseHue: 220, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FloatingParticles, { count: 18, color: COLORS.blue, baseOpacity: 0.2 }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: minDim * 0.06
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.04,
                fontWeight: 700,
                color: COLORS.text,
                textAlign: "center",
                opacity: titleOpacity,
                transform: `translateY(${titleY}px)`
              },
              children: "Mechanical Clock in Code"
            }
          ),
          points.map((point, i) => {
            const pointProgress = (0, import_remotion.spring)({
              frame: Math.max(0, frame - point.delay),
              fps,
              config: SPRING_CONFIGS.settled
            });
            const pointY = (0, import_remotion.interpolate)(pointProgress, [0, 1], [30, 0]);
            const pointOpacity = (0, import_remotion.interpolate)(pointProgress, [0, 1], [0, 1], { extrapolateRight: "clamp" });
            return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: minDim * 0.03,
                  opacity: pointOpacity,
                  transform: `translateY(${pointY}px)`
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    "div",
                    {
                      style: {
                        width: minDim * 0.025,
                        height: minDim * 0.025,
                        borderRadius: "50%",
                        background: point.color,
                        boxShadow: `0 0 ${minDim * 0.015}px ${point.color}66`
                      }
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    "span",
                    {
                      style: {
                        fontSize: height * 0.035,
                        color: point.color,
                        fontWeight: 600
                      },
                      children: point.text
                    }
                  )
                ]
              },
              i
            );
          })
        ]
      }
    )
  ] });
};
var RealWorldScene = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const minDim = Math.min(width, height);
  const kafkaDelay = 0;
  const kafkaProgress = (0, import_remotion.spring)({
    frame: Math.max(0, frame - kafkaDelay),
    fps,
    config: SPRING_CONFIGS.settled
  });
  const kafkaY = (0, import_remotion.interpolate)(kafkaProgress, [0, 1], [40, 0]);
  const nettyDelay = 40;
  const nettyProgress = (0, import_remotion.spring)({
    frame: Math.max(0, frame - nettyDelay),
    fps,
    config: SPRING_CONFIGS.settled
  });
  const nettyY = (0, import_remotion.interpolate)(nettyProgress, [0, 1], [40, 0]);
  const messageDelay = 80;
  const messageProgress = (0, import_remotion.spring)({
    frame: Math.max(0, frame - messageDelay),
    fps,
    config: SPRING_CONFIGS.settled
  });
  const messageOpacity = (0, import_remotion.interpolate)(messageProgress, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const messageY = (0, import_remotion.interpolate)(messageProgress, [0, 1], [20, 0]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AnimatedBackground, { baseHue: 220, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FloatingParticles, { count: 20, color: COLORS.blue, baseOpacity: 0.2 }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: minDim * 0.06
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.035,
                fontWeight: 700,
                color: COLORS.text,
                textAlign: "center"
              },
              children: "Used by Industry Giants"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "div",
            {
              style: {
                display: "flex",
                gap: minDim * 0.1
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                  "div",
                  {
                    style: {
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: minDim * 0.02,
                      transform: `translateY(${kafkaY}px)`,
                      opacity: kafkaProgress
                    },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        "div",
                        {
                          style: {
                            width: minDim * 0.2,
                            height: minDim * 0.2,
                            background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.danger} 100%)`,
                            borderRadius: minDim * 0.03,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: height * 0.04,
                            fontWeight: 900,
                            color: COLORS.white,
                            boxShadow: `0 0 ${minDim * 0.04}px ${COLORS.primary}66`
                          },
                          children: "K"
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        "span",
                        {
                          style: {
                            fontSize: height * 0.025,
                            color: COLORS.primary,
                            fontWeight: 700
                          },
                          children: "Apache Kafka"
                        }
                      )
                    ]
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                  "div",
                  {
                    style: {
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: minDim * 0.02,
                      transform: `translateY(${nettyY}px)`,
                      opacity: nettyProgress
                    },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        "div",
                        {
                          style: {
                            width: minDim * 0.2,
                            height: minDim * 0.2,
                            background: `linear-gradient(135deg, ${COLORS.blue} 0%, ${COLORS.cyan} 100%)`,
                            borderRadius: minDim * 0.03,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: height * 0.04,
                            fontWeight: 900,
                            color: COLORS.white,
                            boxShadow: `0 0 ${minDim * 0.04}px ${COLORS.blue}66`
                          },
                          children: "N"
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        "span",
                        {
                          style: {
                            fontSize: height * 0.025,
                            color: COLORS.blue,
                            fontWeight: 700
                          },
                          children: "Netty"
                        }
                      )
                    ]
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.025,
                color: COLORS.success,
                textAlign: "center",
                fontWeight: 600,
                opacity: messageOpacity,
                transform: `translateY(${messageY}px)`
              },
              children: "Massive throughput without lag!"
            }
          )
        ]
      }
    )
  ] });
};
var OutroScene = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const minDim = Math.min(width, height);
  const nameProgress = (0, import_remotion.spring)({
    frame,
    fps,
    config: SPRING_CONFIGS.settled
  });
  const nameY = (0, import_remotion.interpolate)(nameProgress, [0, 1], [40, 0]);
  const roleDelay = 30;
  const roleProgress = (0, import_remotion.spring)({
    frame: Math.max(0, frame - roleDelay),
    fps,
    config: SPRING_CONFIGS.settled
  });
  const roleOpacity = (0, import_remotion.interpolate)(roleProgress, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const roleY = (0, import_remotion.interpolate)(roleProgress, [0, 1], [30, 0]);
  const ctaDelay = 60;
  const ctaProgress = (0, import_remotion.spring)({
    frame: Math.max(0, frame - ctaDelay),
    fps,
    config: SPRING_CONFIGS.settled
  });
  const ctaOpacity = (0, import_remotion.interpolate)(ctaProgress, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const thanksDelay = 120;
  const thanksProgress = (0, import_remotion.spring)({
    frame: Math.max(0, frame - thanksDelay),
    fps,
    config: SPRING_CONFIGS.settled
  });
  const thanksOpacity = (0, import_remotion.interpolate)(thanksProgress, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const thanksY = (0, import_remotion.interpolate)(thanksProgress, [0, 1], [20, 0]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AnimatedBackground, { baseHue: 270, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FloatingParticles, { count: 25, color: COLORS.accent, baseOpacity: 0.25 }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: minDim * 0.05
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.05,
                fontWeight: 800,
                color: COLORS.accent,
                textAlign: "center",
                transform: `translateY(${nameY}px)`,
                opacity: nameProgress,
                textShadow: `0 0 ${minDim * 0.03}px ${COLORS.accent}66`
              },
              children: "Prasanna"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.025,
                color: COLORS.muted,
                textAlign: "center",
                opacity: roleOpacity,
                transform: `translateY(${roleY}px)`
              },
              children: "Technical Architect @ Zoho"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "div",
            {
              style: {
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: minDim * 0.02,
                marginTop: minDim * 0.04,
                opacity: ctaOpacity
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "div",
                  {
                    style: {
                      fontSize: height * 0.028,
                      color: COLORS.primary,
                      fontWeight: 700
                    },
                    children: "Follow for Real Engineering"
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "div",
                  {
                    style: {
                      fontSize: height * 0.022,
                      color: COLORS.muted
                    },
                    children: "Check pinned comment for full breakdown"
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.06,
                fontWeight: 900,
                color: COLORS.secondary,
                marginTop: minDim * 0.06,
                opacity: thanksOpacity,
                transform: `translateY(${thanksY}px)`,
                textShadow: `0 0 ${minDim * 0.03}px ${COLORS.secondary}66`
              },
              children: "Thank You!"
            }
          )
        ]
      }
    )
  ] });
};
var ProjC8fa689fB2c345ffB309F6c1f87ada7d = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: { background: COLORS.bg }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 0, durationInFrames: 60, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IntroScene, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 60, durationInFrames: 210, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProblemScene, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 270, durationInFrames: 120, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PriorityQueueScene, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 390, durationInFrames: 300, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogarithmicTrapScene, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 690, durationInFrames: 360, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BottleneckScene, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 1050, durationInFrames: 180, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TransitionScene, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 1230, durationInFrames: 210, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimingWheelIntroScene, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 1440, durationInFrames: 150, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropToSlotScene, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 1590, durationInFrames: 300, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HierarchyScene, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 1890, durationInFrames: 330, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CascadeScene, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 2220, durationInFrames: 180, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MechanismScene, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 2400, durationInFrames: 240, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RealWorldScene, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 2640, durationInFrames: 327, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OutroScene, {}) })
  ] });
};
