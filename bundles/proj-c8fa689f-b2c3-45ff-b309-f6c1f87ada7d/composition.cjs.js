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
var import_remotion10 = require("remotion");

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/constants.ts
var import_remotion = require("remotion");
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
  danger: "#ef4444",
  // Red
  warning: "#f97316",
  // Orange
  white: "#ffffff",
  text: "#ffffff",
  glass: "rgba(255, 255, 255, 0.1)",
  glassBorder: "rgba(255, 255, 255, 0.2)",
  muted: "#888888"
};
var SPRING_CONFIG = {
  soft: { damping: 20, stiffness: 60 },
  bouncy: { damping: 12, stiffness: 80 },
  stiff: { damping: 15, stiffness: 150 }
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
    padding: minDim * 0.05,
    gap: minDim * 0.03,
    borderRadius: minDim * 0.02,
    borderWidth: Math.max(2, minDim * 3e-3),
    iconSize: minDim * 0.08,
    nodeSize: minDim * 0.12
  };
};

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/components/SceneIntro.tsx
var import_react = require("react");
var import_remotion2 = require("remotion");
var import_jsx_runtime = require("react/jsx-runtime");
var SceneIntro = () => {
  const frame = (0, import_remotion2.useCurrentFrame)();
  const { width, height, fps } = (0, import_remotion2.useVideoConfig)();
  const { iconSize, fontSize } = getResponsiveSizes(width, height);
  const tasks = (0, import_react.useMemo)(() => {
    return Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      x: (0, import_remotion2.interpolate)(Math.random(), [0, 1], [-width * 0.4, width * 0.4]),
      // Relative to center
      delay: Math.random() * 60,
      color: Math.random() > 0.5 ? COLORS.secondary : COLORS.accent
    }));
  }, [width]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center"
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      marginTop: 100,
      width: iconSize * 3,
      height: iconSize * 3,
      borderRadius: "50%",
      backgroundColor: COLORS.primary,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: `0 0 40px ${COLORS.primary}66`,
      zIndex: 10,
      transform: `scale(${(0, import_remotion2.spring)({ frame: frame - 10, fps, config: SPRING_CONFIG.bouncy })})`,
      opacity: (0, import_remotion2.interpolate)(frame, [10, 20], [0, 1])
    }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: fontSize.lg }, children: "\u2699\uFE0F" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }, children: tasks.map((task) => {
      const dropFrame = frame - task.delay;
      if (dropFrame < 0) return null;
      const progress = (0, import_remotion2.interpolate)(dropFrame, [0, 60], [0, 1]);
      const y = (0, import_remotion2.interpolate)(progress, [0, 1], [-100, height / 2 - 100]);
      const opacity = (0, import_remotion2.interpolate)(progress, [0.8, 1], [1, 0]);
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: width / 2 + task.x,
            top: y,
            width: iconSize * 0.6,
            height: iconSize * 0.6,
            backgroundColor: task.color,
            borderRadius: 8,
            opacity,
            transform: `rotate(${progress * 360}deg)`
          }
        },
        task.id
      );
    }) })
  ] });
};

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/components/SceneHeap.tsx
var import_remotion5 = require("remotion");

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/components/BinaryHeap.tsx
var import_remotion3 = require("remotion");
var import_jsx_runtime2 = require("react/jsx-runtime");
var BinaryHeap = ({ nodes, highlightPath = [], scale = 1 }) => {
  const { width, height, fps } = (0, import_remotion3.useVideoConfig)();
  const frame = (0, import_remotion3.useCurrentFrame)();
  const { nodeSize, fontSize } = getResponsiveSizes(width, height);
  const startY = height * 0.15;
  const levelHeight = height * 0.12;
  const getPosition = (index) => {
    const level = Math.floor(Math.log2(index + 1));
    const levelStartIndex = Math.pow(2, level) - 1;
    const positionInLevel = index - levelStartIndex;
    const nodesInLevel = Math.pow(2, level);
    const maxSpread = width * 0.8;
    const spread = maxSpread / (nodesInLevel + 1);
    const x = (width - maxSpread) / 2 + spread * (positionInLevel + 1);
    const y = startY + level * levelHeight;
    return { x, y };
  };
  const renderLines = () => {
    return nodes.map((node, i) => {
      if (i === 0) return null;
      const parentIndex = Math.floor((i - 1) / 2);
      const parent = nodes[parentIndex];
      if (!parent && parentIndex >= nodes.length) return null;
      const pos = getPosition(i);
      const parentPos = getPosition(parentIndex);
      const isPathHighlighed = highlightPath.includes(i) && highlightPath.includes(parentIndex);
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "svg",
        {
          style: {
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 0
          },
          children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "line",
            {
              x1: parentPos.x,
              y1: parentPos.y + nodeSize / 2,
              x2: pos.x,
              y2: pos.y - nodeSize / 2,
              stroke: isPathHighlighed ? COLORS.danger : COLORS.secondary,
              strokeWidth: isPathHighlighed ? 4 : 2,
              strokeOpacity: 0.6
            }
          )
        },
        `line-${i}`
      );
    });
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { position: "relative", width: "100%", height: "100%", transform: `scale(${scale})` }, children: [
    renderLines(),
    nodes.map((node, i) => {
      const { x, y } = getPosition(i);
      const spr = (0, import_remotion3.spring)({
        frame: frame - i * 3,
        // Stagger
        fps,
        config: SPRING_CONFIG.bouncy
      });
      const isHighlighted = highlightPath.includes(i) || node.highlight;
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: x - nodeSize / 2,
            top: y - nodeSize / 2,
            width: nodeSize,
            height: nodeSize,
            borderRadius: "50%",
            backgroundColor: isHighlighted ? COLORS.danger : node.color || COLORS.primary,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            color: COLORS.white,
            fontWeight: "bold",
            fontSize: fontSize.md,
            boxShadow: `0 4px 10px ${isHighlighted ? COLORS.danger : COLORS.primary}66`,
            transform: `scale(${spr})`,
            zIndex: 1,
            border: `2px solid ${COLORS.glassBorder}`
          },
          children: node.value
        },
        node.id
      );
    })
  ] });
};

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/components/ComplexityVisual.tsx
var import_remotion4 = require("remotion");
var import_jsx_runtime3 = require("react/jsx-runtime");
var OLogNVisual = () => {
  const frame = (0, import_remotion4.useCurrentFrame)();
  const { width, height } = (0, import_remotion4.useVideoConfig)();
  const { fontSize } = getResponsiveSizes(width, height);
  const scale = (0, import_remotion4.interpolate)(frame % 60, [0, 30, 60], [1, 1.05, 1]);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center"
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h1", { style: {
      fontSize: fontSize.xxl,
      color: COLORS.danger,
      transform: `scale(${scale})`,
      margin: 0
    }, children: "O(log n)" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { style: {
      color: COLORS.text,
      fontSize: fontSize.md,
      opacity: 0.8,
      marginTop: 10
    }, children: "Logarithmic (Slower)" })
  ] });
};

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/components/SceneHeap.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
var SceneHeap = () => {
  const frame = (0, import_remotion5.useCurrentFrame)();
  const initialNodes = [
    { id: 0, value: 2 },
    { id: 1, value: 5 },
    { id: 2, value: 12 },
    { id: 3, value: 7 },
    { id: 4, value: 6 },
    { id: 5, value: 20 },
    { id: 6, value: 15 }
  ];
  let currentNodes = [...initialNodes];
  let highlightPath = [];
  if (frame > 90) {
    currentNodes.push({ id: 7, value: 1, color: COLORS.accent, highlight: true });
  }
  if (frame > 120) {
    highlightPath = [3, 7];
    if (frame > 140) {
      currentNodes = [
        { id: 0, value: 2 },
        { id: 1, value: 5 },
        { id: 2, value: 12 },
        { id: 7, value: 1, color: COLORS.accent, highlight: true },
        // moved up
        { id: 4, value: 6 },
        { id: 5, value: 20 },
        { id: 6, value: 15 },
        { id: 3, value: 7 }
        // moved down
      ];
      highlightPath = [1, 3];
    }
  }
  if (frame > 140 && frame > 160) {
    currentNodes = [
      { id: 0, value: 2 },
      { id: 7, value: 1, color: COLORS.accent, highlight: true },
      // moved up
      { id: 2, value: 12 },
      { id: 1, value: 5 },
      // moved down
      { id: 4, value: 6 },
      { id: 5, value: 20 },
      { id: 6, value: 15 },
      { id: 3, value: 7 }
    ];
    highlightPath = [0, 1];
  }
  if (frame > 160 && frame > 180) {
    currentNodes = [
      { id: 7, value: 1, color: COLORS.accent, highlight: true },
      // ROOT
      { id: 0, value: 2 },
      // moved down
      { id: 2, value: 12 },
      { id: 1, value: 5 },
      { id: 4, value: 6 },
      { id: 5, value: 20 },
      { id: 6, value: 15 },
      { id: 3, value: 7 }
    ];
    highlightPath = [];
  }
  const scale = (0, import_remotion5.interpolate)(frame, [220, 260], [1, 0.8]);
  const opacity = (0, import_remotion5.interpolate)(frame, [260, 280], [1, 0]);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { width: "100%", height: "100%", opacity }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { width: "100%", height: "100%", transform: `scale(${scale})` }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      BinaryHeap,
      {
        nodes: currentNodes.map((n) => ({ ...n, highlight: n.id === 7 && frame > 90 })),
        highlightPath
      }
    ) }),
    frame > 180 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
      position: "absolute",
      top: "60%",
      left: 0,
      width: "100%",
      display: "flex",
      justifyContent: "center"
    }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(OLogNVisual, {}) })
  ] });
};

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/components/SceneWheel.tsx
var import_remotion7 = require("remotion");

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/components/TimingWheel.tsx
var import_react2 = __toESM(require("react"));
var import_remotion6 = require("remotion");
var import_jsx_runtime5 = require("react/jsx-runtime");
var TimingWheel = ({
  items,
  radius = 300,
  rotation = 0,
  activeSlot = -1,
  label = "Seconds",
  isOuter = false
}) => {
  const { width, height } = (0, import_remotion6.useVideoConfig)();
  const { fontSize } = getResponsiveSizes(width, height);
  const slots = 60;
  const renderSlots = () => {
    return Array.from({ length: slots }).map((_, i) => {
      const angle = i * 360 / slots - 90;
      const radians = angle * Math.PI / 180;
      const innerR = radius - (isOuter ? 20 : 10);
      const outerR = radius + (isOuter ? 20 : 10);
      const x1 = Math.cos(radians) * innerR;
      const y1 = Math.sin(radians) * innerR;
      const x2 = Math.cos(radians) * outerR;
      const y2 = Math.sin(radians) * outerR;
      const isActive = i === activeSlot;
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_react2.default.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "line",
          {
            x1,
            y1,
            x2,
            y2,
            stroke: isActive ? COLORS.accent : COLORS.glassBorder,
            strokeWidth: isActive ? 4 : 2
          }
        ),
        i % 5 === 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "text",
          {
            x: Math.cos(radians) * (outerR + 25),
            y: Math.sin(radians) * (outerR + 25),
            fill: isActive ? COLORS.accent : COLORS.muted,
            fontSize: fontSize.sm,
            textAnchor: "middle",
            alignmentBaseline: "middle",
            style: { opacity: 0.7 },
            children: i
          }
        )
      ] }, i);
    });
  };
  const renderItems = () => {
    return items.map((item) => {
      const angle = item.slot * 360 / slots - 90;
      const radians = angle * Math.PI / 180;
      const itemRadius = radius - 40;
      const x = Math.cos(radians) * itemRadius;
      const y = Math.sin(radians) * itemRadius;
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("g", { transform: `translate(${x}, ${y})`, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "circle",
        {
          r: 12,
          fill: item.color || COLORS.success,
          stroke: COLORS.white,
          strokeWidth: 2
        }
      ) }, item.id);
    });
  };
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    position: "absolute"
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "svg",
      {
        width: radius * 2.5,
        height: radius * 2.5,
        viewBox: `-${radius * 1.25} -${radius * 1.25} ${radius * 2.5} ${radius * 2.5}`,
        style: { transform: `rotate(${rotation}deg)` },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "circle",
            {
              r: radius,
              fill: "none",
              stroke: COLORS.secondary,
              strokeWidth: 4,
              opacity: 0.3
            }
          ),
          renderSlots(),
          renderItems(),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "line",
            {
              x1: 0,
              y1: 0,
              x2: 0,
              y2: -radius,
              stroke: COLORS.accent,
              strokeWidth: 3,
              strokeLinecap: "round"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("circle", { r: 8, fill: COLORS.accent })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: {
      position: "absolute",
      textAlign: "center",
      paddingTop: isOuter ? 0 : 40,
      pointerEvents: "none"
    }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h3", { style: { color: COLORS.text, fontSize: fontSize.md, margin: 0, textShadow: "0 2px 4px rgba(0,0,0,0.5)" }, children: label }) })
  ] });
};

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/components/SceneWheel.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
var SceneWheel = () => {
  const frame = (0, import_remotion7.useCurrentFrame)();
  const wheel1Scale = (0, import_remotion7.interpolate)(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  const zoomOut = (0, import_remotion7.interpolate)(frame, [120, 150], [1, 0.6], { extrapolateRight: "clamp" });
  const baseRotation = frame * 0.5;
  const rotation = (0, import_remotion7.interpolate)(frame, [60, 120], [0, 90]);
  const items = [];
  if (frame > 30) {
    items.push({ id: 1, slot: 5, value: 5, color: COLORS.accent });
  }
  const outerItems = [];
  if (frame > 150) {
    outerItems.push({ id: 2, slot: 10, value: 60, color: COLORS.warning });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: {
    width: "100%",
    height: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    transform: `scale(${wheel1Scale})`
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: {
      transform: `scale(${zoomOut})`,
      position: "relative",
      width: "100%",
      height: "100%",
      display: "flex",
      justifyContent: "center",
      alignItems: "center"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
        position: "absolute",
        opacity: (0, import_remotion7.interpolate)(frame, [120, 140], [0, 1])
      }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        TimingWheel,
        {
          radius: 550,
          items: outerItems,
          label: "Minutes",
          isOuter: true,
          activeSlot: Math.floor((frame - 200) / 10) % 60
        }
      ) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        TimingWheel,
        {
          radius: 300,
          rotation: baseRotation + rotation,
          items,
          label: "Seconds",
          activeSlot: Math.floor((baseRotation + rotation) / 6) % 60
        }
      )
    ] }),
    frame > 40 && frame < 100 && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: {
      position: "absolute",
      top: "20%",
      right: "10%"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h2", { style: { color: COLORS.success, fontSize: 60, margin: 0 }, children: "O(1)" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { style: { color: COLORS.text, fontSize: 30, margin: 0 }, children: "Direct Access" })
    ] })
  ] });
};

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/components/SceneArchitecture.tsx
var import_remotion8 = require("remotion");
var import_jsx_runtime7 = require("react/jsx-runtime");
var SceneArchitecture = () => {
  const frame = (0, import_remotion8.useCurrentFrame)();
  const { width, height, fps } = (0, import_remotion8.useVideoConfig)();
  const { fontSize } = getResponsiveSizes(width, height);
  const titleOpacity = (0, import_remotion8.interpolate)(frame, [0, 20], [0, 1]);
  const logos = [
    { name: "Apache Kafka", color: "#231F20", textColor: "#ffffff", delay: 20 },
    { name: "Netty", color: "#373737", textColor: "#ffffff", delay: 40 }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: 100
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("h1", { style: {
      color: COLORS.text,
      fontSize: fontSize.xl,
      opacity: titleOpacity
    }, children: "Proven Architecture" }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { display: "flex", gap: 60 }, children: logos.map((logo, i) => {
      const spr = (0, import_remotion8.spring)({
        frame: frame - logo.delay,
        fps,
        config: SPRING_CONFIG.bouncy
      });
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "div",
        {
          style: {
            width: 300,
            height: 300,
            borderRadius: 40,
            backgroundColor: logo.color,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            transform: `scale(${spr})`,
            boxShadow: `0 20px 50px ${logo.color}66`,
            border: `2px solid ${COLORS.glassBorder}`
          },
          children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { style: {
            color: logo.textColor,
            fontSize: fontSize.lg,
            fontWeight: "bold",
            textAlign: "center"
          }, children: logo.name })
        },
        i
      );
    }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { position: "absolute", bottom: 100 }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: {
      opacity: (0, import_remotion8.interpolate)(frame, [60, 80], [0, 1]),
      background: COLORS.glass,
      padding: "20px 40px",
      borderRadius: 100,
      border: `1px solid ${COLORS.glassBorder}`
    }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { style: { color: COLORS.secondary, fontSize: fontSize.md }, children: "Zero Lag Throughput" }) }) })
  ] });
};

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/components/SceneOutro.tsx
var import_remotion9 = require("remotion");
var import_jsx_runtime8 = require("react/jsx-runtime");
var SceneOutro = () => {
  const frame = (0, import_remotion9.useCurrentFrame)();
  const { width, height } = (0, import_remotion9.useVideoConfig)();
  const { fontSize } = getResponsiveSizes(width, height);
  const opacity = (0, import_remotion9.interpolate)(frame, [0, 20], [0, 1]);
  const scale = (0, import_remotion9.interpolate)(frame, [0, 30], [0.9, 1]);
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    opacity,
    transform: `scale(${scale})`
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: {
      width: 300,
      height: 300,
      borderRadius: "50%",
      background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`,
      marginBottom: 40
    } }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("h1", { style: { color: COLORS.text, fontSize: fontSize.xl, marginBottom: 20 }, children: "Prasanna" }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { style: { color: COLORS.accent, fontSize: fontSize.md }, children: "Zoho Technical Architect" }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: {
      marginTop: 60,
      padding: "20px 40px",
      background: COLORS.white,
      borderRadius: 100
    }, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { color: COLORS.bg, fontSize: fontSize.md, fontWeight: "bold" }, children: "Follow for more" }) })
  ] });
};

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/index.tsx
var import_jsx_runtime9 = require("react/jsx-runtime");
var ProjC8fa689fB2c345ffB309F6c1f87ada7d = () => {
  const { fps, height } = (0, import_remotion10.useVideoConfig)();
  const INTRO_DURATION = 7 * fps;
  const HEAP_DURATION = 28 * fps;
  const WHEEL_DURATION = 47 * fps;
  const ARCH_DURATION = 8 * fps;
  const minFont = height * 0.022;
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_remotion10.AbsoluteFill, { style: { backgroundColor: COLORS.bg }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_remotion10.Sequence, { from: 0, durationInFrames: INTRO_DURATION, children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(SceneIntro, {}),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: {
        position: "absolute",
        top: height * 0.08,
        width: "100%",
        textAlign: "center"
      }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("h1", { style: { color: COLORS.text, fontSize: height * 0.04, margin: 0 }, children: "System Design Challenge" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: {
        position: "absolute",
        bottom: height * 0.06,
        width: "100%",
        textAlign: "center"
      }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { style: { color: COLORS.text, fontSize: minFont }, children: "Task Scheduler" }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_remotion10.Sequence, { from: INTRO_DURATION, durationInFrames: HEAP_DURATION, children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(SceneHeap, {}),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: { position: "absolute", top: height * 0.08, width: "100%", textAlign: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("h1", { style: { color: COLORS.text, fontSize: height * 0.04, margin: 0 }, children: "Priority Queue (Binary Heap)" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: { position: "absolute", bottom: height * 0.06, width: "100%", textAlign: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { style: { color: COLORS.text, fontSize: minFont }, children: "O(log n) Insertion" }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_remotion10.Sequence, { from: INTRO_DURATION + HEAP_DURATION, durationInFrames: WHEEL_DURATION, children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(SceneWheel, {}),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: { position: "absolute", top: height * 0.08, width: "100%", textAlign: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("h1", { style: { color: COLORS.text, fontSize: height * 0.04, margin: 0 }, children: "Hierarchical Timing Wheel" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: { position: "absolute", bottom: height * 0.06, width: "100%", textAlign: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { style: { color: COLORS.text, fontSize: minFont }, children: "O(1) Constant Time" }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_remotion10.Sequence, { from: INTRO_DURATION + HEAP_DURATION + WHEEL_DURATION, durationInFrames: ARCH_DURATION, children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(SceneArchitecture, {}),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: { position: "absolute", top: height * 0.08, width: "100%", textAlign: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("h1", { style: { color: COLORS.text, fontSize: height * 0.04, margin: 0 }, children: "Real World Usage" }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_remotion10.Sequence, { from: INTRO_DURATION + HEAP_DURATION + WHEEL_DURATION + ARCH_DURATION, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(SceneOutro, {}) })
  ] });
};
