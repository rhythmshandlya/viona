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

// src/proj_c6e0a8e1_de72_4f2f_883a_5213e23dfa8a/index.tsx
var index_exports = {};
__export(index_exports, {
  RemotionRoot: () => RemotionRoot,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_remotion = require("remotion");

// src/proj_c6e0a8e1_de72_4f2f_883a_5213e23dfa8a/constants.ts
var COLORS = {
  // Primary: Cyan - Skills, efficiency, smart loading
  primary: "#00f5d4",
  // Secondary: Purple - MCP, power, comprehensive access
  secondary: "#7b2cbf",
  // Accent: Magenta - highlights, important moments
  accent: "#f72585",
  // Background: Deep dark
  background: "#0a0a0f",
  // Additional utility colors
  white: "#ffffff",
  darkGray: "#1a1a2e",
  mediumGray: "#2a2a4a"
};
var SPRING_CONFIG = {
  damping: 22,
  stiffness: 90,
  mass: 0.9
};
var TIMING = {
  fps: 30,
  totalDuration: 2208,
  // Scene 1: The Question
  scene1Start: 0,
  scene1End: 87,
  scene1KeySync: 87,
  // "skill"
  // Scene 2: Skills Introduction
  scene2Start: 88,
  scene2End: 268,
  scene2KeySync: 150,
  // "folder"
  // Scene 3: Skills Architecture
  scene3Start: 269,
  scene3End: 606,
  scene3KeySync: 457,
  // "body"
  // Scene 4: Lazy Loading Magic
  scene4Start: 607,
  scene4End: 763,
  scene4KeySync: 657,
  // "only"
  // Scene 5: MCP Server Introduction
  scene5Start: 764,
  scene5End: 1028,
  scene5KeySync: 845,
  // "server"
  // Scene 6: Context Performance Trade-off
  scene6Start: 1029,
  scene6End: 1373,
  scene6KeySync: 1114,
  // "lot"
  // Scene 7: Capability Comparison
  scene7Start: 1374,
  scene7End: 1928,
  scene7KeySync: 1712,
  // "it"
  // Scene 8: Final Wisdom
  scene8Start: 1929,
  scene8End: 2208,
  scene8KeySync: 1947
  // "raw"
};
var glassStyle = {
  background: "rgba(255, 255, 255, 0.1)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: 16,
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)"
};

// src/proj_c6e0a8e1_de72_4f2f_883a_5213e23dfa8a/index.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var AnimatedBackground = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height } = (0, import_remotion.useVideoConfig)();
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: { backgroundColor: COLORS.background }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width, height, style: { position: "absolute", opacity: 0.1 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pattern", { id: "grid", width: "60", height: "60", patternUnits: "userSpaceOnUse", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M 60 0 L 0 0 0 60", fill: "none", stroke: COLORS.primary, strokeWidth: "0.5" }) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { width: "100%", height: "100%", fill: "url(#grid)" })
    ] }),
    Array.from({ length: 15 }).map((_, i) => {
      const x = (frame * 0.5 + i * 120) % (width + 100) - 50;
      const y = height * (0.2 + i % 5 * 0.15) + Math.sin((frame + i * 30) * 0.02) * 30;
      const isCyan = i % 2 === 0;
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: x,
            top: y,
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: isCyan ? COLORS.primary : COLORS.secondary,
            opacity: 0.3,
            filter: `blur(${1 + i % 3}px)`
          }
        },
        i
      );
    })
  ] });
};
var QuestionMark = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const scaleIn = (0, import_remotion.spring)({ frame, fps, config: SPRING_CONFIG });
  const fadeOut = (0, import_remotion.interpolate)(frame, [40, 70], [1, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "35%",
        transform: `translate(-50%, -50%) scale(${scaleIn})`,
        opacity: fadeOut,
        fontSize: 200,
        fontWeight: 900,
        color: COLORS.accent,
        textShadow: `0 0 60px ${COLORS.accent}, 0 0 100px ${COLORS.accent}`,
        fontFamily: "system-ui, sans-serif"
      },
      children: "?"
    }
  );
};
var FolderIcon = ({ glowActive }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const slideProgress = (0, import_remotion.spring)({ frame: frame - 30, fps, config: SPRING_CONFIG });
  const translateX = (0, import_remotion.interpolate)(slideProgress, [0, 1], [-200, 0], { extrapolateRight: "clamp" });
  const glowIntensity = glowActive ? 1 : 0.3;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "20%",
        top: "50%",
        transform: `translate(-50%, -50%) translateX(${translateX}px)`,
        opacity: slideProgress
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: "180", height: "150", viewBox: "0 0 180 150", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "rect",
            {
              x: "10",
              y: "40",
              width: "160",
              height: "100",
              rx: "8",
              fill: COLORS.darkGray,
              stroke: COLORS.primary,
              strokeWidth: "2",
              style: {
                filter: `drop-shadow(0 0 ${glowActive ? 30 : 10}px ${COLORS.primary})`,
                transition: "filter 0.3s ease"
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "path",
            {
              d: "M 10 40 L 10 30 Q 10 20 20 20 L 60 20 L 75 40",
              fill: COLORS.darkGray,
              stroke: COLORS.primary,
              strokeWidth: "2"
            }
          ),
          glowActive && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "rect",
            {
              x: "15",
              y: "45",
              width: "150",
              height: "90",
              rx: "6",
              fill: COLORS.primary,
              opacity: 0.2
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              textAlign: "center",
              marginTop: 20,
              fontSize: 24,
              fontWeight: 700,
              color: COLORS.primary,
              letterSpacing: 2,
              opacity: glowIntensity
            },
            children: "SKILLS"
          }
        )
      ]
    }
  );
};
var ServerIcon = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const slideProgress = (0, import_remotion.spring)({ frame: frame - 35, fps, config: SPRING_CONFIG });
  const translateX = (0, import_remotion.interpolate)(slideProgress, [0, 1], [200, 0], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        right: "20%",
        top: "50%",
        transform: `translate(50%, -50%) translateX(${translateX}px)`,
        opacity: slideProgress
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: "140", height: "160", viewBox: "0 0 140 160", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "rect",
            {
              x: "10",
              y: "10",
              width: "120",
              height: "40",
              rx: "6",
              fill: COLORS.darkGray,
              stroke: COLORS.secondary,
              strokeWidth: "2",
              style: { filter: `drop-shadow(0 0 10px ${COLORS.secondary})` }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "30", cy: "30", r: "6", fill: COLORS.secondary, opacity: 0.8 }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "50", y: "25", width: "60", height: "10", rx: "2", fill: COLORS.mediumGray }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "rect",
            {
              x: "10",
              y: "60",
              width: "120",
              height: "40",
              rx: "6",
              fill: COLORS.darkGray,
              stroke: COLORS.secondary,
              strokeWidth: "2",
              style: { filter: `drop-shadow(0 0 10px ${COLORS.secondary})` }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "30", cy: "80", r: "6", fill: COLORS.secondary, opacity: 0.8 }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "50", y: "75", width: "60", height: "10", rx: "2", fill: COLORS.mediumGray }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "rect",
            {
              x: "10",
              y: "110",
              width: "120",
              height: "40",
              rx: "6",
              fill: COLORS.darkGray,
              stroke: COLORS.secondary,
              strokeWidth: "2",
              style: { filter: `drop-shadow(0 0 10px ${COLORS.secondary})` }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "30", cy: "130", r: "6", fill: COLORS.secondary, opacity: 0.8 }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "50", y: "125", width: "60", height: "10", rx: "2", fill: COLORS.mediumGray })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              textAlign: "center",
              marginTop: 20,
              fontSize: 24,
              fontWeight: 700,
              color: COLORS.secondary,
              letterSpacing: 2
            },
            children: "MCP"
          }
        )
      ]
    }
  );
};
var VSDivider = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const fadeIn = (0, import_remotion.spring)({ frame: frame - 50, fps, config: SPRING_CONFIG });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        opacity: fadeIn
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            fontSize: 48,
            fontWeight: 900,
            color: COLORS.white,
            textShadow: `0 0 20px ${COLORS.accent}`,
            fontFamily: "system-ui, sans-serif"
          },
          children: "VS"
        }
      )
    }
  );
};
var Scene1Question = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const glowActive = frame >= 80;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QuestionMark, {}, "question"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderIcon, { glowActive }, "folder"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ServerIcon, {}, "server"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VSDivider, {}, "vs")
  ] });
};
var SkillsFolder3D = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const keySyncRelative = 62;
  const enterProgress = (0, import_remotion.spring)({ frame, fps, config: SPRING_CONFIG });
  const scale = (0, import_remotion.interpolate)(enterProgress, [0, 1], [0.5, 1.2], { extrapolateRight: "clamp" });
  const floatY = Math.sin(frame * 0.05) * 15;
  const is3DActive = frame >= keySyncRelative - 5;
  const rotateProgress = (0, import_remotion.spring)({ frame: frame - keySyncRelative + 5, fps, config: { ...SPRING_CONFIG, damping: 25 } });
  const rotateX = is3DActive ? (0, import_remotion.interpolate)(rotateProgress, [0, 1], [0, 15], { extrapolateRight: "clamp" }) : 0;
  const rotateY = is3DActive ? (0, import_remotion.interpolate)(rotateProgress, [0, 1], [0, -10], { extrapolateRight: "clamp" }) : 0;
  const glowSize = is3DActive ? (0, import_remotion.interpolate)(rotateProgress, [0, 1], [15, 40], { extrapolateRight: "clamp" }) : 15;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "45%",
        transform: `translate(-50%, -50%) translateY(${floatY}px) scale(${scale}) perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        opacity: enterProgress,
        transformStyle: "preserve-3d"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              width: 280,
              height: 50,
              background: `radial-gradient(ellipse, rgba(0, 245, 212, 0.3) 0%, transparent 70%)`,
              bottom: -60,
              left: "50%",
              transform: "translateX(-50%)",
              filter: "blur(15px)"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: "280", height: "220", viewBox: "0 0 280 220", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "rect",
            {
              x: "20",
              y: "50",
              width: "240",
              height: "150",
              rx: "12",
              fill: COLORS.darkGray,
              stroke: COLORS.primary,
              strokeWidth: "3",
              style: { filter: `drop-shadow(0 0 ${glowSize}px ${COLORS.primary})` }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "path",
            {
              d: "M 20 50 L 20 35 Q 20 20 35 20 L 100 20 L 120 50",
              fill: COLORS.darkGray,
              stroke: COLORS.primary,
              strokeWidth: "3"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "rect",
            {
              x: "30",
              y: "60",
              width: "220",
              height: "130",
              rx: "8",
              fill: COLORS.primary,
              opacity: is3DActive ? 0.15 : 0.05
            }
          ),
          [0, 1, 2].map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "rect",
            {
              x: "50",
              y: 90 + i * 35,
              width: 160 - i * 30,
              height: "8",
              rx: "4",
              fill: COLORS.primary,
              opacity: 0.3 + (is3DActive ? 0.2 : 0)
            },
            i
          ))
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              textAlign: "center",
              marginTop: 30,
              fontSize: 42,
              fontWeight: 800,
              color: COLORS.primary,
              letterSpacing: 8,
              textShadow: `0 0 ${glowSize}px ${COLORS.primary}`,
              fontFamily: "system-ui, sans-serif"
            },
            children: "SKILL"
          }
        )
      ]
    }
  );
};
var SkillsParticles = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: Array.from({ length: 20 }).map((_, i) => {
    const angle = i / 20 * Math.PI * 2;
    const radius = 200 + Math.sin((frame + i * 10) * 0.03) * 30;
    const x = 540 + Math.cos(angle + frame * 0.01) * radius;
    const y = 850 + Math.sin(angle + frame * 0.01) * radius * 0.6;
    const size = 4 + Math.sin((frame + i * 20) * 0.05) * 2;
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
          opacity: 0.4 + Math.sin((frame + i * 15) * 0.04) * 0.2,
          boxShadow: `0 0 10px ${COLORS.primary}`
        }
      },
      i
    );
  }) });
};
var Scene2SkillsIntro = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SkillsParticles, {}, "particles"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SkillsFolder3D, {}, "folder3d")
  ] });
};
var FrontMatterSection = ({ enterProgress }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        ...glassStyle,
        width: 400,
        padding: 24,
        opacity: enterProgress,
        transform: `translateY(${(0, import_remotion.interpolate)(enterProgress, [0, 1], [-30, 0], { extrapolateRight: "clamp" })}px)`,
        borderColor: COLORS.primary,
        boxShadow: `0 0 30px rgba(0, 245, 212, 0.4), 0 8px 32px rgba(0, 0, 0, 0.3)`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              fontSize: 20,
              fontWeight: 800,
              color: COLORS.primary,
              letterSpacing: 3,
              marginBottom: 16,
              fontFamily: "system-ui, sans-serif"
            },
            children: "FRONT MATTER"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 12 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 12 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "div",
              {
                style: {
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: COLORS.primary,
                  boxShadow: `0 0 10px ${COLORS.primary}`
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.white, fontSize: 18, fontFamily: "system-ui, sans-serif" }, children: "name" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 12 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "div",
              {
                style: {
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: COLORS.primary,
                  boxShadow: `0 0 10px ${COLORS.primary}`
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.white, fontSize: 18, fontFamily: "system-ui, sans-serif" }, children: "description" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              marginTop: 16,
              fontSize: 14,
              color: "rgba(255,255,255,0.5)",
              fontStyle: "italic",
              fontFamily: "system-ui, sans-serif"
            },
            children: "Lightweight metadata - always loaded"
          }
        )
      ]
    }
  );
};
var BodySection = ({
  enterProgress,
  isIlluminated,
  illuminateProgress
}) => {
  const glowIntensity = isIlluminated ? (0, import_remotion.interpolate)(illuminateProgress, [0, 1], [0, 1], { extrapolateRight: "clamp" }) : 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        ...glassStyle,
        width: 400,
        padding: 24,
        marginTop: 20,
        opacity: enterProgress,
        transform: `translateY(${(0, import_remotion.interpolate)(enterProgress, [0, 1], [30, 0], { extrapolateRight: "clamp" })}px)`,
        borderColor: isIlluminated ? COLORS.primary : "rgba(0, 245, 212, 0.3)",
        boxShadow: isIlluminated ? `0 0 ${30 + glowIntensity * 30}px rgba(0, 245, 212, ${0.3 + glowIntensity * 0.4}), 0 8px 32px rgba(0, 0, 0, 0.3)` : "0 8px 32px rgba(0, 0, 0, 0.3)",
        transition: "border-color 0.3s ease"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              fontSize: 20,
              fontWeight: 800,
              color: isIlluminated ? COLORS.primary : "rgba(0, 245, 212, 0.4)",
              letterSpacing: 3,
              marginBottom: 16,
              fontFamily: "system-ui, sans-serif",
              transition: "color 0.3s ease"
            },
            children: "BODY"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "flex", flexDirection: "column", gap: 10 }, children: ["instructions", "scripts", "resources", "examples"].map((item, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 12 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: isIlluminated ? COLORS.primary : "rgba(0, 245, 212, 0.3)",
                boxShadow: isIlluminated ? `0 0 10px ${COLORS.primary}` : "none",
                transition: "all 0.3s ease",
                transitionDelay: `${i * 0.1}s`
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "span",
            {
              style: {
                color: isIlluminated ? COLORS.white : "rgba(255,255,255,0.4)",
                fontSize: 18,
                fontFamily: "system-ui, sans-serif",
                transition: "color 0.3s ease",
                transitionDelay: `${i * 0.1}s`
              },
              children: item
            }
          )
        ] }, item)) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              marginTop: 16,
              fontSize: 14,
              color: isIlluminated ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)",
              fontStyle: "italic",
              fontFamily: "system-ui, sans-serif"
            },
            children: isIlluminated ? "Detailed content - loaded on demand" : "Waiting to be invoked..."
          }
        )
      ]
    }
  );
};
var DataFlowParticles = ({ isActive }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  if (!isActive) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: Array.from({ length: 8 }).map((_, i) => {
    const progress = (frame * 3 + i * 30) % 150 / 150;
    const x = 540 + Math.sin(progress * Math.PI * 2 + i) * 30;
    const y = (0, import_remotion.interpolate)(progress, [0, 1], [700, 1e3], { extrapolateRight: "clamp" });
    const opacity = Math.sin(progress * Math.PI);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: x,
          top: y,
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: COLORS.primary,
          opacity: opacity * 0.8,
          boxShadow: `0 0 15px ${COLORS.primary}`
        }
      },
      i
    );
  }) });
};
var Scene3Architecture = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const keySyncRelative = 188;
  const enterProgress = (0, import_remotion.spring)({ frame, fps, config: SPRING_CONFIG });
  const isIlluminated = frame >= keySyncRelative - 10;
  const illuminateProgress = (0, import_remotion.spring)({
    frame: frame - keySyncRelative + 10,
    fps,
    config: { ...SPRING_CONFIG, damping: 25 }
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: 150,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 36,
          fontWeight: 800,
          color: COLORS.white,
          letterSpacing: 4,
          opacity: enterProgress,
          textShadow: `0 0 20px ${COLORS.primary}`,
          fontFamily: "system-ui, sans-serif"
        },
        children: "SKILL ARCHITECTURE"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: "35%",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FrontMatterSection, { enterProgress }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            BodySection,
            {
              enterProgress,
              isIlluminated,
              illuminateProgress
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DataFlowParticles, { isActive: isIlluminated }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "svg",
      {
        width: "100",
        height: "60",
        style: {
          position: "absolute",
          left: "50%",
          top: "58%",
          transform: "translateX(-50%)",
          opacity: enterProgress * 0.6
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "path",
          {
            d: "M 50 0 L 50 40 L 35 25 M 50 40 L 65 25",
            stroke: COLORS.primary,
            strokeWidth: "3",
            fill: "none",
            strokeLinecap: "round",
            style: { filter: `drop-shadow(0 0 5px ${COLORS.primary})` }
          }
        )
      }
    )
  ] });
};
var ActiveFrontMatter = ({ pulseActive, pulseProgress }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const pulseScale = pulseActive ? 1 + pulseProgress * 0.05 : 1;
  const pulseGlow = pulseActive ? 30 + pulseProgress * 40 : 30;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        ...glassStyle,
        width: 380,
        padding: 24,
        borderColor: COLORS.primary,
        boxShadow: `0 0 ${pulseGlow}px rgba(0, 245, 212, 0.5), 0 8px 32px rgba(0, 0, 0, 0.3)`,
        transform: `scale(${pulseScale})`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: COLORS.primary,
                boxShadow: `0 0 ${pulseActive ? 20 : 10}px ${COLORS.primary}`,
                animation: "none"
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "span",
            {
              style: {
                fontSize: 22,
                fontWeight: 800,
                color: COLORS.primary,
                letterSpacing: 3,
                fontFamily: "system-ui, sans-serif"
              },
              children: "FRONT MATTER"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "span",
            {
              style: {
                marginLeft: "auto",
                fontSize: 14,
                color: COLORS.primary,
                fontWeight: 600,
                fontFamily: "system-ui, sans-serif"
              },
              children: "LOADED"
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { position: "relative", height: 60, overflow: "hidden" }, children: Array.from({ length: 5 }).map((_, i) => {
          const lineProgress = (frame * 2 + i * 40) % 200 / 200;
          return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: 0,
                top: i * 12,
                width: `${lineProgress * 100}%`,
                height: 6,
                borderRadius: 3,
                background: `linear-gradient(90deg, ${COLORS.primary} 0%, transparent 100%)`,
                opacity: 0.6
              }
            },
            i
          );
        }) })
      ]
    }
  );
};
var DormantBody = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        ...glassStyle,
        width: 380,
        padding: 24,
        marginTop: 20,
        borderColor: "rgba(0, 245, 212, 0.2)",
        opacity: 0.5
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "rgba(0, 245, 212, 0.2)",
                border: `2px dashed rgba(0, 245, 212, 0.3)`
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "span",
            {
              style: {
                fontSize: 22,
                fontWeight: 800,
                color: "rgba(0, 245, 212, 0.4)",
                letterSpacing: 3,
                fontFamily: "system-ui, sans-serif"
              },
              children: "BODY"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "span",
            {
              style: {
                marginLeft: "auto",
                fontSize: 14,
                color: "rgba(255,255,255,0.4)",
                fontWeight: 600,
                fontFamily: "system-ui, sans-serif"
              },
              children: "DORMANT"
            }
          )
        ] }),
        [0, 1, 2].map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              width: `${70 - i * 15}%`,
              height: 8,
              borderRadius: 4,
              background: "rgba(255, 255, 255, 0.1)",
              marginBottom: 10
            }
          },
          i
        )),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              marginTop: 12,
              fontSize: 14,
              color: "rgba(255,255,255,0.3)",
              fontStyle: "italic",
              fontFamily: "system-ui, sans-serif"
            },
            children: "Waiting for invocation..."
          }
        )
      ]
    }
  );
};
var ResourceMeter = ({ usage }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        bottom: 250,
        left: "50%",
        transform: "translateX(-50%)",
        width: 300,
        textAlign: "center"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              fontSize: 16,
              color: COLORS.white,
              marginBottom: 12,
              fontWeight: 600,
              fontFamily: "system-ui, sans-serif"
            },
            children: "CONTEXT USAGE"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              width: "100%",
              height: 12,
              background: "rgba(255,255,255,0.1)",
              borderRadius: 6,
              overflow: "hidden"
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "div",
              {
                style: {
                  width: `${usage}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, ${COLORS.primary} 0%, rgba(0, 245, 212, 0.6) 100%)`,
                  borderRadius: 6,
                  boxShadow: `0 0 10px ${COLORS.primary}`
                }
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "div",
          {
            style: {
              marginTop: 8,
              fontSize: 24,
              fontWeight: 700,
              color: COLORS.primary,
              fontFamily: "system-ui, sans-serif"
            },
            children: [
              Math.round(usage),
              "%"
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              fontSize: 14,
              color: "rgba(255,255,255,0.6)",
              marginTop: 4,
              fontFamily: "system-ui, sans-serif"
            },
            children: "Minimal footprint"
          }
        )
      ]
    }
  );
};
var EfficientDataStreams = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: Array.from({ length: 12 }).map((_, i) => {
    const delay = i * 15;
    const progress = (frame + delay) % 90 / 90;
    const startY = 200;
    const endY = 620;
    const y = (0, import_remotion.interpolate)(progress, [0, 1], [startY, endY], { extrapolateRight: "clamp" });
    const x = 540 + Math.sin(i * 0.8) * 150;
    const opacity = Math.sin(progress * Math.PI) * 0.8;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: x,
          top: y,
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: COLORS.primary,
          opacity,
          boxShadow: `0 0 12px ${COLORS.primary}`
        }
      },
      i
    );
  }) });
};
var Scene4LazyLoading = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const keySyncRelative = 50;
  const enterProgress = (0, import_remotion.spring)({ frame, fps, config: SPRING_CONFIG });
  const pulseActive = frame >= keySyncRelative - 5;
  const pulseProgress = (0, import_remotion.spring)({
    frame: frame - keySyncRelative + 5,
    fps,
    config: { ...SPRING_CONFIG, damping: 15, stiffness: 120 }
  });
  const resourceUsage = (0, import_remotion.interpolate)(frame, [0, 60], [5, 18], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: 120,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 36,
          fontWeight: 800,
          color: COLORS.white,
          letterSpacing: 4,
          opacity: enterProgress,
          textShadow: `0 0 20px ${COLORS.primary}`,
          textAlign: "center",
          fontFamily: "system-ui, sans-serif"
        },
        children: "LAZY LOADING"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: 175,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 20,
          color: "rgba(255,255,255,0.7)",
          letterSpacing: 2,
          opacity: enterProgress,
          fontFamily: "system-ui, sans-serif"
        },
        children: "Only load what you need"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EfficientDataStreams, {}),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: "32%",
          left: "50%",
          transform: `translateX(-50%) scale(${enterProgress})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: enterProgress
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActiveFrontMatter, { pulseActive, pulseProgress }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DormantBody, {})
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResourceMeter, { usage: resourceUsage })
  ] });
};
var MCPPanel = ({
  title,
  items,
  isActive,
  delay
}) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const activeProgress = (0, import_remotion.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG
  });
  const glowIntensity = isActive ? activeProgress : 0.3;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        ...glassStyle,
        width: 200,
        padding: 16,
        borderColor: isActive ? COLORS.secondary : "rgba(123, 44, 191, 0.3)",
        boxShadow: isActive ? `0 0 ${20 + activeProgress * 20}px rgba(123, 44, 191, ${0.3 + activeProgress * 0.4}), 0 8px 32px rgba(0, 0, 0, 0.3)` : "0 8px 32px rgba(0, 0, 0, 0.3)",
        transform: `scale(${0.8 + activeProgress * 0.2})`,
        opacity: 0.4 + glowIntensity * 0.6
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              fontSize: 14,
              fontWeight: 800,
              color: COLORS.secondary,
              letterSpacing: 2,
              marginBottom: 12,
              fontFamily: "system-ui, sans-serif"
            },
            children: title
          }
        ),
        items.map((item, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 6
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "div",
                {
                  style: {
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: isActive ? COLORS.secondary : "rgba(123, 44, 191, 0.4)",
                    boxShadow: isActive ? `0 0 8px ${COLORS.secondary}` : "none"
                  }
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "span",
                {
                  style: {
                    fontSize: 13,
                    color: isActive ? COLORS.white : "rgba(255,255,255,0.5)",
                    fontFamily: "system-ui, sans-serif"
                  },
                  children: item
                }
              )
            ]
          },
          item
        ))
      ]
    }
  );
};
var MCPDataStreams = ({ isActive }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height } = (0, import_remotion.useVideoConfig)();
  if (!isActive) return null;
  const streams = [
    { startX: 0, startY: height * 0.3, endX: width / 2, endY: height * 0.5 },
    { startX: width, startY: height * 0.3, endX: width / 2, endY: height * 0.5 },
    { startX: 0, startY: height * 0.7, endX: width / 2, endY: height * 0.5 },
    { startX: width, startY: height * 0.7, endX: width / 2, endY: height * 0.5 },
    { startX: width / 2, startY: 0, endX: width / 2, endY: height * 0.5 },
    { startX: width / 2, startY: height, endX: width / 2, endY: height * 0.5 }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: streams.flatMap(
    (stream, si) => Array.from({ length: 5 }).map((_, i) => {
      const delay = si * 10 + i * 15;
      const progress = (frame + delay) % 60 / 60;
      const x = (0, import_remotion.interpolate)(progress, [0, 1], [stream.startX, stream.endX], { extrapolateRight: "clamp" });
      const y = (0, import_remotion.interpolate)(progress, [0, 1], [stream.startY, stream.endY], { extrapolateRight: "clamp" });
      const opacity = Math.sin(progress * Math.PI) * 0.7;
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: x,
            top: y,
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: COLORS.secondary,
            opacity,
            boxShadow: `0 0 15px ${COLORS.secondary}`
          }
        },
        `${si}-${i}`
      );
    })
  ) });
};
var Scene5MCPIntro = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const keySyncRelative = 81;
  const enterProgress = (0, import_remotion.spring)({ frame, fps, config: SPRING_CONFIG });
  const isActive = frame >= keySyncRelative - 10;
  const panels = [
    { title: "TOOLS", items: ["create", "delete", "update", "query"], delay: keySyncRelative },
    { title: "APIS", items: ["REST", "GraphQL", "WebSocket"], delay: keySyncRelative + 3 },
    { title: "RESOURCES", items: ["files", "database", "cache"], delay: keySyncRelative + 6 },
    { title: "SERVICES", items: ["auth", "storage", "compute"], delay: keySyncRelative + 9 }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: 120,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 36,
          fontWeight: 800,
          color: COLORS.white,
          letterSpacing: 4,
          opacity: enterProgress,
          textShadow: `0 0 20px ${COLORS.secondary}`,
          textAlign: "center",
          fontFamily: "system-ui, sans-serif"
        },
        children: "MCP SERVER"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: 175,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 20,
          color: "rgba(255,255,255,0.7)",
          letterSpacing: 2,
          opacity: enterProgress,
          fontFamily: "system-ui, sans-serif"
        },
        children: "Everything loaded upfront"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MCPDataStreams, { isActive }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "30%",
          left: "50%",
          transform: `translateX(-50%) scale(${enterProgress})`,
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 20,
          opacity: enterProgress
        },
        children: panels.map((panel) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MCPPanel, { ...panel, isActive }, panel.title))
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: 280,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          opacity: enterProgress
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: isActive ? COLORS.secondary : "rgba(123, 44, 191, 0.4)",
                boxShadow: isActive ? `0 0 20px ${COLORS.secondary}` : "none"
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "span",
            {
              style: {
                fontSize: 18,
                fontWeight: 700,
                color: COLORS.secondary,
                letterSpacing: 2,
                fontFamily: "system-ui, sans-serif"
              },
              children: isActive ? "ALL SYSTEMS ACTIVE" : "INITIALIZING..."
            }
          )
        ]
      }
    )
  ] });
};
var ContextMeter = ({ label, usage, maxUsage, color, isWarning = false, warningFlash = false }) => {
  const meterHeight = 400;
  const fillHeight = usage / 100 * meterHeight;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { textAlign: "center", width: 120 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          fontSize: 16,
          fontWeight: 700,
          color: COLORS.white,
          marginBottom: 16,
          letterSpacing: 2,
          fontFamily: "system-ui, sans-serif"
        },
        children: label
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          width: 60,
          height: meterHeight,
          background: "rgba(255,255,255,0.1)",
          borderRadius: 30,
          margin: "0 auto",
          position: "relative",
          overflow: "hidden",
          border: `2px solid ${isWarning ? COLORS.accent : color}`,
          boxShadow: warningFlash ? `0 0 40px ${COLORS.accent}, 0 0 80px ${COLORS.accent}` : `0 0 15px ${color}`
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: fillHeight,
                background: isWarning ? `linear-gradient(180deg, ${COLORS.accent} 0%, ${color} 100%)` : `linear-gradient(180deg, ${color} 0%, rgba(${color === COLORS.primary ? "0, 245, 212" : "123, 44, 191"}, 0.5) 100%)`,
                borderRadius: "0 0 28px 28px",
                boxShadow: `0 0 20px ${isWarning ? COLORS.accent : color}`
              }
            }
          ),
          usage > 70 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                top: meterHeight * 0.2,
                left: 0,
                right: 0,
                height: 2,
                background: COLORS.accent,
                opacity: 0.5
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
          marginTop: 16,
          fontSize: 32,
          fontWeight: 800,
          color: isWarning ? COLORS.accent : color,
          fontFamily: "system-ui, sans-serif"
        },
        children: [
          Math.round(usage),
          "%"
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          marginTop: 8,
          fontSize: 12,
          color: isWarning ? COLORS.accent : "rgba(255,255,255,0.6)",
          fontWeight: 600,
          fontFamily: "system-ui, sans-serif"
        },
        children: isWarning ? "HIGH USAGE" : usage < 30 ? "EFFICIENT" : "MODERATE"
      }
    )
  ] });
};
var SkillsIcon = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: "80", height: "70", viewBox: "0 0 80 70", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "rect",
      {
        x: "5",
        y: "20",
        width: "70",
        height: "45",
        rx: "6",
        fill: COLORS.darkGray,
        stroke: COLORS.primary,
        strokeWidth: "2",
        style: { filter: `drop-shadow(0 0 10px ${COLORS.primary})` }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M 5 20 L 5 12 Q 5 5 12 5 L 35 5 L 42 20", fill: COLORS.darkGray, stroke: COLORS.primary, strokeWidth: "2" })
  ] });
};
var MCPIcon = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: "70", height: "80", viewBox: "0 0 70 80", children: [0, 1, 2].map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "rect",
      {
        x: "5",
        y: 5 + i * 25,
        width: "60",
        height: "20",
        rx: "4",
        fill: COLORS.darkGray,
        stroke: COLORS.secondary,
        strokeWidth: "2",
        style: { filter: `drop-shadow(0 0 8px ${COLORS.secondary})` }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "18", cy: 15 + i * 25, r: "4", fill: COLORS.secondary, opacity: 0.8 })
  ] }, i)) });
};
var Scene6Performance = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const keySyncRelative = 85;
  const enterProgress = (0, import_remotion.spring)({ frame, fps, config: SPRING_CONFIG });
  const skillsUsage = (0, import_remotion.interpolate)(frame, [0, 100], [5, 15], { extrapolateRight: "clamp" });
  const mcpBaseUsage = (0, import_remotion.interpolate)(frame, [0, 60], [30, 55], { extrapolateRight: "clamp" });
  const isSpiking = frame >= keySyncRelative - 5;
  const spikeProgress = (0, import_remotion.spring)({
    frame: frame - keySyncRelative + 5,
    fps,
    config: { ...SPRING_CONFIG, damping: 15, stiffness: 150 }
  });
  const mcpUsage = isSpiking ? mcpBaseUsage + spikeProgress * 30 : mcpBaseUsage;
  const isWarning = mcpUsage > 70;
  const warningFlash = isSpiking && spikeProgress > 0.5 && spikeProgress < 0.8;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: 100,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 32,
          fontWeight: 800,
          color: COLORS.white,
          letterSpacing: 4,
          opacity: enterProgress,
          textAlign: "center",
          fontFamily: "system-ui, sans-serif"
        },
        children: "CONTEXT USAGE"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: 150,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 18,
          color: "rgba(255,255,255,0.7)",
          letterSpacing: 2,
          opacity: enterProgress,
          fontFamily: "system-ui, sans-serif"
        },
        children: "Performance trade-offs"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: "25%",
          left: "50%",
          transform: `translateX(-50%) scale(${enterProgress})`,
          display: "flex",
          gap: 120,
          alignItems: "flex-start",
          opacity: enterProgress
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SkillsIcon, {}),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "div",
              {
                style: {
                  fontSize: 20,
                  fontWeight: 700,
                  color: COLORS.primary,
                  letterSpacing: 3,
                  fontFamily: "system-ui, sans-serif"
                },
                children: "SKILLS"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContextMeter, { label: "CONTEXT", usage: skillsUsage, maxUsage: 100, color: COLORS.primary })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                height: 500,
                fontSize: 36,
                fontWeight: 900,
                color: "rgba(255,255,255,0.3)",
                fontFamily: "system-ui, sans-serif"
              },
              children: "VS"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MCPIcon, {}),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "div",
              {
                style: {
                  fontSize: 20,
                  fontWeight: 700,
                  color: COLORS.secondary,
                  letterSpacing: 3,
                  fontFamily: "system-ui, sans-serif"
                },
                children: "MCP"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              ContextMeter,
              {
                label: "CONTEXT",
                usage: mcpUsage,
                maxUsage: 100,
                color: COLORS.secondary,
                isWarning,
                warningFlash
              }
            )
          ] })
        ]
      }
    ),
    warningFlash && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      import_remotion.AbsoluteFill,
      {
        style: {
          background: `radial-gradient(circle at 70% 50%, rgba(247, 37, 133, 0.2) 0%, transparent 50%)`,
          pointerEvents: "none"
        }
      }
    )
  ] });
};
var APIActionButton = ({ label, delay }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const enterProgress = (0, import_remotion.spring)({ frame: frame - delay, fps, config: SPRING_CONFIG });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        ...glassStyle,
        padding: "12px 20px",
        borderColor: COLORS.secondary,
        display: "flex",
        alignItems: "center",
        gap: 10,
        transform: `scale(${enterProgress})`,
        opacity: enterProgress,
        boxShadow: `0 0 15px rgba(123, 44, 191, 0.4)`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: COLORS.secondary,
              boxShadow: `0 0 8px ${COLORS.secondary}`
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            style: {
              fontSize: 14,
              fontWeight: 700,
              color: COLORS.white,
              letterSpacing: 1,
              fontFamily: "monospace"
            },
            children: label
          }
        )
      ]
    }
  );
};
var TemplateSection = ({
  title,
  items,
  isHighlighted
}) => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        marginBottom: 16,
        padding: 12,
        background: isHighlighted ? "rgba(0, 245, 212, 0.1)" : "transparent",
        borderRadius: 8,
        borderLeft: `3px solid ${isHighlighted ? COLORS.primary : "rgba(0, 245, 212, 0.3)"}`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              fontSize: 12,
              fontWeight: 700,
              color: COLORS.primary,
              letterSpacing: 2,
              marginBottom: 8,
              fontFamily: "system-ui, sans-serif"
            },
            children: title
          }
        ),
        items.map((item, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: isHighlighted ? COLORS.primary : "rgba(0, 245, 212, 0.5)", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" }) }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "span",
                {
                  style: {
                    fontSize: 13,
                    color: isHighlighted ? COLORS.white : "rgba(255,255,255,0.6)",
                    fontFamily: "system-ui, sans-serif"
                  },
                  children: item
                }
              )
            ]
          },
          item
        ))
      ]
    }
  );
};
var Scene7Capability = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const keySyncRelative = 338;
  const enterProgress = (0, import_remotion.spring)({ frame, fps, config: SPRING_CONFIG });
  const isSkillsHighlighted = frame >= keySyncRelative - 10;
  const highlightProgress = (0, import_remotion.spring)({
    frame: frame - keySyncRelative + 10,
    fps,
    config: { ...SPRING_CONFIG, damping: 20 }
  });
  const apiActions = ["CREATE_FILE()", "DELETE_FILE()", "UPDATE_FILE()", "READ_FILE()", "LIST_FILES()"];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: 80,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 28,
          fontWeight: 800,
          color: COLORS.white,
          letterSpacing: 4,
          opacity: enterProgress,
          textAlign: "center",
          fontFamily: "system-ui, sans-serif"
        },
        children: "GOOGLE DRIVE USE CASE"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: "15%",
          left: "50%",
          transform: `translateX(-50%)`,
          display: "flex",
          gap: 40,
          opacity: enterProgress
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "div",
            {
              style: {
                width: 280,
                display: "flex",
                flexDirection: "column",
                alignItems: "center"
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "div",
                  {
                    style: {
                      fontSize: 18,
                      fontWeight: 800,
                      color: COLORS.secondary,
                      letterSpacing: 3,
                      marginBottom: 20,
                      fontFamily: "system-ui, sans-serif"
                    },
                    children: "MCP"
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                  "div",
                  {
                    style: {
                      ...glassStyle,
                      width: "100%",
                      padding: 20,
                      borderColor: "rgba(123, 44, 191, 0.5)"
                    },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        "div",
                        {
                          style: {
                            fontSize: 14,
                            fontWeight: 700,
                            color: COLORS.secondary,
                            letterSpacing: 2,
                            marginBottom: 16,
                            textAlign: "center",
                            fontFamily: "system-ui, sans-serif"
                          },
                          children: "RAW API TOOLS"
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "flex", flexDirection: "column", gap: 10 }, children: apiActions.map((action, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(APIActionButton, { label: action, delay: i * 8 }, action)) }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        "div",
                        {
                          style: {
                            marginTop: 16,
                            fontSize: 12,
                            color: "rgba(255,255,255,0.5)",
                            textAlign: "center",
                            fontStyle: "italic",
                            fontFamily: "system-ui, sans-serif"
                          },
                          children: "Direct API access"
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
                display: "flex",
                alignItems: "center",
                fontSize: 24,
                fontWeight: 900,
                color: "rgba(255,255,255,0.3)",
                fontFamily: "system-ui, sans-serif"
              },
              children: "VS"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "div",
            {
              style: {
                width: 280,
                display: "flex",
                flexDirection: "column",
                alignItems: "center"
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "div",
                  {
                    style: {
                      fontSize: 18,
                      fontWeight: 800,
                      color: COLORS.primary,
                      letterSpacing: 3,
                      marginBottom: 20,
                      fontFamily: "system-ui, sans-serif"
                    },
                    children: "SKILLS"
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                  "div",
                  {
                    style: {
                      ...glassStyle,
                      width: "100%",
                      padding: 20,
                      borderColor: isSkillsHighlighted ? COLORS.primary : "rgba(0, 245, 212, 0.3)",
                      boxShadow: isSkillsHighlighted ? `0 0 ${20 + highlightProgress * 30}px rgba(0, 245, 212, ${0.3 + highlightProgress * 0.4}), 0 8px 32px rgba(0, 0, 0, 0.3)` : "0 8px 32px rgba(0, 0, 0, 0.3)",
                      transform: isSkillsHighlighted ? `scale(${1 + highlightProgress * 0.02})` : "scale(1)"
                    },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        "div",
                        {
                          style: {
                            fontSize: 14,
                            fontWeight: 700,
                            color: COLORS.primary,
                            letterSpacing: 2,
                            marginBottom: 16,
                            textAlign: "center",
                            fontFamily: "system-ui, sans-serif"
                          },
                          children: "BEHAVIOR GUIDANCE"
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        TemplateSection,
                        {
                          title: "NAMING CONVENTION",
                          items: ["Use descriptive names", "Include date prefix"],
                          isHighlighted: isSkillsHighlighted
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        TemplateSection,
                        {
                          title: "ORGANIZATION",
                          items: ["Create project folders", "Archive old files"],
                          isHighlighted: isSkillsHighlighted
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        TemplateSection,
                        {
                          title: "BEST PRACTICES",
                          items: ["Version control", "Backup strategy"],
                          isHighlighted: isSkillsHighlighted
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        "div",
                        {
                          style: {
                            marginTop: 8,
                            fontSize: 12,
                            color: isSkillsHighlighted ? COLORS.primary : "rgba(255,255,255,0.5)",
                            textAlign: "center",
                            fontStyle: "italic",
                            fontFamily: "system-ui, sans-serif"
                          },
                          children: "Structured guidance"
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
    ),
    isSkillsHighlighted && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          right: "15%",
          top: "40%",
          width: 350,
          height: 500,
          background: `radial-gradient(ellipse, rgba(0, 245, 212, ${highlightProgress * 0.15}) 0%, transparent 70%)`,
          pointerEvents: "none"
        }
      }
    )
  ] });
};
var FlowingToolIcons = ({ isActive }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const tools = ["API", "DB", "FS", "NET", "AUTH", "CACHE"];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: tools.map((tool, i) => {
    const delay = i * 20;
    const progress = (frame + delay) % 120 / 120;
    const x = 200 + Math.sin(progress * Math.PI * 2 + i) * 80;
    const y = (0, import_remotion.interpolate)(progress, [0, 1], [100, 400], { extrapolateRight: "clamp" });
    const opacity = isActive ? Math.sin(progress * Math.PI) * 0.8 : 0.3;
    const scale = 0.8 + Math.sin(progress * Math.PI) * 0.3;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: x,
          top: y,
          transform: `scale(${scale})`,
          padding: "6px 12px",
          background: "rgba(123, 44, 191, 0.3)",
          border: `1px solid ${COLORS.secondary}`,
          borderRadius: 6,
          opacity,
          boxShadow: `0 0 10px ${COLORS.secondary}`
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            style: {
              fontSize: 12,
              fontWeight: 700,
              color: COLORS.secondary,
              fontFamily: "monospace"
            },
            children: tool
          }
        )
      },
      tool
    );
  }) });
};
var WorkflowArrows = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const arrows = [
    { from: { x: 50, y: 100 }, to: { x: 50, y: 180 } },
    { from: { x: 50, y: 220 }, to: { x: 50, y: 300 } },
    { from: { x: 50, y: 340 }, to: { x: 50, y: 420 } }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: "100", height: "500", style: { position: "absolute", left: 130, top: 100 }, children: arrows.map((arrow, i) => {
    const delay = i * 15;
    const progress = (0, import_remotion.spring)({ frame: frame - delay, fps, config: SPRING_CONFIG });
    const dashOffset = (0, import_remotion.interpolate)(progress, [0, 1], [100, 0], { extrapolateRight: "clamp" });
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "line",
        {
          x1: arrow.from.x,
          y1: arrow.from.y,
          x2: arrow.to.x,
          y2: arrow.to.y,
          stroke: COLORS.primary,
          strokeWidth: "3",
          strokeDasharray: "100",
          strokeDashoffset: dashOffset,
          style: { filter: `drop-shadow(0 0 5px ${COLORS.primary})` }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "polygon",
        {
          points: `${arrow.to.x - 8},${arrow.to.y - 10} ${arrow.to.x + 8},${arrow.to.y - 10} ${arrow.to.x},${arrow.to.y}`,
          fill: COLORS.primary,
          opacity: progress,
          style: { filter: `drop-shadow(0 0 5px ${COLORS.primary})` }
        }
      )
    ] }, i);
  }) });
};
var FinalCard = ({ title, subtitle, color, items, isHighlighted }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const enterProgress = (0, import_remotion.spring)({ frame, fps, config: SPRING_CONFIG });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        ...glassStyle,
        width: 300,
        padding: 24,
        borderColor: color,
        transform: `scale(${enterProgress})`,
        opacity: enterProgress,
        boxShadow: isHighlighted ? `0 0 40px ${color}, 0 8px 32px rgba(0, 0, 0, 0.3)` : `0 0 15px ${color}40, 0 8px 32px rgba(0, 0, 0, 0.3)`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              fontSize: 24,
              fontWeight: 800,
              color,
              letterSpacing: 3,
              marginBottom: 8,
              textAlign: "center",
              fontFamily: "system-ui, sans-serif"
            },
            children: title
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              fontSize: 14,
              color: "rgba(255,255,255,0.6)",
              marginBottom: 20,
              textAlign: "center",
              fontFamily: "system-ui, sans-serif"
            },
            children: subtitle
          }
        ),
        items.map((item, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 12,
              padding: "8px 12px",
              background: `${color}15`,
              borderRadius: 8
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "div",
                {
                  style: {
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: color,
                    boxShadow: `0 0 8px ${color}`
                  }
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "span",
                {
                  style: {
                    fontSize: 14,
                    color: COLORS.white,
                    fontFamily: "system-ui, sans-serif"
                  },
                  children: item
                }
              )
            ]
          },
          item
        ))
      ]
    }
  );
};
var Scene8FinalWisdom = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const keySyncRelative = 18;
  const enterProgress = (0, import_remotion.spring)({ frame, fps, config: SPRING_CONFIG });
  const isToolFlowActive = frame >= keySyncRelative;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: 80,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 32,
          fontWeight: 800,
          color: COLORS.white,
          letterSpacing: 4,
          opacity: enterProgress,
          textAlign: "center",
          fontFamily: "system-ui, sans-serif"
        },
        children: "THE TAKEAWAY"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: "18%",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 60,
          opacity: enterProgress
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { position: "relative" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              FinalCard,
              {
                title: "MCP",
                subtitle: "RAW TOOLS & CAPABILITIES",
                color: COLORS.secondary,
                items: ["Direct API access", "Full tool capabilities", "Immediate availability", "Higher context cost"],
                isHighlighted: isToolFlowActive
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlowingToolIcons, { isActive: isToolFlowActive })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { position: "relative" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              FinalCard,
              {
                title: "SKILLS",
                subtitle: "BEHAVIOR & GUIDANCE",
                color: COLORS.primary,
                items: ["Structured workflows", "Best practices built-in", "Lazy loaded efficiency", "Lower context cost"],
                isHighlighted: !isToolFlowActive
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WorkflowArrows, {})
          ] })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: 200,
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
          opacity: enterProgress
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: 20,
                fontWeight: 700,
                color: COLORS.white,
                marginBottom: 12,
                fontFamily: "system-ui, sans-serif"
              },
              children: "Choose based on your needs"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "div",
            {
              style: {
                fontSize: 16,
                color: "rgba(255,255,255,0.6)",
                fontFamily: "system-ui, sans-serif"
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.secondary }, children: "MCP" }),
                " for raw power \u2022",
                " ",
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.primary }, children: "Skills" }),
                " for guided efficiency"
              ]
            }
          )
        ]
      }
    )
  ] });
};
var MainComposition = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: { backgroundColor: COLORS.background }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AnimatedBackground, {}, "bg"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene1Start, durationInFrames: TIMING.scene1End - TIMING.scene1Start + 1, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene1Question, {}) }, "scene1"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene2Start, durationInFrames: TIMING.scene2End - TIMING.scene2Start + 1, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene2SkillsIntro, {}) }, "scene2"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene3Start, durationInFrames: TIMING.scene3End - TIMING.scene3Start + 1, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene3Architecture, {}) }, "scene3"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene4Start, durationInFrames: TIMING.scene4End - TIMING.scene4Start + 1, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene4LazyLoading, {}) }, "scene4"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene5Start, durationInFrames: TIMING.scene5End - TIMING.scene5Start + 1, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene5MCPIntro, {}) }, "scene5"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene6Start, durationInFrames: TIMING.scene6End - TIMING.scene6Start + 1, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene6Performance, {}) }, "scene6"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene7Start, durationInFrames: TIMING.scene7End - TIMING.scene7Start + 1, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene7Capability, {}) }, "scene7"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene8Start, durationInFrames: TIMING.scene8End - TIMING.scene8Start + 1, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene8FinalWisdom, {}) }, "scene8")
  ] });
};
var RemotionRoot = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_remotion.Composition,
    {
      id: "proj-c6e0a8e1-de72-4f2f-883a-5213e23dfa8a",
      component: MainComposition,
      durationInFrames: TIMING.totalDuration,
      fps: TIMING.fps,
      width: 1080,
      height: 1920
    }
  );
};
var index_default = MainComposition;
(0, import_remotion.registerRoot)(RemotionRoot);
