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

// src/proj_956b6123_5a01_40bc_a3ee_4648502af85d/index.tsx
var index_exports = {};
__export(index_exports, {
  CheckIcon: () => CheckIcon,
  DocumentIcon: () => DocumentIcon,
  RemotionRoot: () => RemotionRoot,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_remotion = require("remotion");

// src/proj_956b6123_5a01_40bc_a3ee_4648502af85d/constants.ts
var COLORS = {
  primary: "#f8f9fa",
  // Off-white background
  secondary: "#212529",
  // Charcoal text
  accent: "#007bff",
  // Digital blue
  supporting: "#6c757d",
  // Subtle gray
  warning: "#dc3545",
  // Warning red
  success: "#28a745"
  // Success green
};
var SPRING_CONFIG = { damping: 22, stiffness: 90, mass: 0.9 };
var TIMING = {
  fps: 30,
  totalFrames: 2208,
  // Scene boundaries
  scene1: { start: 0, end: 168 },
  // Hook Question
  scene2: { start: 168, end: 268 },
  // Skills Introduction
  scene3: { start: 268, end: 445 },
  // Two Parts Structure
  scene4: { start: 445, end: 763 },
  // Lazy Loading Insight
  scene5: { start: 763, end: 1028 },
  // MCP Server Introduction
  scene6: { start: 1028, end: 1373 },
  // Everything Upfront Problem
  scene7: { start: 1373, end: 1919 },
  // Capability Comparison
  scene8: { start: 1919, end: 2208 },
  // Summary & CTA
  // Key sync frames (when word is spoken)
  keySyncs: {
    difference: 14,
    // Scene 1
    folder: 150,
    // Scene 2
    parts: 254,
    // Scene 3
    only: 664,
    // Scene 4
    server: 845,
    // Scene 5
    everything: 1056,
    // Scene 6
    capabilities: 1353,
    // Scene 7
    behavior: 2011
    // Scene 8
  }
};
var RESPONSIVE = {
  safeMargin: 0.1,
  // 10%
  titleSize: 0.06,
  // 6% of height
  headerSize: 0.04,
  // 4% of height
  bodySize: 0.03,
  // 3% of height
  labelSize: 0.025,
  // 2.5% of height
  maxContentWidth: 0.8
  // 80%
};

// src/proj_956b6123_5a01_40bc_a3ee_4648502af85d/index.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var AnimatedBackground = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height } = (0, import_remotion.useVideoConfig)();
  const particles = Array.from({ length: 12 }).map((_, i) => {
    const baseX = i % 4 * (width / 3) + width * 0.1;
    const baseY = Math.floor(i / 4) * (height / 2) + height * 0.2;
    const offsetX = Math.sin((frame + i * 30) * 8e-3) * 30;
    const offsetY = Math.cos((frame + i * 40) * 6e-3) * 20;
    const opacity = 0.03 + Math.sin((frame + i * 50) * 0.01) * 0.02;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: baseX + offsetX,
          top: baseY + offsetY,
          width: 80 + i % 3 * 40,
          height: 80 + i % 3 * 40,
          borderRadius: "50%",
          background: COLORS.accent,
          opacity,
          filter: "blur(40px)"
        }
      },
      i
    );
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.AbsoluteFill, { style: { backgroundColor: COLORS.primary }, children: particles });
};
var Scene1HookQuestion = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const textOpacity = (0, import_remotion.interpolate)(
    frame,
    [0, 20],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  const textScale = (0, import_remotion.spring)({
    frame,
    fps,
    config: SPRING_CONFIG
  });
  const underlineProgress = (0, import_remotion.interpolate)(
    frame,
    [TIMING.keySyncs.difference, TIMING.keySyncs.difference + 30],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const fadeOut = (0, import_remotion.interpolate)(
    frame,
    [140, 165],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const fontSize = height * RESPONSIVE.titleSize;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_remotion.AbsoluteFill,
    {
      style: {
        justifyContent: "flex-start",
        alignItems: "center",
        paddingTop: height * 0.2,
        opacity: fadeOut
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "div",
        {
          style: {
            opacity: textOpacity,
            transform: `scale(${textScale})`,
            textAlign: "center",
            width: width * 0.8
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "div",
              {
                style: {
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize,
                  fontWeight: 700,
                  color: COLORS.secondary,
                  lineHeight: 1.2
                },
                children: [
                  "What's the",
                  " ",
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { position: "relative", display: "inline-block" }, children: [
                    "difference",
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "svg",
                      {
                        style: {
                          position: "absolute",
                          bottom: -8,
                          left: 0,
                          width: "100%",
                          height: 12,
                          overflow: "visible"
                        },
                        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                          "line",
                          {
                            x1: "0",
                            y1: "6",
                            x2: `${underlineProgress * 100}%`,
                            y2: "6",
                            stroke: COLORS.accent,
                            strokeWidth: "4",
                            strokeLinecap: "round"
                          }
                        )
                      }
                    )
                  ] })
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "div",
              {
                style: {
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize,
                  fontWeight: 700,
                  color: COLORS.secondary,
                  lineHeight: 1.2,
                  marginTop: 8
                },
                children: [
                  "between",
                  " ",
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.accent }, children: "Skills" }, "k1"),
                  " ",
                  "and",
                  " ",
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.accent }, children: "MCP" }, "k2"),
                  "?"
                ]
              }
            )
          ]
        }
      )
    }
  );
};
var FolderIcon = ({ size, color = COLORS.accent }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "path",
    {
      d: "M3 6C3 4.89543 3.89543 4 5 4H9.58579C9.851 4 10.1054 4.10536 10.2929 4.29289L12 6H19C20.1046 6 21 6.89543 21 8V18C21 19.1046 20.1046 20 19 20H5C3.89543 20 3 19.1046 3 18V6Z",
      fill: color,
      opacity: 0.2
    }
  ),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "path",
    {
      d: "M3 6C3 4.89543 3.89543 4 5 4H9.58579C9.851 4 10.1054 4.10536 10.2929 4.29289L12 6H19C20.1046 6 21 6.89543 21 8V18C21 19.1046 20.1046 20 19 20H5C3.89543 20 3 19.1046 3 18V6Z",
      stroke: color,
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }
  )
] });
var ServerIcon = ({ size, color = COLORS.accent }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "3", y: "4", width: "18", height: "6", rx: "2", fill: color, opacity: 0.2, stroke: color, strokeWidth: "2" }, "k3"),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "3", y: "14", width: "18", height: "6", rx: "2", fill: color, opacity: 0.2, stroke: color, strokeWidth: "2" }, "k4"),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "7", cy: "7", r: "1", fill: color }, "k5"),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "7", cy: "17", r: "1", fill: color }, "k6"),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", { x1: "11", y1: "7", x2: "17", y2: "7", stroke: color, strokeWidth: "2", strokeLinecap: "round" }, "k7"),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", { x1: "11", y1: "17", x2: "17", y2: "17", stroke: color, strokeWidth: "2", strokeLinecap: "round" }, "k8")
] });
var ToolIcon = ({ size, color = COLORS.accent }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
  "path",
  {
    d: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
    fill: color,
    opacity: 0.2,
    stroke: color,
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }
) });
var FileIcon = ({ size, color = COLORS.accent }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "path",
    {
      d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
      fill: color,
      opacity: 0.2
    }
  ),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("polyline", { points: "14,2 14,8 20,8", stroke: color, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, "k9"),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", stroke: color, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, "k10")
] });
var DatabaseIcon = ({ size, color = COLORS.accent }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ellipse", { cx: "12", cy: "5", rx: "9", ry: "3", fill: color, opacity: 0.2, stroke: color, strokeWidth: "2" }, "k11"),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M21 12c0 1.66-4 3-9 3s-9-1.34-9-3", stroke: color, strokeWidth: "2" }, "k12"),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5", stroke: color, strokeWidth: "2" }, "k13")
] });
var ApiIcon = ({ size, color = COLORS.accent }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2", fill: color, opacity: 0.2, stroke: color, strokeWidth: "2" }, "k14"),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 12h.01M12 12h.01M16 12h.01", stroke: color, strokeWidth: "3", strokeLinecap: "round" }, "k15")
] });
var WarningIcon = ({ size, color = COLORS.warning }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "path",
    {
      d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z",
      fill: color,
      opacity: 0.2,
      stroke: color,
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }
  ),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", { x1: "12", y1: "9", x2: "12", y2: "13", stroke: color, strokeWidth: "2", strokeLinecap: "round" }, "k16"),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", { x1: "12", y1: "17", x2: "12.01", y2: "17", stroke: color, strokeWidth: "2", strokeLinecap: "round" }, "k17")
] });
var _CheckIcon = ({ size, color = COLORS.success }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12", cy: "12", r: "10", fill: color, opacity: 0.2, stroke: color, strokeWidth: "2" }, "k18"),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M9 12l2 2 4-4", stroke: color, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, "k19")
] });
var CheckIcon = _CheckIcon;
var _DocumentIcon = ({ size, color = COLORS.accent }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "path",
    {
      d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
      fill: color,
      opacity: 0.2,
      stroke: color,
      strokeWidth: "2"
    }
  ),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", { x1: "16", y1: "13", x2: "8", y2: "13", stroke: color, strokeWidth: "2", strokeLinecap: "round" }, "k20"),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", { x1: "16", y1: "17", x2: "8", y2: "17", stroke: color, strokeWidth: "2", strokeLinecap: "round" }, "k21"),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("polyline", { points: "10,9 9,9 8,9", stroke: color, strokeWidth: "2", strokeLinecap: "round" }, "k22")
] });
var DocumentIcon = _DocumentIcon;
var Scene2SkillsIntro = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const folderScale = (0, import_remotion.spring)({
    frame,
    fps,
    config: SPRING_CONFIG
  });
  const folderOpacity = (0, import_remotion.interpolate)(
    frame,
    [0, 15],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  const subtitleOpacity = (0, import_remotion.interpolate)(
    frame,
    [20, 35],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  const subtitleY = (0, import_remotion.interpolate)(
    frame,
    [20, 35],
    [20, 0],
    { extrapolateRight: "clamp" }
  );
  const fadeOut = (0, import_remotion.interpolate)(
    frame,
    [85, 100],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const iconSize = height * 0.25;
  const subtitleSize = height * RESPONSIVE.bodySize;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    import_remotion.AbsoluteFill,
    {
      style: {
        justifyContent: "center",
        alignItems: "center",
        opacity: fadeOut
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              opacity: folderOpacity,
              transform: `scale(${folderScale})`,
              marginTop: -height * 0.1
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderIcon, { size: iconSize }, "k23")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: height * 0.65,
              width: width * 0.7,
              textAlign: "center",
              opacity: subtitleOpacity,
              transform: `translateY(${subtitleY}px)`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "p",
              {
                style: {
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: subtitleSize,
                  fontWeight: 500,
                  color: COLORS.supporting,
                  margin: 0,
                  lineHeight: 1.4
                },
                children: [
                  "A skill is just a",
                  " ",
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.accent, fontWeight: 600 }, children: "folder of instructions" }, "k24")
                ]
              }
            )
          }
        )
      ]
    }
  );
};
var GlassCard = ({ children, style }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
  "div",
  {
    style: {
      background: "rgba(255, 255, 255, 0.8)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      border: `2px solid ${COLORS.accent}20`,
      borderRadius: 24,
      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08)",
      padding: 32,
      ...style
    },
    children
  }
);
var Scene3TwoPartsStructure = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const titleOpacity = (0, import_remotion.interpolate)(
    frame,
    [0, 15],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  const titleScale = (0, import_remotion.spring)({
    frame,
    fps,
    config: SPRING_CONFIG
  });
  const leftScale = (0, import_remotion.spring)({
    frame: frame - 20,
    fps,
    config: SPRING_CONFIG
  });
  const leftOpacity = (0, import_remotion.interpolate)(
    frame,
    [20, 35],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  const rightScale = (0, import_remotion.spring)({
    frame: frame - 28,
    fps,
    config: SPRING_CONFIG
  });
  const rightOpacity = (0, import_remotion.interpolate)(
    frame,
    [28, 43],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  const dividerHeight = (0, import_remotion.interpolate)(
    frame,
    [35, 55],
    [0, 100],
    { extrapolateRight: "clamp" }
  );
  const fadeOut = (0, import_remotion.interpolate)(
    frame,
    [160, 177],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const headerSize = height * RESPONSIVE.headerSize;
  const labelSize = height * RESPONSIVE.labelSize;
  const bodyTextSize = height * 0.022;
  const cardWidth = width * 0.38;
  const cardHeight = height * 0.35;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    import_remotion.AbsoluteFill,
    {
      style: {
        justifyContent: "flex-start",
        alignItems: "center",
        paddingTop: height * 0.12,
        opacity: fadeOut
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              opacity: titleOpacity,
              transform: `scale(${titleScale})`,
              textAlign: "center",
              marginBottom: height * 0.05
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "h2",
              {
                style: {
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: headerSize,
                  fontWeight: 700,
                  color: COLORS.secondary,
                  margin: 0
                },
                children: [
                  "Skills have",
                  " ",
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.accent }, children: "two main parts" }, "k25")
                ]
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "div",
          {
            style: {
              display: "flex",
              gap: 40,
              alignItems: "stretch",
              justifyContent: "center",
              width: width * 0.9,
              position: "relative"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "div",
                {
                  style: {
                    opacity: leftOpacity,
                    transform: `scale(${Math.max(0, leftScale)})`
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassCard, { style: { width: cardWidth, height: cardHeight }, children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "div",
                      {
                        style: {
                          fontFamily: "Inter, system-ui, sans-serif",
                          fontSize: labelSize,
                          fontWeight: 700,
                          color: COLORS.accent,
                          marginBottom: 20,
                          textTransform: "uppercase",
                          letterSpacing: 2
                        },
                        children: "Front Matter"
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                      "div",
                      {
                        style: {
                          fontFamily: "Inter, system-ui, sans-serif",
                          fontSize: bodyTextSize,
                          color: COLORS.supporting,
                          lineHeight: 1.6
                        },
                        children: [
                          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { style: { margin: "12px 0" }, children: [
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.secondary, fontWeight: 600 }, children: "name:" }, "k26"),
                            " Skill identifier"
                          ] }),
                          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { style: { margin: "12px 0" }, children: [
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.secondary, fontWeight: 600 }, children: "description:" }, "k27"),
                            " What it does"
                          ] }),
                          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { margin: "12px 0", fontStyle: "italic", color: COLORS.accent }, children: "Loaded immediately" }, "k28")
                        ]
                      }
                    )
                  ] })
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "div",
                {
                  style: {
                    position: "absolute",
                    left: "50%",
                    top: "15%",
                    transform: "translateX(-50%)",
                    width: 3,
                    height: `${dividerHeight}%`,
                    background: `linear-gradient(180deg, ${COLORS.accent}00, ${COLORS.accent}, ${COLORS.accent}00)`,
                    borderRadius: 2
                  }
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "div",
                {
                  style: {
                    opacity: rightOpacity,
                    transform: `scale(${Math.max(0, rightScale)})`
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassCard, { style: { width: cardWidth, height: cardHeight }, children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "div",
                      {
                        style: {
                          fontFamily: "Inter, system-ui, sans-serif",
                          fontSize: labelSize,
                          fontWeight: 700,
                          color: COLORS.supporting,
                          marginBottom: 20,
                          textTransform: "uppercase",
                          letterSpacing: 2
                        },
                        children: "Body"
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                      "div",
                      {
                        style: {
                          fontFamily: "Inter, system-ui, sans-serif",
                          fontSize: bodyTextSize,
                          color: COLORS.supporting,
                          lineHeight: 1.6
                        },
                        children: [
                          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { style: { margin: "12px 0" }, children: [
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.secondary, fontWeight: 600 }, children: "instructions:" }, "k29"),
                            " Detailed guidance"
                          ] }),
                          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { style: { margin: "12px 0" }, children: [
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.secondary, fontWeight: 600 }, children: "examples:" }, "k30"),
                            " Usage patterns"
                          ] }),
                          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { margin: "12px 0", fontStyle: "italic", opacity: 0.6 }, children: "Loaded on demand" }, "k31")
                        ]
                      }
                    )
                  ] })
                }
              )
            ]
          }
        )
      ]
    }
  );
};
var Scene4LazyLoading = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const syncFrame = TIMING.keySyncs.only - TIMING.scene4.start;
  const fadeIn = (0, import_remotion.interpolate)(
    frame,
    [0, 20],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  const frontMatterEmphasis = (0, import_remotion.interpolate)(
    frame,
    [60, syncFrame, syncFrame + 30],
    [0, 1, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const bodyDim = (0, import_remotion.interpolate)(
    frame,
    [60, syncFrame],
    [1, 0.3],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const textOpacity = (0, import_remotion.interpolate)(
    frame,
    [syncFrame, syncFrame + 20],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const textScale = (0, import_remotion.spring)({
    frame: frame - syncFrame,
    fps,
    config: SPRING_CONFIG
  });
  const loadingPulse = (0, import_remotion.interpolate)(
    frame,
    [syncFrame, syncFrame + 15, syncFrame + 30, syncFrame + 45],
    [0, 1, 0.6, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const fadeOut = (0, import_remotion.interpolate)(
    frame,
    [290, 318],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const headerSize = height * RESPONSIVE.headerSize;
  const labelSize = height * RESPONSIVE.labelSize;
  const bodyTextSize = height * 0.022;
  const cardWidth = width * 0.38;
  const cardHeight = height * 0.32;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    import_remotion.AbsoluteFill,
    {
      style: {
        justifyContent: "flex-start",
        alignItems: "center",
        paddingTop: height * 0.1,
        opacity: fadeIn * fadeOut
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              textAlign: "center",
              marginBottom: height * 0.04
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "h2",
              {
                style: {
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: headerSize,
                  fontWeight: 700,
                  color: COLORS.secondary,
                  margin: 0
                },
                children: [
                  "The ",
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.accent }, children: "lazy loading" }, "k32"),
                  " advantage"
                ]
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "div",
          {
            style: {
              display: "flex",
              gap: 40,
              alignItems: "flex-start",
              justifyContent: "center",
              width: width * 0.9
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "div",
                {
                  style: {
                    transform: `scale(${1 + frontMatterEmphasis * 0.05}) translateY(${-frontMatterEmphasis * 10}px)`,
                    zIndex: 10
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                    GlassCard,
                    {
                      style: {
                        width: cardWidth,
                        height: cardHeight,
                        boxShadow: `0 8px 32px rgba(0, 0, 0, 0.08), 0 0 ${40 * frontMatterEmphasis}px ${COLORS.accent}40`,
                        border: `2px solid ${COLORS.accent}`
                      },
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                          "div",
                          {
                            style: {
                              fontFamily: "Inter, system-ui, sans-serif",
                              fontSize: labelSize,
                              fontWeight: 700,
                              color: COLORS.accent,
                              marginBottom: 16,
                              textTransform: "uppercase",
                              letterSpacing: 2,
                              display: "flex",
                              alignItems: "center",
                              gap: 12
                            },
                            children: [
                              "Front Matter",
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                "div",
                                {
                                  style: {
                                    width: 12,
                                    height: 12,
                                    borderRadius: "50%",
                                    background: COLORS.accent,
                                    opacity: loadingPulse,
                                    boxShadow: `0 0 10px ${COLORS.accent}`
                                  }
                                }
                              )
                            ]
                          }
                        ),
                        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                          "div",
                          {
                            style: {
                              fontFamily: "Inter, system-ui, sans-serif",
                              fontSize: bodyTextSize,
                              color: COLORS.secondary,
                              lineHeight: 1.6
                            },
                            children: [
                              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { style: { margin: "10px 0" }, children: [
                                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "name:" }, "k33"),
                                " Skill identifier"
                              ] }),
                              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { style: { margin: "10px 0" }, children: [
                                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "description:" }, "k34"),
                                " What it does"
                              ] }),
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                "p",
                                {
                                  style: {
                                    margin: "16px 0 0",
                                    color: COLORS.accent,
                                    fontWeight: 600,
                                    fontSize: bodyTextSize * 1.1
                                  },
                                  children: "Always loaded"
                                }
                              )
                            ]
                          }
                        )
                      ]
                    }
                  )
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "div",
                {
                  style: {
                    opacity: bodyDim,
                    transform: `scale(${1 - (1 - bodyDim) * 0.1}) translateY(${(1 - bodyDim) * 20}px)`
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassCard, { style: { width: cardWidth, height: cardHeight }, children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "div",
                      {
                        style: {
                          fontFamily: "Inter, system-ui, sans-serif",
                          fontSize: labelSize,
                          fontWeight: 700,
                          color: COLORS.supporting,
                          marginBottom: 16,
                          textTransform: "uppercase",
                          letterSpacing: 2
                        },
                        children: "Body"
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                      "div",
                      {
                        style: {
                          fontFamily: "Inter, system-ui, sans-serif",
                          fontSize: bodyTextSize,
                          color: COLORS.supporting,
                          lineHeight: 1.6
                        },
                        children: [
                          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { margin: "10px 0" }, children: "instructions: Detailed guidance" }, "k35"),
                          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { margin: "10px 0" }, children: "examples: Usage patterns" }, "k36"),
                          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { margin: "16px 0 0", fontStyle: "italic", opacity: 0.6 }, children: "Loaded on demand" }, "k37")
                        ]
                      }
                    )
                  ] })
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
              bottom: height * 0.22,
              width: width * 0.8,
              textAlign: "center",
              opacity: textOpacity,
              transform: `scale(${Math.max(0, textScale)})`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "div",
              {
                style: {
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: height * 0.045,
                  fontWeight: 700,
                  color: COLORS.secondary,
                  background: `linear-gradient(135deg, ${COLORS.accent}15, ${COLORS.accent}05)`,
                  padding: "24px 40px",
                  borderRadius: 20,
                  border: `2px solid ${COLORS.accent}30`
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.accent }, children: "Only" }, "k38"),
                  " loads when needed"
                ]
              }
            )
          }
        )
      ]
    }
  );
};
var Scene5MCPIntro = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const syncFrame = TIMING.keySyncs.server - TIMING.scene5.start;
  const slideIn = (0, import_remotion.spring)({
    frame,
    fps,
    config: { damping: 25, stiffness: 80, mass: 1 }
  });
  const slideX = (0, import_remotion.interpolate)(slideIn, [0, 1], [width, 0], { extrapolateRight: "clamp" });
  const fadeIn = (0, import_remotion.interpolate)(
    frame,
    [0, 20],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  const titleScale = (0, import_remotion.spring)({
    frame: frame - 30,
    fps,
    config: SPRING_CONFIG
  });
  const titleOpacity = (0, import_remotion.interpolate)(
    frame,
    [30, 50],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  const serverGlow = (0, import_remotion.interpolate)(
    frame,
    [syncFrame - 10, syncFrame, syncFrame + 30],
    [0, 1, 0.6],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const subtitleOpacity = (0, import_remotion.interpolate)(
    frame,
    [syncFrame + 20, syncFrame + 40],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const fadeOut = (0, import_remotion.interpolate)(
    frame,
    [240, 265],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const titleSize = height * RESPONSIVE.titleSize;
  const subtitleSize = height * RESPONSIVE.bodySize;
  const iconSize = height * 0.18;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    import_remotion.AbsoluteFill,
    {
      style: {
        opacity: fadeIn * fadeOut,
        overflow: "hidden"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: slideX,
              top: height * 0.55,
              width,
              height: height * 0.25,
              background: `linear-gradient(180deg, ${COLORS.accent}10 0%, ${COLORS.accent}05 100%)`,
              borderTop: `2px solid ${COLORS.accent}30`,
              boxShadow: `0 -10px 40px ${COLORS.accent}10`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "div",
              {
                style: {
                  position: "absolute",
                  inset: 0,
                  backgroundImage: `
              linear-gradient(${COLORS.accent}08 1px, transparent 1px),
              linear-gradient(90deg, ${COLORS.accent}08 1px, transparent 1px)
            `,
                  backgroundSize: "40px 40px"
                }
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: height * 0.15,
              width,
              textAlign: "center",
              opacity: titleOpacity,
              transform: `scale(${Math.max(0, titleScale)})`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "h1",
              {
                style: {
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: titleSize,
                  fontWeight: 700,
                  color: COLORS.secondary,
                  margin: 0
                },
                children: [
                  "Now let's talk about",
                  " ",
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.accent }, children: "MCP" }, "k39")
                ]
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: height * 0.32,
              left: "50%",
              transform: `translateX(-50%) scale(${1 + serverGlow * 0.1})`,
              filter: `drop-shadow(0 0 ${20 * serverGlow}px ${COLORS.accent})`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ServerIcon, { size: iconSize }, "k40")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: height * 0.48,
              width,
              textAlign: "center",
              opacity: subtitleOpacity
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "p",
              {
                style: {
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: subtitleSize,
                  fontWeight: 500,
                  color: COLORS.supporting,
                  margin: 0
                },
                children: [
                  "MCP is an ",
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.accent, fontWeight: 600 }, children: "actual server" }, "k41")
                ]
              }
            )
          }
        )
      ]
    }
  );
};
var TOOL_ICONS = [
  { Icon: ToolIcon, label: "create" },
  { Icon: FileIcon, label: "read" },
  { Icon: DatabaseIcon, label: "update" },
  { Icon: ApiIcon, label: "delete" },
  { Icon: ToolIcon, label: "list" },
  { Icon: FileIcon, label: "search" },
  { Icon: DatabaseIcon, label: "query" },
  { Icon: ApiIcon, label: "connect" },
  { Icon: ToolIcon, label: "execute" },
  { Icon: FileIcon, label: "upload" },
  { Icon: DatabaseIcon, label: "sync" },
  { Icon: ApiIcon, label: "fetch" }
];
var Scene6EverythingUpfront = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const syncFrame = TIMING.keySyncs.everything - TIMING.scene6.start;
  const fadeIn = (0, import_remotion.interpolate)(
    frame,
    [0, 15],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  const titleOpacity = (0, import_remotion.interpolate)(
    frame,
    [0, 20],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  const titleScale = (0, import_remotion.spring)({
    frame,
    fps,
    config: SPRING_CONFIG
  });
  const warningPulse = (0, import_remotion.interpolate)(
    frame,
    [syncFrame + 80, syncFrame + 95, syncFrame + 110, syncFrame + 125],
    [0, 1, 0.7, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const warningTextOpacity = (0, import_remotion.interpolate)(
    frame,
    [syncFrame + 100, syncFrame + 120],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const fadeOut = (0, import_remotion.interpolate)(
    frame,
    [320, 345],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const titleSize = height * RESPONSIVE.headerSize;
  const iconSize = height * 0.06;
  const workspaceTop = height * 0.45;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    import_remotion.AbsoluteFill,
    {
      style: {
        opacity: fadeIn * fadeOut
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: height * 0.1,
              width,
              textAlign: "center",
              opacity: titleOpacity,
              transform: `scale(${titleScale})`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "h2",
              {
                style: {
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: titleSize,
                  fontWeight: 700,
                  color: COLORS.secondary,
                  margin: 0
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.accent }, children: "Everything" }, "k42"),
                  " gets loaded upfront"
                ]
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: 0,
              top: workspaceTop,
              width,
              height: height * 0.35,
              background: `linear-gradient(180deg, ${COLORS.accent}08 0%, ${COLORS.accent}03 100%)`,
              borderTop: `2px solid ${COLORS.accent}20`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "div",
              {
                style: {
                  position: "absolute",
                  inset: 0,
                  backgroundImage: `
              linear-gradient(${COLORS.accent}05 1px, transparent 1px),
              linear-gradient(90deg, ${COLORS.accent}05 1px, transparent 1px)
            `,
                  backgroundSize: "30px 30px"
                }
              }
            )
          }
        ),
        TOOL_ICONS.map((tool, i) => {
          const delay = syncFrame + i * 6;
          const dropProgress = (0, import_remotion.spring)({
            frame: frame - delay,
            fps,
            config: { damping: 18, stiffness: 120, mass: 0.8 }
          });
          const col = i % 4;
          const row = Math.floor(i / 4);
          const targetX = width * 0.15 + col * (width * 0.22) + row % 2 * (width * 0.08);
          const targetY = workspaceTop + 40 + row * (height * 0.1);
          const startY = -100;
          const currentY = (0, import_remotion.interpolate)(
            dropProgress,
            [0, 1],
            [startY, targetY],
            { extrapolateRight: "clamp" }
          );
          const opacity = (0, import_remotion.interpolate)(
            dropProgress,
            [0, 0.3, 1],
            [0, 1, 1],
            { extrapolateRight: "clamp" }
          );
          const rotation = (0, import_remotion.interpolate)(
            dropProgress,
            [0, 1],
            [Math.random() * 30 - 15, 0],
            { extrapolateRight: "clamp" }
          );
          return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: targetX,
                top: currentY,
                opacity,
                transform: `rotate(${rotation}deg)`
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "div",
                {
                  style: {
                    background: "rgba(255, 255, 255, 0.9)",
                    padding: 12,
                    borderRadius: 12,
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                    border: `1px solid ${COLORS.accent}20`,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(tool.Icon, { size: iconSize }, "k43"),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "span",
                      {
                        style: {
                          fontFamily: "Inter, system-ui, sans-serif",
                          fontSize: height * 0.015,
                          color: COLORS.supporting,
                          fontWeight: 500
                        },
                        children: tool.label
                      }
                    )
                  ]
                }
              )
            },
            i
          );
        }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: height * 0.42,
              left: width * 0.05,
              opacity: warningPulse
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WarningIcon, { size: height * 0.04 }, "k44")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: height * 0.42,
              right: width * 0.05,
              opacity: warningPulse
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WarningIcon, { size: height * 0.04 }, "k45")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              bottom: height * 0.12,
              width,
              textAlign: "center",
              opacity: warningTextOpacity
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "div",
              {
                style: {
                  display: "inline-block",
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: height * 0.035,
                  fontWeight: 600,
                  color: COLORS.warning,
                  background: `${COLORS.warning}10`,
                  padding: "16px 32px",
                  borderRadius: 12,
                  border: `2px solid ${COLORS.warning}30`
                },
                children: "Takes up a lot of context"
              }
            )
          }
        )
      ]
    }
  );
};
var Scene7CapabilityComparison = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const fadeIn = (0, import_remotion.interpolate)(
    frame,
    [0, 20],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  const leftSlide = (0, import_remotion.spring)({
    frame,
    fps,
    config: { damping: 25, stiffness: 80, mass: 1 }
  });
  const leftX = (0, import_remotion.interpolate)(leftSlide, [0, 1], [-width * 0.5, 0], { extrapolateRight: "clamp" });
  const rightSlide = (0, import_remotion.spring)({
    frame: frame - 10,
    fps,
    config: { damping: 25, stiffness: 80, mass: 1 }
  });
  const rightX = (0, import_remotion.interpolate)(rightSlide, [0, 1], [width * 0.5, 0], { extrapolateRight: "clamp" });
  const dividerOpacity = (0, import_remotion.interpolate)(
    frame,
    [25, 45],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  const dividerHeight = (0, import_remotion.interpolate)(
    frame,
    [25, 55],
    [0, 100],
    { extrapolateRight: "clamp" }
  );
  const contentOpacity = (delay) => (0, import_remotion.interpolate)(
    frame,
    [40 + delay, 55 + delay],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const fadeOut = (0, import_remotion.interpolate)(
    frame,
    [520, 546],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const titleSize = height * RESPONSIVE.headerSize;
  const labelSize = height * RESPONSIVE.labelSize;
  const bodySize = height * 0.022;
  const panelWidth = width * 0.44;
  const mcpTools = [
    { name: "create_file", desc: "Create new files" },
    { name: "delete_file", desc: "Delete files" },
    { name: "update_file", desc: "Update content" },
    { name: "list_files", desc: "List all files" }
  ];
  const skillsFeatures = [
    { name: "Context", desc: "Understand when to use" },
    { name: "Best Practices", desc: "Follow conventions" },
    { name: "Error Handling", desc: "Graceful failures" },
    { name: "User Intent", desc: "Match expectations" }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    import_remotion.AbsoluteFill,
    {
      style: {
        opacity: fadeIn * fadeOut
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: height * 0.08,
              width,
              textAlign: "center"
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "h2",
              {
                style: {
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: titleSize,
                  fontWeight: 700,
                  color: COLORS.secondary,
                  margin: 0
                },
                children: [
                  "Different ",
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.accent }, children: "capabilities" }, "k46")
                ]
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: width * 0.03 + leftX,
              top: height * 0.2,
              width: panelWidth,
              height: height * 0.65
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassCard, { style: { height: "100%", padding: 28 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "div",
                {
                  style: {
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontSize: labelSize,
                    fontWeight: 700,
                    color: COLORS.accent,
                    marginBottom: 24,
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    opacity: contentOpacity(0)
                  },
                  children: "MCP: Raw Tools"
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "div",
                {
                  style: {
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontSize: bodySize,
                    color: COLORS.supporting,
                    marginBottom: 24,
                    opacity: contentOpacity(6)
                  },
                  children: "Google Drive API"
                }
              ),
              mcpTools.map((tool, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    marginBottom: 20,
                    opacity: contentOpacity(12 + i * 8)
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToolIcon, { size: height * 0.035 }, "k47"),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                        "div",
                        {
                          style: {
                            fontFamily: "monospace",
                            fontSize: bodySize,
                            color: COLORS.secondary,
                            fontWeight: 600
                          },
                          children: [
                            tool.name,
                            "()"
                          ]
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        "div",
                        {
                          style: {
                            fontFamily: "Inter, system-ui, sans-serif",
                            fontSize: bodySize * 0.85,
                            color: COLORS.supporting
                          },
                          children: tool.desc
                        }
                      )
                    ] })
                  ]
                },
                tool.name
              ))
            ] })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: "50%",
              top: height * 0.22,
              transform: "translateX(-50%)",
              width: 3,
              height: `${dividerHeight * 0.6}%`,
              background: `linear-gradient(180deg, ${COLORS.accent}00, ${COLORS.accent}, ${COLORS.accent}00)`,
              borderRadius: 2,
              opacity: dividerOpacity
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              right: width * 0.03 + -rightX,
              top: height * 0.2,
              width: panelWidth,
              height: height * 0.65
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassCard, { style: { height: "100%", padding: 28 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "div",
                {
                  style: {
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontSize: labelSize,
                    fontWeight: 700,
                    color: COLORS.accent,
                    marginBottom: 24,
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    opacity: contentOpacity(5)
                  },
                  children: "Skills: Behavior"
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "div",
                {
                  style: {
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontSize: bodySize,
                    color: COLORS.supporting,
                    marginBottom: 24,
                    opacity: contentOpacity(11)
                  },
                  children: "Structured Guidance"
                }
              ),
              skillsFeatures.map((feature, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    marginBottom: 20,
                    opacity: contentOpacity(17 + i * 8)
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckIcon, { size: height * 0.035 }, "k48"),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        "div",
                        {
                          style: {
                            fontFamily: "Inter, system-ui, sans-serif",
                            fontSize: bodySize,
                            color: COLORS.secondary,
                            fontWeight: 600
                          },
                          children: feature.name
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        "div",
                        {
                          style: {
                            fontFamily: "Inter, system-ui, sans-serif",
                            fontSize: bodySize * 0.85,
                            color: COLORS.supporting
                          },
                          children: feature.desc
                        }
                      )
                    ] })
                  ]
                },
                feature.name
              ))
            ] })
          }
        )
      ]
    }
  );
};
var Scene8Summary = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const syncFrame = TIMING.keySyncs.behavior - TIMING.scene8.start;
  const fadeIn = (0, import_remotion.interpolate)(
    frame,
    [0, 20],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  const summaryScale = (0, import_remotion.spring)({
    frame,
    fps,
    config: SPRING_CONFIG
  });
  const summaryOpacity = (0, import_remotion.interpolate)(
    frame,
    [0, 25],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  const behaviorGlow = (0, import_remotion.interpolate)(
    frame,
    [syncFrame - 5, syncFrame, syncFrame + 20, syncFrame + 60],
    [0, 1, 0.8, 0.6],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const behaviorScale = (0, import_remotion.interpolate)(
    frame,
    [syncFrame - 5, syncFrame, syncFrame + 15],
    [1, 1.1, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const ctaOpacity = (0, import_remotion.interpolate)(
    frame,
    [syncFrame + 40, syncFrame + 60],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const ctaScale = (0, import_remotion.spring)({
    frame: frame - syncFrame - 40,
    fps,
    config: SPRING_CONFIG
  });
  const titleSize = height * RESPONSIVE.titleSize * 0.85;
  const ctaSize = height * RESPONSIVE.bodySize * 1.1;
  const particles = Array.from({ length: 8 }).map((_, i) => {
    const angle = i / 8 * Math.PI * 2;
    const radius = 80 + Math.sin((frame + i * 30) * 0.03) * 20;
    const x = Math.cos(angle + frame * 5e-3) * radius;
    const y = Math.sin(angle + frame * 5e-3) * radius;
    const size = 6 + Math.sin((frame + i * 50) * 0.05) * 2;
    const opacity = 0.3 + Math.sin((frame + i * 40) * 0.04) * 0.2;
    return { x, y, size, opacity };
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    import_remotion.AbsoluteFill,
    {
      style: {
        opacity: fadeIn,
        justifyContent: "center",
        alignItems: "center"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "div",
          {
            style: {
              opacity: summaryOpacity,
              transform: `scale(${summaryScale})`,
              textAlign: "center",
              width: width * 0.85,
              marginTop: -height * 0.1
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "p",
                {
                  style: {
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontSize: titleSize,
                    fontWeight: 700,
                    color: COLORS.secondary,
                    lineHeight: 1.4,
                    margin: 0
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.accent }, children: "MCP" }, "k49"),
                    " gives raw tools",
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}, "k50"),
                    "and capabilities"
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "p",
                {
                  style: {
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontSize: titleSize,
                    fontWeight: 700,
                    color: COLORS.secondary,
                    lineHeight: 1.4,
                    margin: "20px 0 0"
                  },
                  children: [
                    "while ",
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.accent }, children: "Skills" }, "k51"),
                    " give",
                    " ",
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "span",
                      {
                        style: {
                          color: COLORS.accent,
                          textShadow: `0 0 ${20 * behaviorGlow}px ${COLORS.accent}`,
                          transform: `scale(${behaviorScale})`,
                          display: "inline-block"
                        },
                        children: "behavior"
                      }
                    )
                  ]
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "div",
          {
            style: {
              position: "absolute",
              bottom: height * 0.2,
              width,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              opacity: ctaOpacity,
              transform: `scale(${Math.max(0, ctaScale)})`
            },
            children: [
              particles.map((p, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "div",
                {
                  style: {
                    position: "absolute",
                    left: `calc(50% + ${p.x}px)`,
                    top: `calc(50% + ${p.y}px)`,
                    width: p.size,
                    height: p.size,
                    borderRadius: "50%",
                    background: COLORS.accent,
                    opacity: p.opacity * ctaOpacity
                  }
                },
                i
              )),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "div",
                {
                  style: {
                    background: `linear-gradient(135deg, ${COLORS.accent}20, ${COLORS.accent}10)`,
                    padding: "24px 48px",
                    borderRadius: 20,
                    border: `2px solid ${COLORS.accent}40`,
                    boxShadow: `0 0 40px ${COLORS.accent}20`,
                    display: "flex",
                    alignItems: "center",
                    gap: 16
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckIcon, { size: height * 0.04, color: COLORS.accent }, "k52"),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "span",
                      {
                        style: {
                          fontFamily: "Inter, system-ui, sans-serif",
                          fontSize: ctaSize,
                          fontWeight: 600,
                          color: COLORS.secondary
                        },
                        children: 'Comment "skills" for the link'
                      }
                    )
                  ]
                }
              )
            ]
          }
        )
      ]
    }
  );
};
var MainComposition = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: { backgroundColor: COLORS.primary }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AnimatedBackground, {}, "bg"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene1.start, durationInFrames: TIMING.scene1.end - TIMING.scene1.start, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene1HookQuestion, {}) }, "scene1"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene2.start, durationInFrames: TIMING.scene2.end - TIMING.scene2.start, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene2SkillsIntro, {}) }, "scene2"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene3.start, durationInFrames: TIMING.scene3.end - TIMING.scene3.start, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene3TwoPartsStructure, {}) }, "scene3"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene4.start, durationInFrames: TIMING.scene4.end - TIMING.scene4.start, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene4LazyLoading, {}) }, "scene4"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene5.start, durationInFrames: TIMING.scene5.end - TIMING.scene5.start, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene5MCPIntro, {}) }, "scene5"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene6.start, durationInFrames: TIMING.scene6.end - TIMING.scene6.start, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene6EverythingUpfront, {}) }, "scene6"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene7.start, durationInFrames: TIMING.scene7.end - TIMING.scene7.start, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene7CapabilityComparison, {}) }, "scene7"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene8.start, durationInFrames: TIMING.scene8.end - TIMING.scene8.start, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene8Summary, {}) }, "scene8")
  ] });
};
var RemotionRoot = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_remotion.Composition,
    {
      id: "proj_956b6123_5a01_40bc_a3ee_4648502af85d",
      component: MainComposition,
      durationInFrames: TIMING.totalFrames,
      fps: TIMING.fps,
      width: 1080,
      height: 1920
    }
  );
};
var index_default = MainComposition;
(0, import_remotion.registerRoot)(RemotionRoot);
