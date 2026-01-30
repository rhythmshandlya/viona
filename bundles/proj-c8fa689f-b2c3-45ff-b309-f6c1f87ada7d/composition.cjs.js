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
  bg: "#000000",
  white: "#FFFFFF",
  accent: "#EF4444",
  // Red
  muted: "#444444",
  glow: "rgba(239, 68, 68, 0.4)"
};
var TIMING = {
  intro: { start: 0, end: 60 },
  useCases: { start: 60, end: 270 },
  priorityQueue: { start: 270, end: 600 },
  complexityTrap: { start: 600, end: 1140 },
  timingWheelIntro: { start: 1140, end: 1530 },
  timingWheelDetail: { start: 1530, end: 1830 },
  hierarchicalIntro: { start: 1830, end: 2100 },
  hierarchicalMechanism: { start: 2100, end: 2460 },
  summary: { start: 2460, end: 2700 },
  outro: { start: 2700, end: 2967 }
};

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/components/useResponsive.ts
var import_remotion = require("remotion");
var useResponsive = () => {
  const { width, height } = (0, import_remotion.useVideoConfig)();
  const minDim = Math.min(width, height);
  return {
    width,
    height,
    minDim,
    padding: minDim * 0.08,
    gap: {
      xs: minDim * 0.01,
      sm: minDim * 0.02,
      md: minDim * 0.04,
      lg: minDim * 0.06,
      xl: minDim * 0.1
    },
    radius: {
      sm: minDim * 0.01,
      md: minDim * 0.02,
      lg: minDim * 0.04,
      full: minDim * 0.5
    },
    fontSize: {
      xs: height * 0.018,
      sm: height * 0.025,
      md: height * 0.035,
      lg: height * 0.05,
      xl: height * 0.07,
      xxl: height * 0.1
    },
    borderWidth: Math.max(3, minDim * 8e-3),
    glow: minDim * 0.03
  };
};

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/components/Node.tsx
var import_remotion2 = require("remotion");
var import_jsx_runtime = require("react/jsx-runtime");
var Node = ({ label, index, active }) => {
  const frame = (0, import_remotion2.useCurrentFrame)();
  const { fps } = (0, import_remotion2.useVideoConfig)();
  const r = useResponsive();
  const delay = index * 10;
  const show = (0, import_remotion2.spring)({
    frame: frame - delay,
    fps,
    config: { damping: 12, stiffness: 120 }
  });
  const borderColor = active ? COLORS.accent : COLORS.white;
  const shadowColor = active ? COLORS.accent : COLORS.white;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        width: "100%",
        padding: `${r.gap.md}px ${r.gap.lg}px`,
        border: `${r.borderWidth}px solid ${borderColor}`,
        borderRadius: r.radius.md,
        backgroundColor: active ? COLORS.accent : "transparent",
        opacity: show,
        transform: `scale(${show})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: active ? `0 0 ${r.glow}px ${shadowColor}` : "none"
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "span",
        {
          style: {
            fontFamily: "Impact, sans-serif",
            fontSize: r.fontSize.md,
            color: active ? COLORS.bg : COLORS.white,
            textTransform: "uppercase",
            textAlign: "center",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          },
          children: label
        }
      )
    }
  );
};

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/components/ClockFace.tsx
var import_remotion3 = require("remotion");
var import_jsx_runtime2 = require("react/jsx-runtime");
var ClockFace = ({ size, highlightIndex }) => {
  const frame = (0, import_remotion3.useCurrentFrame)();
  const { fps } = (0, import_remotion3.useVideoConfig)();
  const r = useResponsive();
  const slots = Array.from({ length: 12 });
  const radius = size / 2 - r.gap.md;
  const fadeIn = (0, import_remotion3.spring)({
    frame,
    fps,
    config: { damping: 15, stiffness: 100 }
  });
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "div",
    {
      style: {
        width: size,
        height: size,
        borderRadius: "50%",
        border: `${r.borderWidth}px solid ${COLORS.white}`,
        position: "relative",
        opacity: fadeIn,
        transform: `scale(${fadeIn})`
      },
      children: [
        slots.map((_, i) => {
          const angle = i * 360 / slots.length;
          const isActive = highlightIndex === i;
          const x = size / 2 + radius * Math.sin(angle * Math.PI / 180);
          const y = size / 2 - radius * Math.cos(angle * Math.PI / 180);
          return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: x,
                top: y,
                width: r.gap.md,
                height: r.gap.md,
                backgroundColor: isActive ? COLORS.accent : COLORS.white,
                borderRadius: "50%",
                transform: "translate(-50%, -50%)",
                boxShadow: isActive ? `0 0 ${r.glow}px ${COLORS.accent}` : "none",
                border: isActive ? `2px solid ${COLORS.white}` : "none"
              }
            },
            i
          );
        }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: "50%",
              top: "50%",
              width: r.gap.sm,
              height: r.gap.sm,
              backgroundColor: COLORS.white,
              borderRadius: "50%",
              transform: "translate(-50%, -50%)"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: "50%",
              top: "50%",
              width: r.borderWidth,
              height: radius * 0.8,
              backgroundColor: COLORS.accent,
              transformOrigin: "top center",
              transform: `translate(-50%, 0) rotate(${180 + (highlightIndex || 0) * (360 / slots.length)}deg)`,
              boxShadow: `0 0 ${r.glow}px ${COLORS.accent}`
            }
          }
        )
      ]
    }
  );
};

// src/proj_c8fa689f_b2c3_45ff_b309_f6c1f87ada7d/index.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var BigTitle = ({ text }) => {
  const frame = (0, import_remotion4.useCurrentFrame)();
  const { fps } = (0, import_remotion4.useVideoConfig)();
  const r = useResponsive();
  const scale = (0, import_remotion4.spring)({
    frame,
    fps,
    config: { damping: 12, stiffness: 150 }
  });
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "h1",
    {
      style: {
        fontFamily: "Impact, sans-serif",
        fontSize: r.fontSize.xl,
        color: COLORS.white,
        textTransform: "uppercase",
        textAlign: "center",
        margin: 0,
        transform: `scale(${scale})`,
        lineHeight: 1,
        maxWidth: "90%"
      },
      children: text
    }
  );
};
var AccentBox = ({ text, subtext }) => {
  const frame = (0, import_remotion4.useCurrentFrame)();
  const { fps } = (0, import_remotion4.useVideoConfig)();
  const r = useResponsive();
  const widthScale = (0, import_remotion4.spring)({
    frame,
    fps,
    config: { damping: 15, stiffness: 100 }
  });
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    "div",
    {
      style: {
        backgroundColor: COLORS.accent,
        padding: r.gap.md,
        width: `${90 * widthScale}%`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 0 ${r.glow}px ${COLORS.accent}`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "span",
          {
            style: {
              fontFamily: "Impact, sans-serif",
              fontSize: r.fontSize.lg,
              color: COLORS.bg,
              textTransform: "uppercase"
            },
            children: text
          }
        ),
        subtext && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "span",
          {
            style: {
              fontFamily: "system-ui, sans-serif",
              fontSize: r.fontSize.sm,
              color: COLORS.bg,
              fontWeight: 700
            },
            children: subtext
          }
        )
      ]
    }
  );
};
var ProjC8fa689fB2c345ffB309F6c1f87ada7d = () => {
  const frame = (0, import_remotion4.useCurrentFrame)();
  (0, import_remotion4.useVideoConfig)();
  const r = useResponsive();
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_remotion4.AbsoluteFill, { style: { backgroundColor: COLORS.bg, color: COLORS.white }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_remotion4.Sequence, { from: TIMING.intro.start, durationInFrames: TIMING.intro.end - TIMING.intro.start, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: r.gap.xl
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(BigTitle, { text: "SYSTEM DESIGN" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(AccentBox, { text: "CHALLENGE" })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_remotion4.Sequence, { from: TIMING.useCases.start, durationInFrames: TIMING.useCases.end - TIMING.useCases.start, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: r.gap.lg,
      padding: r.padding
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(BigTitle, { text: "THE SCHEDULER" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { width: "100%", display: "flex", flexDirection: "column", gap: r.gap.md }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Node, { label: "MILLIONS OF TASKS", index: 0 }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Node, { label: "DELAYED EXECUTION", index: 1 }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Node, { label: "RETRY LOGIC", index: 2 })
      ] })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_remotion4.Sequence, { from: TIMING.priorityQueue.start, durationInFrames: TIMING.priorityQueue.end - TIMING.priorityQueue.start, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: r.gap.lg,
      padding: r.padding
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(BigTitle, { text: "PRIORITY QUEUE" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { border: `${r.borderWidth}px solid ${COLORS.white}`, padding: r.gap.md, position: "relative" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Node, { label: "BINARY HEAP", index: 0, active: true }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { textAlign: "center", marginTop: r.gap.sm, fontFamily: "monospace", fontSize: r.fontSize.sm }, children: "O(log N)" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { style: { fontFamily: "Impact, sans-serif", fontSize: r.fontSize.md, color: COLORS.accent, textAlign: "center" }, children: "AUTO-SORTING TRAP" })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_remotion4.Sequence, { from: TIMING.complexityTrap.start, durationInFrames: TIMING.complexityTrap.end - TIMING.complexityTrap.start, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: r.gap.lg,
      padding: r.padding
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(BigTitle, { text: "THE OVERHEAD" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { position: "relative", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { fontSize: r.fontSize.xl, fontWeight: "bold", color: COLORS.accent }, children: "10,000,000" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { fontSize: r.fontSize.md }, children: "CONNECTIONS" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(AccentBox, { text: "BOTTLENECK", subtext: "Rebalancing the tree too much" })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_remotion4.Sequence, { from: TIMING.timingWheelIntro.start, durationInFrames: TIMING.timingWheelIntro.end - TIMING.timingWheelIntro.start, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: r.gap.lg
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { transform: "rotate(-5deg)" }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(BigTitle, { text: "CONSTANT TIME" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { transform: "rotate(5deg)" }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(AccentBox, { text: "TIMING WHEEL", subtext: "O(1) Scheduling" }) })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_remotion4.Sequence, { from: TIMING.timingWheelDetail.start, durationInFrames: TIMING.timingWheelDetail.end - TIMING.timingWheelDetail.start, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: r.gap.lg
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ClockFace, { size: r.minDim * 0.6, highlightIndex: Math.floor(frame / 2) % 12 }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", gap: r.gap.sm }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { border: `${r.borderWidth}px solid ${COLORS.accent}`, padding: r.gap.sm, fontFamily: "Impact" }, children: "5S BUCKET" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { border: `${r.borderWidth}px solid ${COLORS.white}`, padding: r.gap.sm, fontFamily: "Impact" }, children: "NO SORTING" })
      ] })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_remotion4.Sequence, { from: TIMING.hierarchicalIntro.start, durationInFrames: TIMING.hierarchicalIntro.end - TIMING.hierarchicalIntro.start, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: r.gap.xl
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(BigTitle, { text: "THE GENIUS" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(AccentBox, { text: "HIERARCHY", subtext: "Multiple Wheels" })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_remotion4.Sequence, { from: TIMING.hierarchicalMechanism.start, durationInFrames: TIMING.hierarchicalMechanism.end - TIMING.hierarchicalMechanism.start, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: r.gap.lg
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: r.gap.md }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ClockFace, { size: r.minDim * 0.4, highlightIndex: Math.floor(frame / 10) % 12 }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { fontSize: r.fontSize.lg }, children: "\u2192" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ClockFace, { size: r.minDim * 0.3, highlightIndex: Math.floor(frame / 2) % 12 })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { textAlign: "center" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { fontFamily: "Impact", fontSize: r.fontSize.md }, children: "CASCADE DOWN" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { color: COLORS.accent, fontSize: r.fontSize.sm }, children: "MINUTE \u2192 SECOND" })
      ] })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_remotion4.Sequence, { from: TIMING.summary.start, durationInFrames: TIMING.summary.end - TIMING.summary.start, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: r.gap.lg,
      padding: r.padding
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(BigTitle, { text: "USED BY GIANTS" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: r.gap.sm, width: "100%" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Node, { label: "APACHE KAFKA", index: 0, active: true }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Node, { label: "NETTY", index: 1, active: true })
      ] })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_remotion4.Sequence, { from: TIMING.outro.start, durationInFrames: TIMING.outro.end - TIMING.outro.start, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: r.gap.xl
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(AccentBox, { text: "FOLLOW", subtext: "FOR REAL ENGINEERING" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { textAlign: "center" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { fontSize: r.fontSize.md, fontFamily: "Impact" }, children: "PRASANNA" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { fontSize: r.fontSize.sm }, children: "ZOHO ENGINEER" })
      ] })
    ] }) })
  ] });
};
