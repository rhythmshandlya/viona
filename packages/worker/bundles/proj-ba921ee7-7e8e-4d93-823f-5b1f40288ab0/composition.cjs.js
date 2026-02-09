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

// src/proj_ba921ee7_7e8e_4d93_823f_5b1f40288ab0/index.tsx
var index_exports = {};
__export(index_exports, {
  CheckIcon: () => CheckIcon,
  DataIcon: () => DataIcon,
  RemotionRoot: () => RemotionRoot,
  WarningIcon: () => WarningIcon,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_remotion = require("remotion");

// src/proj_ba921ee7_7e8e_4d93_823f_5b1f40288ab0/constants.ts
var COLORS = {
  primary: "#00f5d4",
  // Cyan - Skills, clean organization
  secondary: "#7b2cbf",
  // Purple - MCP servers, powerful but heavy
  accent: "#f72585",
  // Magenta - Highlights, key moments
  background: "#0a0a0f",
  // Dark - Background, contrast
  success: "#00b894",
  // Mint - Benefits, positive outcomes
  warning: "#fdcb6e",
  // Gold - Performance issues, trade-offs
  white: "#ffffff",
  dimmed: "rgba(123, 44, 191, 0.3)"
  // Dimmed purple for inactive states
};
var SPRING_CONFIG = { damping: 22, stiffness: 90, mass: 0.9 };
var TIMING = {
  scene1: { start: 0, end: 118 },
  scene2: { start: 118, end: 445 },
  scene3: { start: 445, end: 763 },
  scene4: { start: 763, end: 1083 },
  scene5: { start: 1083, end: 1373 },
  scene6: { start: 1373, end: 1928 },
  scene7: { start: 1928, end: 2030 },
  scene8: { start: 2030, end: 2208 }
};
var KEY_SYNCS = {
  scene1_skill: 87,
  // "skill" - First skill book materializes
  scene2_just: 135,
  // "just" - Folder opens simply
  scene3_instead: 610,
  // "instead" - Selective loading contrast
  scene4_all: 924,
  // "all" - Everything floods workspace
  scene5_but: 1314,
  // "But" - Performance meters turn red
  scene6_access: 1457,
  // "access" - Google Drive tools light up
  scene7_gives: 1947,
  // "gives" - Labels animate in
  scene8_skills: 2179
  // "skills" - CTA text glows
};
var VIDEO_CONFIG = {
  fps: 30,
  width: 1080,
  height: 1920,
  durationInFrames: 2208
};

// src/proj_ba921ee7_7e8e_4d93_823f_5b1f40288ab0/index.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var FolderIcon = ({
  size = 40,
  color = COLORS.primary
}) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: color, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" }) });
var ServerIcon = ({
  size = 40,
  color = COLORS.secondary
}) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: color, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 1h16c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V3c0-1.1.9-2 2-2zm0 8h16c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2v-4c0-1.1.9-2 2-2zm0 8h16c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2v-4c0-1.1.9-2 2-2zm1 3h2v2H5v-2zm0-8h2v2H5v-2zm0-8h2v2H5V4z" }) });
var CheckIcon = ({
  size = 24,
  color = COLORS.success
}) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: color, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" }) });
var WarningIcon = ({
  size = 24,
  color = COLORS.warning
}) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: color, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" }) });
var DataIcon = ({
  size = 24,
  color = COLORS.primary
}) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: color, children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ellipse", { cx: "12", cy: "5", rx: "8", ry: "3" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5c0 1.66-3.58 3-8 3S4 6.66 4 5z" }),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6c0 1.66-3.58 3-8 3s-8-1.34-8-3z" })
] });
var AnimatedBackground = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height } = (0, import_remotion.useVideoConfig)();
  const gradientOffset = frame * 0.5 % 360;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_remotion.AbsoluteFill,
    {
      style: {
        background: `
          linear-gradient(
            ${135 + gradientOffset * 0.1}deg,
            ${COLORS.background} 0%,
            #0f0a1a 50%,
            ${COLORS.background} 100%
          )
        `
      },
      children: Array.from({ length: 20 }).map((_, i) => {
        const x = (frame * 0.3 + i * 60) % (width + 40) - 20;
        const y = height * 0.3 + Math.sin(frame * 0.02 + i * 0.5) * 100 + i * 80 % height;
        const opacity = 0.1 + i % 3 * 0.05;
        const size = 3 + i % 4;
        return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: x,
              top: y % height,
              width: size,
              height: size,
              borderRadius: "50%",
              background: i % 2 === 0 ? COLORS.primary : COLORS.secondary,
              opacity
            }
          },
          `particle-${i}`
        );
      })
    }
  );
};
var SkillBook = ({ delay, label, index, triggerFrame }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const effectiveFrame = frame - triggerFrame - delay;
  if (effectiveFrame < 0) return null;
  const scale = (0, import_remotion.spring)({
    frame: effectiveFrame,
    fps,
    config: SPRING_CONFIG
  });
  const glow = (0, import_remotion.interpolate)(
    Math.sin(frame * 0.1 + index),
    [-1, 1],
    [0, 15]
  );
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 16px",
        background: "rgba(0, 245, 212, 0.1)",
        borderRadius: 8,
        border: `1px solid ${COLORS.primary}40`,
        transform: `scale(${scale})`,
        opacity: scale,
        boxShadow: `0 0 ${glow}px ${COLORS.primary}50`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderIcon, { size: 28, color: COLORS.primary }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
          color: COLORS.white,
          fontSize: 16,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 500
        }, children: label })
      ]
    }
  );
};
var ClutteredTool = ({ delay, label, x, y, rotation }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const effectiveFrame = frame - 50 - delay;
  if (effectiveFrame < 0) return null;
  const scale = (0, import_remotion.spring)({
    frame: effectiveFrame,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 70 }
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        padding: "8px 12px",
        background: "rgba(123, 44, 191, 0.15)",
        borderRadius: 6,
        border: `1px solid ${COLORS.secondary}40`,
        transform: `scale(${scale}) rotate(${rotation}deg)`,
        opacity: scale * 0.9,
        boxShadow: `0 4px 12px ${COLORS.secondary}30`
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
        color: COLORS.secondary,
        fontSize: 12,
        fontFamily: "Inter, system-ui, sans-serif",
        fontWeight: 500,
        whiteSpace: "nowrap"
      }, children: label })
    }
  );
};
var GradientTitle = ({ text, startFrame }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const progress = (0, import_remotion.spring)({
    frame: frame - startFrame,
    fps,
    config: SPRING_CONFIG
  });
  const gradientOffset = frame * 2;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        fontSize: 72,
        fontFamily: "Inter, system-ui, sans-serif",
        fontWeight: 800,
        background: `linear-gradient(${90 + gradientOffset}deg, ${COLORS.primary}, ${COLORS.accent}, ${COLORS.secondary})`,
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        transform: `scale(${progress}) translateY(${(1 - progress) * 30}px)`,
        opacity: progress,
        textAlign: "center"
      },
      children: text
    }
  );
};
var AIAgentSilhouette = ({ startFrame }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const progress = (0, import_remotion.spring)({
    frame: frame - startFrame - 20,
    fps,
    config: SPRING_CONFIG
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transform: `translateY(${(1 - progress) * 50}px)`,
        opacity: progress
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${COLORS.primary}40, ${COLORS.secondary}40)`,
              border: `2px solid ${COLORS.white}30`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "div",
              {
                style: {
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`
                }
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
          marginTop: 12,
          color: COLORS.white,
          fontSize: 14,
          fontFamily: "Inter, system-ui, sans-serif",
          opacity: 0.7
        }, children: "AI Agent" })
      ]
    }
  );
};
var Scene1 = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const keyTriggerFrame = KEY_SYNCS.scene1_skill;
  const skillBooks = [
    "Frontend Design",
    "API Patterns",
    "Testing Guide",
    "TypeScript Tips"
  ];
  const mcpTools = [
    { label: "Google Drive", x: 10, y: 15, rotation: -5, delay: 0 },
    { label: "Database API", x: 55, y: 25, rotation: 8, delay: 6 },
    { label: "File Ops", x: 20, y: 50, rotation: -3, delay: 12 },
    { label: "Auth API", x: 50, y: 60, rotation: 12, delay: 18 },
    { label: "Analytics", x: 15, y: 80, rotation: -8, delay: 24 },
    { label: "Storage", x: 60, y: 75, rotation: 5, delay: 30 }
  ];
  const dividerProgress = (0, import_remotion.spring)({
    frame: frame - 10,
    fps,
    config: SPRING_CONFIG
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "10%",
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GradientTitle, { text: "Skills vs MCP?", startFrame: 5 })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: "22%",
          left: "5%",
          right: "5%",
          height: "55%",
          display: "flex",
          gap: 20
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "div",
            {
              style: {
                flex: 1,
                background: "rgba(0, 245, 212, 0.05)",
                borderRadius: 20,
                border: `1px solid ${COLORS.primary}30`,
                padding: 24,
                display: "flex",
                flexDirection: "column",
                gap: 16
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 8
                }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderIcon, { size: 32, color: COLORS.primary }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
                    color: COLORS.primary,
                    fontSize: 22,
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontWeight: 700
                  }, children: "Skills" })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
                  display: "flex",
                  flexDirection: "column",
                  gap: 12
                }, children: skillBooks.map((label, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  SkillBook,
                  {
                    label,
                    delay: i * 8,
                    index: i,
                    triggerFrame: keyTriggerFrame
                  },
                  label
                )) })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                width: 3,
                background: `linear-gradient(180deg, ${COLORS.primary}, ${COLORS.accent}, ${COLORS.secondary})`,
                borderRadius: 2,
                transform: `scaleY(${dividerProgress})`,
                opacity: dividerProgress
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "div",
            {
              style: {
                flex: 1,
                background: "rgba(123, 44, 191, 0.05)",
                borderRadius: 20,
                border: `1px solid ${COLORS.secondary}30`,
                padding: 24,
                position: "relative",
                overflow: "hidden"
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 8
                }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ServerIcon, { size: 32, color: COLORS.secondary }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
                    color: COLORS.secondary,
                    fontSize: 22,
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontWeight: 700
                  }, children: "MCP" })
                ] }),
                mcpTools.map((tool) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  ClutteredTool,
                  {
                    label: tool.label,
                    x: tool.x,
                    y: tool.y,
                    rotation: tool.rotation,
                    delay: tool.delay
                  },
                  tool.label
                ))
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
          position: "absolute",
          bottom: "8%",
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AIAgentSilhouette, { startFrame: 30 })
      }
    )
  ] });
};
var FilingDrawer = ({ label, isSelected, delay, openProgress }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const entranceProgress = (0, import_remotion.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG
  });
  const glowIntensity = isSelected ? (0, import_remotion.interpolate)(Math.sin(frame * 0.15), [-1, 1], [10, 25]) : 0;
  const drawerOpen = isSelected ? openProgress * 20 : 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "16px 20px",
        background: isSelected ? "rgba(0, 245, 212, 0.15)" : "rgba(255, 255, 255, 0.05)",
        borderRadius: 12,
        border: `2px solid ${isSelected ? COLORS.primary : COLORS.white + "20"}`,
        transform: `scale(${entranceProgress}) translateX(${drawerOpen}px)`,
        opacity: entranceProgress,
        boxShadow: isSelected ? `0 0 ${glowIntensity}px ${COLORS.primary}80, inset 0 0 20px ${COLORS.primary}20` : "none",
        transition: "border-color 0.3s, background 0.3s"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderIcon, { size: 32, color: isSelected ? COLORS.primary : COLORS.white + "60" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
          color: isSelected ? COLORS.primary : COLORS.white,
          fontSize: 20,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: isSelected ? 700 : 500
        }, children: label }),
        isSelected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
          marginLeft: "auto",
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: COLORS.primary,
          boxShadow: `0 0 10px ${COLORS.primary}`
        } })
      ]
    }
  );
};
var AIAgentReaching = ({ progress }) => {
  const reachY = (0, import_remotion.interpolate)(progress, [0, 1], [0, -80], { extrapolateRight: "clamp" });
  const reachX = (0, import_remotion.interpolate)(progress, [0, 1], [0, -20], { extrapolateRight: "clamp" });
  const armExtend = (0, import_remotion.interpolate)(progress, [0, 0.5, 1], [0, 0, 30], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transform: `translate(${reachX}px, ${reachY}px)`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: -20,
              width: 4,
              height: armExtend,
              background: `linear-gradient(180deg, ${COLORS.primary}80, transparent)`,
              borderRadius: 2
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              width: 100,
              height: 100,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${COLORS.primary}50, ${COLORS.secondary}50)`,
              border: `3px solid ${COLORS.white}40`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 10px 40px ${COLORS.primary}30`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "div",
              {
                style: {
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`
                }
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
          marginTop: 12,
          color: COLORS.white,
          fontSize: 16,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 600
        }, children: "AI Agent" })
      ]
    }
  );
};
var Scene2 = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const keyTriggerFrame = KEY_SYNCS.scene2_just - TIMING.scene2.start;
  const folders = [
    { label: "Frontend Design", isSelected: true },
    { label: "API Best Practices", isSelected: false },
    { label: "Testing Strategies", isSelected: false },
    { label: "Code Reviews", isSelected: false },
    { label: "Documentation", isSelected: false }
  ];
  const cabinetProgress = (0, import_remotion.spring)({
    frame,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 60 }
  });
  const folderOpenProgress = (0, import_remotion.spring)({
    frame: frame - keyTriggerFrame,
    fps,
    config: SPRING_CONFIG
  });
  const reachProgress = (0, import_remotion.interpolate)(
    frame,
    [keyTriggerFrame, keyTriggerFrame + 45],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const titleProgress = (0, import_remotion.spring)({
    frame: frame - 5,
    fps,
    config: SPRING_CONFIG
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "8%",
          left: 0,
          right: 0,
          textAlign: "center",
          transform: `translateY(${(1 - titleProgress) * 30}px)`,
          opacity: titleProgress
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
          fontSize: 48,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 800,
          color: COLORS.primary,
          textShadow: `0 0 30px ${COLORS.primary}50`
        }, children: "Skills: Organized Knowledge" })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "14%",
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: (0, import_remotion.interpolate)(frame, [20, 40], [0, 0.7], { extrapolateRight: "clamp" })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
          fontSize: 22,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 400,
          color: COLORS.white
        }, children: "Pick what you need, when you need it" })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: "20%",
          left: "10%",
          right: "10%",
          height: "50%",
          background: "rgba(0, 245, 212, 0.05)",
          borderRadius: 24,
          border: `2px solid ${COLORS.primary}30`,
          padding: 28,
          transform: `scale(${cabinetProgress})`,
          opacity: cabinetProgress,
          boxShadow: `0 20px 60px rgba(0, 0, 0, 0.4), inset 0 0 40px ${COLORS.primary}10`,
          backdropFilter: "blur(10px)",
          display: "flex",
          flexDirection: "column",
          gap: 16
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 8,
            paddingBottom: 16,
            borderBottom: `1px solid ${COLORS.primary}30`
          }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderIcon, { size: 36, color: COLORS.primary }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
              color: COLORS.white,
              fontSize: 24,
              fontFamily: "Inter, system-ui, sans-serif",
              fontWeight: 700
            }, children: "Skill Library" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
            display: "flex",
            flexDirection: "column",
            gap: 12,
            overflow: "hidden"
          }, children: folders.map((folder, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            FilingDrawer,
            {
              label: folder.label,
              isSelected: folder.isSelected,
              delay: 15 + i * 8,
              openProgress: folder.isSelected ? folderOpenProgress : 0
            },
            folder.label
          )) })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "10%",
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AIAgentReaching, { progress: reachProgress })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          right: "5%",
          top: "22%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          opacity: (0, import_remotion.interpolate)(frame, [30, 50], [0, 1], { extrapolateRight: "clamp" })
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
            fontSize: 12,
            color: COLORS.white,
            fontFamily: "Inter, system-ui, sans-serif",
            opacity: 0.7
          }, children: "Context" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
            width: 24,
            height: 120,
            background: "rgba(255, 255, 255, 0.1)",
            borderRadius: 12,
            overflow: "hidden",
            border: `1px solid ${COLORS.white}20`
          }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "20%",
            background: `linear-gradient(180deg, ${COLORS.success}, ${COLORS.primary})`,
            borderRadius: "0 0 12px 12px"
          } }) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
            fontSize: 14,
            color: COLORS.success,
            fontFamily: "Inter, system-ui, sans-serif",
            fontWeight: 600
          }, children: "20%" })
        ]
      }
    )
  ] });
};
var LoadingParticles = ({ targetY, active }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width } = (0, import_remotion.useVideoConfig)();
  if (!active) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: Array.from({ length: 12 }).map((_, i) => {
    const startX = width * 0.2 + i * 50;
    const progress = (frame * 3 + i * 30) % 150 / 150;
    const x = (0, import_remotion.interpolate)(progress, [0, 1], [startX, width * 0.5], { extrapolateRight: "clamp" });
    const y = (0, import_remotion.interpolate)(progress, [0, 1], [targetY + 200, targetY], { extrapolateRight: "clamp" });
    const opacity = (0, import_remotion.interpolate)(progress, [0, 0.3, 0.7, 1], [0, 1, 1, 0], { extrapolateRight: "clamp" });
    const size = 6 + i % 3 * 2;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: "50%",
          background: COLORS.primary,
          opacity,
          boxShadow: `0 0 8px ${COLORS.primary}`
        }
      },
      `loading-particle-${i}`
    );
  }) });
};
var FolderSection = ({ title, content, isActive, delay, color }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const entranceProgress = (0, import_remotion.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG
  });
  const glowIntensity = isActive ? (0, import_remotion.interpolate)(Math.sin(frame * 0.1), [-1, 1], [5, 20]) : 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        padding: 24,
        background: isActive ? `${color}15` : "rgba(255, 255, 255, 0.03)",
        borderRadius: 16,
        border: `2px solid ${isActive ? color : COLORS.white + "15"}`,
        transform: `scale(${entranceProgress})`,
        opacity: isActive ? entranceProgress : entranceProgress * 0.4,
        boxShadow: isActive ? `0 0 ${glowIntensity}px ${color}60` : "none"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16
        }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: isActive ? color : COLORS.white + "30",
            boxShadow: isActive ? `0 0 10px ${color}` : "none"
          } }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
            fontSize: 22,
            fontWeight: 700,
            color: isActive ? color : COLORS.white + "50",
            fontFamily: "Inter, system-ui, sans-serif"
          }, children: title }),
          isActive && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
            marginLeft: "auto",
            fontSize: 14,
            color: COLORS.success,
            fontFamily: "Inter, system-ui, sans-serif",
            background: `${COLORS.success}20`,
            padding: "4px 12px",
            borderRadius: 20
          }, children: "Loaded" }),
          !isActive && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
            marginLeft: "auto",
            fontSize: 14,
            color: COLORS.white + "40",
            fontFamily: "Inter, system-ui, sans-serif"
          }, children: "On-demand" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
          display: "flex",
          flexDirection: "column",
          gap: 8
        }, children: content.map((item, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              fontSize: 16,
              color: isActive ? COLORS.white : COLORS.white + "30",
              fontFamily: "Inter, system-ui, sans-serif",
              padding: "8px 12px",
              background: isActive ? "rgba(255, 255, 255, 0.05)" : "transparent",
              borderRadius: 8,
              opacity: (0, import_remotion.interpolate)(
                frame - delay - 10 - i * 6,
                [0, 15],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
              )
            },
            children: item
          },
          item
        )) })
      ]
    }
  );
};
var Scene3 = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const keyTriggerFrame = KEY_SYNCS.scene3_instead - TIMING.scene3.start;
  const titleProgress = (0, import_remotion.spring)({
    frame: frame - 5,
    fps,
    config: SPRING_CONFIG
  });
  const containerProgress = (0, import_remotion.spring)({
    frame: frame - 15,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 60 }
  });
  const contrastProgress = (0, import_remotion.spring)({
    frame: frame - keyTriggerFrame,
    fps,
    config: SPRING_CONFIG
  });
  const frontMatterContent = [
    'name: "Frontend Design"',
    'description: "Best practices for UI/UX"'
  ];
  const bodyContent = [
    "Component architecture patterns",
    "State management strategies",
    "Performance optimization tips",
    "Accessibility guidelines"
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "6%",
          left: 0,
          right: 0,
          textAlign: "center",
          transform: `translateY(${(1 - titleProgress) * 30}px)`,
          opacity: titleProgress
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
          fontSize: 42,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 800,
          color: COLORS.primary,
          textShadow: `0 0 30px ${COLORS.primary}50`
        }, children: "Two-Part Structure" })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "12%",
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: (0, import_remotion.interpolate)(frame, [20, 40], [0, 0.7], { extrapolateRight: "clamp" })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
          fontSize: 20,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 400,
          color: COLORS.white
        }, children: "Load only what you need, when you need it" })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: "18%",
          left: "8%",
          right: "8%",
          height: "55%",
          background: "rgba(0, 245, 212, 0.05)",
          borderRadius: 24,
          border: `2px solid ${COLORS.primary}30`,
          padding: 24,
          transform: `scale(${containerProgress})`,
          opacity: containerProgress,
          boxShadow: `0 20px 60px rgba(0, 0, 0, 0.4)`,
          display: "flex",
          flexDirection: "column",
          gap: 20
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
            display: "flex",
            alignItems: "center",
            gap: 12,
            paddingBottom: 16,
            borderBottom: `1px solid ${COLORS.primary}30`
          }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderIcon, { size: 32, color: COLORS.primary }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
              color: COLORS.white,
              fontSize: 22,
              fontFamily: "Inter, system-ui, sans-serif",
              fontWeight: 700
            }, children: "Frontend Design Skill" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            FolderSection,
            {
              title: "Front Matter",
              content: frontMatterContent,
              isActive: true,
              delay: 25,
              color: COLORS.primary
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            FolderSection,
            {
              title: "Body",
              content: bodyContent,
              isActive: false,
              delay: 40,
              color: COLORS.secondary
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoadingParticles, { targetY: 380, active: frame > 30 && frame < 120 }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          right: "5%",
          top: "20%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          opacity: (0, import_remotion.interpolate)(frame, [30, 50], [0, 1], { extrapolateRight: "clamp" })
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
            fontSize: 12,
            color: COLORS.white,
            fontFamily: "Inter, system-ui, sans-serif",
            opacity: 0.7
          }, children: "Context" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
            width: 28,
            height: 140,
            background: "rgba(255, 255, 255, 0.1)",
            borderRadius: 14,
            overflow: "hidden",
            border: `1px solid ${COLORS.white}20`,
            position: "relative"
          }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "15%",
            background: `linear-gradient(180deg, ${COLORS.success}, ${COLORS.primary})`,
            borderRadius: "0 0 14px 14px"
          } }) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
            fontSize: 16,
            color: COLORS.success,
            fontFamily: "Inter, system-ui, sans-serif",
            fontWeight: 700
          }, children: "15%" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
            fontSize: 11,
            color: COLORS.success,
            fontFamily: "Inter, system-ui, sans-serif",
            opacity: 0.8
          }, children: "Efficient" })
        ]
      }
    ),
    frame >= keyTriggerFrame && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "12%",
          left: "10%",
          right: "10%",
          display: "flex",
          justifyContent: "center",
          gap: 40,
          transform: `translateY(${(1 - contrastProgress) * 30}px)`,
          opacity: contrastProgress
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
            padding: "16px 24px",
            background: `${COLORS.primary}20`,
            borderRadius: 16,
            border: `2px solid ${COLORS.primary}`,
            textAlign: "center"
          }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
            fontSize: 18,
            color: COLORS.primary,
            fontFamily: "Inter, system-ui, sans-serif",
            fontWeight: 700
          }, children: "Skills: Load on demand" }) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
            padding: "16px 24px",
            background: `${COLORS.secondary}20`,
            borderRadius: 16,
            border: `2px solid ${COLORS.secondary}50`,
            textAlign: "center",
            opacity: 0.6
          }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
            fontSize: 18,
            color: COLORS.secondary,
            fontFamily: "Inter, system-ui, sans-serif",
            fontWeight: 700
          }, children: "vs. Load everything" }) })
        ]
      }
    )
  ] });
};
var MCPServer = ({ progress, pulsePhase }) => {
  const glowIntensity = (0, import_remotion.interpolate)(Math.sin(pulsePhase * 0.15), [-1, 1], [15, 35]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        width: 280,
        height: 200,
        background: `linear-gradient(180deg, ${COLORS.secondary}30, ${COLORS.secondary}10)`,
        borderRadius: 20,
        border: `3px solid ${COLORS.secondary}`,
        transform: `scale(${progress})`,
        opacity: progress,
        boxShadow: `0 0 ${glowIntensity}px ${COLORS.secondary}, inset 0 0 30px ${COLORS.secondary}20`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        position: "relative",
        overflow: "hidden"
      },
      children: [
        [0, 1, 2].map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "div",
          {
            style: {
              width: "80%",
              height: 30,
              background: `${COLORS.secondary}40`,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              padding: "0 12px",
              gap: 8
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: COLORS.accent,
                boxShadow: `0 0 8px ${COLORS.accent}`
              } }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
                flex: 1,
                height: 4,
                background: `${COLORS.white}20`,
                borderRadius: 2
              } })
            ]
          },
          `rack-${i}`
        )),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
          position: "absolute",
          bottom: 10,
          fontSize: 14,
          color: COLORS.secondary,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 700
        }, children: "MCP Server" })
      ]
    }
  );
};
var FloodingTool = ({ label, delay, targetX, targetY, rotation, floodTriggered }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  if (!floodTriggered) return null;
  const fallProgress = (0, import_remotion.spring)({
    frame: frame - delay,
    fps,
    config: { damping: 15, stiffness: 50, mass: 1.2 }
  });
  const x = (0, import_remotion.interpolate)(fallProgress, [0, 1], [50, targetX], { extrapolateRight: "clamp" });
  const y = (0, import_remotion.interpolate)(fallProgress, [0, 1], [-20, targetY], { extrapolateRight: "clamp" });
  const rot = (0, import_remotion.interpolate)(fallProgress, [0, 0.5, 1], [0, rotation * 2, rotation], { extrapolateRight: "clamp" });
  const scale = (0, import_remotion.interpolate)(fallProgress, [0, 0.3, 1], [0.3, 1.2, 1], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        padding: "10px 16px",
        background: `${COLORS.secondary}25`,
        borderRadius: 10,
        border: `2px solid ${COLORS.secondary}60`,
        transform: `rotate(${rot}deg) scale(${scale})`,
        opacity: fallProgress,
        boxShadow: `0 4px 20px ${COLORS.secondary}40`
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
        color: COLORS.white,
        fontSize: 14,
        fontFamily: "Inter, system-ui, sans-serif",
        fontWeight: 600,
        whiteSpace: "nowrap"
      }, children: label })
    }
  );
};
var FloodParticles = ({ active }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  if (!active) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: Array.from({ length: 25 }).map((_, i) => {
    const startX = 40 + i % 5 * 5;
    const speed = 3 + i % 4;
    const progress = (frame * speed + i * 20) % 200 / 200;
    const x = startX + Math.sin(i * 0.5) * 10;
    const y = (0, import_remotion.interpolate)(progress, [0, 1], [20, 80], { extrapolateRight: "clamp" });
    const opacity = (0, import_remotion.interpolate)(progress, [0, 0.2, 0.8, 1], [0, 0.8, 0.8, 0], { extrapolateRight: "clamp" });
    const size = 4 + i % 3 * 2;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: `${x}%`,
          top: `${y}%`,
          width: size,
          height: size,
          borderRadius: "50%",
          background: i % 2 === 0 ? COLORS.secondary : COLORS.accent,
          opacity,
          boxShadow: `0 0 6px ${i % 2 === 0 ? COLORS.secondary : COLORS.accent}`
        }
      },
      `flood-particle-${i}`
    );
  }) });
};
var Scene4 = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const keyTriggerFrame = KEY_SYNCS.scene4_all - TIMING.scene4.start;
  const floodTriggered = frame >= keyTriggerFrame;
  const serverProgress = (0, import_remotion.spring)({
    frame: frame - 10,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 60 }
  });
  const titleProgress = (0, import_remotion.spring)({
    frame: frame - 5,
    fps,
    config: SPRING_CONFIG
  });
  const contextFill = floodTriggered ? (0, import_remotion.interpolate)(frame - keyTriggerFrame, [0, 60], [20, 85], { extrapolateRight: "clamp" }) : 20;
  const tools = [
    { label: "Google Drive API", targetX: 15, targetY: 55, rotation: -8, delay: 0 },
    { label: "File Operations", targetX: 65, targetY: 50, rotation: 12, delay: 6 },
    { label: "Database Access", targetX: 25, targetY: 70, rotation: -5, delay: 12 },
    { label: "Auth Provider", targetX: 55, targetY: 65, rotation: 15, delay: 18 },
    { label: "Analytics SDK", targetX: 10, targetY: 80, rotation: -12, delay: 24 },
    { label: "Storage API", targetX: 70, targetY: 75, rotation: 8, delay: 30 },
    { label: "Email Service", targetX: 40, targetY: 58, rotation: -3, delay: 36 },
    { label: "Payment Gateway", targetX: 30, targetY: 85, rotation: 10, delay: 42 },
    { label: "Notification API", targetX: 60, targetY: 82, rotation: -7, delay: 48 }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "5%",
          left: 0,
          right: 0,
          textAlign: "center",
          transform: `translateY(${(1 - titleProgress) * 30}px)`,
          opacity: titleProgress
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
          fontSize: 42,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 800,
          color: COLORS.secondary,
          textShadow: `0 0 30px ${COLORS.secondary}50`
        }, children: "MCP: Everything at Once" })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "11%",
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: (0, import_remotion.interpolate)(frame, [20, 40], [0, 0.7], { extrapolateRight: "clamp" })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
          fontSize: 20,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 400,
          color: COLORS.white
        }, children: "All tools loaded into context immediately" })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "16%",
          left: "50%",
          transform: "translateX(-50%)"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MCPServer, { progress: serverProgress, pulsePhase: frame })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "42%",
          left: "5%",
          right: "5%",
          bottom: "12%",
          background: "rgba(123, 44, 191, 0.05)",
          borderRadius: 24,
          border: `2px solid ${COLORS.secondary}30`,
          overflow: "hidden"
        },
        children: tools.map((tool) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          FloodingTool,
          {
            label: tool.label,
            delay: tool.delay,
            targetX: tool.targetX,
            targetY: tool.targetY,
            rotation: tool.rotation,
            floodTriggered
          },
          tool.label
        ))
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FloodParticles, { active: floodTriggered }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          right: "4%",
          top: "18%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          opacity: (0, import_remotion.interpolate)(frame, [30, 50], [0, 1], { extrapolateRight: "clamp" })
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
            fontSize: 12,
            color: COLORS.white,
            fontFamily: "Inter, system-ui, sans-serif",
            opacity: 0.7
          }, children: "Context" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
            width: 28,
            height: 160,
            background: "rgba(255, 255, 255, 0.1)",
            borderRadius: 14,
            overflow: "hidden",
            border: `1px solid ${contextFill > 70 ? COLORS.warning : COLORS.white}20`,
            position: "relative"
          }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: `${contextFill}%`,
            background: contextFill > 70 ? `linear-gradient(180deg, ${COLORS.warning}, ${COLORS.accent})` : `linear-gradient(180deg, ${COLORS.secondary}, ${COLORS.accent})`,
            borderRadius: "0 0 14px 14px",
            transition: "height 0.1s"
          } }) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: {
            fontSize: 16,
            color: contextFill > 70 ? COLORS.warning : COLORS.secondary,
            fontFamily: "Inter, system-ui, sans-serif",
            fontWeight: 700
          }, children: [
            Math.round(contextFill),
            "%"
          ] }),
          contextFill > 70 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
            fontSize: 11,
            color: COLORS.warning,
            fontFamily: "Inter, system-ui, sans-serif",
            opacity: 0.9
          }, children: "Heavy" })
        ]
      }
    ),
    floodTriggered && frame > keyTriggerFrame + 30 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "5%",
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: (0, import_remotion.interpolate)(frame - keyTriggerFrame - 30, [0, 20], [0, 1], { extrapolateRight: "clamp" })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
          fontSize: 24,
          color: COLORS.warning,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 700,
          textShadow: `0 0 20px ${COLORS.warning}50`
        }, children: "Everything loaded at startup" })
      }
    )
  ] });
};
var PerformanceBar = ({ label, value, maxValue, color, delay, isWarning }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const entranceProgress = (0, import_remotion.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG
  });
  const fillPercent = value / maxValue * 100;
  const shake = isWarning ? Math.sin(frame * 0.5) * 2 : 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 6,
        transform: `scale(${entranceProgress}) translateX(${shake}px)`,
        opacity: entranceProgress
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
            fontSize: 14,
            color: COLORS.white,
            fontFamily: "Inter, system-ui, sans-serif",
            fontWeight: 500
          }, children: label }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: {
            fontSize: 14,
            color: isWarning ? COLORS.warning : color,
            fontFamily: "Inter, system-ui, sans-serif",
            fontWeight: 700
          }, children: [
            value,
            "%"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
          height: 12,
          background: "rgba(255, 255, 255, 0.1)",
          borderRadius: 6,
          overflow: "hidden",
          border: `1px solid ${isWarning ? COLORS.warning : COLORS.white}20`
        }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
          height: "100%",
          width: `${fillPercent}%`,
          background: isWarning ? `linear-gradient(90deg, ${COLORS.warning}, ${COLORS.accent})` : `linear-gradient(90deg, ${color}, ${color}80)`,
          borderRadius: 6,
          boxShadow: isWarning ? `0 0 10px ${COLORS.warning}` : "none"
        } }) })
      ]
    }
  );
};
var StressedAgent = ({ stressLevel }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const shake = stressLevel > 0.5 ? Math.sin(frame * 0.8) * 3 : 0;
  const swirl = stressLevel > 0.7;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transform: `translateX(${shake}px)`,
        position: "relative"
      },
      children: [
        swirl && Array.from({ length: 8 }).map((_, i) => {
          const angle = frame * 0.05 + i * (Math.PI / 4);
          const radius = 70 + Math.sin(frame * 0.1 + i) * 10;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: `calc(50% + ${x}px)`,
                top: `calc(50% + ${y}px)`,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: i % 2 === 0 ? COLORS.secondary : COLORS.accent,
                opacity: 0.7,
                transform: "translate(-50%, -50%)"
              }
            },
            `swirl-${i}`
          );
        }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              width: 120,
              height: 120,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${COLORS.warning}40, ${COLORS.accent}40)`,
              border: `3px solid ${stressLevel > 0.5 ? COLORS.warning : COLORS.white}50`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: stressLevel > 0.5 ? `0 0 30px ${COLORS.warning}40` : `0 10px 40px rgba(0,0,0,0.3)`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "div",
              {
                style: {
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${COLORS.warning}, ${COLORS.accent})`,
                  opacity: stressLevel > 0.5 ? 0.8 : 1
                }
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
          marginTop: 12,
          color: stressLevel > 0.5 ? COLORS.warning : COLORS.white,
          fontSize: 16,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 600
        }, children: stressLevel > 0.5 ? "Overloaded!" : "AI Agent" })
      ]
    }
  );
};
var ComparisonCard = ({ title, percentage, color, isGood, delay }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const progress = (0, import_remotion.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        flex: 1,
        padding: 20,
        background: `${color}15`,
        borderRadius: 16,
        border: `2px solid ${color}60`,
        transform: `scale(${progress})`,
        opacity: progress,
        textAlign: "center"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
          fontSize: 18,
          color: COLORS.white,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 600,
          marginBottom: 12
        }, children: title }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
          fontSize: 48,
          color,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 800,
          marginBottom: 8
        }, children: [
          percentage,
          "%"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
          fontSize: 14,
          color: isGood ? COLORS.success : COLORS.warning,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 500
        }, children: isGood ? "Efficient" : "Heavy load" })
      ]
    }
  );
};
var Scene5 = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const keyTriggerFrame = KEY_SYNCS.scene5_but - TIMING.scene5.start;
  const warningTriggered = frame >= keyTriggerFrame;
  const titleProgress = (0, import_remotion.spring)({
    frame: frame - 5,
    fps,
    config: SPRING_CONFIG
  });
  const stressLevel = (0, import_remotion.interpolate)(
    frame,
    [0, keyTriggerFrame, keyTriggerFrame + 30],
    [0.3, 0.7, 0.9],
    { extrapolateRight: "clamp" }
  );
  const cpuUsage = warningTriggered ? (0, import_remotion.interpolate)(frame - keyTriggerFrame, [0, 30], [65, 92], { extrapolateRight: "clamp" }) : 65;
  const memoryUsage = warningTriggered ? (0, import_remotion.interpolate)(frame - keyTriggerFrame, [0, 30], [70, 88], { extrapolateRight: "clamp" }) : 70;
  const responseTime = warningTriggered ? (0, import_remotion.interpolate)(frame - keyTriggerFrame, [0, 30], [45, 78], { extrapolateRight: "clamp" }) : 45;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "5%",
          left: 0,
          right: 0,
          textAlign: "center",
          transform: `translateY(${(1 - titleProgress) * 30}px)`,
          opacity: titleProgress
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
          fontSize: 42,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 800,
          color: warningTriggered ? COLORS.warning : COLORS.secondary,
          textShadow: `0 0 30px ${warningTriggered ? COLORS.warning : COLORS.secondary}50`
        }, children: warningTriggered ? "The Trade-off" : "Context Usage" })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "11%",
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: (0, import_remotion.interpolate)(frame, [20, 40], [0, 0.7], { extrapolateRight: "clamp" })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
          fontSize: 20,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 400,
          color: warningTriggered ? COLORS.warning : COLORS.white
        }, children: warningTriggered ? "Performance degrades with context overload" : "More context = more resource usage" })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          left: "8%",
          top: "18%",
          width: "25%",
          display: "flex",
          flexDirection: "column",
          gap: 20
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
            fontSize: 16,
            color: COLORS.white,
            fontFamily: "Inter, system-ui, sans-serif",
            fontWeight: 700,
            marginBottom: 8
          }, children: "System Performance" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            PerformanceBar,
            {
              label: "CPU Usage",
              value: Math.round(cpuUsage),
              maxValue: 100,
              color: COLORS.secondary,
              delay: 15,
              isWarning: cpuUsage > 80
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            PerformanceBar,
            {
              label: "Memory",
              value: Math.round(memoryUsage),
              maxValue: 100,
              color: COLORS.accent,
              delay: 25,
              isWarning: memoryUsage > 80
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            PerformanceBar,
            {
              label: "Response Time",
              value: Math.round(responseTime),
              maxValue: 100,
              color: COLORS.warning,
              delay: 35,
              isWarning: responseTime > 60
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
          top: "30%",
          left: "50%",
          transform: "translateX(-50%)"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StressedAgent, { stressLevel })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "15%",
          left: "8%",
          right: "8%",
          display: "flex",
          gap: 24
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            ComparisonCard,
            {
              title: "Skills",
              percentage: 20,
              color: COLORS.primary,
              isGood: true,
              delay: 45
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            ComparisonCard,
            {
              title: "MCP",
              percentage: 85,
              color: COLORS.secondary,
              isGood: false,
              delay: 55
            }
          )
        ]
      }
    ),
    warningTriggered && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: "55%",
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: (0, import_remotion.interpolate)(frame - keyTriggerFrame, [0, 20], [0, 1], { extrapolateRight: "clamp" })
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WarningIcon, { size: 40, color: COLORS.warning }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
            marginTop: 12,
            fontSize: 20,
            color: COLORS.warning,
            fontFamily: "Inter, system-ui, sans-serif",
            fontWeight: 700
          }, children: "But there's a cost..." })
        ]
      }
    )
  ] });
};
var ToolButton = ({ label, isActive, delay }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const progress = (0, import_remotion.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG
  });
  const glowIntensity = isActive ? (0, import_remotion.interpolate)(Math.sin(frame * 0.12), [-1, 1], [8, 20]) : 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        padding: "12px 20px",
        background: isActive ? `${COLORS.secondary}30` : `${COLORS.secondary}15`,
        borderRadius: 10,
        border: `2px solid ${isActive ? COLORS.secondary : COLORS.secondary}50`,
        transform: `scale(${progress})`,
        opacity: progress,
        boxShadow: isActive ? `0 0 ${glowIntensity}px ${COLORS.secondary}` : "none",
        cursor: "pointer"
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
        color: isActive ? COLORS.white : COLORS.white + "80",
        fontSize: 15,
        fontFamily: "Inter, system-ui, sans-serif",
        fontWeight: isActive ? 700 : 500
      }, children: label })
    }
  );
};
var DocumentLine = ({ content, isHeader, delay }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const progress = (0, import_remotion.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        padding: isHeader ? "10px 0" : "6px 0",
        borderBottom: isHeader ? `1px solid ${COLORS.primary}30` : "none",
        transform: `translateX(${(1 - progress) * 20}px)`,
        opacity: progress
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
        color: isHeader ? COLORS.primary : COLORS.white + "90",
        fontSize: isHeader ? 18 : 14,
        fontFamily: "Inter, system-ui, sans-serif",
        fontWeight: isHeader ? 700 : 400
      }, children: content })
    }
  );
};
var Scene6 = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const keyTriggerFrame = KEY_SYNCS.scene6_access - TIMING.scene6.start;
  const toolsActivated = frame >= keyTriggerFrame;
  const titleProgress = (0, import_remotion.spring)({
    frame: frame - 5,
    fps,
    config: SPRING_CONFIG
  });
  const leftPanelProgress = (0, import_remotion.spring)({
    frame: frame - 15,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 60 }
  });
  const rightPanelProgress = (0, import_remotion.spring)({
    frame: frame - 25,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 60 }
  });
  const mcpTools = [
    "Create File",
    "Delete File",
    "Update File",
    "List Files",
    "Share File",
    "Move File"
  ];
  const documentContent = [
    { content: "Best Practices Guide", isHeader: true },
    { content: "1. Structure your components clearly", isHeader: false },
    { content: "2. Use meaningful variable names", isHeader: false },
    { content: "3. Write tests for critical paths", isHeader: false },
    { content: "How to Write PRDs", isHeader: true },
    { content: "Start with user needs", isHeader: false },
    { content: "Define success metrics", isHeader: false },
    { content: "Include technical requirements", isHeader: false }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "5%",
          left: 0,
          right: 0,
          textAlign: "center",
          transform: `translateY(${(1 - titleProgress) * 30}px)`,
          opacity: titleProgress
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
          fontSize: 42,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 800,
          background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.secondary})`,
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent"
        }, children: "Different Capabilities" })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "11%",
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: (0, import_remotion.interpolate)(frame, [20, 40], [0, 0.7], { extrapolateRight: "clamp" })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
          fontSize: 20,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 400,
          color: COLORS.white
        }, children: "Each approach has its strengths" })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: "16%",
          left: "5%",
          right: "5%",
          bottom: "15%",
          display: "flex",
          gap: 24
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "div",
            {
              style: {
                flex: 1,
                background: `${COLORS.primary}08`,
                borderRadius: 20,
                border: `2px solid ${COLORS.primary}40`,
                padding: 24,
                transform: `scale(${leftPanelProgress})`,
                opacity: leftPanelProgress,
                display: "flex",
                flexDirection: "column"
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 20,
                  paddingBottom: 16,
                  borderBottom: `1px solid ${COLORS.primary}30`
                }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderIcon, { size: 28, color: COLORS.primary }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
                    color: COLORS.primary,
                    fontSize: 22,
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontWeight: 700
                  }, children: "Skills: Guidance" })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  overflow: "hidden"
                }, children: documentContent.map((line, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  DocumentLine,
                  {
                    content: line.content,
                    isHeader: line.isHeader,
                    delay: 35 + i * 8
                  },
                  `doc-${i}`
                )) }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
                  marginTop: 16,
                  padding: "10px 16px",
                  background: `${COLORS.primary}20`,
                  borderRadius: 10,
                  textAlign: "center"
                }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
                  color: COLORS.primary,
                  fontSize: 14,
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontWeight: 600
                }, children: "Teaches HOW to do things well" }) })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "div",
            {
              style: {
                flex: 1,
                background: `${COLORS.secondary}08`,
                borderRadius: 20,
                border: `2px solid ${COLORS.secondary}40`,
                padding: 24,
                transform: `scale(${rightPanelProgress})`,
                opacity: rightPanelProgress,
                display: "flex",
                flexDirection: "column"
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 20,
                  paddingBottom: 16,
                  borderBottom: `1px solid ${COLORS.secondary}30`
                }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ServerIcon, { size: 28, color: COLORS.secondary }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
                    color: COLORS.secondary,
                    fontSize: 22,
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontWeight: 700
                  }, children: "MCP: Tools" })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
                  marginBottom: 16,
                  padding: "8px 14px",
                  background: `${COLORS.secondary}20`,
                  borderRadius: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  alignSelf: "flex-start"
                }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DataIcon, { size: 18, color: COLORS.secondary }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
                    color: COLORS.secondary,
                    fontSize: 14,
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontWeight: 600
                  }, children: "Google Drive API" })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
                  flex: 1,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  alignContent: "flex-start"
                }, children: mcpTools.map((tool, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  ToolButton,
                  {
                    label: tool,
                    isActive: toolsActivated,
                    delay: 45 + i * 8
                  },
                  tool
                )) }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
                  marginTop: 16,
                  padding: "10px 16px",
                  background: `${COLORS.secondary}20`,
                  borderRadius: 10,
                  textAlign: "center"
                }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
                  color: COLORS.secondary,
                  fontSize: 14,
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontWeight: 600
                }, children: "Provides raw CAPABILITIES" }) })
              ]
            }
          )
        ]
      }
    ),
    toolsActivated && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "6%",
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: (0, import_remotion.interpolate)(frame - keyTriggerFrame, [0, 20], [0, 1], { extrapolateRight: "clamp" })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: {
          fontSize: 22,
          color: COLORS.white,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 600
        }, children: [
          "MCP gives you direct ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.secondary }, children: "access" }),
          " to APIs"
        ] })
      }
    )
  ] });
};
var InsightCard = ({ title, subtitle, icon, color, delay }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const progress = (0, import_remotion.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG
  });
  const glowIntensity = (0, import_remotion.interpolate)(Math.sin(frame * 0.1), [-1, 1], [15, 30]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        width: 400,
        padding: 32,
        background: `${color}15`,
        borderRadius: 24,
        border: `3px solid ${color}`,
        transform: `scale(${progress}) translateY(${(1 - progress) * 30}px)`,
        opacity: progress,
        boxShadow: `0 0 ${glowIntensity}px ${color}40`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              width: 80,
              height: 80,
              borderRadius: 20,
              background: `${color}30`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            },
            children: icon === "tools" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ServerIcon, { size: 48, color }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderIcon, { size: 48, color })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
          fontSize: 32,
          fontWeight: 800,
          color,
          fontFamily: "Inter, system-ui, sans-serif",
          textAlign: "center"
        }, children: title }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
          fontSize: 18,
          color: COLORS.white + "90",
          fontFamily: "Inter, system-ui, sans-serif",
          textAlign: "center",
          lineHeight: 1.4
        }, children: subtitle })
      ]
    }
  );
};
var ConfidentAgent = ({ progress }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const bob = Math.sin(frame * 0.08) * 3;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transform: `translateY(${bob}px) scale(${progress})`,
        opacity: progress
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              width: 140,
              height: 140,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${COLORS.primary}50, ${COLORS.secondary}50)`,
              border: `4px solid ${COLORS.white}50`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 15px 50px rgba(0,0,0,0.4), 0 0 40px ${COLORS.primary}30`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "div",
              {
                style: {
                  width: 70,
                  height: 70,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`
                }
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
          marginTop: 16,
          color: COLORS.white,
          fontSize: 18,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 700
        }, children: "Choose Wisely" })
      ]
    }
  );
};
var Scene7 = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const keyTriggerFrame = KEY_SYNCS.scene7_gives - TIMING.scene7.start;
  const labelsVisible = frame >= keyTriggerFrame;
  const titleProgress = (0, import_remotion.spring)({
    frame: frame - 5,
    fps,
    config: SPRING_CONFIG
  });
  const agentProgress = (0, import_remotion.spring)({
    frame: frame - 15,
    fps,
    config: SPRING_CONFIG
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "6%",
          left: 0,
          right: 0,
          textAlign: "center",
          transform: `translateY(${(1 - titleProgress) * 30}px)`,
          opacity: titleProgress
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
          fontSize: 48,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 800,
          color: COLORS.white
        }, children: "The Key Difference" })
      }
    ),
    labelsVisible && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: "18%",
          left: "5%",
          right: "5%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            InsightCard,
            {
              title: "MCP = Raw Tools",
              subtitle: "Direct access to APIs, databases, and services",
              icon: "tools",
              color: COLORS.secondary,
              delay: keyTriggerFrame
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            InsightCard,
            {
              title: "Skills = Behavior",
              subtitle: "Guidance on how to do things the right way",
              icon: "behavior",
              color: COLORS.primary,
              delay: keyTriggerFrame + 10
            }
          )
        ]
      }
    ),
    labelsVisible && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "35%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 3,
          height: 120,
          background: `linear-gradient(180deg, ${COLORS.secondary}, ${COLORS.primary})`,
          borderRadius: 2,
          opacity: (0, import_remotion.interpolate)(frame - keyTriggerFrame, [15, 30], [0, 0.6], { extrapolateRight: "clamp" })
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "12%",
          left: "50%",
          transform: "translateX(-50%)"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConfidentAgent, { progress: agentProgress })
      }
    ),
    labelsVisible && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "4%",
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: (0, import_remotion.interpolate)(frame - keyTriggerFrame, [20, 40], [0, 1], { extrapolateRight: "clamp" })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
          fontSize: 20,
          color: COLORS.white + "90",
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 500
        }, children: "Use the right tool for the job" })
      }
    )
  ] });
};
var PulsingText = ({ text, highlightWord, highlightColor, isActive, delay }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const progress = (0, import_remotion.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG
  });
  const pulseIntensity = isActive ? (0, import_remotion.interpolate)(Math.sin(frame * 0.2), [-1, 1], [15, 40]) : 0;
  const parts = text.split(highlightWord);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        transform: `scale(${progress}) translateY(${(1 - progress) * 20}px)`,
        opacity: progress,
        textAlign: "center"
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: {
        fontSize: 28,
        fontFamily: "Inter, system-ui, sans-serif",
        fontWeight: 600,
        color: COLORS.white
      }, children: [
        parts[0],
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            style: {
              color: highlightColor,
              textShadow: isActive ? `0 0 ${pulseIntensity}px ${highlightColor}` : "none",
              fontWeight: 800
            },
            children: highlightWord
          }
        ),
        parts[1]
      ] })
    }
  );
};
var HarmonyBackground = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(circle at 30% 30%, ${COLORS.primary}20 0%, transparent 50%),
            radial-gradient(circle at 70% 70%, ${COLORS.secondary}20 0%, transparent 50%),
            ${COLORS.background}
          `
        }
      }
    ),
    Array.from({ length: 16 }).map((_, i) => {
      const x = 10 + i % 4 * 25;
      const y = 20 + Math.floor(i / 4) * 20;
      const offset = Math.sin(frame * 0.03 + i * 0.5) * 20;
      const color = i % 2 === 0 ? COLORS.primary : COLORS.secondary;
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: `${x}%`,
            top: `calc(${y}% + ${offset}px)`,
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: color,
            opacity: 0.3
          }
        },
        `harmony-${i}`
      );
    })
  ] });
};
var ActionAgent = ({ progress }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const bob = Math.sin(frame * 0.1) * 4;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transform: `translateY(${bob}px) scale(${progress})`,
        opacity: progress
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { position: "relative" }, children: [
        [0, 1, 2].map((i) => {
          const angle = -30 + i * 30;
          const length = 30 + i * 10;
          const opacity = (0, import_remotion.interpolate)(Math.sin(frame * 0.15 + i), [-1, 1], [0.2, 0.6]);
          return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: "50%",
                top: "50%",
                width: length,
                height: 3,
                background: `linear-gradient(90deg, ${COLORS.primary}80, transparent)`,
                transform: `translate(70px, -50%) rotate(${angle}deg)`,
                opacity,
                borderRadius: 2
              }
            },
            `action-${i}`
          );
        }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              width: 120,
              height: 120,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${COLORS.primary}60, ${COLORS.secondary}60)`,
              border: `4px solid ${COLORS.white}60`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 15px 50px rgba(0,0,0,0.4), 0 0 50px ${COLORS.primary}30`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "div",
              {
                style: {
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`
                }
              }
            )
          }
        )
      ] })
    }
  );
};
var Scene8 = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const keyTriggerFrame = KEY_SYNCS.scene8_skills - TIMING.scene8.start;
  const ctaActive = frame >= keyTriggerFrame;
  const titleProgress = (0, import_remotion.spring)({
    frame: frame - 10,
    fps,
    config: SPRING_CONFIG
  });
  const agentProgress = (0, import_remotion.spring)({
    frame: frame - 20,
    fps,
    config: SPRING_CONFIG
  });
  const ctaProgress = (0, import_remotion.spring)({
    frame: frame - 40,
    fps,
    config: SPRING_CONFIG
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HarmonyBackground, {}),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "15%",
          left: 0,
          right: 0,
          textAlign: "center",
          transform: `translateY(${(1 - titleProgress) * 30}px)`,
          opacity: titleProgress
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
          fontSize: 52,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 800,
          background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.accent}, ${COLORS.secondary})`,
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent"
        }, children: "Want to dive deeper?" })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "32%",
          left: "50%",
          transform: "translateX(-50%)"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionAgent, { progress: agentProgress })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: "55%",
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                transform: `scale(${ctaProgress})`,
                opacity: ctaProgress
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
                fontSize: 24,
                fontFamily: "Inter, system-ui, sans-serif",
                fontWeight: 500,
                color: COLORS.white + "90"
              }, children: "Get the full breakdown" })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            PulsingText,
            {
              text: 'Comment "skills" for the free lecture',
              highlightWord: "skills",
              highlightColor: COLORS.primary,
              isActive: ctaActive,
              delay: 50
            }
          )
        ]
      }
    ),
    ctaActive && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "18%",
          left: "50%",
          transform: "translateX(-50%)",
          opacity: (0, import_remotion.interpolate)(frame - keyTriggerFrame, [0, 20], [0, 1], { extrapolateRight: "clamp" })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              padding: "20px 48px",
              background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`,
              borderRadius: 50,
              boxShadow: `0 10px 40px ${COLORS.primary}50, 0 0 ${(0, import_remotion.interpolate)(Math.sin(frame * 0.15), [-1, 1], [20, 40])}px ${COLORS.primary}60`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
              fontSize: 24,
              fontFamily: "Inter, system-ui, sans-serif",
              fontWeight: 700,
              color: COLORS.white
            }, children: "Comment Below" })
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "5%",
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: (0, import_remotion.interpolate)(frame, [60, 90], [0, 0.6], { extrapolateRight: "clamp" })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
          fontSize: 16,
          fontFamily: "Inter, system-ui, sans-serif",
          color: COLORS.white + "60"
        }, children: "Master AI development with Skills and MCP" })
      }
    )
  ] });
};
var MainComposition = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: { backgroundColor: COLORS.background }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AnimatedBackground, {}, "bg"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene1.start, durationInFrames: TIMING.scene1.end - TIMING.scene1.start, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene1, {}) }, "scene1"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene2.start, durationInFrames: TIMING.scene2.end - TIMING.scene2.start, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene2, {}) }, "scene2"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene3.start, durationInFrames: TIMING.scene3.end - TIMING.scene3.start, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene3, {}) }, "scene3"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene4.start, durationInFrames: TIMING.scene4.end - TIMING.scene4.start, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene4, {}) }, "scene4"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene5.start, durationInFrames: TIMING.scene5.end - TIMING.scene5.start, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene5, {}) }, "scene5"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene6.start, durationInFrames: TIMING.scene6.end - TIMING.scene6.start, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene6, {}) }, "scene6"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene7.start, durationInFrames: TIMING.scene7.end - TIMING.scene7.start, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene7, {}) }, "scene7"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene8.start, durationInFrames: TIMING.scene8.end - TIMING.scene8.start, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene8, {}) }, "scene8")
  ] });
};
var RemotionRoot = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_remotion.Composition,
    {
      id: "proj-ba921ee7-7e8e-4d93-823f-5b1f40288ab0",
      component: MainComposition,
      durationInFrames: VIDEO_CONFIG.durationInFrames,
      fps: VIDEO_CONFIG.fps,
      width: VIDEO_CONFIG.width,
      height: VIDEO_CONFIG.height
    }
  );
};
var index_default = MainComposition;
