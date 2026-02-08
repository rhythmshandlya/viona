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
  RemotionRoot: () => RemotionRoot,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_remotion10 = require("remotion");

// src/proj_956b6123_5a01_40bc_a3ee_4648502af85d/constants.ts
var COLORS = {
  primary: "#00f5d4",
  // Cyan - Skills system
  secondary: "#7b2cbf",
  // Purple - MCP system
  accent: "#f72585",
  // Magenta - AI agent
  dark: "#0a0a0f",
  // Background
  success: "#00ff88",
  // Positive states
  warning: "#ff6b35",
  // Performance issues
  white: "#ffffff",
  dimWhite: "rgba(255, 255, 255, 0.7)",
  glassWhite: "rgba(255, 255, 255, 0.1)",
  glassBorder: "rgba(255, 255, 255, 0.2)"
};
var SPRING_CONFIG = { damping: 22, stiffness: 90, mass: 0.9 };
var TIMING = {
  scene1: { start: 0, end: 419, duration: 420 },
  scene2: { start: 420, end: 599, duration: 180 },
  scene3: { start: 600, end: 779, duration: 180 },
  scene4: { start: 780, end: 1019, duration: 240 },
  scene5: { start: 1020, end: 1319, duration: 300 },
  scene6: { start: 1320, end: 1919, duration: 600 },
  scene7: { start: 1920, end: 2009, duration: 90 },
  scene8: { start: 2010, end: 2208, duration: 199 }
};
var KEY_SYNCS = {
  scene1_difference: 7,
  scene2_parts: 268,
  scene3_only: 664,
  scene4_server: 831,
  scene5_degrade: 1300,
  scene6_googleDrive: 1468,
  scene7_behavior: 2011,
  scene8_skills: 2179
};
var VIDEO_CONFIG = {
  fps: 30,
  width: 1080,
  height: 1920,
  durationInFrames: 2209
};
var glassStyle = {
  background: COLORS.glassWhite,
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: `1px solid ${COLORS.glassBorder}`,
  borderRadius: 16,
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)"
};

// src/proj_956b6123_5a01_40bc_a3ee_4648502af85d/components/Background.tsx
var import_remotion = require("remotion");
var import_jsx_runtime = require("react/jsx-runtime");
var Background = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height } = (0, import_remotion.useVideoConfig)();
  const gradientAngle = (0, import_remotion.interpolate)(frame, [0, 2209], [135, 225], { extrapolateRight: "clamp" });
  const particles = Array.from({ length: 20 }).map((_, i) => {
    const baseX = i * 137.5 % width;
    const baseY = i * 89.3 % height;
    const speed = 0.3 + i % 5 * 0.1;
    const size = 2 + i % 3 * 2;
    const opacity = 0.1 + i % 4 * 0.05;
    const x = baseX + Math.sin(frame * speed * 0.01 + i) * 30;
    const y = (baseY + frame * speed * 0.5) % (height + 50) - 25;
    return { x, y, size, opacity, key: i };
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    import_remotion.AbsoluteFill,
    {
      style: {
        background: `linear-gradient(${gradientAngle}deg, ${COLORS.dark} 0%, #0f0f1a 50%, #1a0a1f 100%)`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: "20%",
              left: "10%",
              width: "40%",
              height: "40%",
              background: `radial-gradient(circle, ${COLORS.primary}15 0%, transparent 70%)`,
              filter: "blur(60px)",
              opacity: 0.5 + Math.sin(frame * 0.02) * 0.2
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              bottom: "20%",
              right: "10%",
              width: "40%",
              height: "40%",
              background: `radial-gradient(circle, ${COLORS.secondary}15 0%, transparent 70%)`,
              filter: "blur(60px)",
              opacity: 0.5 + Math.sin(frame * 0.02 + 1) * 0.2
            }
          }
        ),
        particles.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: p.x,
              top: p.y,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              background: p.key % 2 === 0 ? COLORS.primary : COLORS.secondary,
              opacity: p.opacity
            }
          },
          p.key
        )),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              inset: 0,
              backgroundImage: `
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
          `,
              backgroundSize: "60px 60px",
              opacity: 0.5
            }
          }
        )
      ]
    }
  );
};
var AIAgent = ({
  x,
  y,
  size = 80,
  pulseIntensity = 1,
  lookDirection = "center"
}) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const pulse = 1 + Math.sin(frame * 0.1) * 0.1 * pulseIntensity;
  const eyeOffset = lookDirection === "left" ? -8 : lookDirection === "right" ? 8 : 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: typeof x === "number" ? x : x,
        top: typeof y === "number" ? y : y,
        transform: "translate(-50%, -50%)",
        width: size,
        height: size
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              inset: -20,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${COLORS.accent}40 0%, transparent 70%)`,
              filter: "blur(15px)",
              transform: `scale(${pulse})`
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: `radial-gradient(circle at 30% 30%, ${COLORS.accent}, #a855f7)`,
              boxShadow: `0 0 30px ${COLORS.accent}80, inset 0 0 20px rgba(255,255,255,0.3)`
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: "15%",
              left: "20%",
              width: "30%",
              height: "30%",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.4)",
              filter: "blur(5px)"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: "45%",
              left: `calc(50% + ${eyeOffset}px)`,
              transform: "translate(-50%, -50%)",
              width: size * 0.15,
              height: size * 0.15,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.9)",
              boxShadow: "0 0 10px rgba(255,255,255,0.8)"
            }
          }
        )
      ]
    }
  );
};

// src/proj_956b6123_5a01_40bc_a3ee_4648502af85d/scenes/Scene1.tsx
var import_remotion2 = require("remotion");

// src/proj_956b6123_5a01_40bc_a3ee_4648502af85d/components/Icons.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var FolderIcon = ({ size = 24, color = "currentColor", style }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", style, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { fill: color, d: "M10 4H4c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8z" }) });
var ServerIcon = ({ size = 24, color = "currentColor", style }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", style, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("g", { fill: "none", stroke: color, strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", children: [
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { width: "20", height: "8", x: "2", y: "2", rx: "2", ry: "2", fill: color }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { width: "20", height: "8", x: "2", y: "14", rx: "2", ry: "2", fill: color }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "6", cy: "6", r: "1", fill: "rgba(0,0,0,0.3)" }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "6", cy: "18", r: "1", fill: "rgba(0,0,0,0.3)" })
] }) });
var WarningIcon = ({ size = 24, color = "currentColor", style }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", style, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("g", { fill: "none", stroke: color, strokeLinecap: "round", strokeWidth: "1.5", children: [
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M20.043 21H3.957c-1.538 0-2.5-1.664-1.734-2.997l8.043-13.988c.77-1.337 2.699-1.337 3.468 0l8.043 13.988C22.543 19.336 21.58 21 20.043 21ZM12 9v4" }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { strokeLinejoin: "round", d: "m12 17.01l.01-.011" })
] }) });
var CheckmarkIcon = ({ size = 24, color = "currentColor", style }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 512 512", style, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { fill: color, d: "M256 48C141.31 48 48 141.31 48 256s93.31 208 208 208s208-93.31 208-208S370.69 48 256 48m108.25 138.29l-134.4 160a16 16 0 0 1-12 5.71h-.27a16 16 0 0 1-11.89-5.3l-57.6-64a16 16 0 1 1 23.78-21.4l45.29 50.32l122.59-145.91a16 16 0 0 1 24.5 20.58" }) });
var DatabaseIcon = ({ size = 24, color = "currentColor", style }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", style, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("g", { fill: "none", stroke: color, strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", children: [
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ellipse", { cx: "12", cy: "5", rx: "9", ry: "3", fill: color }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M3 5v14a9 3 0 0 0 18 0V5" }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M3 12a9 3 0 0 0 18 0" })
] }) });
var QuestionIcon = ({ size = 24, color = "currentColor", style }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", style, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { fill: color, d: "m15.07 11.25l-.9.92C13.45 12.89 13 13.5 13 15h-2v-.5c0-1.11.45-2.11 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41a2 2 0 0 0-2-2a2 2 0 0 0-2 2H8a4 4 0 0 1 4-4a4 4 0 0 1 4 4a3.2 3.2 0 0 1-.93 2.25M13 19h-2v-2h2M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10a10 10 0 0 0 10-10c0-5.53-4.5-10-10-10" }) });
var DocumentIcon = ({ size = 24, color = "currentColor", style }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", style, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { fill: color, d: "M13 9h5.5L13 3.5zM6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4c0-1.11.89-2 2-2m9 16v-2H6v2zm3-4v-2H6v2z" }) });

// src/proj_956b6123_5a01_40bc_a3ee_4648502af85d/scenes/Scene1.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var SkillsContainer = ({ progress }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "25%",
        top: "50%",
        transform: `translate(-50%, -50%) scale(${progress})`,
        width: "18%",
        height: "35%",
        background: "rgba(0, 245, 212, 0.08)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: `2px solid ${COLORS.primary}40`,
        borderRadius: 20,
        boxShadow: `0 0 40px ${COLORS.primary}30, inset 0 0 30px ${COLORS.primary}10`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        opacity: progress
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(FolderIcon, { size: 60, color: COLORS.primary }),
        [0, 1, 2].map((i) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "div",
          {
            style: {
              width: "70%",
              height: 8,
              background: `linear-gradient(90deg, transparent, ${COLORS.primary}40, transparent)`,
              borderRadius: 4
            }
          },
          i
        )),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              bottom: -40,
              fontSize: 28,
              fontWeight: 700,
              color: COLORS.primary,
              textShadow: `0 0 20px ${COLORS.primary}`,
              letterSpacing: 2
            },
            children: "SKILLS"
          }
        )
      ]
    }
  );
};
var MCPContainer = ({ progress }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "75%",
        top: "50%",
        transform: `translate(-50%, -50%) scale(${progress})`,
        width: "18%",
        height: "35%",
        background: "rgba(123, 44, 191, 0.08)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: `2px solid ${COLORS.secondary}40`,
        borderRadius: 20,
        boxShadow: `0 0 40px ${COLORS.secondary}30, inset 0 0 30px ${COLORS.secondary}10`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 15,
        opacity: progress
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ServerIcon, { size: 60, color: COLORS.secondary }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", padding: "0 20px" }, children: [0, 1, 2, 3, 4, 5].map((i) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "div",
          {
            style: {
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: `${COLORS.secondary}60`,
              boxShadow: `0 0 10px ${COLORS.secondary}40`
            }
          },
          i
        )) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              bottom: -40,
              fontSize: 28,
              fontWeight: 700,
              color: COLORS.secondary,
              textShadow: `0 0 20px ${COLORS.secondary}`,
              letterSpacing: 2
            },
            children: "MCP"
          }
        )
      ]
    }
  );
};
var AnimatedQuestionMark = ({ frame, fps }) => {
  const keySyncFrame = KEY_SYNCS.scene1_difference;
  const entranceProgress = (0, import_remotion2.spring)({
    frame: frame - 20,
    fps,
    config: SPRING_CONFIG
  });
  const isPastKeySync = frame >= keySyncFrame;
  const pulseProgress = isPastKeySync ? (0, import_remotion2.spring)({
    frame: frame - keySyncFrame,
    fps,
    config: { damping: 15, stiffness: 100, mass: 0.8 }
  }) : 0;
  const continuousPulse = isPastKeySync ? 1 + Math.sin((frame - keySyncFrame) * 0.08) * 0.05 : 1;
  const scale = entranceProgress * (1 + pulseProgress * 0.3) * continuousPulse;
  const glowIntensity = isPastKeySync ? 1 + pulseProgress * 0.5 : 0.5;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity: entranceProgress
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              inset: -60,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${COLORS.accent}${Math.round(glowIntensity * 40).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
              filter: "blur(20px)"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          QuestionIcon,
          {
            size: 140,
            color: COLORS.accent,
            style: {
              filter: `drop-shadow(0 0 ${20 * glowIntensity}px ${COLORS.accent})`
            }
          }
        )
      ]
    }
  );
};
var Scene1 = ({ startFrame = 0 }) => {
  const frame = (0, import_remotion2.useCurrentFrame)();
  const { fps } = (0, import_remotion2.useVideoConfig)();
  const localFrame = frame - startFrame;
  const skillsProgress = (0, import_remotion2.spring)({
    frame: localFrame,
    fps,
    config: SPRING_CONFIG
  });
  const mcpProgress = (0, import_remotion2.spring)({
    frame: localFrame - 8,
    fps,
    config: SPRING_CONFIG
  });
  const agentProgress = (0, import_remotion2.spring)({
    frame: localFrame - 40,
    fps,
    config: SPRING_CONFIG
  });
  const oscillationPeriod = 90;
  const lookCycle = Math.floor(localFrame / oscillationPeriod) % 2;
  const lookDirection = localFrame < 50 ? "center" : lookCycle === 0 ? "left" : "right";
  const agentY = 30 + Math.sin(localFrame * 0.03) * 2;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_remotion2.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(SkillsContainer, { progress: skillsProgress }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(MCPContainer, { progress: mcpProgress }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(AnimatedQuestionMark, { frame: localFrame, fps }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        style: {
          opacity: agentProgress,
          transform: `scale(${agentProgress})`
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          AIAgent,
          {
            x: "50%",
            y: `${agentY}%`,
            size: 80,
            pulseIntensity: 1.2,
            lookDirection
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "8%",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 42,
          fontWeight: 800,
          color: COLORS.white,
          textAlign: "center",
          opacity: (0, import_remotion2.interpolate)(localFrame, [0, 30], [0, 1], { extrapolateRight: "clamp" }),
          textShadow: "0 2px 20px rgba(0,0,0,0.5)",
          letterSpacing: 1
        },
        children: "What's the difference?"
      }
    )
  ] });
};

// src/proj_956b6123_5a01_40bc_a3ee_4648502af85d/scenes/Scene2.tsx
var import_remotion3 = require("remotion");
var import_jsx_runtime4 = require("react/jsx-runtime");
var FrontMatterDrawer = ({
  progress,
  slideOut
}) => {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        top: "25%",
        left: "50%",
        width: "50%",
        height: "12%",
        background: `linear-gradient(135deg, ${COLORS.primary}20 0%, ${COLORS.primary}10 100%)`,
        backdropFilter: "blur(15px)",
        WebkitBackdropFilter: "blur(15px)",
        border: `2px solid ${COLORS.primary}60`,
        borderRadius: 16,
        boxShadow: `0 0 30px ${COLORS.primary}30, inset 0 0 20px ${COLORS.primary}10`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        opacity: progress,
        transform: `translate(-50%, 0) translateX(${slideOut * -40}px) scale(${0.9 + progress * 0.1})`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(FolderIcon, { size: 40, color: COLORS.primary }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 4 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "div",
            {
              style: {
                fontSize: 24,
                fontWeight: 700,
                color: COLORS.primary,
                textShadow: `0 0 15px ${COLORS.primary}`
              },
              children: "FRONT MATTER"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { fontSize: 14, color: COLORS.dimWhite }, children: "name + description" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              right: 20,
              width: 40,
              height: 8,
              background: `${COLORS.primary}60`,
              borderRadius: 4
            }
          }
        )
      ]
    }
  );
};
var BodySection = ({ progress }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        top: "45%",
        left: "50%",
        width: "50%",
        height: "35%",
        background: `linear-gradient(135deg, ${COLORS.secondary}15 0%, ${COLORS.secondary}08 100%)`,
        backdropFilter: "blur(15px)",
        WebkitBackdropFilter: "blur(15px)",
        border: `2px solid ${COLORS.secondary}40`,
        borderRadius: 16,
        boxShadow: `0 0 25px ${COLORS.secondary}20, inset 0 0 15px ${COLORS.secondary}08`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 15,
        opacity: progress,
        transform: `translate(-50%, 0) scale(${0.9 + progress * 0.1})`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "div",
          {
            style: {
              fontSize: 24,
              fontWeight: 700,
              color: COLORS.secondary,
              textShadow: `0 0 15px ${COLORS.secondary}`
            },
            children: "BODY"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { display: "flex", flexDirection: "column", gap: 12, width: "80%" }, children: ["Detailed instructions", "Scripts & resources", "Examples"].map((text, i) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: 12,
              opacity: (0, import_remotion3.interpolate)(progress, [0.5, 1], [0, 1], { extrapolateRight: "clamp" })
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(DocumentIcon, { size: 20, color: COLORS.dimWhite }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { fontSize: 16, color: COLORS.dimWhite }, children: text })
            ]
          },
          i
        )) }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              bottom: 15,
              fontSize: 12,
              color: `${COLORS.secondary}80`,
              letterSpacing: 1
            },
            children: "LOADED ON DEMAND"
          }
        )
      ]
    }
  );
};
var SkillsCabinet = ({ openProgress }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: "60%",
        height: "70%",
        background: "rgba(0, 245, 212, 0.05)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border: `2px solid ${COLORS.primary}30`,
        borderRadius: 24,
        boxShadow: `0 0 50px ${COLORS.primary}20`,
        overflow: "hidden"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: 20,
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: 32,
              fontWeight: 800,
              color: COLORS.primary,
              textShadow: `0 0 20px ${COLORS.primary}`,
              letterSpacing: 3,
              opacity: openProgress
            },
            children: "SKILLS"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: "40%",
              left: "10%",
              width: "80%",
              height: 2,
              background: `linear-gradient(90deg, transparent, ${COLORS.primary}40, transparent)`,
              opacity: openProgress
            }
          }
        )
      ]
    }
  );
};
var Scene2 = ({ startFrame = 0 }) => {
  const frame = (0, import_remotion3.useCurrentFrame)();
  const { fps } = (0, import_remotion3.useVideoConfig)();
  const localFrame = frame - startFrame;
  const cabinetProgress = (0, import_remotion3.spring)({
    frame: localFrame,
    fps,
    config: SPRING_CONFIG
  });
  const frontMatterProgress = (0, import_remotion3.spring)({
    frame: localFrame - 25,
    fps,
    config: SPRING_CONFIG
  });
  const slideOutProgress = (0, import_remotion3.spring)({
    frame: localFrame - 40,
    fps,
    config: { damping: 25, stiffness: 80, mass: 1 }
  });
  const bodyProgress = (0, import_remotion3.spring)({
    frame: localFrame - 50,
    fps,
    config: SPRING_CONFIG
  });
  const agentProgress = (0, import_remotion3.spring)({
    frame: localFrame - 15,
    fps,
    config: SPRING_CONFIG
  });
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_remotion3.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { opacity: cabinetProgress, transform: `scale(${0.9 + cabinetProgress * 0.1})` }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SkillsCabinet, { openProgress: cabinetProgress }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(FrontMatterDrawer, { progress: frontMatterProgress, slideOut: slideOutProgress }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BodySection, { progress: bodyProgress }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { opacity: agentProgress, transform: `scale(${agentProgress})` }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      AIAgent,
      {
        x: "15%",
        y: "45%",
        size: 70,
        pulseIntensity: 0.8,
        lookDirection: "right"
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "12%",
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
          opacity: (0, import_remotion3.interpolate)(localFrame, [80, 110], [0, 1], { extrapolateRight: "clamp" })
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "div",
            {
              style: {
                fontSize: 28,
                fontWeight: 600,
                color: COLORS.white,
                marginBottom: 8
              },
              children: "Two main parts"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { fontSize: 18, color: COLORS.dimWhite }, children: "Front matter loads first, body loads when needed" })
        ]
      }
    )
  ] });
};

// src/proj_956b6123_5a01_40bc_a3ee_4648502af85d/scenes/Scene3.tsx
var import_remotion4 = require("remotion");
var import_jsx_runtime5 = require("react/jsx-runtime");
var ExtractedFrontMatter = ({
  progress,
  extractProgress
}) => {
  const xPos = (0, import_remotion4.interpolate)(extractProgress, [0, 1], [55, 35], { extrapolateRight: "clamp" });
  const yPos = (0, import_remotion4.interpolate)(extractProgress, [0, 1], [35, 40], { extrapolateRight: "clamp" });
  const scale = 0.9 + extractProgress * 0.2;
  const glow = extractProgress * 40;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${xPos}%`,
        top: `${yPos}%`,
        transform: `translate(-50%, -50%) scale(${scale})`,
        width: "22%",
        height: "10%",
        background: `linear-gradient(135deg, ${COLORS.primary}25 0%, ${COLORS.primary}15 100%)`,
        backdropFilter: "blur(15px)",
        WebkitBackdropFilter: "blur(15px)",
        border: `2px solid ${COLORS.primary}80`,
        borderRadius: 14,
        boxShadow: `0 0 ${20 + glow}px ${COLORS.primary}50, inset 0 0 15px ${COLORS.primary}15`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 15,
        opacity: progress
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(FolderIcon, { size: 32, color: COLORS.primary }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { fontSize: 18, fontWeight: 700, color: COLORS.primary }, children: "FRONT MATTER" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { fontSize: 12, color: COLORS.dimWhite }, children: "name + description" })
        ] }),
        extractProgress > 0.8 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              right: -15,
              top: -15,
              opacity: (0, import_remotion4.interpolate)(extractProgress, [0.8, 1], [0, 1], { extrapolateRight: "clamp" })
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(CheckmarkIcon, { size: 36, color: COLORS.success })
          }
        )
      ]
    }
  );
};
var SealedBodySection = ({ frame }) => {
  const pulseOpacity = 0.5 + Math.sin(frame * 0.12) * 0.3;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "65%",
        top: "60%",
        transform: "translate(-50%, -50%)",
        width: "28%",
        height: "25%",
        background: `linear-gradient(135deg, ${COLORS.secondary}10 0%, ${COLORS.secondary}05 100%)`,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border: `2px dashed ${COLORS.secondary}40`,
        borderRadius: 16,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              width: 50,
              height: 50,
              borderRadius: 8,
              border: `3px solid ${COLORS.secondary}50`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "div",
              {
                style: {
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: `${COLORS.secondary}60`
                }
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { fontSize: 14, color: COLORS.secondary, fontWeight: 600 }, children: "BODY" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              padding: "8px 16px",
              background: `${COLORS.warning}20`,
              border: `1px solid ${COLORS.warning}40`,
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              color: COLORS.warning,
              letterSpacing: 1,
              opacity: pulseOpacity,
              boxShadow: `0 0 ${pulseOpacity * 20}px ${COLORS.warning}30`
            },
            children: "LOAD WHEN NEEDED"
          }
        )
      ]
    }
  );
};
var EnergyBeam = ({ progress }) => {
  const beamWidth = progress * 100;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "25%",
        top: "42%",
        width: "20%",
        height: 4,
        overflow: "hidden",
        opacity: progress
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              width: `${beamWidth}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${COLORS.accent}80, ${COLORS.primary}80)`,
              borderRadius: 2,
              boxShadow: `0 0 15px ${COLORS.primary}60`
            }
          }
        ),
        Array.from({ length: 5 }).map((_, i) => {
          const particleX = (progress * 100 + i * 25) % 100;
          return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: `${particleX}%`,
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: COLORS.primary,
                boxShadow: `0 0 10px ${COLORS.primary}`,
                opacity: 0.8
              }
            },
            i
          );
        })
      ]
    }
  );
};
var EfficiencyParticles = ({ frame, active }) => {
  if (!active) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_jsx_runtime5.Fragment, { children: Array.from({ length: 8 }).map((_, i) => {
    const angle = i / 8 * Math.PI * 2;
    const radius = 60 + Math.sin(frame * 0.1 + i) * 20;
    const x = 30 + Math.cos(angle + frame * 0.02) * (radius / 5);
    const y = 42 + Math.sin(angle + frame * 0.02) * (radius / 10);
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: `${x}%`,
          top: `${y}%`,
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: COLORS.success,
          opacity: 0.6,
          boxShadow: `0 0 8px ${COLORS.success}`
        }
      },
      i
    );
  }) });
};
var Scene3 = ({ startFrame = 0 }) => {
  const frame = (0, import_remotion4.useCurrentFrame)();
  const { fps } = (0, import_remotion4.useVideoConfig)();
  const localFrame = frame - startFrame;
  const agentProgress = (0, import_remotion4.spring)({
    frame: localFrame,
    fps,
    config: SPRING_CONFIG
  });
  const frontMatterProgress = (0, import_remotion4.spring)({
    frame: localFrame - 10,
    fps,
    config: SPRING_CONFIG
  });
  const beamProgress = (0, import_remotion4.spring)({
    frame: localFrame - 25,
    fps,
    config: { damping: 30, stiffness: 60, mass: 1 }
  });
  const extractProgress = (0, import_remotion4.spring)({
    frame: localFrame - 50,
    fps,
    config: { damping: 25, stiffness: 50, mass: 1.2 }
  });
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_remotion4.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: "65%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: "32%",
          height: "55%",
          background: "rgba(0, 245, 212, 0.03)",
          border: `2px solid ${COLORS.primary}20`,
          borderRadius: 20,
          opacity: agentProgress
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(SealedBodySection, { frame: localFrame }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(EnergyBeam, { progress: beamProgress }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ExtractedFrontMatter, { progress: frontMatterProgress, extractProgress }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(EfficiencyParticles, { frame: localFrame, active: extractProgress > 0.3 }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { opacity: agentProgress, transform: `scale(${agentProgress})` }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      AIAgent,
      {
        x: "20%",
        y: "42%",
        size: 90,
        pulseIntensity: 1.5,
        lookDirection: "right"
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "15%",
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
          opacity: (0, import_remotion4.interpolate)(localFrame, [100, 130], [0, 1], { extrapolateRight: "clamp" })
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "div",
            {
              style: {
                fontSize: 28,
                fontWeight: 700,
                color: COLORS.success,
                textShadow: `0 0 20px ${COLORS.success}`,
                marginBottom: 8
              },
              children: "Only load what you need"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { fontSize: 18, color: COLORS.dimWhite }, children: "Front matter first, body on demand" })
        ]
      }
    )
  ] });
};

// src/proj_956b6123_5a01_40bc_a3ee_4648502af85d/scenes/Scene4.tsx
var import_remotion5 = require("remotion");
var import_jsx_runtime6 = require("react/jsx-runtime");
var TransformingServer = ({
  serverOpacity,
  transformProgress
}) => {
  const scale = (0, import_remotion5.interpolate)(transformProgress, [0, 1], [1, 0], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "45%",
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity: serverOpacity * (1 - transformProgress)
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "div",
        {
          style: {
            padding: 30,
            background: `radial-gradient(circle, ${COLORS.secondary}30 0%, ${COLORS.secondary}10 100%)`,
            borderRadius: "50%",
            boxShadow: `0 0 60px ${COLORS.secondary}40`
          },
          children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(ServerIcon, { size: 100, color: COLORS.secondary })
        }
      )
    }
  );
};
var ToolItem = ({ icon, x, y, delay, frame, fps }) => {
  const progress = (0, import_remotion5.spring)({
    frame: frame - delay,
    fps,
    config: { damping: 20, stiffness: 80, mass: 0.8 }
  });
  const floatY = Math.sin((frame + delay) * 0.05) * 8;
  const floatX = Math.cos((frame + delay * 0.7) * 0.04) * 5;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) translate(${floatX}px, ${floatY}px) scale(${progress})`,
        opacity: progress
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "div",
        {
          style: {
            padding: 12,
            background: `${COLORS.secondary}20`,
            borderRadius: 12,
            border: `1px solid ${COLORS.secondary}40`,
            boxShadow: `0 0 20px ${COLORS.secondary}30`
          },
          children: icon
        }
      )
    }
  );
};
var MCPToolbox = ({
  progress,
  frame,
  fps
}) => {
  const tools = [
    { icon: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(ServerIcon, { size: 32, color: COLORS.secondary }), x: 35, y: 35, delay: 70 },
    { icon: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(DatabaseIcon, { size: 32, color: COLORS.secondary }), x: 65, y: 35, delay: 76 },
    { icon: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(FolderIcon, { size: 32, color: COLORS.primary }), x: 35, y: 55, delay: 82 },
    { icon: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(DocumentIcon, { size: 32, color: COLORS.primary }), x: 65, y: 55, delay: 88 },
    { icon: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(ServerIcon, { size: 28, color: COLORS.secondary }), x: 50, y: 45, delay: 94 },
    { icon: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(DatabaseIcon, { size: 28, color: COLORS.secondary }), x: 42, y: 65, delay: 100 },
    { icon: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(FolderIcon, { size: 28, color: COLORS.primary }), x: 58, y: 65, delay: 106 }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate(-50%, -50%) scale(${progress})`,
        width: "55%",
        height: "50%",
        background: `linear-gradient(135deg, ${COLORS.secondary}12 0%, ${COLORS.secondary}05 100%)`,
        backdropFilter: "blur(15px)",
        WebkitBackdropFilter: "blur(15px)",
        border: `2px solid ${COLORS.secondary}40`,
        borderRadius: 24,
        boxShadow: `0 0 50px ${COLORS.secondary}25, inset 0 0 30px ${COLORS.secondary}08`,
        opacity: progress,
        overflow: "visible"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: 20,
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: 28,
              fontWeight: 800,
              color: COLORS.secondary,
              textShadow: `0 0 20px ${COLORS.secondary}`,
              letterSpacing: 3
            },
            children: "MCP"
          }
        ),
        tools.map((tool, i) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          ToolItem,
          {
            icon: tool.icon,
            x: tool.x,
            y: tool.y,
            delay: tool.delay,
            frame,
            fps
          },
          i
        )),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
          "svg",
          {
            style: {
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              opacity: progress * 0.3
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("line", { x1: "35%", y1: "35%", x2: "65%", y2: "35%", stroke: COLORS.secondary, strokeWidth: "1", strokeDasharray: "4" }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("line", { x1: "35%", y1: "35%", x2: "35%", y2: "55%", stroke: COLORS.secondary, strokeWidth: "1", strokeDasharray: "4" }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("line", { x1: "65%", y1: "35%", x2: "65%", y2: "55%", stroke: COLORS.secondary, strokeWidth: "1", strokeDasharray: "4" }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("line", { x1: "35%", y1: "55%", x2: "50%", y2: "45%", stroke: COLORS.secondary, strokeWidth: "1", strokeDasharray: "4" }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("line", { x1: "65%", y1: "55%", x2: "50%", y2: "45%", stroke: COLORS.secondary, strokeWidth: "1", strokeDasharray: "4" })
            ]
          }
        )
      ]
    }
  );
};
var Scene4 = ({ startFrame = 0 }) => {
  const frame = (0, import_remotion5.useCurrentFrame)();
  const { fps } = (0, import_remotion5.useVideoConfig)();
  const localFrame = frame - startFrame;
  const serverProgress = (0, import_remotion5.spring)({
    frame: localFrame,
    fps,
    config: SPRING_CONFIG
  });
  const transformProgress = (0, import_remotion5.spring)({
    frame: localFrame - 40,
    fps,
    config: { damping: 25, stiffness: 70, mass: 1 }
  });
  const toolboxProgress = (0, import_remotion5.spring)({
    frame: localFrame - 50,
    fps,
    config: SPRING_CONFIG
  });
  const agentProgress = (0, import_remotion5.spring)({
    frame: localFrame - 80,
    fps,
    config: SPRING_CONFIG
  });
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_remotion5.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: "70%",
          height: "60%",
          background: `radial-gradient(circle, ${COLORS.secondary}15 0%, transparent 70%)`,
          filter: "blur(40px)",
          opacity: toolboxProgress
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(TransformingServer, { serverOpacity: serverProgress, transformProgress }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(MCPToolbox, { progress: toolboxProgress, frame: localFrame, fps }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { opacity: agentProgress, transform: `scale(${agentProgress})` }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      AIAgent,
      {
        x: "82%",
        y: "50%",
        size: 80,
        pulseIntensity: 1,
        lookDirection: "left"
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "12%",
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
          opacity: (0, import_remotion5.interpolate)(localFrame, [120, 150], [0, 1], { extrapolateRight: "clamp" })
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "div",
            {
              style: {
                fontSize: 26,
                fontWeight: 600,
                color: COLORS.white,
                marginBottom: 8
              },
              children: "Model Context Protocol"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { fontSize: 18, color: COLORS.dimWhite }, children: "Actual servers injecting tools into context" })
        ]
      }
    )
  ] });
};

// src/proj_956b6123_5a01_40bc_a3ee_4648502af85d/scenes/Scene5.tsx
var import_remotion6 = require("remotion");
var import_jsx_runtime7 = require("react/jsx-runtime");
var OverflowTool = ({ x, y, size, delay, frame, fps, escapeDirection }) => {
  const appearProgress = (0, import_remotion6.spring)({
    frame: frame - delay,
    fps,
    config: { damping: 18, stiffness: 100, mass: 0.7 }
  });
  const escapeProgress = (0, import_remotion6.interpolate)(
    frame - delay - 30,
    [0, 60],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const finalX = x + escapeDirection.x * escapeProgress * 15;
  const finalY = y + escapeDirection.y * escapeProgress * 10;
  const jitterX = Math.sin(frame * 0.3 + delay) * 3 * escapeProgress;
  const jitterY = Math.cos(frame * 0.4 + delay) * 2 * escapeProgress;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${finalX + jitterX}%`,
        top: `${finalY + jitterY}%`,
        transform: `translate(-50%, -50%) scale(${appearProgress})`,
        opacity: appearProgress
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "div",
        {
          style: {
            padding: 8,
            background: `${COLORS.secondary}25`,
            borderRadius: 10,
            border: `1px solid ${COLORS.secondary}50`,
            boxShadow: `0 0 15px ${COLORS.secondary}30`
          },
          children: delay % 2 === 0 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(ServerIcon, { size, color: COLORS.secondary }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(DatabaseIcon, { size, color: COLORS.secondary })
        }
      )
    }
  );
};
var ContextMeter = ({
  fillProgress,
  frame
}) => {
  const color = fillProgress < 0.5 ? COLORS.success : fillProgress < 0.8 ? COLORS.warning : "#ff4444";
  const pulseScale = fillProgress > 0.8 ? 1 + Math.sin(frame * 0.2) * 0.03 : 1;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        right: "8%",
        top: "20%",
        width: "8%",
        height: "55%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        transform: `scale(${pulseScale})`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
          "div",
          {
            style: {
              fontSize: 14,
              fontWeight: 700,
              color: COLORS.dimWhite,
              letterSpacing: 1,
              textAlign: "center"
            },
            children: [
              "CONTEXT",
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("br", {}),
              "USAGE"
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            style: {
              flex: 1,
              width: "100%",
              background: "rgba(255,255,255,0.1)",
              borderRadius: 10,
              border: `2px solid ${color}40`,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end"
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
              "div",
              {
                style: {
                  width: "100%",
                  height: `${fillProgress * 100}%`,
                  background: `linear-gradient(0deg, ${color} 0%, ${color}80 100%)`,
                  boxShadow: `0 0 20px ${color}60`,
                  transition: "height 0.1s ease-out"
                }
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
          "div",
          {
            style: {
              fontSize: 24,
              fontWeight: 800,
              color,
              textShadow: `0 0 15px ${color}`
            },
            children: [
              Math.round(fillProgress * 100),
              "%"
            ]
          }
        )
      ]
    }
  );
};
var WarningIndicators = ({
  active,
  frame
}) => {
  if (!active) return null;
  const flashOpacity = 0.5 + Math.sin(frame * 0.25) * 0.5;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        top: "8%",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 15,
        padding: "12px 24px",
        background: `${COLORS.warning}20`,
        border: `2px solid ${COLORS.warning}60`,
        borderRadius: 30,
        opacity: flashOpacity,
        boxShadow: `0 0 30px ${COLORS.warning}40`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(WarningIcon, { size: 28, color: COLORS.warning }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            style: {
              fontSize: 18,
              fontWeight: 700,
              color: COLORS.warning,
              letterSpacing: 1
            },
            children: "PERFORMANCE DEGRADATION"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(WarningIcon, { size: 28, color: COLORS.warning })
      ]
    }
  );
};
var StrugglingAgent = ({ progress, strainLevel, frame }) => {
  const flickerOpacity = strainLevel > 0.5 ? 0.7 + Math.random() * 0.3 : 1;
  const shakeX = strainLevel * Math.sin(frame * 0.5) * 5;
  const shakeY = strainLevel * Math.cos(frame * 0.6) * 3;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
    "div",
    {
      style: {
        opacity: progress * flickerOpacity,
        transform: `scale(${progress}) translate(${shakeX}px, ${shakeY}px)`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          AIAgent,
          {
            x: "70%",
            y: "55%",
            size: 75,
            pulseIntensity: 0.5 - strainLevel * 0.3,
            lookDirection: "left"
          }
        ),
        strainLevel > 0.3 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: "70%",
              top: "55%",
              transform: "translate(-50%, -50%)",
              width: 120,
              height: 120,
              borderRadius: "50%",
              border: `2px solid ${COLORS.warning}${Math.round(strainLevel * 60).toString(16).padStart(2, "0")}`,
              animation: "none"
            }
          }
        )
      ]
    }
  );
};
var Scene5 = ({ startFrame = 0 }) => {
  const frame = (0, import_remotion6.useCurrentFrame)();
  const { fps } = (0, import_remotion6.useVideoConfig)();
  const localFrame = frame - startFrame;
  const toolboxProgress = (0, import_remotion6.spring)({
    frame: localFrame,
    fps,
    config: SPRING_CONFIG
  });
  const contextFill = (0, import_remotion6.interpolate)(
    localFrame,
    [0, 280],
    [0.3, 0.95],
    { extrapolateRight: "clamp" }
  );
  const strainLevel = (0, import_remotion6.interpolate)(
    localFrame,
    [100, 280],
    [0, 0.8],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const warningsActive = localFrame > 150;
  const overflowTools = [
    { x: 25, y: 30, size: 24, delay: 20, escape: { x: -2, y: -1 } },
    { x: 45, y: 35, size: 26, delay: 30, escape: { x: 0, y: -1.5 } },
    { x: 55, y: 32, size: 22, delay: 40, escape: { x: 1, y: -1 } },
    { x: 35, y: 50, size: 28, delay: 50, escape: { x: -1.5, y: 0 } },
    { x: 50, y: 48, size: 24, delay: 60, escape: { x: 0, y: 0.5 } },
    { x: 40, y: 65, size: 26, delay: 70, escape: { x: -1, y: 1 } },
    { x: 55, y: 62, size: 22, delay: 80, escape: { x: 1, y: 1 } },
    { x: 30, y: 45, size: 20, delay: 90, escape: { x: -2, y: 0 } },
    { x: 48, y: 72, size: 24, delay: 100, escape: { x: 0, y: 1.5 } },
    { x: 60, y: 50, size: 22, delay: 110, escape: { x: 2, y: 0 } },
    { x: 25, y: 60, size: 20, delay: 120, escape: { x: -2, y: 1 } },
    { x: 58, y: 40, size: 20, delay: 130, escape: { x: 2, y: -1 } }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_remotion6.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 40% 50%, ${COLORS.warning}${Math.round(strainLevel * 15).toString(16).padStart(2, "0")} 0%, transparent 60%)`
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: "40%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${toolboxProgress})`,
          width: "45%",
          height: "55%",
          background: `linear-gradient(135deg, ${COLORS.secondary}15 0%, ${COLORS.secondary}08 100%)`,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: `2px solid ${COLORS.secondary}50`,
          borderRadius: 20,
          boxShadow: `0 0 40px ${COLORS.secondary}30`,
          opacity: toolboxProgress,
          overflow: "visible"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: 15,
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: 24,
              fontWeight: 800,
              color: COLORS.secondary,
              letterSpacing: 2
            },
            children: "MCP"
          }
        )
      }
    ),
    overflowTools.map((tool, i) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      OverflowTool,
      {
        x: tool.x,
        y: tool.y,
        size: tool.size,
        delay: tool.delay,
        frame: localFrame,
        fps,
        escapeDirection: tool.escape
      },
      i
    )),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(ContextMeter, { fillProgress: contextFill, frame: localFrame }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(WarningIndicators, { active: warningsActive, frame: localFrame }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      StrugglingAgent,
      {
        progress: toolboxProgress,
        strainLevel,
        frame: localFrame
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "10%",
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
          opacity: (0, import_remotion6.interpolate)(localFrame, [180, 210], [0, 1], { extrapolateRight: "clamp" })
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            "div",
            {
              style: {
                fontSize: 24,
                fontWeight: 600,
                color: COLORS.warning,
                textShadow: `0 0 15px ${COLORS.warning}`
              },
              children: "Performance tends to degrade"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { fontSize: 16, color: COLORS.dimWhite, marginTop: 8 }, children: "Too many tools consume context" })
        ]
      }
    )
  ] });
};

// src/proj_956b6123_5a01_40bc_a3ee_4648502af85d/scenes/Scene6.tsx
var import_remotion7 = require("remotion");
var import_jsx_runtime8 = require("react/jsx-runtime");
var APICard = ({ label, icon, delay, frame, fps }) => {
  const progress = (0, import_remotion7.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG
  });
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 18px",
        background: `${COLORS.secondary}15`,
        border: `1px solid ${COLORS.secondary}40`,
        borderRadius: 12,
        opacity: progress,
        transform: `translateX(${(1 - progress) * -30}px) scale(${0.9 + progress * 0.1})`
      },
      children: [
        icon,
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { fontSize: 16, fontWeight: 600, color: COLORS.secondary }, children: label })
      ]
    }
  );
};
var GuidanceCard = ({ title, description, delay, frame, fps }) => {
  const progress = (0, import_remotion7.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG
  });
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    "div",
    {
      style: {
        padding: "16px 18px",
        background: `${COLORS.primary}12`,
        border: `1px solid ${COLORS.primary}40`,
        borderRadius: 12,
        opacity: progress,
        transform: `translateX(${(1 - progress) * 30}px) scale(${0.9 + progress * 0.1})`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 8
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(CheckmarkIcon, { size: 18, color: COLORS.primary }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { fontSize: 16, fontWeight: 700, color: COLORS.primary }, children: title })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { fontSize: 13, color: COLORS.dimWhite, lineHeight: 1.4 }, children: description })
      ]
    }
  );
};
var MCPPanel = ({
  frame,
  fps,
  progress
}) => {
  const apiOperations = [
    { label: "files.create()", icon: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(DatabaseIcon, { size: 22, color: COLORS.secondary }), delay: 50 },
    { label: "files.delete()", icon: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(DatabaseIcon, { size: 22, color: COLORS.secondary }), delay: 60 },
    { label: "files.update()", icon: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(DatabaseIcon, { size: 22, color: COLORS.secondary }), delay: 70 },
    { label: "files.list()", icon: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(FolderIcon, { size: 22, color: COLORS.secondary }), delay: 80 }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "5%",
        top: "15%",
        width: "40%",
        height: "70%",
        background: `linear-gradient(135deg, ${COLORS.secondary}08 0%, ${COLORS.secondary}03 100%)`,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border: `2px solid ${COLORS.secondary}30`,
        borderRadius: 20,
        padding: 24,
        opacity: progress,
        transform: `scale(${0.95 + progress * 0.05})`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "div",
          {
            style: {
              fontSize: 24,
              fontWeight: 800,
              color: COLORS.secondary,
              textShadow: `0 0 15px ${COLORS.secondary}`,
              marginBottom: 8,
              letterSpacing: 2
            },
            children: "MCP"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { fontSize: 14, color: COLORS.dimWhite, marginBottom: 20 }, children: "Raw API Access" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "div",
          {
            style: {
              fontSize: 18,
              fontWeight: 700,
              color: COLORS.white,
              marginBottom: 16,
              opacity: (0, import_remotion7.interpolate)(frame, [100, 130], [0, 1], { extrapolateRight: "clamp" })
            },
            children: "Google Drive API"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { display: "flex", flexDirection: "column", gap: 12 }, children: apiOperations.map((op, i) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          APICard,
          {
            label: op.label,
            icon: op.icon,
            delay: op.delay,
            frame,
            fps
          },
          i
        )) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              bottom: 20,
              left: 24,
              right: 24,
              fontSize: 12,
              color: `${COLORS.secondary}80`,
              textAlign: "center"
            },
            children: "Direct tool access"
          }
        )
      ]
    }
  );
};
var SkillsPanel = ({
  frame,
  fps,
  progress
}) => {
  const guidelines = [
    {
      title: "Document Structure",
      description: "How to organize PRDs with clear sections and hierarchy",
      delay: 90
    },
    {
      title: "Best Practices",
      description: "Writing guidelines, formatting standards, templates",
      delay: 100
    },
    {
      title: "Review Process",
      description: "Steps for stakeholder review and iteration",
      delay: 110
    }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        right: "5%",
        top: "15%",
        width: "40%",
        height: "70%",
        background: `linear-gradient(135deg, ${COLORS.primary}08 0%, ${COLORS.primary}03 100%)`,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border: `2px solid ${COLORS.primary}30`,
        borderRadius: 20,
        padding: 24,
        opacity: progress,
        transform: `scale(${0.95 + progress * 0.05})`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "div",
          {
            style: {
              fontSize: 24,
              fontWeight: 800,
              color: COLORS.primary,
              textShadow: `0 0 15px ${COLORS.primary}`,
              marginBottom: 8,
              letterSpacing: 2
            },
            children: "SKILLS"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { fontSize: 14, color: COLORS.dimWhite, marginBottom: 20 }, children: "Behavioral Guidance" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
          "div",
          {
            style: {
              fontSize: 18,
              fontWeight: 700,
              color: COLORS.white,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 10,
              opacity: (0, import_remotion7.interpolate)(frame, [100, 130], [0, 1], { extrapolateRight: "clamp" })
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(DocumentIcon, { size: 22, color: COLORS.primary }),
              "Product Requirements Doc"
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { display: "flex", flexDirection: "column", gap: 12 }, children: guidelines.map((guide, i) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          GuidanceCard,
          {
            title: guide.title,
            description: guide.description,
            delay: guide.delay,
            frame,
            fps
          },
          i
        )) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              bottom: 20,
              left: 24,
              right: 24,
              fontSize: 12,
              color: `${COLORS.primary}80`,
              textAlign: "center"
            },
            children: "Teaches how to use tools effectively"
          }
        )
      ]
    }
  );
};
var CenterDivider = ({ progress, frame }) => {
  const glowIntensity = 0.5 + Math.sin(frame * 0.05) * 0.2;
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "20%",
        transform: "translateX(-50%)",
        width: 3,
        height: "60%",
        background: `linear-gradient(180deg, transparent 0%, ${COLORS.accent}${Math.round(glowIntensity * 80).toString(16).padStart(2, "0")} 50%, transparent 100%)`,
        boxShadow: `0 0 20px ${COLORS.accent}40`,
        opacity: progress
      }
    }
  );
};
var Scene6 = ({ startFrame = 0 }) => {
  const frame = (0, import_remotion7.useCurrentFrame)();
  const { fps } = (0, import_remotion7.useVideoConfig)();
  const localFrame = frame - startFrame;
  const panelProgress = (0, import_remotion7.spring)({
    frame: localFrame,
    fps,
    config: SPRING_CONFIG
  });
  const dividerProgress = (0, import_remotion7.spring)({
    frame: localFrame - 20,
    fps,
    config: { damping: 30, stiffness: 80, mass: 1 }
  });
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_remotion7.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "8%",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 20,
          fontWeight: 800,
          color: COLORS.accent,
          textShadow: `0 0 15px ${COLORS.accent}`,
          letterSpacing: 4,
          opacity: (0, import_remotion7.interpolate)(localFrame, [40, 70], [0, 1], { extrapolateRight: "clamp" })
        },
        children: "VS"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(CenterDivider, { progress: dividerProgress, frame: localFrame }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(MCPPanel, { frame: localFrame, fps, progress: panelProgress }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(SkillsPanel, { frame: localFrame, fps, progress: panelProgress }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "8%",
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
          opacity: (0, import_remotion7.interpolate)(localFrame, [200, 240], [0, 1], { extrapolateRight: "clamp" })
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { fontSize: 22, fontWeight: 600, color: COLORS.white }, children: "Same domain, different approaches" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { fontSize: 16, color: COLORS.dimWhite, marginTop: 8 }, children: "Tools vs. Knowledge" })
        ]
      }
    )
  ] });
};

// src/proj_956b6123_5a01_40bc_a3ee_4648502af85d/scenes/Scene7.tsx
var import_remotion8 = require("remotion");
var import_jsx_runtime9 = require("react/jsx-runtime");
var MCPSystem = ({ progress, frame }) => {
  const glowPulse = 0.8 + Math.sin(frame * 0.1) * 0.2;
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: "25%",
        top: "40%",
        transform: `translate(-50%, -50%) scale(${progress})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
        opacity: progress
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
        "div",
        {
          style: {
            width: 180,
            height: 200,
            background: `linear-gradient(135deg, ${COLORS.secondary}20 0%, ${COLORS.secondary}10 100%)`,
            border: `3px solid ${COLORS.secondary}60`,
            borderRadius: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 15,
            boxShadow: `0 0 ${40 * glowPulse}px ${COLORS.secondary}40`
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: { display: "flex", gap: 12 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(ServerIcon, { size: 36, color: COLORS.secondary }),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(DatabaseIcon, { size: 36, color: COLORS.secondary })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: { display: "flex", gap: 12 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(FolderIcon, { size: 30, color: COLORS.secondary }),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(DocumentIcon, { size: 30, color: COLORS.secondary })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
              "div",
              {
                style: {
                  fontSize: 24,
                  fontWeight: 800,
                  color: COLORS.secondary,
                  letterSpacing: 3
                },
                children: "MCP"
              }
            )
          ]
        }
      )
    }
  );
};
var SkillsSystem = ({ progress, frame }) => {
  const glowPulse = 0.8 + Math.sin(frame * 0.1 + 1) * 0.2;
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: "75%",
        top: "40%",
        transform: `translate(-50%, -50%) scale(${progress})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
        opacity: progress
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
        "div",
        {
          style: {
            width: 180,
            height: 200,
            background: `linear-gradient(135deg, ${COLORS.primary}20 0%, ${COLORS.primary}10 100%)`,
            border: `3px solid ${COLORS.primary}60`,
            borderRadius: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            boxShadow: `0 0 ${40 * glowPulse}px ${COLORS.primary}40`
          },
          children: [
            [0, 1, 2].map((i) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
              "div",
              {
                style: {
                  width: "70%",
                  height: 12,
                  background: `linear-gradient(90deg, ${COLORS.primary}50 ${70 - i * 15}%, transparent ${70 - i * 15}%)`,
                  borderRadius: 6
                }
              },
              i
            )),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(FolderIcon, { size: 40, color: COLORS.primary }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
              "div",
              {
                style: {
                  fontSize: 24,
                  fontWeight: 800,
                  color: COLORS.primary,
                  letterSpacing: 3
                },
                children: "SKILLS"
              }
            )
          ]
        }
      )
    }
  );
};
var DistinctionLabel = ({ text, highlight, x, color, progress }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: "68%",
        transform: `translate(-50%, -50%) scale(${progress})`,
        textAlign: "center",
        opacity: progress
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          "div",
          {
            style: {
              fontSize: 18,
              fontWeight: 700,
              color: COLORS.dimWhite,
              marginBottom: 8,
              letterSpacing: 2
            },
            children: text
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          "div",
          {
            style: {
              fontSize: 32,
              fontWeight: 900,
              color,
              textShadow: `0 0 25px ${color}`,
              letterSpacing: 3
            },
            children: highlight
          }
        )
      ]
    }
  );
};
var Scene7 = ({ startFrame = 0 }) => {
  const frame = (0, import_remotion8.useCurrentFrame)();
  const { fps } = (0, import_remotion8.useVideoConfig)();
  const localFrame = frame - startFrame;
  const mcpProgress = (0, import_remotion8.spring)({
    frame: localFrame,
    fps,
    config: SPRING_CONFIG
  });
  const skillsProgress = (0, import_remotion8.spring)({
    frame: localFrame - 8,
    fps,
    config: SPRING_CONFIG
  });
  const labelProgress = (0, import_remotion8.spring)({
    frame: localFrame - 25,
    fps,
    config: { damping: 18, stiffness: 100, mass: 0.8 }
  });
  const dividerOpacity = (0, import_remotion8.interpolate)(
    localFrame,
    [15, 35],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_remotion8.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "10%",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 28,
          fontWeight: 800,
          color: COLORS.white,
          textAlign: "center",
          opacity: (0, import_remotion8.interpolate)(localFrame, [0, 20], [0, 1], { extrapolateRight: "clamp" })
        },
        children: "The Key Distinction"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: "50%",
          top: "30%",
          transform: "translateX(-50%)",
          width: 3,
          height: "45%",
          background: `linear-gradient(180deg, transparent, ${COLORS.accent}60, transparent)`,
          opacity: dividerOpacity
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(MCPSystem, { progress: mcpProgress, frame: localFrame }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(SkillsSystem, { progress: skillsProgress, frame: localFrame }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      DistinctionLabel,
      {
        text: "RAW",
        highlight: "TOOLS",
        x: "25%",
        color: COLORS.secondary,
        progress: labelProgress
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      DistinctionLabel,
      {
        text: "BEHAVIORAL",
        highlight: "GUIDANCE",
        x: "75%",
        color: COLORS.primary,
        progress: labelProgress
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "10%",
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
          opacity: (0, import_remotion8.interpolate)(localFrame, [50, 70], [0, 1], { extrapolateRight: "clamp" })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          "div",
          {
            style: {
              fontSize: 24,
              fontWeight: 700,
              color: COLORS.accent,
              textShadow: `0 0 20px ${COLORS.accent}`
            },
            children: "Different purposes, complementary roles"
          }
        )
      }
    )
  ] });
};

// src/proj_956b6123_5a01_40bc_a3ee_4648502af85d/scenes/Scene8.tsx
var import_remotion9 = require("remotion");
var import_jsx_runtime10 = require("react/jsx-runtime");
var FadedSystems = ({ opacity }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_jsx_runtime10.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: "20%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 120,
          height: 140,
          background: `${COLORS.secondary}08`,
          border: `2px solid ${COLORS.secondary}20`,
          borderRadius: 16,
          opacity
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: "80%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 120,
          height: 140,
          background: `${COLORS.primary}08`,
          border: `2px solid ${COLORS.primary}20`,
          borderRadius: 16,
          opacity
        }
      }
    )
  ] });
};
var CommentInterface = ({ progress, frame, keywordGlow }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "42%",
        transform: `translate(-50%, -50%) scale(${0.95 + progress * 0.05})`,
        width: "75%",
        opacity: progress
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
        "div",
        {
          style: {
            background: "rgba(255, 255, 255, 0.08)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: 20,
            padding: 28,
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.3)"
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 20
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                    "div",
                    {
                      style: {
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.secondary})`,
                        boxShadow: `0 0 15px ${COLORS.accent}40`
                      }
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { fontSize: 16, fontWeight: 700, color: COLORS.white }, children: "Add a comment..." }),
                    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { fontSize: 12, color: COLORS.dimWhite }, children: "Share your thoughts" })
                  ] })
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
              "div",
              {
                style: {
                  background: "rgba(0, 0, 0, 0.3)",
                  borderRadius: 12,
                  padding: 20,
                  minHeight: 80
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { style: { fontSize: 18, color: COLORS.dimWhite }, children: [
                    "Comment",
                    " "
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                    "span",
                    {
                      style: {
                        fontSize: 20,
                        fontWeight: 800,
                        color: COLORS.primary,
                        textShadow: `0 0 ${20 + keywordGlow * 30}px ${COLORS.primary}`,
                        background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.accent})`,
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                        padding: "2px 8px",
                        borderRadius: 4,
                        border: `1px solid ${COLORS.primary}${Math.round(40 + keywordGlow * 40).toString(16).padStart(2, "0")}`
                      },
                      children: "skills"
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { style: { fontSize: 18, color: COLORS.dimWhite }, children: [
                    " ",
                    "to learn more about behavioral guidance for AI agents"
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                    "span",
                    {
                      style: {
                        display: "inline-block",
                        width: 2,
                        height: 20,
                        background: COLORS.white,
                        marginLeft: 4,
                        opacity: Math.sin(frame * 0.15) > 0 ? 1 : 0,
                        verticalAlign: "middle"
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
  );
};
var InvitationParticles = ({
  frame,
  active
}) => {
  if (!active) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_jsx_runtime10.Fragment, { children: Array.from({ length: 15 }).map((_, i) => {
    const angle = i / 15 * Math.PI * 2;
    const baseRadius = 200 + i * 10;
    const radius = baseRadius + Math.sin(frame * 0.05 + i) * 30;
    const x = 50 + Math.cos(angle + frame * 0.01) * (radius / 10);
    const y = 42 + Math.sin(angle + frame * 0.01) * (radius / 18);
    const size = 4 + i % 3 * 2;
    const opacity = 0.3 + Math.sin(frame * 0.1 + i * 0.5) * 0.2;
    return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: `${x}%`,
          top: `${y}%`,
          width: size,
          height: size,
          borderRadius: "50%",
          background: i % 3 === 0 ? COLORS.primary : i % 3 === 1 ? COLORS.secondary : COLORS.accent,
          opacity,
          boxShadow: `0 0 10px currentColor`
        }
      },
      i
    );
  }) });
};
var Scene8 = ({ startFrame = 0 }) => {
  const frame = (0, import_remotion9.useCurrentFrame)();
  const { fps } = (0, import_remotion9.useVideoConfig)();
  const localFrame = frame - startFrame;
  const systemsFade = (0, import_remotion9.interpolate)(
    localFrame,
    [0, 30],
    [0.4, 0.15],
    { extrapolateRight: "clamp" }
  );
  const interfaceProgress = (0, import_remotion9.spring)({
    frame: localFrame - 20,
    fps,
    config: SPRING_CONFIG
  });
  const keywordGlow = (0, import_remotion9.interpolate)(
    localFrame,
    [60, 100, 169, 198],
    [0, 0.5, 1, 0.8],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const particlesActive = localFrame > 40;
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_remotion9.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(FadedSystems, { opacity: systemsFade }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(InvitationParticles, { frame: localFrame, active: particlesActive }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
      CommentInterface,
      {
        progress: interfaceProgress,
        frame: localFrame,
        keywordGlow
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "18%",
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
          opacity: (0, import_remotion9.interpolate)(localFrame, [80, 110], [0, 1], { extrapolateRight: "clamp" })
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            "div",
            {
              style: {
                fontSize: 26,
                fontWeight: 700,
                color: COLORS.white,
                marginBottom: 12
              },
              children: "Want to learn more?"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
            "div",
            {
              style: {
                fontSize: 18,
                color: COLORS.dimWhite,
                lineHeight: 1.5
              },
              children: [
                "Comment ",
                /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { style: { color: COLORS.primary, fontWeight: 700 }, children: "skills" }),
                " below",
                /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("br", {}),
                "and I'll share resources for building with AI agents"
              ]
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "5%",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 14,
          color: `${COLORS.dimWhite}60`,
          letterSpacing: 2,
          opacity: (0, import_remotion9.interpolate)(localFrame, [150, 180], [0, 1], { extrapolateRight: "clamp" })
        },
        children: "THANKS FOR WATCHING"
      }
    )
  ] });
};

// src/proj_956b6123_5a01_40bc_a3ee_4648502af85d/index.tsx
var import_jsx_runtime11 = require("react/jsx-runtime");
var MainComposition = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
    import_remotion10.AbsoluteFill,
    {
      style: {
        backgroundColor: COLORS.dark,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Background, {}, "bg"),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          import_remotion10.Sequence,
          {
            from: TIMING.scene1.start,
            durationInFrames: TIMING.scene1.duration,
            children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Scene1, { startFrame: 0 })
          },
          "scene1"
        ),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          import_remotion10.Sequence,
          {
            from: TIMING.scene2.start,
            durationInFrames: TIMING.scene2.duration,
            children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Scene2, { startFrame: 0 })
          },
          "scene2"
        ),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          import_remotion10.Sequence,
          {
            from: TIMING.scene3.start,
            durationInFrames: TIMING.scene3.duration,
            children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Scene3, { startFrame: 0 })
          },
          "scene3"
        ),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          import_remotion10.Sequence,
          {
            from: TIMING.scene4.start,
            durationInFrames: TIMING.scene4.duration,
            children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Scene4, { startFrame: 0 })
          },
          "scene4"
        ),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          import_remotion10.Sequence,
          {
            from: TIMING.scene5.start,
            durationInFrames: TIMING.scene5.duration,
            children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Scene5, { startFrame: 0 })
          },
          "scene5"
        ),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          import_remotion10.Sequence,
          {
            from: TIMING.scene6.start,
            durationInFrames: TIMING.scene6.duration,
            children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Scene6, { startFrame: 0 })
          },
          "scene6"
        ),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          import_remotion10.Sequence,
          {
            from: TIMING.scene7.start,
            durationInFrames: TIMING.scene7.duration,
            children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Scene7, { startFrame: 0 })
          },
          "scene7"
        ),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          import_remotion10.Sequence,
          {
            from: TIMING.scene8.start,
            durationInFrames: TIMING.scene8.duration,
            children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Scene8, { startFrame: 0 })
          },
          "scene8"
        )
      ]
    }
  );
};
var RemotionRoot = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
    import_remotion10.Composition,
    {
      id: "proj_956b6123_5a01_40bc_a3ee_4648502af85d",
      component: MainComposition,
      durationInFrames: VIDEO_CONFIG.durationInFrames,
      fps: VIDEO_CONFIG.fps,
      width: VIDEO_CONFIG.width,
      height: VIDEO_CONFIG.height
    }
  );
};
var index_default = MainComposition;
(0, import_remotion10.registerRoot)(RemotionRoot);
