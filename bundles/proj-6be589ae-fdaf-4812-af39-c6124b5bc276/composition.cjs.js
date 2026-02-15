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

// src/proj_6be589ae_fdaf_4812_af39_c6124b5bc276/index.tsx
var index_exports = {};
__export(index_exports, {
  RemotionRoot: () => RemotionRoot,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_remotion10 = require("remotion");

// src/proj_6be589ae_fdaf_4812_af39_c6124b5bc276/constants.ts
var COLORS = {
  primary: "#2563EB",
  // Blue accent for highlighting key concepts
  secondary: "#64748B",
  // Slate gray for secondary elements
  accent: "#EF4444",
  // Red for MCP side and warnings
  background: "#FFFFFF",
  // Pure white background
  surface: "#F8FAFC",
  // Very light gray for surfaces
  text: "#1E293B",
  // Dark slate for text
  textMuted: "#94A3B8",
  // Muted text
  success: "#22C55E",
  // Green for positive indicators
  warning: "#F59E0B",
  // Amber for warnings
  skillsBlue: "#2563EB",
  // Skills side color
  mcpRed: "#DC2626"
  // MCP side color
};
var SPRING_CONFIG = { damping: 22, stiffness: 90, mass: 0.9 };
var TIMING = {
  // Video specs from scenes.json (MUST MATCH EXACTLY)
  totalFrames: 2208,
  fps: 30,
  width: 1080,
  height: 1920,
  // Scene timing from scenes.json.scenes[].frames
  scene1Start: 0,
  scene1End: 135,
  scene2Start: 135,
  scene2End: 610,
  scene3Start: 610,
  scene3End: 850,
  scene4Start: 850,
  scene4End: 1314,
  scene5Start: 1314,
  scene5End: 1587,
  scene6Start: 1587,
  scene6End: 1941,
  scene7Start: 1941,
  scene7End: 2161,
  scene8Start: 2161,
  scene8End: 2208
};

// src/proj_6be589ae_fdaf_4812_af39_c6124b5bc276/components/Background.tsx
var import_remotion = require("remotion");
var import_jsx_runtime = require("react/jsx-runtime");
var Background = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const gradientShift = (0, import_remotion.interpolate)(
    frame,
    [0, TIMING.totalFrames],
    [0, 20],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_remotion.AbsoluteFill,
    {
      style: {
        background: `linear-gradient(${180 + gradientShift}deg, ${COLORS.background} 0%, ${COLORS.surface} 100%)`
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            inset: 0,
            backgroundImage: `
            linear-gradient(${COLORS.textMuted}08 1px, transparent 1px),
            linear-gradient(90deg, ${COLORS.textMuted}08 1px, transparent 1px)
          `,
            backgroundSize: "40px 40px",
            opacity: 0.5
          }
        }
      )
    }
  );
};

// src/proj_6be589ae_fdaf_4812_af39_c6124b5bc276/scenes/Scene1.tsx
var import_remotion2 = require("remotion");
var import_jsx_runtime2 = require("react/jsx-runtime");
var Scene1 = ({ startFrame = 0 }) => {
  const frame = (0, import_remotion2.useCurrentFrame)();
  const { fps, height } = (0, import_remotion2.useVideoConfig)();
  const localFrame = frame - startFrame;
  const sceneDuration = TIMING.scene1End - TIMING.scene1Start;
  const skillsEntrance = (0, import_remotion2.spring)({
    frame: localFrame,
    fps,
    config: SPRING_CONFIG,
    durationInFrames: 30
  });
  const mcpEntrance = (0, import_remotion2.spring)({
    frame: localFrame - 8,
    // 8 frame stagger
    fps,
    config: SPRING_CONFIG,
    durationInFrames: 30
  });
  const vsEntrance = (0, import_remotion2.spring)({
    frame: localFrame - 16,
    fps,
    config: SPRING_CONFIG,
    durationInFrames: 30
  });
  const pulseProgress = (0, import_remotion2.interpolate)(
    localFrame % 30,
    [0, 15, 30],
    [1, 1.08, 1],
    { extrapolateRight: "clamp" }
  );
  const exitProgress = (0, import_remotion2.interpolate)(
    localFrame,
    [sceneDuration - 20, sceneDuration],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const exitScale = (0, import_remotion2.interpolate)(exitProgress, [0, 1], [1, 0.9], {
    extrapolateRight: "clamp"
  });
  const exitOpacity = (0, import_remotion2.interpolate)(exitProgress, [0, 1], [1, 0], {
    extrapolateRight: "clamp"
  });
  const titleSize = height * 0.05;
  const vsSize = height * 0.08;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    import_remotion2.AbsoluteFill,
    {
      style: {
        opacity: exitOpacity,
        transform: `scale(${exitScale})`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "50%",
              backgroundColor: COLORS.skillsBlue,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `translateY(${(0, import_remotion2.interpolate)(skillsEntrance, [0, 1], [-100, 0])}%)`,
              opacity: skillsEntrance
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "span",
              {
                style: {
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  fontSize: titleSize,
                  fontWeight: 800,
                  color: "#FFFFFF",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase"
                },
                children: "Skills"
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "50%",
              backgroundColor: COLORS.mcpRed,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `translateY(${(0, import_remotion2.interpolate)(mcpEntrance, [0, 1], [100, 0])}%)`,
              opacity: mcpEntrance
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "span",
              {
                style: {
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  fontSize: titleSize,
                  fontWeight: 800,
                  color: "#FFFFFF",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase"
                },
                children: "MCP"
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: `translate(-50%, -50%) scale(${vsEntrance * pulseProgress})`,
              width: vsSize * 2.5,
              height: vsSize * 2.5,
              borderRadius: "50%",
              backgroundColor: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.25)",
              opacity: vsEntrance
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "span",
              {
                style: {
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  fontSize: vsSize,
                  fontWeight: 900,
                  color: COLORS.text,
                  letterSpacing: "-0.02em"
                },
                children: "VS"
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              height: 4,
              backgroundColor: "#FFFFFF",
              transform: `translateY(-50%) scaleX(${vsEntrance})`,
              transformOrigin: "center",
              opacity: 0.8
            }
          }
        )
      ]
    }
  );
};

// src/proj_6be589ae_fdaf_4812_af39_c6124b5bc276/scenes/Scene2.tsx
var import_remotion3 = require("remotion");

// src/proj_6be589ae_fdaf_4812_af39_c6124b5bc276/components/Icons.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var BrainIcon = ({ size = 24, color = "currentColor", style }) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", style, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("g", { fill: "none", stroke: color, strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", children: [
  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M12 5c2.76 0 5 2.24 5 5v8M7 10c0-2.76 2.24-5 5-5" }),
  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M17 14.5c0 1.38-1.12 2.5-2.5 2.5S12 15.88 12 14.5s1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5Z" }),
  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M7 14.5c0 1.38 1.12 2.5 2.5 2.5S12 15.88 12 14.5s-1.12-2.5-2.5-2.5S7 13.12 7 14.5Z" }),
  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M12 5V3M8 8c-1.1 0-2 .9-2 2v1c0 .55-.45 1-1 1s-1-.45-1-1v-1c0-2.21 1.79-4 4-4" }),
  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M16 8c1.1 0 2 .9 2 2v1c0 .55.45 1 1 1s1-.45 1-1v-1c0-2.21-1.79-4-4-4" }),
  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M12 17v4" })
] }) });
var ServerIcon = ({ size = 24, color = "currentColor", style }) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", style, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("g", { fill: "none", stroke: color, strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", children: [
  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("rect", { width: "20", height: "8", x: "2", y: "2", rx: "2", ry: "2" }),
  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("rect", { width: "20", height: "8", x: "2", y: "14", rx: "2", ry: "2" }),
  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M6 6h.01M6 18h.01" })
] }) });
var FolderIcon = ({ size = 24, color = "currentColor", style }) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", style, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { fill: color, d: "M10 4H4c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8z" }) });
var FileDocumentIcon = ({ size = 24, color = "currentColor", style }) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", style, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { fill: color, d: "M13 9h5.5L13 3.5zM6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4c0-1.11.89-2 2-2m9 16v-2H6v2zm3-4v-2H6v2z" }) });
var WarningIcon = ({ size = 24, color = "currentColor", style }) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", style, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { fill: color, d: "M13 14h-2V9h2m0 9h-2v-2h2M1 21h22L12 2z" }) });
var ToolsIcon = ({ size = 24, color = "currentColor", style }) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", style, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { fill: color, d: "m21.71 20.29l-1.42 1.42a1 1 0 0 1-1.41 0L7 9.85A3.8 3.8 0 0 1 6 10a4 4 0 0 1-3.78-5.3l2.54 2.54l.53-.53l1.42-1.42l.53-.53L4.7 2.22A4 4 0 0 1 10 6a3.8 3.8 0 0 1-.15 1l11.86 11.88a1 1 0 0 1 0 1.41M2.29 18.88a1 1 0 0 0 0 1.41l1.42 1.42a1 1 0 0 0 1.41 0l5.47-5.46l-2.83-2.83M20 2l-4 2v2l-2.17 2.17l2 2L18 8h2l2-4Z" }) });
var CommentIcon = ({ size = 24, color = "currentColor", style }) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", style, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { fill: color, d: "M9 22a1 1 0 0 1-1-1v-3H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6.1l-3.7 3.71c-.2.19-.45.29-.7.29z" }) });
var ApiIcon = ({ size = 24, color = "currentColor", style }) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", style, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { fill: color, d: "M7 7H5a2 2 0 0 0-2 2v8h2v-4h2v4h2V9a2 2 0 0 0-2-2m0 4H5V9h2m7-2h-4v10h2v-4h2a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2m0 4h-2V9h2m6 0v6h1v2h-4v-2h1V9h-1V7h4v2Z" }) });
var DownloadIcon = ({ size = 24, color = "currentColor", style }) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", style, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("g", { fill: "none", stroke: color, strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", children: [
  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("polyline", { points: "7,10 12,15 17,10" }),
  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("line", { x1: "12", y1: "15", x2: "12", y2: "3" })
] }) });

// src/proj_6be589ae_fdaf_4812_af39_c6124b5bc276/scenes/Scene2.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
var Scene2 = ({ startFrame = 0 }) => {
  const frame = (0, import_remotion3.useCurrentFrame)();
  const { fps, height, width } = (0, import_remotion3.useVideoConfig)();
  const localFrame = frame - startFrame;
  const sceneDuration = TIMING.scene2End - TIMING.scene2Start;
  const brainEntrance = (0, import_remotion3.spring)({
    frame: localFrame,
    fps,
    config: SPRING_CONFIG,
    durationInFrames: 30
  });
  const cabinetEntrance = (0, import_remotion3.spring)({
    frame: localFrame - 10,
    fps,
    config: SPRING_CONFIG,
    durationInFrames: 40
  });
  const localKeySync = 215;
  const topDrawerOpen = (0, import_remotion3.spring)({
    frame: localFrame - localKeySync + 30,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 70 },
    durationInFrames: 40
  });
  const bottomDrawerOpen = (0, import_remotion3.spring)({
    frame: localFrame - localKeySync - 60,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 70 },
    durationInFrames: 40
  });
  const cardEntrance = (0, import_remotion3.spring)({
    frame: localFrame - localKeySync - 20,
    fps,
    config: SPRING_CONFIG,
    durationInFrames: 30
  });
  const exitProgress = (0, import_remotion3.interpolate)(
    localFrame,
    [sceneDuration - 25, sceneDuration],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const titleSize = height * 0.03;
  const bodySize = height * 0.025;
  const cabinetWidth = width * 0.5;
  const cabinetHeight = height * 0.4;
  const drawerHeight = cabinetHeight * 0.35;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    import_remotion3.AbsoluteFill,
    {
      style: {
        backgroundColor: COLORS.background,
        opacity: (0, import_remotion3.interpolate)(exitProgress, [0, 1], [1, 0], { extrapolateRight: "clamp" })
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
          "div",
          {
            style: {
              position: "absolute",
              top: height * 0.12,
              left: "50%",
              transform: `translateX(-50%) scale(${brainEntrance})`,
              opacity: brainEntrance,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BrainIcon, { size: height * 0.08, color: COLORS.skillsBlue }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                "span",
                {
                  style: {
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    fontSize: bodySize,
                    color: COLORS.textMuted,
                    fontWeight: 500
                  },
                  children: "AI Agent"
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
          "div",
          {
            style: {
              position: "absolute",
              top: height * 0.35,
              left: "50%",
              transform: `translateX(-50%) scale(${cabinetEntrance})`,
              opacity: cabinetEntrance,
              width: cabinetWidth,
              height: cabinetHeight,
              backgroundColor: COLORS.surface,
              borderRadius: 16,
              border: `3px solid ${COLORS.skillsBlue}`,
              overflow: "hidden",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                "div",
                {
                  style: {
                    position: "relative",
                    height: drawerHeight,
                    borderBottom: `2px solid ${COLORS.skillsBlue}20`,
                    transform: `translateX(${(0, import_remotion3.interpolate)(topDrawerOpen, [0, 1], [0, 30], { extrapolateRight: "clamp" })}px)`
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
                    "div",
                    {
                      style: {
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        padding: "0 24px",
                        backgroundColor: COLORS.skillsBlue + "15"
                      },
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(FolderIcon, { size: titleSize * 1.2, color: COLORS.skillsBlue }),
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                          "span",
                          {
                            style: {
                              marginLeft: 16,
                              fontFamily: "system-ui, -apple-system, sans-serif",
                              fontSize: titleSize,
                              fontWeight: 700,
                              color: COLORS.skillsBlue
                            },
                            children: "Front Matter"
                          }
                        ),
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                          "div",
                          {
                            style: {
                              position: "absolute",
                              right: 24,
                              width: 40,
                              height: 8,
                              backgroundColor: COLORS.skillsBlue,
                              borderRadius: 4
                            }
                          }
                        )
                      ]
                    }
                  )
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                "div",
                {
                  style: {
                    position: "absolute",
                    top: drawerHeight + 20,
                    left: "50%",
                    transform: `translateX(-50%) translateY(${(0, import_remotion3.interpolate)(cardEntrance, [0, 1], [50, 0])}px)`,
                    opacity: cardEntrance,
                    display: "flex",
                    gap: 16
                  },
                  children: ["name", "description"].map((label, i) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
                    "div",
                    {
                      style: {
                        padding: "12px 20px",
                        backgroundColor: "#FFFFFF",
                        borderRadius: 8,
                        border: `2px solid ${COLORS.skillsBlue}40`,
                        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                        transform: `translateY(${(0, import_remotion3.interpolate)(
                          (0, import_remotion3.spring)({ frame: localFrame - localKeySync - 20 - i * 8, fps, config: SPRING_CONFIG }),
                          [0, 1],
                          [20, 0],
                          { extrapolateRight: "clamp" }
                        )}px)`
                      },
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(FileDocumentIcon, { size: bodySize * 1.2, color: COLORS.skillsBlue }),
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                          "span",
                          {
                            style: {
                              marginLeft: 8,
                              fontFamily: "system-ui, -apple-system, sans-serif",
                              fontSize: bodySize * 0.9,
                              fontWeight: 600,
                              color: COLORS.text,
                              textTransform: "capitalize"
                            },
                            children: label
                          }
                        )
                      ]
                    },
                    label
                  ))
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                "div",
                {
                  style: {
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: drawerHeight,
                    transform: `translateX(${(0, import_remotion3.interpolate)(bottomDrawerOpen, [0, 1], [0, 8], { extrapolateRight: "clamp" })}px)`
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
                    "div",
                    {
                      style: {
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        padding: "0 24px",
                        backgroundColor: COLORS.textMuted + "10"
                      },
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(FolderIcon, { size: titleSize * 1.2, color: COLORS.textMuted }),
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                          "span",
                          {
                            style: {
                              marginLeft: 16,
                              fontFamily: "system-ui, -apple-system, sans-serif",
                              fontSize: titleSize,
                              fontWeight: 700,
                              color: COLORS.textMuted
                            },
                            children: "Body"
                          }
                        ),
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                          "span",
                          {
                            style: {
                              marginLeft: 12,
                              fontFamily: "system-ui, -apple-system, sans-serif",
                              fontSize: bodySize * 0.8,
                              color: COLORS.textMuted,
                              opacity: 0.7
                            },
                            children: "(loaded on demand)"
                          }
                        ),
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                          "div",
                          {
                            style: {
                              position: "absolute",
                              right: 24,
                              width: 40,
                              height: 8,
                              backgroundColor: COLORS.textMuted,
                              borderRadius: 4,
                              opacity: 0.5
                            }
                          }
                        )
                      ]
                    }
                  )
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
          "div",
          {
            style: {
              position: "absolute",
              bottom: height * 0.12,
              left: "50%",
              transform: `translateX(-50%)`,
              opacity: (0, import_remotion3.interpolate)(localFrame, [60, 90], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" }),
              textAlign: "center"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                "span",
                {
                  style: {
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    fontSize: titleSize,
                    fontWeight: 700,
                    color: COLORS.text
                  },
                  children: "Skills = Organized Instructions"
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("br", {}),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                "span",
                {
                  style: {
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    fontSize: bodySize,
                    color: COLORS.textMuted,
                    marginTop: 8,
                    display: "block"
                  },
                  children: "Only load what you need, when you need it"
                }
              )
            ]
          }
        )
      ]
    }
  );
};

// src/proj_6be589ae_fdaf_4812_af39_c6124b5bc276/scenes/Scene3.tsx
var import_remotion4 = require("remotion");
var import_jsx_runtime5 = require("react/jsx-runtime");
var Scene3 = ({ startFrame = 0 }) => {
  const frame = (0, import_remotion4.useCurrentFrame)();
  const { fps, height, width } = (0, import_remotion4.useVideoConfig)();
  const localFrame = frame - startFrame;
  const sceneDuration = TIMING.scene3End - TIMING.scene3Start;
  const leftPanelEntrance = (0, import_remotion4.spring)({
    frame: localFrame,
    fps,
    config: SPRING_CONFIG,
    durationInFrames: 30
  });
  const rightPanelEntrance = (0, import_remotion4.spring)({
    frame: localFrame - 10,
    fps,
    config: SPRING_CONFIG,
    durationInFrames: 30
  });
  const localKeySync = 47;
  const selectiveProgress = (0, import_remotion4.interpolate)(
    localFrame,
    [localKeySync, localKeySync + 80],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const bulkProgress = (0, import_remotion4.interpolate)(
    localFrame,
    [localKeySync + 20, localKeySync + 40],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const fileFloat = (0, import_remotion4.spring)({
    frame: localFrame - localKeySync,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 60 },
    durationInFrames: 60
  });
  const exitProgress = (0, import_remotion4.interpolate)(
    localFrame,
    [sceneDuration - 20, sceneDuration],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const titleSize = height * 0.028;
  const bodySize = height * 0.022;
  const panelWidth = width * 0.4;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    import_remotion4.AbsoluteFill,
    {
      style: {
        backgroundColor: COLORS.background,
        opacity: (0, import_remotion4.interpolate)(exitProgress, [0, 1], [1, 0], { extrapolateRight: "clamp" })
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: "20%",
              bottom: "20%",
              left: "50%",
              width: 3,
              backgroundColor: COLORS.textMuted + "30",
              transform: "translateX(-50%)"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
          "div",
          {
            style: {
              position: "absolute",
              top: "15%",
              left: width * 0.05,
              width: panelWidth,
              height: height * 0.7,
              transform: `translateX(${(0, import_remotion4.interpolate)(leftPanelEntrance, [0, 1], [-50, 0])}px)`,
              opacity: leftPanelEntrance
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 24
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                      "div",
                      {
                        style: {
                          width: 48,
                          height: 48,
                          borderRadius: 12,
                          backgroundColor: COLORS.skillsBlue + "20",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        },
                        children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(DownloadIcon, { size: 24, color: COLORS.skillsBlue })
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                        "div",
                        {
                          style: {
                            fontFamily: "system-ui, -apple-system, sans-serif",
                            fontSize: titleSize,
                            fontWeight: 700,
                            color: COLORS.skillsBlue
                          },
                          children: "Selective Loading"
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                        "div",
                        {
                          style: {
                            fontFamily: "system-ui, -apple-system, sans-serif",
                            fontSize: bodySize * 0.9,
                            color: COLORS.textMuted
                          },
                          children: "One at a time"
                        }
                      )
                    ] })
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                "div",
                {
                  style: {
                    position: "relative",
                    height: height * 0.35,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    padding: 20,
                    backgroundColor: COLORS.surface,
                    borderRadius: 16,
                    border: `2px solid ${COLORS.skillsBlue}30`
                  },
                  children: [0, 1, 2, 3].map((i) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                    "div",
                    {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 16px",
                        backgroundColor: i === 0 ? COLORS.skillsBlue + "15" : "#FFFFFF",
                        borderRadius: 8,
                        border: `2px solid ${i === 0 ? COLORS.skillsBlue : COLORS.textMuted + "30"}`,
                        transform: i === 0 ? `translateX(${(0, import_remotion4.interpolate)(fileFloat, [0, 1], [0, 30])}px)` : "none",
                        opacity: i === 0 ? 1 : 0.5
                      },
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                          FileDocumentIcon,
                          {
                            size: 20,
                            color: i === 0 ? COLORS.skillsBlue : COLORS.textMuted
                          }
                        ),
                        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                          "span",
                          {
                            style: {
                              fontFamily: "system-ui, -apple-system, sans-serif",
                              fontSize: bodySize * 0.85,
                              color: i === 0 ? COLORS.text : COLORS.textMuted,
                              fontWeight: i === 0 ? 600 : 400
                            },
                            children: i === 0 ? "Active file" : `File ${i + 1}`
                          }
                        )
                      ]
                    },
                    i
                  ))
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { marginTop: 24 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                  "div",
                  {
                    style: {
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 8
                    },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                        "span",
                        {
                          style: {
                            fontFamily: "system-ui, -apple-system, sans-serif",
                            fontSize: bodySize * 0.85,
                            color: COLORS.textMuted
                          },
                          children: "Context used"
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                        "span",
                        {
                          style: {
                            fontFamily: "system-ui, -apple-system, sans-serif",
                            fontSize: bodySize * 0.85,
                            color: COLORS.success,
                            fontWeight: 600
                          },
                          children: [
                            Math.round(selectiveProgress * 25),
                            "%"
                          ]
                        }
                      )
                    ]
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "div",
                  {
                    style: {
                      height: 12,
                      backgroundColor: COLORS.textMuted + "20",
                      borderRadius: 6,
                      overflow: "hidden"
                    },
                    children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                      "div",
                      {
                        style: {
                          height: "100%",
                          width: `${selectiveProgress * 25}%`,
                          backgroundColor: COLORS.success,
                          borderRadius: 6,
                          transition: "width 0.1s ease-out"
                        }
                      }
                    )
                  }
                )
              ] })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
          "div",
          {
            style: {
              position: "absolute",
              top: "15%",
              right: width * 0.05,
              width: panelWidth,
              height: height * 0.7,
              transform: `translateX(${(0, import_remotion4.interpolate)(rightPanelEntrance, [0, 1], [50, 0])}px)`,
              opacity: rightPanelEntrance
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 24
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                      "div",
                      {
                        style: {
                          width: 48,
                          height: 48,
                          borderRadius: 12,
                          backgroundColor: COLORS.mcpRed + "20",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        },
                        children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ServerIcon, { size: 24, color: COLORS.mcpRed })
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                        "div",
                        {
                          style: {
                            fontFamily: "system-ui, -apple-system, sans-serif",
                            fontSize: titleSize,
                            fontWeight: 700,
                            color: COLORS.mcpRed
                          },
                          children: "Bulk Loading"
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                        "div",
                        {
                          style: {
                            fontFamily: "system-ui, -apple-system, sans-serif",
                            fontSize: bodySize * 0.9,
                            color: COLORS.textMuted
                          },
                          children: "Everything at once"
                        }
                      )
                    ] })
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                "div",
                {
                  style: {
                    position: "relative",
                    height: height * 0.35,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 16,
                    padding: 20,
                    backgroundColor: COLORS.surface,
                    borderRadius: 16,
                    border: `2px solid ${COLORS.mcpRed}30`
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ServerIcon, { size: 60, color: COLORS.mcpRed }),
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                      "div",
                      {
                        style: {
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                          justifyContent: "center",
                          opacity: bulkProgress
                        },
                        children: [...Array(8)].map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                          "div",
                          {
                            style: {
                              width: 32,
                              height: 40,
                              backgroundColor: COLORS.mcpRed + "30",
                              borderRadius: 4,
                              transform: `translateY(${(0, import_remotion4.interpolate)(
                                (0, import_remotion4.spring)({
                                  frame: localFrame - localKeySync - 20 - i * 2,
                                  fps,
                                  config: { ...SPRING_CONFIG, stiffness: 120 }
                                }),
                                [0, 1],
                                [-30, 0],
                                { extrapolateRight: "clamp" }
                              )}px)`
                            }
                          },
                          i
                        ))
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                      "span",
                      {
                        style: {
                          fontFamily: "system-ui, -apple-system, sans-serif",
                          fontSize: bodySize * 0.85,
                          color: COLORS.textMuted,
                          opacity: bulkProgress
                        },
                        children: "Loading all tools..."
                      }
                    )
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { marginTop: 24 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                  "div",
                  {
                    style: {
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 8
                    },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                        "span",
                        {
                          style: {
                            fontFamily: "system-ui, -apple-system, sans-serif",
                            fontSize: bodySize * 0.85,
                            color: COLORS.textMuted
                          },
                          children: "Context used"
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                        "span",
                        {
                          style: {
                            fontFamily: "system-ui, -apple-system, sans-serif",
                            fontSize: bodySize * 0.85,
                            color: bulkProgress > 0.7 ? COLORS.warning : COLORS.mcpRed,
                            fontWeight: 600
                          },
                          children: [
                            Math.round(bulkProgress * 75),
                            "%"
                          ]
                        }
                      )
                    ]
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "div",
                  {
                    style: {
                      height: 12,
                      backgroundColor: COLORS.textMuted + "20",
                      borderRadius: 6,
                      overflow: "hidden"
                    },
                    children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                      "div",
                      {
                        style: {
                          height: "100%",
                          width: `${bulkProgress * 75}%`,
                          backgroundColor: bulkProgress > 0.7 ? COLORS.warning : COLORS.mcpRed,
                          borderRadius: 6,
                          transition: "width 0.1s ease-out"
                        }
                      }
                    )
                  }
                )
              ] })
            ]
          }
        )
      ]
    }
  );
};

// src/proj_6be589ae_fdaf_4812_af39_c6124b5bc276/scenes/Scene4.tsx
var import_remotion5 = require("remotion");
var import_jsx_runtime6 = require("react/jsx-runtime");
var Scene4 = ({ startFrame = 0 }) => {
  const frame = (0, import_remotion5.useCurrentFrame)();
  const { fps, height, width } = (0, import_remotion5.useVideoConfig)();
  const localFrame = frame - startFrame;
  const sceneDuration = TIMING.scene4End - TIMING.scene4Start;
  const brainEntrance = (0, import_remotion5.spring)({
    frame: localFrame,
    fps,
    config: SPRING_CONFIG,
    durationInFrames: 30
  });
  const serverEntrance = (0, import_remotion5.spring)({
    frame: localFrame - 15,
    fps,
    config: SPRING_CONFIG,
    durationInFrames: 40
  });
  const localKeySync = 74;
  const connectionActivation = (0, import_remotion5.spring)({
    frame: localFrame - localKeySync,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 100 },
    durationInFrames: 30
  });
  const brainGrowth = (0, import_remotion5.interpolate)(
    localFrame,
    [localKeySync, localKeySync + 100],
    [1, 1.3],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const dataStreamProgress = (0, import_remotion5.interpolate)(
    localFrame,
    [localKeySync, localKeySync + 60],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const exitProgress = (0, import_remotion5.interpolate)(
    localFrame,
    [sceneDuration - 25, sceneDuration],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const titleSize = height * 0.03;
  const bodySize = height * 0.022;
  const connectionCount = 6;
  const serverCenterX = width * 0.5;
  const serverCenterY = height * 0.62;
  const brainCenterY = height * 0.22;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
    import_remotion5.AbsoluteFill,
    {
      style: {
        backgroundColor: COLORS.background,
        opacity: (0, import_remotion5.interpolate)(exitProgress, [0, 1], [1, 0], { extrapolateRight: "clamp" })
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
          "div",
          {
            style: {
              position: "absolute",
              top: height * 0.15,
              left: "50%",
              transform: `translateX(-50%) scale(${brainEntrance * brainGrowth})`,
              opacity: brainEntrance,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
                "div",
                {
                  style: {
                    position: "relative"
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                      BrainIcon,
                      {
                        size: height * 0.1,
                        color: (0, import_remotion5.interpolate)(dataStreamProgress, [0, 1], [0, 1]) > 0.5 ? COLORS.mcpRed : COLORS.primary
                      }
                    ),
                    dataStreamProgress > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                      "div",
                      {
                        style: {
                          position: "absolute",
                          inset: -20,
                          borderRadius: "50%",
                          background: `radial-gradient(circle, ${COLORS.mcpRed}30 0%, transparent 70%)`,
                          opacity: dataStreamProgress
                        }
                      }
                    )
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                "span",
                {
                  style: {
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    fontSize: bodySize,
                    color: COLORS.textMuted,
                    fontWeight: 500
                  },
                  children: "AI Agent"
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "svg",
          {
            style: {
              position: "absolute",
              inset: 0,
              pointerEvents: "none"
            },
            width,
            height,
            children: [...Array(connectionCount)].map((_, i) => {
              const startX = serverCenterX + (i - (connectionCount - 1) / 2) * 60;
              const startY = serverCenterY - 80;
              const endX = width / 2;
              const endY = brainCenterY + 60;
              const connectionDelay = i * 3;
              const lineProgress = (0, import_remotion5.interpolate)(
                localFrame - localKeySync - connectionDelay,
                [0, 20],
                [0, 1],
                { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
              );
              return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("g", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                  "line",
                  {
                    x1: startX,
                    y1: startY,
                    x2: startX + (endX - startX) * lineProgress,
                    y2: startY + (endY - startY) * lineProgress,
                    stroke: COLORS.mcpRed,
                    strokeWidth: 3,
                    strokeLinecap: "round",
                    opacity: connectionActivation * 0.6
                  }
                ),
                lineProgress > 0.1 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                  "circle",
                  {
                    cx: startX + (endX - startX) * ((localFrame * 0.03 + i * 0.15) % 1),
                    cy: startY + (endY - startY) * ((localFrame * 0.03 + i * 0.15) % 1),
                    r: 6,
                    fill: COLORS.mcpRed,
                    opacity: connectionActivation * dataStreamProgress
                  }
                )
              ] }, i);
            })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
          "div",
          {
            style: {
              position: "absolute",
              top: height * 0.5,
              left: "50%",
              transform: `translateX(-50%) scale(${serverEntrance})`,
              opacity: serverEntrance,
              display: "flex",
              flexDirection: "column",
              alignItems: "center"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
                "div",
                {
                  style: {
                    width: width * 0.7,
                    padding: 24,
                    backgroundColor: COLORS.surface,
                    borderRadius: 16,
                    border: `3px solid ${COLORS.mcpRed}`,
                    boxShadow: connectionActivation > 0 ? `0 0 40px ${COLORS.mcpRed}40` : "none"
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                      "div",
                      {
                        style: {
                          display: "flex",
                          flexDirection: "column",
                          gap: 12
                        },
                        children: [0, 1, 2].map((row) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                          "div",
                          {
                            style: {
                              display: "flex",
                              gap: 12,
                              justifyContent: "center"
                            },
                            children: [0, 1, 2, 3].map((col) => {
                              const slotIndex = row * 4 + col;
                              const slotActivation = (0, import_remotion5.spring)({
                                frame: localFrame - localKeySync - slotIndex * 2,
                                fps,
                                config: { ...SPRING_CONFIG, stiffness: 150 },
                                durationInFrames: 15
                              });
                              return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                                "div",
                                {
                                  style: {
                                    width: 70,
                                    height: 50,
                                    backgroundColor: slotActivation > 0.5 ? COLORS.mcpRed + "30" : COLORS.textMuted + "15",
                                    borderRadius: 8,
                                    border: `2px solid ${slotActivation > 0.5 ? COLORS.mcpRed : COLORS.textMuted + "30"}`,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    transition: "background-color 0.1s ease"
                                  },
                                  children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                                    "div",
                                    {
                                      style: {
                                        width: 8,
                                        height: 8,
                                        borderRadius: "50%",
                                        backgroundColor: slotActivation > 0.5 ? COLORS.mcpRed : COLORS.textMuted,
                                        boxShadow: slotActivation > 0.5 ? `0 0 10px ${COLORS.mcpRed}` : "none"
                                      }
                                    }
                                  )
                                },
                                col
                              );
                            })
                          },
                          row
                        ))
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
                      "div",
                      {
                        style: {
                          marginTop: 16,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 12
                        },
                        children: [
                          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(ServerIcon, { size: 24, color: COLORS.mcpRed }),
                          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                            "span",
                            {
                              style: {
                                fontFamily: "system-ui, -apple-system, sans-serif",
                                fontSize: titleSize,
                                fontWeight: 700,
                                color: COLORS.mcpRed
                              },
                              children: "MCP Server"
                            }
                          )
                        ]
                      }
                    )
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                "div",
                {
                  style: {
                    marginTop: 24,
                    opacity: (0, import_remotion5.interpolate)(localFrame, [localKeySync + 30, localKeySync + 50], [0, 1], {
                      extrapolateRight: "clamp",
                      extrapolateLeft: "clamp"
                    })
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
                    "span",
                    {
                      style: {
                        fontFamily: "system-ui, -apple-system, sans-serif",
                        fontSize: titleSize,
                        fontWeight: 700,
                        color: COLORS.text
                      },
                      children: [
                        "Inject",
                        " ",
                        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { color: COLORS.mcpRed }, children: "ALL" }),
                        " tools into context"
                      ]
                    }
                  )
                }
              )
            ]
          }
        )
      ]
    }
  );
};

// src/proj_6be589ae_fdaf_4812_af39_c6124b5bc276/scenes/Scene5.tsx
var import_remotion6 = require("remotion");
var import_jsx_runtime7 = require("react/jsx-runtime");
var Scene5 = ({ startFrame = 0 }) => {
  const frame = (0, import_remotion6.useCurrentFrame)();
  const { fps, height, width } = (0, import_remotion6.useVideoConfig)();
  const localFrame = frame - startFrame;
  const sceneDuration = TIMING.scene5End - TIMING.scene5Start;
  const brainEntrance = (0, import_remotion6.spring)({
    frame: localFrame,
    fps,
    config: SPRING_CONFIG,
    durationInFrames: 20
  });
  const performanceDrop = (0, import_remotion6.interpolate)(
    localFrame,
    [20, 120],
    [0.85, 0.15],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const shakeIntensity = (0, import_remotion6.interpolate)(localFrame, [30, 80], [0, 3], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp"
  });
  const shakeX = shakeIntensity * Math.sin(localFrame * 0.5) * (performanceDrop < 0.3 ? 2 : 1);
  const overflowProgress = (0, import_remotion6.interpolate)(localFrame, [40, 100], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp"
  });
  const exitProgress = (0, import_remotion6.interpolate)(
    localFrame,
    [sceneDuration - 20, sceneDuration],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const titleSize = height * 0.035;
  const bodySize = height * 0.025;
  const warningPositions = [
    { x: -120, y: -80, delay: 0 },
    { x: 120, y: -60, delay: 8 },
    { x: -100, y: 80, delay: 16 },
    { x: 110, y: 70, delay: 24 },
    { x: 0, y: -120, delay: 12 }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
    import_remotion6.AbsoluteFill,
    {
      style: {
        backgroundColor: COLORS.background,
        opacity: (0, import_remotion6.interpolate)(exitProgress, [0, 1], [1, 0], { extrapolateRight: "clamp" })
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              inset: 0,
              background: `radial-gradient(circle at 50% 45%, ${COLORS.mcpRed}10 0%, transparent 50%)`,
              opacity: (0, import_remotion6.interpolate)(performanceDrop, [0.5, 0.2], [0, 0.8], {
                extrapolateRight: "clamp",
                extrapolateLeft: "clamp"
              })
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
          "div",
          {
            style: {
              position: "absolute",
              top: height * 0.35,
              left: "50%",
              transform: `translateX(-50%) translateX(${shakeX}px) scale(${brainEntrance * 1.2})`,
              opacity: brainEntrance
            },
            children: [
              overflowProgress > 0 && [...Array(12)].map((_, i) => {
                const angle = i / 12 * Math.PI * 2;
                const distance = 60 + overflowProgress * 40;
                const particleX = Math.cos(angle + localFrame * 0.02) * distance;
                const particleY = Math.sin(angle + localFrame * 0.02) * distance;
                return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                  "div",
                  {
                    style: {
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      backgroundColor: COLORS.mcpRed + "60",
                      transform: `translate(-50%, -50%) translate(${particleX}px, ${particleY}px)`,
                      opacity: overflowProgress * 0.8
                    }
                  },
                  i
                );
              }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { position: "relative" }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(BrainIcon, { size: height * 0.15, color: COLORS.mcpRed }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                  "div",
                  {
                    style: {
                      position: "absolute",
                      inset: -30,
                      borderRadius: "50%",
                      background: `radial-gradient(circle, ${COLORS.mcpRed}40 0%, transparent 70%)`,
                      opacity: (0, import_remotion6.interpolate)(performanceDrop, [0.5, 0.2], [0.3, 1], {
                        extrapolateRight: "clamp"
                      })
                    }
                  }
                )
              ] }),
              warningPositions.map((pos, i) => {
                const warningScale = (0, import_remotion6.spring)({
                  frame: localFrame - 15 - pos.delay,
                  fps,
                  config: { ...SPRING_CONFIG, stiffness: 150 },
                  durationInFrames: 20
                });
                const pulse = 1 + 0.1 * Math.sin((localFrame + i * 10) * 0.15);
                return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                  "div",
                  {
                    style: {
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) scale(${warningScale * pulse})`,
                      opacity: warningScale
                    },
                    children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                      "div",
                      {
                        style: {
                          padding: 8,
                          backgroundColor: "#FFFFFF",
                          borderRadius: 8,
                          boxShadow: `0 4px 12px ${COLORS.mcpRed}30`,
                          border: `2px solid ${COLORS.mcpRed}`
                        },
                        children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(WarningIcon, { size: 28, color: COLORS.mcpRed })
                      }
                    )
                  },
                  i
                );
              })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
          "div",
          {
            style: {
              position: "absolute",
              bottom: height * 0.2,
              left: "50%",
              transform: "translateX(-50%)",
              width: width * 0.7,
              opacity: (0, import_remotion6.interpolate)(localFrame, [30, 50], [0, 1], {
                extrapolateRight: "clamp",
                extrapolateLeft: "clamp"
              })
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
                "div",
                {
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 12
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                      "span",
                      {
                        style: {
                          fontFamily: "system-ui, -apple-system, sans-serif",
                          fontSize: bodySize,
                          fontWeight: 600,
                          color: COLORS.text
                        },
                        children: "Context Window Capacity"
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
                      "span",
                      {
                        style: {
                          fontFamily: "system-ui, -apple-system, sans-serif",
                          fontSize: bodySize,
                          fontWeight: 700,
                          color: performanceDrop < 0.3 ? COLORS.mcpRed : COLORS.warning
                        },
                        children: [
                          Math.round((1 - performanceDrop) * 100),
                          "% FULL"
                        ]
                      }
                    )
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
                "div",
                {
                  style: {
                    height: 24,
                    backgroundColor: COLORS.textMuted + "20",
                    borderRadius: 12,
                    overflow: "hidden",
                    position: "relative"
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                      "div",
                      {
                        style: {
                          height: "100%",
                          width: `${(1 - performanceDrop) * 100}%`,
                          background: performanceDrop < 0.3 ? COLORS.mcpRed : performanceDrop < 0.5 ? COLORS.warning : COLORS.success,
                          borderRadius: 12,
                          transition: "background-color 0.3s ease"
                        }
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                      "div",
                      {
                        style: {
                          position: "absolute",
                          right: "15%",
                          top: 0,
                          bottom: 0,
                          width: 2,
                          backgroundColor: COLORS.mcpRed,
                          opacity: 0.5
                        }
                      }
                    )
                  ]
                }
              ),
              performanceDrop < 0.3 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                "div",
                {
                  style: {
                    marginTop: 16,
                    textAlign: "center",
                    opacity: (0, import_remotion6.interpolate)(performanceDrop, [0.3, 0.2], [0, 1], {
                      extrapolateRight: "clamp"
                    })
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                    "span",
                    {
                      style: {
                        fontFamily: "system-ui, -apple-system, sans-serif",
                        fontSize: titleSize,
                        fontWeight: 700,
                        color: COLORS.mcpRed
                      },
                      children: "Performance Degradation"
                    }
                  )
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: height * 0.1,
              left: "50%",
              transform: "translateX(-50%)",
              opacity: brainEntrance
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
              "span",
              {
                style: {
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  fontSize: titleSize * 1.2,
                  fontWeight: 800,
                  color: COLORS.mcpRed
                },
                children: "But there's a problem..."
              }
            )
          }
        )
      ]
    }
  );
};

// src/proj_6be589ae_fdaf_4812_af39_c6124b5bc276/scenes/Scene6.tsx
var import_remotion7 = require("remotion");
var import_jsx_runtime8 = require("react/jsx-runtime");
var Scene6 = ({ startFrame = 0 }) => {
  const frame = (0, import_remotion7.useCurrentFrame)();
  const { fps, height, width } = (0, import_remotion7.useVideoConfig)();
  const localFrame = frame - startFrame;
  const sceneDuration = TIMING.scene6End - TIMING.scene6Start;
  const leftPanelEntrance = (0, import_remotion7.spring)({
    frame: localFrame,
    fps,
    config: SPRING_CONFIG,
    durationInFrames: 30
  });
  const rightPanelEntrance = (0, import_remotion7.spring)({
    frame: localFrame - 12,
    fps,
    config: SPRING_CONFIG,
    durationInFrames: 30
  });
  const dividerEntrance = (0, import_remotion7.spring)({
    frame: localFrame - 6,
    fps,
    config: SPRING_CONFIG,
    durationInFrames: 25
  });
  const exitProgress = (0, import_remotion7.interpolate)(
    localFrame,
    [sceneDuration - 20, sceneDuration],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const titleSize = height * 0.028;
  const bodySize = height * 0.022;
  const panelWidth = width * 0.42;
  const apiFunctions = [
    { name: "create()", color: COLORS.success },
    { name: "read()", color: COLORS.primary },
    { name: "update()", color: COLORS.warning },
    { name: "delete()", color: COLORS.mcpRed },
    { name: "list()", color: COLORS.primary }
  ];
  const docStructure = [
    { title: "Purpose", desc: "What this skill does" },
    { title: "Guidelines", desc: "How to approach tasks" },
    { title: "Examples", desc: "Sample outputs" },
    { title: "Constraints", desc: "What to avoid" }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    import_remotion7.AbsoluteFill,
    {
      style: {
        backgroundColor: COLORS.background,
        opacity: (0, import_remotion7.interpolate)(exitProgress, [0, 1], [1, 0], { extrapolateRight: "clamp" })
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: height * 0.08,
              left: "50%",
              transform: "translateX(-50%)",
              textAlign: "center",
              opacity: (0, import_remotion7.interpolate)(localFrame, [10, 30], [0, 1], {
                extrapolateRight: "clamp",
                extrapolateLeft: "clamp"
              })
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              "span",
              {
                style: {
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  fontSize: titleSize * 1.1,
                  fontWeight: 700,
                  color: COLORS.text
                },
                children: "Different Types of Capabilities"
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: "18%",
              bottom: "12%",
              left: "50%",
              width: 3,
              backgroundColor: COLORS.textMuted + "40",
              transform: `translateX(-50%) scaleY(${dividerEntrance})`,
              transformOrigin: "top"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
          "div",
          {
            style: {
              position: "absolute",
              top: height * 0.18,
              left: width * 0.04,
              width: panelWidth,
              transform: `translateX(${(0, import_remotion7.interpolate)(leftPanelEntrance, [0, 1], [-40, 0])}px)`,
              opacity: leftPanelEntrance
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 20,
                    padding: "16px 20px",
                    backgroundColor: COLORS.mcpRed + "15",
                    borderRadius: 12,
                    border: `2px solid ${COLORS.mcpRed}30`
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(ApiIcon, { size: 32, color: COLORS.mcpRed }),
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { children: [
                      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                        "div",
                        {
                          style: {
                            fontFamily: "system-ui, -apple-system, sans-serif",
                            fontSize: titleSize,
                            fontWeight: 700,
                            color: COLORS.mcpRed
                          },
                          children: "MCP: Raw API Tools"
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                        "div",
                        {
                          style: {
                            fontFamily: "system-ui, -apple-system, sans-serif",
                            fontSize: bodySize * 0.85,
                            color: COLORS.textMuted
                          },
                          children: "Google Drive Example"
                        }
                      )
                    ] })
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                "div",
                {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: 12
                  },
                  children: apiFunctions.map((fn, i) => {
                    const buttonEntrance = (0, import_remotion7.spring)({
                      frame: localFrame - 30 - i * 8,
                      fps,
                      config: SPRING_CONFIG,
                      durationInFrames: 25
                    });
                    return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
                      "div",
                      {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "14px 20px",
                          backgroundColor: "#FFFFFF",
                          borderRadius: 10,
                          border: `2px solid ${COLORS.textMuted}25`,
                          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
                          transform: `translateX(${(0, import_remotion7.interpolate)(buttonEntrance, [0, 1], [30, 0])}px)`,
                          opacity: buttonEntrance
                        },
                        children: [
                          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                            "div",
                            {
                              style: {
                                width: 12,
                                height: 12,
                                borderRadius: "50%",
                                backgroundColor: fn.color
                              }
                            }
                          ),
                          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                            "code",
                            {
                              style: {
                                fontFamily: "SF Mono, Monaco, monospace",
                                fontSize: bodySize,
                                fontWeight: 600,
                                color: COLORS.text
                              },
                              children: fn.name
                            }
                          )
                        ]
                      },
                      fn.name
                    );
                  })
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                "div",
                {
                  style: {
                    marginTop: 20,
                    padding: "12px 16px",
                    backgroundColor: COLORS.textMuted + "10",
                    borderRadius: 8,
                    opacity: (0, import_remotion7.interpolate)(localFrame, [80, 100], [0, 1], {
                      extrapolateRight: "clamp",
                      extrapolateLeft: "clamp"
                    })
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
                    "span",
                    {
                      style: {
                        fontFamily: "system-ui, -apple-system, sans-serif",
                        fontSize: bodySize * 0.85,
                        color: COLORS.textMuted
                      },
                      children: [
                        "Just functions - no guidance on ",
                        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("em", { children: "when" }),
                        " or ",
                        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("em", { children: "how" }),
                        " to use them"
                      ]
                    }
                  )
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
          "div",
          {
            style: {
              position: "absolute",
              top: height * 0.18,
              right: width * 0.04,
              width: panelWidth,
              transform: `translateX(${(0, import_remotion7.interpolate)(rightPanelEntrance, [0, 1], [40, 0])}px)`,
              opacity: rightPanelEntrance
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 20,
                    padding: "16px 20px",
                    backgroundColor: COLORS.skillsBlue + "15",
                    borderRadius: 12,
                    border: `2px solid ${COLORS.skillsBlue}30`
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(FileDocumentIcon, { size: 32, color: COLORS.skillsBlue }),
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { children: [
                      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                        "div",
                        {
                          style: {
                            fontFamily: "system-ui, -apple-system, sans-serif",
                            fontSize: titleSize,
                            fontWeight: 700,
                            color: COLORS.skillsBlue
                          },
                          children: "Skills: Structured Guidance"
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                        "div",
                        {
                          style: {
                            fontFamily: "system-ui, -apple-system, sans-serif",
                            fontSize: bodySize * 0.85,
                            color: COLORS.textMuted
                          },
                          children: "Doc Writing Skill Example"
                        }
                      )
                    ] })
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                "div",
                {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: 12
                  },
                  children: docStructure.map((item, i) => {
                    const itemEntrance = (0, import_remotion7.spring)({
                      frame: localFrame - 35 - i * 8,
                      fps,
                      config: SPRING_CONFIG,
                      durationInFrames: 25
                    });
                    return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
                      "div",
                      {
                        style: {
                          padding: "14px 20px",
                          backgroundColor: "#FFFFFF",
                          borderRadius: 10,
                          border: `2px solid ${COLORS.skillsBlue}20`,
                          borderLeft: `4px solid ${COLORS.skillsBlue}`,
                          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
                          transform: `translateX(${(0, import_remotion7.interpolate)(itemEntrance, [0, 1], [-30, 0])}px)`,
                          opacity: itemEntrance
                        },
                        children: [
                          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                            "div",
                            {
                              style: {
                                fontFamily: "system-ui, -apple-system, sans-serif",
                                fontSize: bodySize,
                                fontWeight: 700,
                                color: COLORS.skillsBlue,
                                marginBottom: 4
                              },
                              children: item.title
                            }
                          ),
                          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                            "div",
                            {
                              style: {
                                fontFamily: "system-ui, -apple-system, sans-serif",
                                fontSize: bodySize * 0.85,
                                color: COLORS.textMuted
                              },
                              children: item.desc
                            }
                          )
                        ]
                      },
                      item.title
                    );
                  })
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                "div",
                {
                  style: {
                    marginTop: 20,
                    padding: "12px 16px",
                    backgroundColor: COLORS.skillsBlue + "10",
                    borderRadius: 8,
                    opacity: (0, import_remotion7.interpolate)(localFrame, [90, 110], [0, 1], {
                      extrapolateRight: "clamp",
                      extrapolateLeft: "clamp"
                    })
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
                    "span",
                    {
                      style: {
                        fontFamily: "system-ui, -apple-system, sans-serif",
                        fontSize: bodySize * 0.85,
                        color: COLORS.skillsBlue,
                        fontWeight: 500
                      },
                      children: [
                        "Instructions + context for ",
                        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("em", { children: "intelligent" }),
                        " behavior"
                      ]
                    }
                  )
                }
              )
            ]
          }
        )
      ]
    }
  );
};

// src/proj_6be589ae_fdaf_4812_af39_c6124b5bc276/scenes/Scene7.tsx
var import_remotion8 = require("remotion");
var import_jsx_runtime9 = require("react/jsx-runtime");
var Scene7 = ({ startFrame = 0 }) => {
  const frame = (0, import_remotion8.useCurrentFrame)();
  const { fps, height, width } = (0, import_remotion8.useVideoConfig)();
  const localFrame = frame - startFrame;
  const sceneDuration = TIMING.scene7End - TIMING.scene7Start;
  const leftCardEntrance = (0, import_remotion8.spring)({
    frame: localFrame,
    fps,
    config: SPRING_CONFIG,
    durationInFrames: 30
  });
  const vsEntrance = (0, import_remotion8.spring)({
    frame: localFrame - 10,
    fps,
    config: SPRING_CONFIG,
    durationInFrames: 25
  });
  const rightCardEntrance = (0, import_remotion8.spring)({
    frame: localFrame - 15,
    fps,
    config: SPRING_CONFIG,
    durationInFrames: 30
  });
  const summaryEntrance = (0, import_remotion8.spring)({
    frame: localFrame - 40,
    fps,
    config: SPRING_CONFIG,
    durationInFrames: 30
  });
  const exitProgress = (0, import_remotion8.interpolate)(
    localFrame,
    [sceneDuration - 15, sceneDuration],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const titleSize = height * 0.032;
  const bodySize = height * 0.024;
  const cardWidth = width * 0.35;
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
    import_remotion8.AbsoluteFill,
    {
      style: {
        backgroundColor: COLORS.background,
        opacity: (0, import_remotion8.interpolate)(exitProgress, [0, 1], [1, 0], { extrapolateRight: "clamp" })
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: height * 0.1,
              left: "50%",
              transform: "translateX(-50%)",
              textAlign: "center",
              opacity: (0, import_remotion8.interpolate)(localFrame, [5, 20], [0, 1], {
                extrapolateRight: "clamp",
                extrapolateLeft: "clamp"
              })
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
              "span",
              {
                style: {
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  fontSize: titleSize * 1.2,
                  fontWeight: 800,
                  color: COLORS.text
                },
                children: "The Core Distinction"
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: height * 0.28,
              left: width * 0.08,
              width: cardWidth,
              transform: `translateX(${(0, import_remotion8.interpolate)(leftCardEntrance, [0, 1], [-50, 0])}px) scale(${leftCardEntrance})`,
              opacity: leftCardEntrance
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
              "div",
              {
                style: {
                  padding: 32,
                  backgroundColor: "#FFFFFF",
                  borderRadius: 20,
                  border: `3px solid ${COLORS.mcpRed}`,
                  boxShadow: `0 12px 40px ${COLORS.mcpRed}20`,
                  textAlign: "center"
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                    "div",
                    {
                      style: {
                        width: 80,
                        height: 80,
                        margin: "0 auto 20px",
                        borderRadius: 20,
                        backgroundColor: COLORS.mcpRed + "15",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      },
                      children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(ToolsIcon, { size: 48, color: COLORS.mcpRed })
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                    "div",
                    {
                      style: {
                        fontFamily: "system-ui, -apple-system, sans-serif",
                        fontSize: titleSize,
                        fontWeight: 800,
                        color: COLORS.mcpRed,
                        marginBottom: 8
                      },
                      children: "MCP"
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                    "div",
                    {
                      style: {
                        fontFamily: "system-ui, -apple-system, sans-serif",
                        fontSize: bodySize * 1.5,
                        fontWeight: 700,
                        color: COLORS.textMuted,
                        marginBottom: 8
                      },
                      children: "="
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                    "div",
                    {
                      style: {
                        fontFamily: "system-ui, -apple-system, sans-serif",
                        fontSize: titleSize * 0.9,
                        fontWeight: 700,
                        color: COLORS.text
                      },
                      children: "Raw Tools"
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                    "div",
                    {
                      style: {
                        fontFamily: "system-ui, -apple-system, sans-serif",
                        fontSize: bodySize,
                        color: COLORS.textMuted,
                        marginTop: 12
                      },
                      children: "Functions & APIs"
                    }
                  )
                ]
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: height * 0.42,
              left: "50%",
              transform: `translateX(-50%) scale(${vsEntrance})`,
              opacity: vsEntrance
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
              "div",
              {
                style: {
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  backgroundColor: COLORS.textMuted + "20",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                },
                children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                  "span",
                  {
                    style: {
                      fontFamily: "system-ui, -apple-system, sans-serif",
                      fontSize: bodySize,
                      fontWeight: 700,
                      color: COLORS.textMuted
                    },
                    children: "vs"
                  }
                )
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: height * 0.28,
              right: width * 0.08,
              width: cardWidth,
              transform: `translateX(${(0, import_remotion8.interpolate)(rightCardEntrance, [0, 1], [50, 0])}px) scale(${rightCardEntrance})`,
              opacity: rightCardEntrance
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
              "div",
              {
                style: {
                  padding: 32,
                  backgroundColor: "#FFFFFF",
                  borderRadius: 20,
                  border: `3px solid ${COLORS.skillsBlue}`,
                  boxShadow: `0 12px 40px ${COLORS.skillsBlue}20`,
                  textAlign: "center"
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                    "div",
                    {
                      style: {
                        width: 80,
                        height: 80,
                        margin: "0 auto 20px",
                        borderRadius: 20,
                        backgroundColor: COLORS.skillsBlue + "15",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      },
                      children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(BrainIcon, { size: 48, color: COLORS.skillsBlue })
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                    "div",
                    {
                      style: {
                        fontFamily: "system-ui, -apple-system, sans-serif",
                        fontSize: titleSize,
                        fontWeight: 800,
                        color: COLORS.skillsBlue
                      },
                      children: "Skills"
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                    "div",
                    {
                      style: {
                        fontFamily: "system-ui, -apple-system, sans-serif",
                        fontSize: bodySize * 1.5,
                        fontWeight: 700,
                        color: COLORS.textMuted,
                        marginBottom: 8
                      },
                      children: "="
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                    "div",
                    {
                      style: {
                        fontFamily: "system-ui, -apple-system, sans-serif",
                        fontSize: titleSize * 0.9,
                        fontWeight: 700,
                        color: COLORS.text
                      },
                      children: "Behavior"
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                    "div",
                    {
                      style: {
                        fontFamily: "system-ui, -apple-system, sans-serif",
                        fontSize: bodySize,
                        color: COLORS.textMuted,
                        marginTop: 12
                      },
                      children: "Instructions & Context"
                    }
                  )
                ]
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              bottom: height * 0.12,
              left: "50%",
              transform: `translateX(-50%) translateY(${(0, import_remotion8.interpolate)(summaryEntrance, [0, 1], [30, 0])}px)`,
              opacity: summaryEntrance,
              textAlign: "center",
              width: width * 0.8
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
              "div",
              {
                style: {
                  padding: "20px 32px",
                  backgroundColor: COLORS.surface,
                  borderRadius: 16,
                  border: `2px solid ${COLORS.textMuted}20`
                },
                children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
                  "span",
                  {
                    style: {
                      fontFamily: "system-ui, -apple-system, sans-serif",
                      fontSize: bodySize,
                      color: COLORS.text,
                      lineHeight: 1.5
                    },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("strong", { style: { color: COLORS.mcpRed }, children: "MCP" }),
                      " gives you the ",
                      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("em", { children: "what" }),
                      " \u2014",
                      " ",
                      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("strong", { style: { color: COLORS.skillsBlue }, children: "Skills" }),
                      " give you the ",
                      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("em", { children: "how" })
                    ]
                  }
                )
              }
            )
          }
        )
      ]
    }
  );
};

// src/proj_6be589ae_fdaf_4812_af39_c6124b5bc276/scenes/Scene8.tsx
var import_remotion9 = require("remotion");
var import_jsx_runtime10 = require("react/jsx-runtime");
var Scene8 = ({ startFrame = 0 }) => {
  const frame = (0, import_remotion9.useCurrentFrame)();
  const { fps, height, width } = (0, import_remotion9.useVideoConfig)();
  const localFrame = frame - startFrame;
  const summaryFade = (0, import_remotion9.interpolate)(localFrame, [0, 10], [0.3, 0.15], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp"
  });
  const boxEntrance = (0, import_remotion9.spring)({
    frame: localFrame,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 100 },
    durationInFrames: 20
  });
  const localKeySync = 9;
  const skillsHighlight = (0, import_remotion9.spring)({
    frame: localFrame - localKeySync,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 120 },
    durationInFrames: 15
  });
  const cursorVisible = Math.floor(localFrame / 15) % 2 === 0;
  const titleSize = height * 0.04;
  const bodySize = height * 0.028;
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
    import_remotion9.AbsoluteFill,
    {
      style: {
        backgroundColor: COLORS.background
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
          "div",
          {
            style: {
              position: "absolute",
              top: height * 0.15,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: 40,
              opacity: summaryFade
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                "div",
                {
                  style: {
                    padding: "16px 24px",
                    backgroundColor: "#FFFFFF",
                    borderRadius: 12,
                    border: `2px solid ${COLORS.mcpRed}40`,
                    textAlign: "center"
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                    "span",
                    {
                      style: {
                        fontFamily: "system-ui, -apple-system, sans-serif",
                        fontSize: bodySize * 0.9,
                        fontWeight: 700,
                        color: COLORS.mcpRed
                      },
                      children: "MCP = Tools"
                    }
                  )
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                "div",
                {
                  style: {
                    padding: "16px 24px",
                    backgroundColor: "#FFFFFF",
                    borderRadius: 12,
                    border: `2px solid ${COLORS.skillsBlue}40`,
                    textAlign: "center"
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                    "span",
                    {
                      style: {
                        fontFamily: "system-ui, -apple-system, sans-serif",
                        fontSize: bodySize * 0.9,
                        fontWeight: 700,
                        color: COLORS.skillsBlue
                      },
                      children: "Skills = Behavior"
                    }
                  )
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
          "div",
          {
            style: {
              position: "absolute",
              bottom: height * 0.25,
              left: "50%",
              transform: `translateX(-50%) translateY(${(0, import_remotion9.interpolate)(boxEntrance, [0, 1], [50, 0])}px)`,
              opacity: boxEntrance,
              width: width * 0.85
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                "div",
                {
                  style: {
                    textAlign: "center",
                    marginBottom: 24
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                    "span",
                    {
                      style: {
                        fontFamily: "system-ui, -apple-system, sans-serif",
                        fontSize: titleSize * 0.8,
                        fontWeight: 600,
                        color: COLORS.text
                      },
                      children: "Want to learn more about Skills?"
                    }
                  )
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                "div",
                {
                  style: {
                    padding: 24,
                    backgroundColor: "#FFFFFF",
                    borderRadius: 16,
                    border: `3px solid ${COLORS.skillsBlue}`,
                    boxShadow: `0 8px 32px ${COLORS.skillsBlue}20`
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
                    "div",
                    {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        gap: 16
                      },
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(CommentIcon, { size: 36, color: COLORS.skillsBlue }),
                        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
                          "div",
                          {
                            style: {
                              flex: 1,
                              padding: "16px 20px",
                              backgroundColor: COLORS.surface,
                              borderRadius: 12,
                              border: `2px solid ${COLORS.skillsBlue}30`,
                              display: "flex",
                              alignItems: "center"
                            },
                            children: [
                              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                                "span",
                                {
                                  style: {
                                    fontFamily: "system-ui, -apple-system, sans-serif",
                                    fontSize: bodySize,
                                    color: COLORS.textMuted
                                  },
                                  children: 'Comment "'
                                }
                              ),
                              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                                "span",
                                {
                                  style: {
                                    fontFamily: "system-ui, -apple-system, sans-serif",
                                    fontSize: bodySize,
                                    fontWeight: 700,
                                    color: COLORS.skillsBlue,
                                    backgroundColor: COLORS.skillsBlue + "20",
                                    padding: "4px 12px",
                                    borderRadius: 6,
                                    transform: `scale(${(0, import_remotion9.interpolate)(skillsHighlight, [0, 1], [0.9, 1])})`,
                                    display: "inline-block"
                                  },
                                  children: "skills"
                                }
                              ),
                              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                                "span",
                                {
                                  style: {
                                    fontFamily: "system-ui, -apple-system, sans-serif",
                                    fontSize: bodySize,
                                    color: COLORS.textMuted
                                  },
                                  children: '" for more info'
                                }
                              ),
                              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                                "div",
                                {
                                  style: {
                                    width: 2,
                                    height: bodySize * 1.2,
                                    backgroundColor: COLORS.skillsBlue,
                                    marginLeft: 4,
                                    opacity: cursorVisible ? 1 : 0
                                  }
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
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                "div",
                {
                  style: {
                    textAlign: "center",
                    marginTop: 20,
                    opacity: (0, import_remotion9.interpolate)(localFrame, [15, 25], [0, 1], {
                      extrapolateRight: "clamp",
                      extrapolateLeft: "clamp"
                    })
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                    "div",
                    {
                      style: {
                        display: "inline-block",
                        transform: `translateY(${localFrame % 20 < 10 ? 0 : 5}px)`,
                        transition: "transform 0.2s ease"
                      },
                      children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("svg", { width: "32", height: "32", viewBox: "0 0 24 24", fill: "none", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                        "path",
                        {
                          d: "M12 5v14M5 12l7 7 7-7",
                          stroke: COLORS.skillsBlue,
                          strokeWidth: "2.5",
                          strokeLinecap: "round",
                          strokeLinejoin: "round"
                        }
                      ) })
                    }
                  )
                }
              )
            ]
          }
        )
      ]
    }
  );
};

// src/proj_6be589ae_fdaf_4812_af39_c6124b5bc276/index.tsx
var import_jsx_runtime11 = require("react/jsx-runtime");
var MainComposition = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(import_remotion10.AbsoluteFill, { style: { backgroundColor: COLORS.background }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Background, {}, "bg"),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      import_remotion10.Sequence,
      {
        from: TIMING.scene1Start,
        durationInFrames: TIMING.scene1End - TIMING.scene1Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Scene1, { startFrame: 0 })
      },
      "scene1"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      import_remotion10.Sequence,
      {
        from: TIMING.scene2Start,
        durationInFrames: TIMING.scene2End - TIMING.scene2Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Scene2, { startFrame: 0 })
      },
      "scene2"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      import_remotion10.Sequence,
      {
        from: TIMING.scene3Start,
        durationInFrames: TIMING.scene3End - TIMING.scene3Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Scene3, { startFrame: 0 })
      },
      "scene3"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      import_remotion10.Sequence,
      {
        from: TIMING.scene4Start,
        durationInFrames: TIMING.scene4End - TIMING.scene4Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Scene4, { startFrame: 0 })
      },
      "scene4"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      import_remotion10.Sequence,
      {
        from: TIMING.scene5Start,
        durationInFrames: TIMING.scene5End - TIMING.scene5Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Scene5, { startFrame: 0 })
      },
      "scene5"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      import_remotion10.Sequence,
      {
        from: TIMING.scene6Start,
        durationInFrames: TIMING.scene6End - TIMING.scene6Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Scene6, { startFrame: 0 })
      },
      "scene6"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      import_remotion10.Sequence,
      {
        from: TIMING.scene7Start,
        durationInFrames: TIMING.scene7End - TIMING.scene7Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Scene7, { startFrame: 0 })
      },
      "scene7"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      import_remotion10.Sequence,
      {
        from: TIMING.scene8Start,
        durationInFrames: TIMING.scene8End - TIMING.scene8Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Scene8, { startFrame: 0 })
      },
      "scene8"
    )
  ] });
};
var RemotionRoot = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
    import_remotion10.Composition,
    {
      id: "proj-6be589ae-fdaf-4812-af39-c6124b5bc276",
      component: MainComposition,
      durationInFrames: TIMING.totalFrames,
      fps: TIMING.fps,
      width: TIMING.width,
      height: TIMING.height
    }
  );
};
var index_default = MainComposition;
