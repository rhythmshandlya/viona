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

// src/proj_87e55a0e_3971_4aa9_a85c_b31ef756238f/index.tsx
var index_exports = {};
__export(index_exports, {
  RemotionRoot: () => RemotionRoot,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_remotion10 = require("remotion");

// src/proj_87e55a0e_3971_4aa9_a85c_b31ef756238f/constants.ts
var COLORS = {
  skillsBlue: "#3B82F6",
  mcpOrange: "#F97316",
  accentYellow: "#FDE047",
  successGreen: "#10B981",
  warningRed: "#EF4444",
  backgroundStart: "#F8FAFC",
  backgroundEnd: "#E2E8F0",
  white: "#FFFFFF",
  textDark: "#1E293B"
};
var SPRING_CONFIG = { damping: 22, stiffness: 90, mass: 0.9 };
var SPRING_FAST = { damping: 28, stiffness: 120, mass: 0.8 };
var TIMING = {
  totalFrames: 2208,
  fps: 30,
  width: 1080,
  height: 960,
  // Scene timing from scenes.json
  scene1Start: 0,
  scene1End: 99,
  scene2Start: 99,
  scene2End: 268,
  scene3Start: 268,
  scene3End: 606,
  scene4Start: 606,
  scene4End: 924,
  scene5Start: 924,
  scene5End: 1314,
  scene6Start: 1314,
  scene6End: 1391,
  scene7Start: 1391,
  scene7End: 1941,
  scene8Start: 1941,
  scene8End: 2208
};

// src/proj_87e55a0e_3971_4aa9_a85c_b31ef756238f/components/Background.tsx
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
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          width: "100%",
          height: "100%",
          background: `linear-gradient(${135 + gradientShift}deg, ${COLORS.backgroundStart} 0%, ${COLORS.backgroundEnd} 100%)`
        }
      }
    ),
    Array.from({ length: 12 }).map((_, i) => {
      const baseX = i * 83 % 100;
      const baseY = i * 47 % 100;
      const size = 4 + i % 3 * 2;
      const speed = 0.3 + i % 4 * 0.1;
      const yOffset = (0, import_remotion.interpolate)(
        frame,
        [0, TIMING.totalFrames],
        [0, -100 * speed],
        { extrapolateRight: "clamp" }
      );
      const opacity = (0, import_remotion.interpolate)(
        Math.sin((frame + i * 20) * 0.02),
        [-1, 1],
        [0.03, 0.08],
        { extrapolateRight: "clamp" }
      );
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: `${baseX}%`,
            top: `${(baseY + yOffset) % 120}%`,
            width: size,
            height: size,
            borderRadius: "50%",
            backgroundColor: i % 2 === 0 ? COLORS.skillsBlue : COLORS.accentYellow,
            opacity
          }
        },
        i
      );
    })
  ] });
};

// src/proj_87e55a0e_3971_4aa9_a85c_b31ef756238f/scenes/Scene1.tsx
var import_remotion2 = require("remotion");
var import_jsx_runtime2 = require("react/jsx-runtime");
var EnergyLine = ({ angle, delay, frame, fps, color }) => {
  const progress = (0, import_remotion2.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_FAST
  });
  const length = (0, import_remotion2.interpolate)(progress, [0, 1], [0, 120], {
    extrapolateRight: "clamp"
  });
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "50%",
        width: length,
        height: 4,
        background: `linear-gradient(90deg, ${color} 0%, transparent 100%)`,
        transformOrigin: "left center",
        transform: `rotate(${angle}deg)`,
        opacity: progress * 0.8,
        borderRadius: 2
      }
    }
  );
};
var Spark = ({ x, y, delay, frame, fps }) => {
  const progress = (0, import_remotion2.spring)({
    frame: frame - delay,
    fps,
    config: { damping: 20, stiffness: 150, mass: 0.6 }
  });
  const pulse = (0, import_remotion2.interpolate)(
    frame % 20,
    [0, 10, 20],
    [0.6, 1, 0.6],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: 12,
        height: 12,
        background: COLORS.accentYellow,
        borderRadius: "50%",
        transform: `scale(${progress * pulse})`,
        opacity: progress,
        boxShadow: `0 0 20px ${COLORS.accentYellow}, 0 0 40px ${COLORS.accentYellow}80`
      }
    }
  );
};
var MCPIcon = ({ delay, x, y, frame, fps }) => {
  const progress = (0, import_remotion2.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG
  });
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) scale(${progress})`,
        opacity: progress
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { width: "40", height: "40", viewBox: "0 0 40 40", fill: "none", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { x: "4", y: "4", width: "32", height: "32", rx: "6", stroke: COLORS.white, strokeWidth: "3", fill: "none" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "12", cy: "20", r: "4", fill: COLORS.white }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "28", cy: "20", r: "4", fill: COLORS.white }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M12 20H28", stroke: COLORS.white, strokeWidth: "2" })
      ] })
    }
  );
};
var SkillsIcon = ({ delay, x, y, frame, fps }) => {
  const progress = (0, import_remotion2.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG
  });
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) scale(${progress})`,
        opacity: progress
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { width: "40", height: "40", viewBox: "0 0 40 40", fill: "none", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M20 4L36 14V26L20 36L4 26V14L20 4Z", stroke: COLORS.white, strokeWidth: "3", fill: "none" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "20", cy: "20", r: "6", fill: COLORS.white })
      ] })
    }
  );
};
var Scene1 = ({ startFrame }) => {
  const frame = (0, import_remotion2.useCurrentFrame)();
  const { fps, height } = (0, import_remotion2.useVideoConfig)();
  const localFrame = frame - startFrame;
  const topSlide = (0, import_remotion2.spring)({
    frame: localFrame,
    fps,
    config: { damping: 25, stiffness: 80, mass: 1 }
  });
  const bottomSlide = (0, import_remotion2.spring)({
    frame: localFrame - 6,
    fps,
    config: { damping: 25, stiffness: 80, mass: 1 }
  });
  const vsProgress = (0, import_remotion2.spring)({
    frame: localFrame - 18,
    fps,
    config: { damping: 20, stiffness: 200, mass: 0.8 }
  });
  const vsScale = (0, import_remotion2.interpolate)(vsProgress, [0, 1], [3, 1], {
    extrapolateRight: "clamp"
  });
  const mcpProgress = (0, import_remotion2.spring)({
    frame: localFrame - 24,
    fps,
    config: SPRING_CONFIG
  });
  const mcpX = (0, import_remotion2.interpolate)(mcpProgress, [0, 1], [-100, 0], {
    extrapolateRight: "clamp"
  });
  const skillsProgress = (0, import_remotion2.spring)({
    frame: localFrame - 30,
    fps,
    config: SPRING_CONFIG
  });
  const skillsX = (0, import_remotion2.interpolate)(skillsProgress, [0, 1], [100, 0], {
    extrapolateRight: "clamp"
  });
  const glowIntensity = (0, import_remotion2.interpolate)(
    localFrame % 30,
    [0, 15, 30],
    [0.5, 1, 0.5],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_remotion2.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "50%",
          background: `linear-gradient(180deg, ${COLORS.skillsBlue} 0%, #2563EB 100%)`,
          transform: `translateY(${(0, import_remotion2.interpolate)(topSlide, [0, 1], [-height / 2, 0], { extrapolateRight: "clamp" })}px)`,
          overflow: "hidden"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                top: "40%",
                left: "50%",
                transform: `translate(-50%, -50%) translateX(${mcpX}px)`,
                opacity: mcpProgress
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                "h2",
                {
                  style: {
                    fontSize: 90,
                    fontWeight: 900,
                    color: COLORS.white,
                    margin: 0,
                    letterSpacing: 8,
                    textShadow: `0 4px 30px rgba(0,0,0,0.3), 0 0 60px ${COLORS.white}40`
                  },
                  children: "MCP"
                }
              )
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(MCPIcon, { delay: 36, x: 15, y: 30, frame: localFrame, fps }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(MCPIcon, { delay: 42, x: 85, y: 35, frame: localFrame, fps }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(MCPIcon, { delay: 48, x: 20, y: 70, frame: localFrame, fps }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(MCPIcon, { delay: 54, x: 80, y: 65, frame: localFrame, fps })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "50%",
          background: `linear-gradient(0deg, ${COLORS.warningRed} 0%, #DC2626 100%)`,
          transform: `translateY(${(0, import_remotion2.interpolate)(bottomSlide, [0, 1], [height / 2, 0], { extrapolateRight: "clamp" })}px)`,
          overflow: "hidden"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                top: "60%",
                left: "50%",
                transform: `translate(-50%, -50%) translateX(${skillsX}px)`,
                opacity: skillsProgress
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                "h2",
                {
                  style: {
                    fontSize: 80,
                    fontWeight: 900,
                    color: COLORS.white,
                    margin: 0,
                    letterSpacing: 6,
                    textShadow: `0 4px 30px rgba(0,0,0,0.3), 0 0 60px ${COLORS.white}40`
                  },
                  children: "SKILLS"
                }
              )
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(SkillsIcon, { delay: 40, x: 18, y: 35, frame: localFrame, fps }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(SkillsIcon, { delay: 46, x: 82, y: 30, frame: localFrame, fps }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(SkillsIcon, { delay: 52, x: 25, y: 70, frame: localFrame, fps }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(SkillsIcon, { delay: 58, x: 75, y: 75, frame: localFrame, fps })
        ]
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
          height: 6,
          transform: "translateY(-50%)",
          background: `linear-gradient(90deg, transparent 0%, ${COLORS.accentYellow} 30%, ${COLORS.white} 50%, ${COLORS.accentYellow} 70%, transparent 100%)`,
          boxShadow: `0 0 ${30 * glowIntensity}px ${COLORS.accentYellow}, 0 0 ${60 * glowIntensity}px ${COLORS.accentYellow}80`,
          opacity: vsProgress
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) scale(${vsScale})`,
          opacity: vsProgress
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                top: "50%",
                left: "50%",
                width: 180,
                height: 180,
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                background: `radial-gradient(circle, ${COLORS.accentYellow}60 0%, transparent 70%)`,
                opacity: glowIntensity
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "div",
            {
              style: {
                width: 140,
                height: 140,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${COLORS.accentYellow} 0%, #F59E0B 100%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 8px 40px rgba(0,0,0,0.4), 0 0 60px ${COLORS.accentYellow}80`,
                border: `4px solid ${COLORS.white}`
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                "span",
                {
                  style: {
                    fontSize: 56,
                    fontWeight: 900,
                    color: COLORS.textDark,
                    letterSpacing: 2,
                    textShadow: "0 2px 4px rgba(0,0,0,0.2)"
                  },
                  children: "VS"
                }
              )
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(EnergyLine, { angle: 30, delay: 22, frame: localFrame, fps, color: COLORS.accentYellow }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(EnergyLine, { angle: 60, delay: 24, frame: localFrame, fps, color: COLORS.accentYellow }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(EnergyLine, { angle: 120, delay: 26, frame: localFrame, fps, color: COLORS.accentYellow }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(EnergyLine, { angle: 150, delay: 28, frame: localFrame, fps, color: COLORS.accentYellow }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(EnergyLine, { angle: 210, delay: 30, frame: localFrame, fps, color: COLORS.accentYellow }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(EnergyLine, { angle: 240, delay: 32, frame: localFrame, fps, color: COLORS.accentYellow }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(EnergyLine, { angle: 300, delay: 34, frame: localFrame, fps, color: COLORS.accentYellow }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(EnergyLine, { angle: 330, delay: 36, frame: localFrame, fps, color: COLORS.accentYellow }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Spark, { x: 42, y: 42, delay: 40, frame: localFrame, fps }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Spark, { x: 58, y: 42, delay: 44, frame: localFrame, fps }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Spark, { x: 42, y: 58, delay: 48, frame: localFrame, fps }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Spark, { x: 58, y: 58, delay: 52, frame: localFrame, fps }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Spark, { x: 35, y: 50, delay: 56, frame: localFrame, fps }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Spark, { x: 65, y: 50, delay: 60, frame: localFrame, fps })
  ] });
};

// src/proj_87e55a0e_3971_4aa9_a85c_b31ef756238f/scenes/Scene2.tsx
var import_react = __toESM(require("react"));
var import_remotion3 = require("remotion");
var import_jsx_runtime3 = require("react/jsx-runtime");
var TextFileIcon = ({ frame, fps }) => {
  const entranceProgress = (0, import_remotion3.spring)({
    frame,
    fps,
    config: { damping: 16, stiffness: 90, mass: 0.9 }
  });
  const bounceY = (0, import_remotion3.interpolate)(entranceProgress, [0, 0.6, 1], [80, -15, 0], {
    extrapolateRight: "clamp"
  });
  const scale = (0, import_remotion3.interpolate)(entranceProgress, [0, 0.6, 1], [0.3, 1.15, 1], {
    extrapolateRight: "clamp"
  });
  const frontMatterHighlight = (0, import_remotion3.spring)({
    frame: frame - 60,
    fps,
    config: { damping: 22, stiffness: 100, mass: 0.8 }
  });
  const bodyHighlight = (0, import_remotion3.spring)({
    frame: frame - 90,
    fps,
    config: { damping: 22, stiffness: 100, mass: 0.8 }
  });
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "38%",
        transform: `translate(-50%, -50%) translateY(${bounceY}px) scale(${scale})`,
        opacity: entranceProgress
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
        "div",
        {
          style: {
            width: 240,
            height: 320,
            background: COLORS.white,
            borderRadius: 16,
            boxShadow: `0 25px 70px rgba(0,0,0,0.18), 0 0 50px ${COLORS.skillsBlue}15`,
            position: "relative",
            overflow: "hidden",
            border: `3px solid ${COLORS.skillsBlue}50`
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "div",
              {
                style: {
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: 45,
                  height: 45,
                  background: `linear-gradient(135deg, transparent 50%, ${COLORS.skillsBlue}25 50%)`
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "div",
              {
                style: {
                  position: "absolute",
                  top: 12,
                  left: 12,
                  background: COLORS.skillsBlue,
                  color: COLORS.white,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: 6,
                  letterSpacing: 0.5
                },
                children: ".md"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
              "div",
              {
                style: {
                  marginTop: 45,
                  height: "40%",
                  background: `linear-gradient(180deg, ${COLORS.accentYellow}${Math.floor(30 + frontMatterHighlight * 20).toString(16)} 0%, ${COLORS.accentYellow}15 100%)`,
                  borderBottom: `3px dashed ${COLORS.mcpOrange}70`,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  transform: `scale(${1 + frontMatterHighlight * 0.02})`,
                  boxShadow: frontMatterHighlight > 0.5 ? `inset 0 0 20px ${COLORS.accentYellow}30` : "none"
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
                    fontSize: 12,
                    fontWeight: 800,
                    color: COLORS.mcpOrange,
                    letterSpacing: 1.5,
                    textTransform: "uppercase"
                  }, children: "FRONT MATTER" }),
                  [
                    { w: 75, delay: 65 },
                    { w: 60, delay: 72 },
                    { w: 70, delay: 79 }
                  ].map((line, i) => {
                    const lineProgress = (0, import_remotion3.spring)({
                      frame: frame - line.delay,
                      fps,
                      config: { damping: 20, stiffness: 120, mass: 0.6 }
                    });
                    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                      "div",
                      {
                        style: {
                          width: `${line.w}%`,
                          height: 10,
                          borderRadius: 5,
                          background: `linear-gradient(90deg, ${COLORS.mcpOrange}50 0%, ${COLORS.mcpOrange}30 100%)`,
                          transform: `scaleX(${lineProgress}) translateX(${(1 - lineProgress) * -20}px)`,
                          opacity: lineProgress
                        }
                      },
                      i
                    );
                  })
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
              "div",
              {
                style: {
                  height: "45%",
                  background: `linear-gradient(180deg, ${COLORS.skillsBlue}${Math.floor(8 + bodyHighlight * 12).toString(16).padStart(2, "0")} 0%, ${COLORS.skillsBlue}08 100%)`,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  transform: `scale(${1 + bodyHighlight * 0.02})`,
                  boxShadow: bodyHighlight > 0.5 ? `inset 0 0 20px ${COLORS.skillsBlue}20` : "none"
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
                    fontSize: 12,
                    fontWeight: 800,
                    color: COLORS.skillsBlue,
                    letterSpacing: 1.5,
                    textTransform: "uppercase"
                  }, children: "BODY" }),
                  [
                    { w: 95, delay: 95 },
                    { w: 80, delay: 101 },
                    { w: 90, delay: 107 },
                    { w: 65, delay: 113 },
                    { w: 85, delay: 119 }
                  ].map((line, i) => {
                    const lineProgress = (0, import_remotion3.spring)({
                      frame: frame - line.delay,
                      fps,
                      config: { damping: 20, stiffness: 120, mass: 0.6 }
                    });
                    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                      "div",
                      {
                        style: {
                          width: `${line.w}%`,
                          height: 8,
                          borderRadius: 4,
                          background: `linear-gradient(90deg, ${COLORS.skillsBlue}40 0%, ${COLORS.skillsBlue}25 100%)`,
                          transform: `scaleX(${lineProgress}) translateX(${(1 - lineProgress) * -20}px)`,
                          opacity: lineProgress
                        }
                      },
                      i
                    );
                  })
                ]
              }
            )
          ]
        }
      )
    }
  );
};
var FolderPath = ({ frame, fps }) => {
  const folders = [
    { name: "Claude Desktop", icon: "\u{1F916}", delay: 30, isFolder: true },
    { name: "skills", icon: "\u{1F4C1}", delay: 42, isFolder: true },
    { name: "skill.md", icon: "\u{1F4C4}", delay: 54, isFolder: false }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "78%",
        transform: "translate(-50%, -50%)",
        display: "flex",
        alignItems: "center",
        gap: 10
      },
      children: folders.map((folder, i) => {
        const progress = (0, import_remotion3.spring)({
          frame: frame - folder.delay,
          fps,
          config: { damping: 18, stiffness: 100, mass: 0.7 }
        });
        const bounceX = (0, import_remotion3.interpolate)(progress, [0, 0.7, 1], [-40, 8, 0], {
          extrapolateRight: "clamp"
        });
        const bounceScale = (0, import_remotion3.interpolate)(progress, [0, 0.7, 1], [0.5, 1.1, 1], {
          extrapolateRight: "clamp"
        });
        const arrowProgress = (0, import_remotion3.spring)({
          frame: frame - folder.delay - 6,
          fps,
          config: { damping: 20, stiffness: 120, mass: 0.5 }
        });
        return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_react.default.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
            "div",
            {
              style: {
                background: folder.isFolder ? COLORS.white : COLORS.skillsBlue,
                color: folder.isFolder ? COLORS.textDark : COLORS.white,
                padding: "14px 20px",
                borderRadius: 14,
                fontSize: 15,
                fontWeight: 700,
                boxShadow: `0 10px 30px rgba(0,0,0,0.15), 0 0 20px ${folder.isFolder ? "transparent" : COLORS.skillsBlue + "30"}`,
                border: `2px solid ${folder.isFolder ? COLORS.skillsBlue + "40" : COLORS.skillsBlue}`,
                transform: `translateX(${bounceX}px) scale(${bounceScale * progress})`,
                opacity: progress,
                display: "flex",
                alignItems: "center",
                gap: 10,
                whiteSpace: "nowrap"
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { fontSize: 20 }, children: folder.icon }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: folder.name })
              ]
            }
          ),
          i < folders.length - 1 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "div",
            {
              style: {
                fontSize: 28,
                color: COLORS.skillsBlue,
                opacity: arrowProgress,
                fontWeight: 800,
                transform: `scale(${arrowProgress}) translateX(${(1 - arrowProgress) * -10}px)`
              },
              children: "\u2192"
            }
          )
        ] }, i);
      })
    }
  );
};
var FloatingSnippets = ({ frame, fps }) => {
  const snippets = [
    { text: "name: my-skill", x: 10, y: 22, delay: 70, color: COLORS.mcpOrange },
    { text: "description: ...", x: 78, y: 28, delay: 80, color: COLORS.mcpOrange },
    { text: "# Instructions", x: 8, y: 52, delay: 100, color: COLORS.skillsBlue },
    { text: "Use when...", x: 82, y: 48, delay: 110, color: COLORS.skillsBlue }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_jsx_runtime3.Fragment, { children: snippets.map((snippet, i) => {
    const progress = (0, import_remotion3.spring)({
      frame: frame - snippet.delay,
      fps,
      config: { damping: 20, stiffness: 80, mass: 0.8 }
    });
    const floatY = (0, import_remotion3.interpolate)((frame + i * 20) % 60, [0, 30, 60], [0, -8, 0], {
      extrapolateRight: "clamp"
    });
    const floatX = (0, import_remotion3.interpolate)((frame + i * 15) % 50, [0, 25, 50], [0, 4, 0], {
      extrapolateRight: "clamp"
    });
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: `${snippet.x}%`,
          top: `${snippet.y}%`,
          transform: `translate(${floatX}px, ${floatY}px) scale(${progress})`,
          opacity: progress * 0.95,
          background: COLORS.white,
          padding: "10px 16px",
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 600,
          color: snippet.color,
          boxShadow: `0 8px 25px rgba(0,0,0,0.12), 0 0 15px ${snippet.color}15`,
          border: `2px solid ${snippet.color}40`,
          fontFamily: "monospace"
        },
        children: snippet.text
      },
      i
    );
  }) });
};
var Sparkles = ({ frame, fps }) => {
  const sparkles = [
    { x: 22, y: 18, delay: 35 },
    { x: 78, y: 20, delay: 45 },
    { x: 18, y: 62, delay: 60 },
    { x: 85, y: 58, delay: 70 },
    { x: 12, y: 40, delay: 55 },
    { x: 88, y: 38, delay: 65 }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_jsx_runtime3.Fragment, { children: sparkles.map((s, i) => {
    const progress = (0, import_remotion3.spring)({
      frame: frame - s.delay,
      fps,
      config: { damping: 15, stiffness: 100, mass: 0.5 }
    });
    const pulse = (0, import_remotion3.interpolate)((frame + i * 15) % 40, [0, 20, 40], [0.6, 1.3, 0.6], {
      extrapolateRight: "clamp"
    });
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: `${s.x}%`,
          top: `${s.y}%`,
          width: 18,
          height: 18,
          transform: `scale(${progress * pulse})`,
          opacity: progress * pulse
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { viewBox: "0 0 24 24", fill: COLORS.accentYellow, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z" }) })
      },
      i
    );
  }) });
};
var Scene2 = ({ startFrame }) => {
  const frame = (0, import_remotion3.useCurrentFrame)();
  const { fps } = (0, import_remotion3.useVideoConfig)();
  const localFrame = frame - startFrame;
  const titleProgress = (0, import_remotion3.spring)({
    frame: localFrame - 5,
    fps,
    config: { damping: 18, stiffness: 100, mass: 0.8 }
  });
  const titleY = (0, import_remotion3.interpolate)(titleProgress, [0, 1], [50, 0], {
    extrapolateRight: "clamp"
  });
  const titleScale = (0, import_remotion3.interpolate)(titleProgress, [0, 0.6, 1], [0.6, 1.08, 1], {
    extrapolateRight: "clamp"
  });
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_remotion3.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Sparkles, { frame: localFrame, fps }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(FloatingSnippets, { frame: localFrame, fps }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(TextFileIcon, { frame: localFrame, fps }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(FolderPath, { frame: localFrame, fps }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "5%",
          left: "50%",
          transform: `translateX(-50%) translateY(${titleY}px) scale(${titleScale})`,
          opacity: titleProgress
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "h2",
          {
            style: {
              fontSize: 52,
              fontWeight: 800,
              color: COLORS.skillsBlue,
              margin: 0,
              textShadow: `0 4px 30px ${COLORS.skillsBlue}45, 0 0 50px ${COLORS.skillsBlue}25`,
              letterSpacing: 2,
              textAlign: "center"
            },
            children: "A SKILL IS..."
          }
        )
      }
    )
  ] });
};

// src/proj_87e55a0e_3971_4aa9_a85c_b31ef756238f/scenes/Scene3.tsx
var import_react2 = __toESM(require("react"));
var import_remotion4 = require("remotion");
var import_jsx_runtime4 = require("react/jsx-runtime");
var PLAYFUL = {
  purple: "#A855F7",
  pink: "#EC4899",
  blue: COLORS.skillsBlue,
  green: COLORS.successGreen,
  lightPurple: "#C4B5FD",
  lightPink: "#FBCFE8",
  lightBlue: "#BFDBFE",
  lightGreen: "#A7F3D0"
};
var Sparkle = ({ x, y, delay, frame, color, size = 8 }) => {
  const sparkleFrame = frame - delay;
  const cycle = 30;
  const progress = sparkleFrame % cycle / cycle;
  const opacity = (0, import_remotion4.interpolate)(
    progress,
    [0, 0.3, 0.5, 0.7, 1],
    [0, 1, 0.6, 1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const scale = (0, import_remotion4.interpolate)(
    progress,
    [0, 0.3, 1],
    [0.3, 1.2, 0.5],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const rotation = progress * 180;
  if (sparkleFrame < 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        opacity,
        transform: `scale(${scale}) rotate(${rotation}deg)`
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("svg", { viewBox: "0 0 24 24", width: size, height: size, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "path",
        {
          d: "M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z",
          fill: color
        }
      ) })
    }
  );
};
var OpenAILogo = ({ size = 24, color = COLORS.textDark }) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: color, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.0993 3.8558L12.6 8.3829l2.02-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.1408 1.6465 4.4708 4.4708 0 0 1 .5765 3.4746zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" }) });
var AnthropicLogo = ({ size = 24, color = COLORS.textDark }) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: color, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M13.827 3.52h3.603L24 20.48h-3.603l-6.57-16.96zm-7.257 0h3.604L16.744 20.48h-3.603L6.57 3.52zM0 20.48h3.604L10.174 3.52H6.57L0 20.48z" }) });
var GeminiLogo = ({ size = 24 }) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("svg", { viewBox: "0 0 24 24", width: size, height: size, children: [
  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("linearGradient", { id: "geminiGrad", x1: "0%", y1: "0%", x2: "100%", y2: "100%", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("stop", { offset: "0%", stopColor: "#4285F4" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("stop", { offset: "50%", stopColor: "#9B72CB" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("stop", { offset: "100%", stopColor: "#D96570" })
  ] }) }),
  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("circle", { cx: "12", cy: "12", r: "10", fill: "url(#geminiGrad)" }),
  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M12 4C8.5 4 6 7 6 10c0 3 2.5 6 6 6s6-3 6-6c0-3-2.5-6-6-6zm0 10c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z", fill: "white", opacity: "0.9" })
] });
var FolderPath2 = ({ frame, fps }) => {
  const entranceProgress = (0, import_remotion4.spring)({
    frame: frame - 15,
    fps,
    config: SPRING_CONFIG
  });
  const segments = [
    { icon: "\u{1F4C1}", text: ".claude", delay: 0 },
    { icon: "\u{1F4C1}", text: "skills", delay: 8 },
    { icon: "\u{1F4C4}", text: "skill.md", delay: 16, isFile: true }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        top: "8%",
        left: "50%",
        transform: `translateX(-50%) translateY(${(0, import_remotion4.interpolate)(entranceProgress, [0, 1], [-40, 0], { extrapolateRight: "clamp" })}px)`,
        opacity: entranceProgress,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "12px 24px",
        borderRadius: 16,
        backgroundColor: COLORS.white,
        boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
        border: `2px solid ${PLAYFUL.lightPurple}`
      },
      children: segments.map((seg, i) => {
        const segProgress = (0, import_remotion4.spring)({
          frame: frame - 20 - seg.delay,
          fps,
          config: SPRING_FAST
        });
        return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_react2.default.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 6,
                opacity: segProgress,
                transform: `scale(${segProgress})`
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { fontSize: 18 }, children: seg.icon }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                  "span",
                  {
                    style: {
                      fontSize: 16,
                      fontWeight: seg.isFile ? 700 : 500,
                      color: seg.isFile ? PLAYFUL.purple : COLORS.textDark,
                      fontFamily: "monospace"
                    },
                    children: seg.text
                  }
                )
              ]
            }
          ),
          i < segments.length - 1 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "span",
            {
              style: {
                fontSize: 18,
                color: COLORS.textDark,
                opacity: 0.3 * segProgress
              },
              children: "/"
            }
          )
        ] }, i);
      })
    }
  );
};
var MarkdownFileIcon = ({ frame, fps }) => {
  const entranceProgress = (0, import_remotion4.spring)({
    frame: frame - 50,
    fps,
    config: { damping: 20, stiffness: 80, mass: 1 }
  });
  const bounceY = (0, import_remotion4.interpolate)(
    entranceProgress,
    [0, 0.5, 0.8, 1],
    [-100, 10, -5, 0],
    { extrapolateRight: "clamp" }
  );
  const floatOffset = (0, import_remotion4.interpolate)(
    frame % 60 / 60,
    [0, 0.5, 1],
    [0, -4, 0],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "6%",
        top: "22%",
        transform: `translateY(${bounceY + floatOffset}px) scale(${entranceProgress})`,
        opacity: entranceProgress
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
          "div",
          {
            style: {
              width: 100,
              height: 120,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${COLORS.white} 0%, ${PLAYFUL.lightBlue} 100%)`,
              border: `3px solid ${PLAYFUL.blue}`,
              boxShadow: `0 12px 40px ${PLAYFUL.blue}30`,
              position: "relative",
              overflow: "hidden"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                "div",
                {
                  style: {
                    position: "absolute",
                    top: 0,
                    right: 0,
                    width: 28,
                    height: 28,
                    background: `linear-gradient(135deg, ${PLAYFUL.lightBlue} 50%, ${PLAYFUL.blue} 50%)`,
                    borderBottomLeftRadius: 8
                  }
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                "div",
                {
                  style: {
                    position: "absolute",
                    bottom: 12,
                    left: "50%",
                    transform: "translateX(-50%)",
                    fontSize: 24,
                    fontWeight: 800,
                    color: PLAYFUL.blue,
                    fontFamily: "monospace"
                  },
                  children: ".md"
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { padding: 12, display: "flex", flexDirection: "column", gap: 6 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { width: "60%", height: 6, borderRadius: 3, backgroundColor: `${PLAYFUL.purple}40` } }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { width: "80%", height: 6, borderRadius: 3, backgroundColor: `${PLAYFUL.pink}30` } }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { width: "50%", height: 6, borderRadius: 3, backgroundColor: `${PLAYFUL.green}30` } })
              ] })
            ]
          }
        ),
        [
          { Logo: OpenAILogo, x: -30, y: 20, delay: 70 },
          { Logo: AnthropicLogo, x: 100, y: -10, delay: 85 },
          { Logo: GeminiLogo, x: 90, y: 110, delay: 100 }
        ].map(({ Logo, x, y, delay }, i) => {
          const logoProgress = (0, import_remotion4.spring)({
            frame: frame - delay,
            fps,
            config: SPRING_FAST
          });
          const float = (0, import_remotion4.interpolate)(
            (frame + i * 20) % 50 / 50,
            [0, 0.5, 1],
            [0, -3, 0],
            { extrapolateRight: "clamp" }
          );
          return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: x,
                top: y + float,
                opacity: logoProgress * 0.8,
                transform: `scale(${logoProgress * 0.9})`,
                padding: 8,
                borderRadius: "50%",
                backgroundColor: COLORS.white,
                boxShadow: "0 4px 16px rgba(0,0,0,0.1)"
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Logo, { size: 20 })
            },
            i
          );
        }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "div",
          {
            style: {
              textAlign: "center",
              marginTop: 16,
              fontSize: 14,
              fontWeight: 700,
              color: PLAYFUL.blue
            },
            children: "Skill File"
          }
        )
      ]
    }
  );
};
var TwoPartStructure = ({ frame, fps }) => {
  const containerProgress = (0, import_remotion4.spring)({
    frame: frame - 60,
    fps,
    config: SPRING_CONFIG
  });
  const frontMatterProgress = (0, import_remotion4.spring)({
    frame: frame - 90,
    fps,
    config: SPRING_CONFIG
  });
  const frontMatterHighlight = (0, import_remotion4.interpolate)(
    frame,
    [100, 120, 160, 180],
    [0, 1, 1, 0.6],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const bodyProgress = (0, import_remotion4.spring)({
    frame: frame - 170,
    fps,
    config: SPRING_CONFIG
  });
  const bodyHighlight = (0, import_remotion4.interpolate)(
    frame,
    [180, 200, 280, 300],
    [0, 1, 1, 0.6],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const containerScale = (0, import_remotion4.interpolate)(
    containerProgress,
    [0, 1],
    [0.8, 1],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        right: "5%",
        top: "16%",
        width: 520,
        transform: `scale(${containerScale})`,
        opacity: containerProgress
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
        "div",
        {
          style: {
            borderRadius: 24,
            background: COLORS.white,
            boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
            overflow: "hidden",
            border: `3px solid ${PLAYFUL.lightPurple}`
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
              "div",
              {
                style: {
                  position: "relative",
                  padding: 24,
                  borderBottom: `3px dashed ${PLAYFUL.lightPurple}`,
                  background: frontMatterHighlight > 0.3 ? `linear-gradient(135deg, ${PLAYFUL.lightPurple}${Math.floor(frontMatterHighlight * 40).toString(16).padStart(2, "0")} 0%, transparent 100%)` : "transparent"
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
                    "div",
                    {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        marginBottom: 18,
                        opacity: frontMatterProgress,
                        transform: `translateX(${(0, import_remotion4.interpolate)(frontMatterProgress, [0, 1], [-20, 0], { extrapolateRight: "clamp" })}px)`
                      },
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                          "div",
                          {
                            style: {
                              padding: "8px 16px",
                              borderRadius: 20,
                              background: `linear-gradient(135deg, ${PLAYFUL.purple} 0%, ${PLAYFUL.pink} 100%)`,
                              boxShadow: frontMatterHighlight > 0.5 ? `0 4px 20px ${PLAYFUL.purple}50` : "none"
                            },
                            children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                              "span",
                              {
                                style: {
                                  fontSize: 13,
                                  fontWeight: 800,
                                  color: COLORS.white,
                                  textTransform: "uppercase",
                                  letterSpacing: 1.5
                                },
                                children: "Front Matter"
                              }
                            )
                          }
                        ),
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                          "span",
                          {
                            style: {
                              fontSize: 13,
                              fontWeight: 600,
                              color: PLAYFUL.purple,
                              opacity: 0.8
                            },
                            children: "(Metadata)"
                          }
                        )
                      ]
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                    "div",
                    {
                      style: {
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                        fontFamily: "monospace",
                        fontSize: 14
                      },
                      children: [
                        { key: "name:", value: '"code-reviewer"', delay: 0 },
                        { key: "description:", value: '"Reviews code quality"', delay: 8 },
                        { key: "tags:", value: '["review", "quality"]', delay: 16 },
                        { key: "version:", value: '"1.0"', delay: 24 }
                      ].map((item, i) => {
                        const lineProgress = (0, import_remotion4.spring)({
                          frame: frame - 100 - item.delay,
                          fps,
                          config: SPRING_FAST
                        });
                        return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
                          "div",
                          {
                            style: {
                              display: "flex",
                              gap: 8,
                              opacity: lineProgress,
                              transform: `translateX(${(0, import_remotion4.interpolate)(lineProgress, [0, 1], [20, 0], { extrapolateRight: "clamp" })}px)`
                            },
                            children: [
                              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { color: PLAYFUL.purple, fontWeight: 600 }, children: item.key }),
                              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { color: PLAYFUL.pink }, children: item.value })
                            ]
                          },
                          i
                        );
                      })
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                    "div",
                    {
                      style: {
                        position: "absolute",
                        top: 8,
                        left: 24,
                        fontSize: 16,
                        fontFamily: "monospace",
                        color: PLAYFUL.purple,
                        opacity: frontMatterProgress * 0.5
                      },
                      children: "---"
                    }
                  )
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
              "div",
              {
                style: {
                  position: "relative",
                  padding: 24,
                  background: bodyHighlight > 0.3 ? `linear-gradient(135deg, ${PLAYFUL.lightGreen}${Math.floor(bodyHighlight * 40).toString(16).padStart(2, "0")} 0%, transparent 100%)` : "transparent"
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
                    "div",
                    {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        marginBottom: 18,
                        opacity: bodyProgress,
                        transform: `translateX(${(0, import_remotion4.interpolate)(bodyProgress, [0, 1], [-20, 0], { extrapolateRight: "clamp" })}px)`
                      },
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                          "div",
                          {
                            style: {
                              padding: "8px 16px",
                              borderRadius: 20,
                              background: `linear-gradient(135deg, ${PLAYFUL.green} 0%, ${PLAYFUL.blue} 100%)`,
                              boxShadow: bodyHighlight > 0.5 ? `0 4px 20px ${PLAYFUL.green}50` : "none"
                            },
                            children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                              "span",
                              {
                                style: {
                                  fontSize: 13,
                                  fontWeight: 800,
                                  color: COLORS.white,
                                  textTransform: "uppercase",
                                  letterSpacing: 1.5
                                },
                                children: "Body"
                              }
                            )
                          }
                        ),
                        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                          "span",
                          {
                            style: {
                              fontSize: 13,
                              fontWeight: 600,
                              color: PLAYFUL.green,
                              opacity: 0.8
                            },
                            children: "(Prompt Instructions)"
                          }
                        )
                      ]
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                    "div",
                    {
                      style: {
                        padding: 16,
                        borderRadius: 12,
                        backgroundColor: `${COLORS.textDark}06`,
                        border: `2px solid ${PLAYFUL.lightGreen}`,
                        fontFamily: "monospace",
                        fontSize: 13
                      },
                      children: [
                        { text: "## When to use", isHeader: true, delay: 0 },
                        { text: "Use after completing major features", isHeader: false, delay: 8 },
                        { text: "", isHeader: false, delay: 12 },
                        { text: "## Instructions", isHeader: true, delay: 16 },
                        { text: "1. Check test coverage", isHeader: false, delay: 24 },
                        { text: "2. Review coding standards", isHeader: false, delay: 32 },
                        { text: "3. Analyze for security issues", isHeader: false, delay: 40 }
                      ].map((line, i) => {
                        const lineProgress = (0, import_remotion4.spring)({
                          frame: frame - 190 - line.delay,
                          fps,
                          config: SPRING_FAST
                        });
                        return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                          "div",
                          {
                            style: {
                              fontSize: 13,
                              color: line.isHeader ? PLAYFUL.green : COLORS.textDark,
                              fontWeight: line.isHeader ? 700 : 400,
                              opacity: lineProgress,
                              transform: `translateX(${(0, import_remotion4.interpolate)(lineProgress, [0, 1], [15, 0], { extrapolateRight: "clamp" })}px)`,
                              minHeight: 20,
                              lineHeight: 1.5
                            },
                            children: line.text
                          },
                          i
                        );
                      })
                    }
                  ),
                  Array.from({ length: 5 }).map((_, i) => {
                    const particleProgress = (0, import_remotion4.interpolate)(
                      frame - 220 - i * 15,
                      [0, 50],
                      [0, 1],
                      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                    );
                    if (particleProgress <= 0) return null;
                    const xOffset = (0, import_remotion4.interpolate)(particleProgress, [0, 1], [0, 40], { extrapolateRight: "clamp" });
                    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                      "div",
                      {
                        style: {
                          position: "absolute",
                          right: 30 + i * 18 - xOffset,
                          top: (0, import_remotion4.interpolate)(particleProgress, [0, 1], [180, 60], { extrapolateRight: "clamp" }),
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          backgroundColor: PLAYFUL.green,
                          opacity: (0, import_remotion4.interpolate)(particleProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0], { extrapolateRight: "clamp" }),
                          boxShadow: `0 0 12px ${PLAYFUL.green}`
                        }
                      },
                      i
                    );
                  })
                ]
              }
            )
          ]
        }
      )
    }
  );
};
var ConnectingArrow = ({ frame, fps }) => {
  const arrowProgress = (0, import_remotion4.spring)({
    frame: frame - 80,
    fps,
    config: SPRING_CONFIG
  });
  const dashOffset = frame * 2;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    "svg",
    {
      style: {
        position: "absolute",
        left: "16%",
        top: "32%",
        width: 300,
        height: 100,
        opacity: arrowProgress
      },
      viewBox: "0 0 300 100",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("linearGradient", { id: "arrowGrad", x1: "0%", y1: "0%", x2: "100%", y2: "0%", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("stop", { offset: "0%", stopColor: PLAYFUL.blue }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("stop", { offset: "100%", stopColor: PLAYFUL.purple })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "path",
          {
            d: "M 10 50 Q 100 20 200 50 T 280 50",
            fill: "none",
            stroke: "url(#arrowGrad)",
            strokeWidth: 4,
            strokeDasharray: "12 8",
            strokeDashoffset: -dashOffset,
            strokeLinecap: "round",
            style: {
              transform: `scaleX(${arrowProgress})`,
              transformOrigin: "left center"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "polygon",
          {
            points: "275,50 260,40 260,60",
            fill: PLAYFUL.purple,
            style: {
              opacity: (0, import_remotion4.interpolate)(arrowProgress, [0.7, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
            }
          }
        )
      ]
    }
  );
};
var SectionLabels = ({ frame, fps }) => {
  const showLabels = frame > 280;
  const labelProgress = (0, import_remotion4.spring)({
    frame: frame - 290,
    fps,
    config: SPRING_CONFIG
  });
  if (!showLabels) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        bottom: "8%",
        left: "50%",
        transform: `translateX(-50%) scale(${labelProgress})`,
        opacity: labelProgress,
        display: "flex",
        alignItems: "center",
        gap: 24,
        padding: "16px 32px",
        borderRadius: 20,
        backgroundColor: `${COLORS.white}F0`,
        boxShadow: "0 8px 32px rgba(0,0,0,0.1)"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 10 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "div",
            {
              style: {
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${PLAYFUL.purple}, ${PLAYFUL.pink})`,
                boxShadow: `0 0 10px ${PLAYFUL.purple}50`
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { fontSize: 15, fontWeight: 600, color: PLAYFUL.purple }, children: "Metadata" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "div",
          {
            style: {
              width: 2,
              height: 20,
              backgroundColor: COLORS.textDark,
              opacity: 0.2
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 10 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "div",
            {
              style: {
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${PLAYFUL.green}, ${PLAYFUL.blue})`,
                boxShadow: `0 0 10px ${PLAYFUL.green}50`
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { fontSize: 15, fontWeight: 600, color: PLAYFUL.green }, children: "Instructions" })
        ] })
      ]
    }
  );
};
var Scene3 = ({ startFrame }) => {
  const frame = (0, import_remotion4.useCurrentFrame)();
  const { fps } = (0, import_remotion4.useVideoConfig)();
  const localFrame = frame - startFrame;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    import_remotion4.AbsoluteFill,
    {
      style: {
        background: `linear-gradient(135deg, ${COLORS.backgroundStart} 0%, ${COLORS.backgroundEnd} 100%)`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(FolderPath2, { frame: localFrame, fps }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(MarkdownFileIcon, { frame: localFrame, fps }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ConnectingArrow, { frame: localFrame, fps }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(TwoPartStructure, { frame: localFrame, fps }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SectionLabels, { frame: localFrame, fps }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Sparkle, { x: 50, y: 750, delay: 30, frame: localFrame, color: PLAYFUL.purple, size: 12 }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Sparkle, { x: 900, y: 200, delay: 50, frame: localFrame, color: PLAYFUL.green, size: 10 }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Sparkle, { x: 980, y: 680, delay: 70, frame: localFrame, color: PLAYFUL.pink, size: 10 }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Sparkle, { x: 540, y: 850, delay: 90, frame: localFrame, color: PLAYFUL.blue, size: 8 }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Sparkle, { x: 200, y: 100, delay: 110, frame: localFrame, color: PLAYFUL.lightPurple, size: 9 }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Sparkle, { x: 750, y: 900, delay: 130, frame: localFrame, color: PLAYFUL.green, size: 11 })
      ]
    }
  );
};

// src/proj_87e55a0e_3971_4aa9_a85c_b31ef756238f/scenes/Scene4.tsx
var import_remotion5 = require("remotion");
var import_jsx_runtime5 = require("react/jsx-runtime");
var PLAYFUL2 = {
  purple: "#A855F7",
  pink: "#EC4899",
  blue: COLORS.skillsBlue,
  green: COLORS.successGreen,
  lightPurple: "#C4B5FD",
  lightPink: "#FBCFE8",
  lightBlue: "#BFDBFE",
  lightGreen: "#A7F3D0"
};
var SkillsFilingCabinet = ({ localFrame, fps }) => {
  const exitProgress = (0, import_remotion5.spring)({
    frame: localFrame - 130,
    fps,
    config: { damping: 26, stiffness: 120, mass: 0.7 }
  });
  const opacity = (0, import_remotion5.interpolate)(exitProgress, [0, 1], [1, 0], { extrapolateRight: "clamp" });
  const exitX = (0, import_remotion5.interpolate)(exitProgress, [0, 1], [0, -50], { extrapolateRight: "clamp" });
  const glowPulse = (0, import_remotion5.interpolate)(
    localFrame % 60,
    [0, 30, 60],
    [0.4, 0.7, 0.4],
    { extrapolateRight: "clamp" }
  );
  const floatY = (0, import_remotion5.interpolate)(
    localFrame % 90,
    [0, 45, 90],
    [0, -6, 0],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate(-50%, -50%) translateX(${exitX}px) translateY(${floatY}px)`,
        opacity
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              inset: -60,
              borderRadius: 30,
              background: `radial-gradient(circle, ${COLORS.skillsBlue}${Math.floor(glowPulse * 60).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
              pointerEvents: "none"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
          "div",
          {
            style: {
              width: 320,
              borderRadius: 24,
              background: COLORS.white,
              boxShadow: `0 20px 60px rgba(0,0,0,0.12), 0 0 40px ${COLORS.skillsBlue}20`,
              overflow: "hidden",
              border: `3px solid ${PLAYFUL2.lightPurple}`
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                DrawerSection,
                {
                  localFrame,
                  fps,
                  label: "Front Matter",
                  sublabel: "(Metadata)",
                  color1: PLAYFUL2.purple,
                  color2: PLAYFUL2.pink,
                  lightColor: PLAYFUL2.lightPurple,
                  items: ["name:", "description:", "tags:"],
                  baseDelay: 10
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                "div",
                {
                  style: {
                    height: 3,
                    background: `linear-gradient(90deg, transparent, ${PLAYFUL2.lightPurple}, transparent)`
                  }
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                DrawerSection,
                {
                  localFrame,
                  fps,
                  label: "Body",
                  sublabel: "(Instructions)",
                  color1: PLAYFUL2.green,
                  color2: PLAYFUL2.blue,
                  lightColor: PLAYFUL2.lightGreen,
                  items: ["## When to use", "## Instructions", "1. Review code..."],
                  baseDelay: 40
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              marginTop: 20,
              textAlign: "center"
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "span",
              {
                style: {
                  fontSize: 20,
                  fontWeight: 700,
                  color: COLORS.skillsBlue,
                  letterSpacing: 2
                },
                children: "SKILLS"
              }
            )
          }
        )
      ]
    }
  );
};
var DrawerSection = ({ localFrame, fps, label, sublabel, color1, color2, lightColor, items, baseDelay }) => {
  const highlightIntensity = (0, import_remotion5.interpolate)(
    localFrame,
    [baseDelay, baseDelay + 30, baseDelay + 80, baseDelay + 100],
    [0, 0.6, 0.6, 0.3],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "div",
    {
      style: {
        padding: 20,
        background: highlightIntensity > 0.1 ? `linear-gradient(135deg, ${lightColor}${Math.floor(highlightIntensity * 35).toString(16).padStart(2, "0")} 0%, transparent 100%)` : "transparent"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 14
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                "div",
                {
                  style: {
                    padding: "6px 14px",
                    borderRadius: 16,
                    background: `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`,
                    boxShadow: highlightIntensity > 0.4 ? `0 4px 16px ${color1}50` : "none"
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                    "span",
                    {
                      style: {
                        fontSize: 12,
                        fontWeight: 800,
                        color: COLORS.white,
                        textTransform: "uppercase",
                        letterSpacing: 1
                      },
                      children: label
                    }
                  )
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                "span",
                {
                  style: {
                    fontSize: 12,
                    fontWeight: 600,
                    color: color1,
                    opacity: 0.7
                  },
                  children: sublabel
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontFamily: "monospace",
              fontSize: 13
            },
            children: items.map((item, i) => {
              const lineProgress = (0, import_remotion5.spring)({
                frame: localFrame - baseDelay - 15 - i * 8,
                fps,
                config: SPRING_FAST
              });
              return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                "div",
                {
                  style: {
                    opacity: lineProgress,
                    transform: `translateX(${(0, import_remotion5.interpolate)(lineProgress, [0, 1], [15, 0], { extrapolateRight: "clamp" })}px)`,
                    color: color1
                  },
                  children: item
                },
                i
              );
            })
          }
        )
      ]
    }
  );
};
var SkillsSparkle = ({ x, y, delay, localFrame }) => {
  const sparkleFrame = localFrame - delay;
  if (sparkleFrame < 0 || localFrame > 144) return null;
  const cycle = 35;
  const progress = sparkleFrame % cycle / cycle;
  const opacity = (0, import_remotion5.interpolate)(
    progress,
    [0, 0.3, 0.5, 0.7, 1],
    [0, 0.8, 0.5, 0.8, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const scale = (0, import_remotion5.interpolate)(
    progress,
    [0, 0.3, 1],
    [0.4, 1.1, 0.5],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: 10,
        height: 10,
        opacity,
        transform: `scale(${scale}) rotate(${progress * 180}deg)`
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("svg", { viewBox: "0 0 24 24", width: 10, height: 10, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "path",
        {
          d: "M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z",
          fill: COLORS.skillsBlue
        }
      ) })
    }
  );
};
var AIBrainIcon = ({ localFrame, fps }) => {
  const revealDelay = 170;
  const revealProgress = (0, import_remotion5.spring)({
    frame: localFrame - revealDelay,
    fps,
    config: { damping: 20, stiffness: 80, mass: 0.9 }
  });
  const pulse = (0, import_remotion5.interpolate)(
    (localFrame - revealDelay) % 60,
    [0, 30, 60],
    [1, 1.05, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  if (revealProgress <= 0) return null;
  const bounceY = (0, import_remotion5.interpolate)(revealProgress, [0, 1], [20, 0], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "48%",
        transform: `translate(-50%, -50%) translateY(${bounceY}px) scale(${revealProgress * pulse})`,
        opacity: revealProgress
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              inset: -30,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${COLORS.mcpOrange}30 0%, transparent 70%)`,
              pointerEvents: "none"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${COLORS.mcpOrange} 0%, #EA580C 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 12px 40px ${COLORS.mcpOrange}40`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("svg", { width: "44", height: "44", viewBox: "0 0 24 24", fill: "none", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("circle", { cx: "12", cy: "12", r: "8", stroke: COLORS.white, strokeWidth: "2", fill: "none" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("circle", { cx: "12", cy: "12", r: "3", fill: COLORS.white }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("circle", { cx: "8", cy: "8", r: "1.5", fill: COLORS.white }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("circle", { cx: "16", cy: "8", r: "1.5", fill: COLORS.white }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("circle", { cx: "8", cy: "16", r: "1.5", fill: COLORS.white }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("circle", { cx: "16", cy: "16", r: "1.5", fill: COLORS.white }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("line", { x1: "9.5", y1: "9.5", x2: "12", y2: "12", stroke: COLORS.white, strokeWidth: "1.5" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("line", { x1: "14.5", y1: "9.5", x2: "12", y2: "12", stroke: COLORS.white, strokeWidth: "1.5" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("line", { x1: "9.5", y1: "14.5", x2: "12", y2: "12", stroke: COLORS.white, strokeWidth: "1.5" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("line", { x1: "14.5", y1: "14.5", x2: "12", y2: "12", stroke: COLORS.white, strokeWidth: "1.5" })
            ] })
          }
        )
      ]
    }
  );
};
var ToolBubble = ({ icon, x, y, localFrame, fps, delay }) => {
  const progress = (0, import_remotion5.spring)({
    frame: localFrame - delay,
    fps,
    config: { damping: 18, stiffness: 90, mass: 0.8 }
  });
  const floatY = (0, import_remotion5.interpolate)(
    (localFrame + delay * 10) % 80,
    [0, 40, 80],
    [0, -4, 0],
    { extrapolateRight: "clamp" }
  );
  if (progress <= 0) return null;
  const bounceScale = (0, import_remotion5.interpolate)(progress, [0, 0.7, 1], [0.3, 1.1, 1], { extrapolateRight: "clamp" });
  const renderIcon = () => {
    const iconProps = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: COLORS.mcpOrange, strokeWidth: 2 };
    switch (icon) {
      case "database":
        return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("svg", { ...iconProps, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("ellipse", { cx: "12", cy: "6", rx: "8", ry: "3" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("path", { d: "M20 6v6c0 1.66-3.58 3-8 3s-8-1.34-8-3V6" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("path", { d: "M20 12v6c0 1.66-3.58 3-8 3s-8-1.34-8-3v-6" })
        ] });
      case "code":
        return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("svg", { ...iconProps, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("polyline", { points: "16 18 22 12 16 6" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("polyline", { points: "8 6 2 12 8 18" })
        ] });
      case "file":
        return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("svg", { ...iconProps, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("polyline", { points: "14 2 14 8 20 8" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("line", { x1: "16", y1: "13", x2: "8", y2: "13" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("line", { x1: "16", y1: "17", x2: "8", y2: "17" })
        ] });
      case "cloud":
        return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("svg", { ...iconProps, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("path", { d: "M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" }) });
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) translateY(${floatY}px) scale(${bounceScale})`,
        opacity: progress
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "div",
        {
          style: {
            width: 56,
            height: 56,
            borderRadius: 16,
            background: COLORS.white,
            border: `3px solid ${COLORS.mcpOrange}40`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 8px 24px rgba(0,0,0,0.1)`
          },
          children: renderIcon()
        }
      )
    }
  );
};
var ConnectionLine = ({ fromX, fromY, toX, toY, localFrame, fps, delay }) => {
  const drawProgress = (0, import_remotion5.spring)({
    frame: localFrame - delay,
    fps,
    config: { damping: 22, stiffness: 80, mass: 0.9 }
  });
  if (drawProgress <= 0.05) return null;
  const dashOffset = (localFrame - delay) * 0.5;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "svg",
    {
      style: {
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "visible"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("linearGradient", { id: `lineGrad-${fromX}-${toX}`, x1: "0%", y1: "0%", x2: "100%", y2: "0%", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("stop", { offset: "0%", stopColor: COLORS.mcpOrange, stopOpacity: 0.8 }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("stop", { offset: "100%", stopColor: COLORS.mcpOrange, stopOpacity: 0.4 })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "line",
          {
            x1: `${fromX}%`,
            y1: `${fromY}%`,
            x2: `${fromX + (toX - fromX) * drawProgress}%`,
            y2: `${fromY + (toY - fromY) * drawProgress}%`,
            stroke: `url(#lineGrad-${fromX}-${toX})`,
            strokeWidth: "3",
            strokeLinecap: "round",
            strokeDasharray: "8 6",
            strokeDashoffset: -dashOffset,
            opacity: 0.7
          }
        )
      ]
    }
  );
};
var MCPTitle = ({ localFrame, fps }) => {
  const revealDelay = 150;
  const titleProgress = (0, import_remotion5.spring)({
    frame: localFrame - revealDelay,
    fps,
    config: { damping: 18, stiffness: 100, mass: 0.8 }
  });
  const subtitleProgress = (0, import_remotion5.spring)({
    frame: localFrame - revealDelay - 25,
    fps,
    config: { damping: 22, stiffness: 80, mass: 1 }
  });
  if (titleProgress <= 0) return null;
  const titleScale = (0, import_remotion5.interpolate)(titleProgress, [0, 0.6, 1], [0.5, 1.08, 1], { extrapolateRight: "clamp" });
  const titleY = (0, import_remotion5.interpolate)(titleProgress, [0, 1], [30, 0], { extrapolateRight: "clamp" });
  const glowPulse = (0, import_remotion5.interpolate)(
    (localFrame - revealDelay) % 50,
    [0, 25, 50],
    [0.4, 0.7, 0.4],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "18%",
        transform: "translateX(-50%)",
        textAlign: "center"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
          "div",
          {
            style: {
              transform: `translateY(${titleY}px) scale(${titleScale})`,
              opacity: titleProgress,
              position: "relative"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                "div",
                {
                  style: {
                    position: "absolute",
                    inset: -20,
                    background: `radial-gradient(circle, ${COLORS.mcpOrange}${Math.floor(glowPulse * 50).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
                    filter: "blur(15px)",
                    pointerEvents: "none"
                  }
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                "h1",
                {
                  style: {
                    fontSize: 72,
                    fontWeight: 900,
                    color: COLORS.mcpOrange,
                    margin: 0,
                    letterSpacing: 8,
                    textShadow: `0 6px 40px ${COLORS.mcpOrange}50`,
                    position: "relative"
                  },
                  children: "MCP"
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              marginTop: 12,
              transform: `translateY(${(0, import_remotion5.interpolate)(subtitleProgress, [0, 1], [15, 0], { extrapolateRight: "clamp" })}px)`,
              opacity: subtitleProgress
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "p",
              {
                style: {
                  fontSize: 24,
                  fontWeight: 600,
                  color: COLORS.textDark,
                  margin: 0,
                  opacity: 0.8,
                  letterSpacing: 1
                },
                children: "Model Context Protocol"
              }
            )
          }
        )
      ]
    }
  );
};
var ExplanatoryText = ({ localFrame, fps }) => {
  const textProgress = (0, import_remotion5.spring)({
    frame: localFrame - 230,
    fps,
    config: SPRING_CONFIG
  });
  if (textProgress <= 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        bottom: "12%",
        left: "50%",
        transform: `translateX(-50%) scale(${textProgress})`,
        opacity: textProgress,
        textAlign: "center",
        maxWidth: "80%"
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "p",
        {
          style: {
            fontSize: 20,
            fontWeight: 600,
            color: COLORS.textDark,
            margin: 0,
            opacity: 0.75
          },
          children: "A way to connect AI to external tools"
        }
      )
    }
  );
};
var MCPSparkle = ({ x, y, delay, localFrame, size = 10 }) => {
  const sparkleFrame = localFrame - delay;
  if (sparkleFrame < 0 || localFrame < 144) return null;
  const cycle = 40;
  const progress = sparkleFrame % cycle / cycle;
  const opacity = (0, import_remotion5.interpolate)(
    progress,
    [0, 0.3, 0.5, 0.7, 1],
    [0, 0.7, 0.4, 0.7, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const scale = (0, import_remotion5.interpolate)(
    progress,
    [0, 0.3, 1],
    [0.4, 1.1, 0.5],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        opacity,
        transform: `scale(${scale}) rotate(${progress * 180}deg)`
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("svg", { viewBox: "0 0 24 24", width: size, height: size, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "path",
        {
          d: "M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z",
          fill: COLORS.mcpOrange
        }
      ) })
    }
  );
};
var Scene4 = ({ startFrame }) => {
  const frame = (0, import_remotion5.useCurrentFrame)();
  const { fps } = (0, import_remotion5.useVideoConfig)();
  const localFrame = frame - startFrame;
  const isSkillsPhase = localFrame < 144;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_remotion5.AbsoluteFill, { children: [
    isSkillsPhase && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(SkillsFilingCabinet, { localFrame, fps }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(SkillsSparkle, { x: 20, y: 30, delay: 10, localFrame }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(SkillsSparkle, { x: 80, y: 25, delay: 25, localFrame }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(SkillsSparkle, { x: 15, y: 70, delay: 45, localFrame }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(SkillsSparkle, { x: 85, y: 65, delay: 60, localFrame }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(SkillsSparkle, { x: 25, y: 50, delay: 80, localFrame }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(SkillsSparkle, { x: 75, y: 45, delay: 95, localFrame })
    ] }),
    !isSkillsPhase && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(MCPTitle, { localFrame, fps }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        ConnectionLine,
        {
          fromX: 50,
          fromY: 48,
          toX: 25,
          toY: 42,
          localFrame,
          fps,
          delay: 195
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        ConnectionLine,
        {
          fromX: 50,
          fromY: 48,
          toX: 75,
          toY: 42,
          localFrame,
          fps,
          delay: 210
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        ConnectionLine,
        {
          fromX: 50,
          fromY: 48,
          toX: 25,
          toY: 62,
          localFrame,
          fps,
          delay: 225
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        ConnectionLine,
        {
          fromX: 50,
          fromY: 48,
          toX: 75,
          toY: 62,
          localFrame,
          fps,
          delay: 240
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(AIBrainIcon, { localFrame, fps }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        ToolBubble,
        {
          icon: "database",
          x: 25,
          y: 42,
          localFrame,
          fps,
          delay: 200
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        ToolBubble,
        {
          icon: "code",
          x: 75,
          y: 42,
          localFrame,
          fps,
          delay: 215
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        ToolBubble,
        {
          icon: "file",
          x: 25,
          y: 62,
          localFrame,
          fps,
          delay: 230
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        ToolBubble,
        {
          icon: "cloud",
          x: 75,
          y: 62,
          localFrame,
          fps,
          delay: 245
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ExplanatoryText, { localFrame, fps }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(MCPSparkle, { x: 15, y: 25, delay: 160, localFrame }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(MCPSparkle, { x: 85, y: 28, delay: 175, localFrame }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(MCPSparkle, { x: 12, y: 55, delay: 190, localFrame }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(MCPSparkle, { x: 88, y: 52, delay: 205, localFrame }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(MCPSparkle, { x: 50, y: 80, delay: 220, localFrame, size: 12 }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(MCPSparkle, { x: 35, y: 75, delay: 235, localFrame }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(MCPSparkle, { x: 65, y: 78, delay: 250, localFrame })
    ] })
  ] });
};

// src/proj_87e55a0e_3971_4aa9_a85c_b31ef756238f/scenes/Scene5.tsx
var import_remotion6 = require("remotion");
var import_jsx_runtime6 = require("react/jsx-runtime");
var MCPServerHub = ({ frame, fps }) => {
  const entranceProgress = (0, import_remotion6.spring)({
    frame,
    fps,
    config: SPRING_CONFIG
  });
  const pulse = (0, import_remotion6.interpolate)(
    frame % 60,
    [0, 30, 60],
    [1, 1.03, 1],
    { extrapolateRight: "clamp" }
  );
  const glowIntensity = (0, import_remotion6.interpolate)(
    frame % 50,
    [0, 25, 50],
    [0.4, 0.7, 0.4],
    { extrapolateRight: "clamp" }
  );
  const scale = (0, import_remotion6.interpolate)(entranceProgress, [0, 1], [0.5, 1], {
    extrapolateRight: "clamp"
  });
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "45%",
        transform: `translate(-50%, -50%) scale(${scale * pulse})`,
        opacity: entranceProgress
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              inset: -40,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${COLORS.mcpOrange}${Math.floor(glowIntensity * 50).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
              pointerEvents: "none"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "div",
          {
            style: {
              width: 120,
              height: 120,
              borderRadius: 24,
              background: `linear-gradient(135deg, ${COLORS.mcpOrange} 0%, #EA580C 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 16px 50px ${COLORS.mcpOrange}50`,
              border: `4px solid ${COLORS.white}90`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("svg", { width: "60", height: "60", viewBox: "0 0 24 24", fill: "none", children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("rect", { x: "2", y: "3", width: "20", height: "6", rx: "2", stroke: COLORS.white, strokeWidth: "2", fill: "none" }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("rect", { x: "2", y: "11", width: "20", height: "6", rx: "2", stroke: COLORS.white, strokeWidth: "2", fill: "none" }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("circle", { cx: "6", cy: "6", r: "1.5", fill: COLORS.white }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("circle", { cx: "6", cy: "14", r: "1.5", fill: COLORS.white }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("line", { x1: "10", y1: "6", x2: "18", y2: "6", stroke: COLORS.white, strokeWidth: "1.5" }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("line", { x1: "10", y1: "14", x2: "18", y2: "14", stroke: COLORS.white, strokeWidth: "1.5" }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("circle", { cx: "8", cy: "20", r: "1.5", fill: COLORS.white }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("circle", { cx: "12", cy: "20", r: "1.5", fill: COLORS.white }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("circle", { cx: "16", cy: "20", r: "1.5", fill: COLORS.white })
            ] })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              bottom: -35,
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: 20,
              fontWeight: 800,
              color: COLORS.mcpOrange,
              letterSpacing: 2,
              whiteSpace: "nowrap"
            },
            children: "MCP SERVER"
          }
        )
      ]
    }
  );
};
var CapabilityCard = ({ icon, label, description, x, y, frame, fps, delay }) => {
  const progress = (0, import_remotion6.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG
  });
  const floatY = (0, import_remotion6.interpolate)(
    (frame + delay * 10) % 80,
    [0, 40, 80],
    [0, -4, 0],
    { extrapolateRight: "clamp" }
  );
  if (progress <= 0.01) return null;
  const bounceScale = (0, import_remotion6.interpolate)(progress, [0, 0.7, 1], [0.3, 1.08, 1], {
    extrapolateRight: "clamp"
  });
  const slideIn = (0, import_remotion6.interpolate)(progress, [0, 1], [30, 0], {
    extrapolateRight: "clamp"
  });
  const centerX = 50;
  const centerY = 45;
  const dirX = x > centerX ? slideIn : -slideIn;
  const dirY = y > centerY ? slideIn * 0.5 : -slideIn * 0.5;
  const renderIcon = () => {
    const iconProps = {
      width: 28,
      height: 28,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: COLORS.mcpOrange,
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    };
    switch (icon) {
      case "tools":
        return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("svg", { ...iconProps, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("path", { d: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" }) });
      case "resources":
        return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("svg", { ...iconProps, children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("polyline", { points: "14 2 14 8 20 8" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("line", { x1: "16", y1: "13", x2: "8", y2: "13" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("line", { x1: "16", y1: "17", x2: "8", y2: "17" })
        ] });
      case "prompts":
        return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("svg", { ...iconProps, children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("line", { x1: "9", y1: "9", x2: "15", y2: "9" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("line", { x1: "9", y1: "13", x2: "13", y2: "13" })
        ] });
      case "sampling":
        return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("svg", { ...iconProps, children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("circle", { cx: "12", cy: "12", r: "3" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("path", { d: "M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" })
        ] });
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) translate(${dirX}px, ${dirY + floatY}px) scale(${bounceScale})`,
        opacity: progress
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
        "div",
        {
          style: {
            width: 140,
            padding: "16px 12px",
            borderRadius: 16,
            background: COLORS.white,
            border: `3px solid ${COLORS.mcpOrange}40`,
            boxShadow: `0 8px 30px rgba(0,0,0,0.1)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              "div",
              {
                style: {
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  background: `${COLORS.mcpOrange}15`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                },
                children: renderIcon()
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              "div",
              {
                style: {
                  fontSize: 14,
                  fontWeight: 700,
                  color: COLORS.mcpOrange,
                  textAlign: "center"
                },
                children: label
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              "div",
              {
                style: {
                  fontSize: 11,
                  fontWeight: 500,
                  color: COLORS.textDark,
                  opacity: 0.7,
                  textAlign: "center",
                  lineHeight: 1.3
                },
                children: description
              }
            )
          ]
        }
      )
    }
  );
};
var ConnectionLine2 = ({ toX, toY, frame, fps, delay }) => {
  const drawProgress = (0, import_remotion6.spring)({
    frame: frame - delay + 15,
    fps,
    config: { damping: 25, stiffness: 70, mass: 1 }
  });
  if (drawProgress <= 0.05) return null;
  const fromX = 50;
  const fromY = 45;
  const startX = fromX;
  const startY = fromY;
  const endX = fromX + (toX - fromX) * drawProgress;
  const endY = fromY + (toY - fromY) * drawProgress;
  const dashOffset = frame * 0.8;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
    "svg",
    {
      style: {
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "visible"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("linearGradient", { id: `connGrad-${toX}-${toY}`, x1: `${startX}%`, y1: `${startY}%`, x2: `${toX}%`, y2: `${toY}%`, children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("stop", { offset: "0%", stopColor: COLORS.mcpOrange, stopOpacity: 0.8 }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("stop", { offset: "100%", stopColor: COLORS.mcpOrange, stopOpacity: 0.4 })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "line",
          {
            x1: `${startX}%`,
            y1: `${startY}%`,
            x2: `${endX}%`,
            y2: `${endY}%`,
            stroke: `url(#connGrad-${toX}-${toY})`,
            strokeWidth: 3,
            strokeLinecap: "round",
            strokeDasharray: "10 6",
            strokeDashoffset: -dashOffset,
            opacity: 0.6
          }
        )
      ]
    }
  );
};
var ServiceConnector = ({ name, emoji, x, y, frame, fps, delay }) => {
  const progress = (0, import_remotion6.spring)({
    frame: frame - delay,
    fps,
    config: { damping: 20, stiffness: 100, mass: 0.7 }
  });
  const pulse = (0, import_remotion6.interpolate)(
    (frame + delay * 12) % 50,
    [0, 25, 50],
    [0.95, 1.05, 0.95],
    { extrapolateRight: "clamp" }
  );
  if (progress <= 0.01) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) scale(${progress * pulse})`,
        opacity: progress
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
        "div",
        {
          style: {
            width: 70,
            height: 70,
            borderRadius: 14,
            background: COLORS.white,
            border: `2px solid ${COLORS.textDark}20`,
            boxShadow: `0 6px 20px rgba(0,0,0,0.08)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { fontSize: 24 }, children: emoji }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              "span",
              {
                style: {
                  fontSize: 10,
                  fontWeight: 600,
                  color: COLORS.textDark,
                  opacity: 0.8
                },
                children: name
              }
            )
          ]
        }
      )
    }
  );
};
var ServiceLine = ({ fromX, fromY, frame, fps, delay, direction }) => {
  const progress = (0, import_remotion6.spring)({
    frame: frame - delay - 10,
    fps,
    config: { damping: 25, stiffness: 80, mass: 0.9 }
  });
  if (progress <= 0.05) return null;
  const targetX = direction === "left" ? 35 : 65;
  const targetY = 45;
  const currentX = fromX + (targetX - fromX) * progress;
  const currentY = fromY + (targetY - fromY) * progress;
  const dashOffset = frame * 0.5;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    "svg",
    {
      style: {
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "visible"
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "line",
        {
          x1: `${fromX}%`,
          y1: `${fromY}%`,
          x2: `${currentX}%`,
          y2: `${currentY}%`,
          stroke: COLORS.textDark,
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeDasharray: "6 4",
          strokeDashoffset: -dashOffset,
          opacity: 0.25
        }
      )
    }
  );
};
var SceneTitle = ({ frame, fps }) => {
  const titleProgress = (0, import_remotion6.spring)({
    frame: frame - 5,
    fps,
    config: SPRING_CONFIG
  });
  const subtitleProgress = (0, import_remotion6.spring)({
    frame: frame - 25,
    fps,
    config: SPRING_CONFIG
  });
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "6%",
          left: "50%",
          transform: `translateX(-50%) translateY(${(0, import_remotion6.interpolate)(titleProgress, [0, 1], [20, 0], { extrapolateRight: "clamp" })}px)`,
          opacity: titleProgress,
          textAlign: "center"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "h1",
          {
            style: {
              fontSize: 36,
              fontWeight: 900,
              color: COLORS.mcpOrange,
              margin: 0,
              letterSpacing: 1
            },
            children: "What MCP Provides"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "13%",
          left: "50%",
          transform: `translateX(-50%)`,
          opacity: subtitleProgress,
          textAlign: "center"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "p",
          {
            style: {
              fontSize: 18,
              fontWeight: 600,
              color: COLORS.textDark,
              margin: 0,
              opacity: 0.7
            },
            children: "A standardized way to connect AI to external capabilities"
          }
        )
      }
    )
  ] });
};
var PhaseLabel = ({ text, frame, fps, delay, position, y }) => {
  const progress = (0, import_remotion6.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_FAST
  });
  if (progress <= 0.01) return null;
  const xPos = position === "left" ? "15%" : position === "right" ? "85%" : "50%";
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: xPos,
        top: `${y}%`,
        transform: `translate(-50%, -50%) scale(${progress})`,
        opacity: progress * 0.9,
        padding: "8px 16px",
        borderRadius: 8,
        background: `${COLORS.mcpOrange}15`,
        border: `2px solid ${COLORS.mcpOrange}30`
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "span",
        {
          style: {
            fontSize: 13,
            fontWeight: 700,
            color: COLORS.mcpOrange,
            textTransform: "uppercase",
            letterSpacing: 1
          },
          children: text
        }
      )
    }
  );
};
var SummaryText = ({ frame, fps }) => {
  const progress = (0, import_remotion6.spring)({
    frame: frame - 300,
    fps,
    config: SPRING_CONFIG
  });
  if (progress <= 0.01) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        bottom: "6%",
        left: "50%",
        transform: `translateX(-50%) scale(${progress})`,
        opacity: progress,
        textAlign: "center",
        maxWidth: "80%"
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "p",
        {
          style: {
            fontSize: 20,
            fontWeight: 700,
            color: COLORS.textDark,
            margin: 0
          },
          children: "One protocol, many capabilities \u2014 all available to the AI"
        }
      )
    }
  );
};
var Sparkle2 = ({ x, y, frame, delay, size = 10 }) => {
  const sparkleFrame = frame - delay;
  if (sparkleFrame < 0) return null;
  const cycle = 40;
  const progress = sparkleFrame % cycle / cycle;
  const opacity = (0, import_remotion6.interpolate)(
    progress,
    [0, 0.3, 0.5, 0.7, 1],
    [0, 0.7, 0.4, 0.7, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const scale = (0, import_remotion6.interpolate)(
    progress,
    [0, 0.3, 1],
    [0.4, 1.1, 0.5],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        opacity,
        transform: `scale(${scale}) rotate(${progress * 180}deg)`
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("svg", { viewBox: "0 0 24 24", width: size, height: size, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "path",
        {
          d: "M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z",
          fill: COLORS.mcpOrange
        }
      ) })
    }
  );
};
var Scene5 = ({ startFrame }) => {
  const frame = (0, import_remotion6.useCurrentFrame)();
  const { fps } = (0, import_remotion6.useVideoConfig)();
  const localFrame = frame - startFrame;
  const capabilities = [
    { icon: "tools", label: "Tools", description: "Execute actions & functions", x: 22, y: 35, delay: 60 },
    { icon: "resources", label: "Resources", description: "Access files & data", x: 78, y: 35, delay: 90 },
    { icon: "prompts", label: "Prompts", description: "Template workflows", x: 22, y: 65, delay: 150 },
    { icon: "sampling", label: "Sampling", description: "AI completions", x: 78, y: 65, delay: 180 }
  ];
  const services = [
    { name: "Database", emoji: "\u{1F5C4}\uFE0F", x: 8, y: 30, delay: 240 },
    { name: "APIs", emoji: "\u{1F310}", x: 8, y: 50, delay: 260 },
    { name: "Files", emoji: "\u{1F4C1}", x: 8, y: 70, delay: 280 },
    { name: "GitHub", emoji: "\u{1F419}", x: 92, y: 30, delay: 250 },
    { name: "Slack", emoji: "\u{1F4AC}", x: 92, y: 50, delay: 270 },
    { name: "Cloud", emoji: "\u2601\uFE0F", x: 92, y: 70, delay: 290 }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_remotion6.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(SceneTitle, { frame: localFrame, fps }),
    capabilities.map((cap, i) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      ConnectionLine2,
      {
        toX: cap.x,
        toY: cap.y,
        frame: localFrame,
        fps,
        delay: cap.delay
      },
      `conn-${i}`
    )),
    services.map((svc, i) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      ServiceLine,
      {
        fromX: svc.x,
        fromY: svc.y,
        frame: localFrame,
        fps,
        delay: svc.delay,
        direction: svc.x < 50 ? "left" : "right"
      },
      `svc-line-${i}`
    )),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(MCPServerHub, { frame: localFrame, fps }),
    capabilities.map((cap, i) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      CapabilityCard,
      {
        icon: cap.icon,
        label: cap.label,
        description: cap.description,
        x: cap.x,
        y: cap.y,
        frame: localFrame,
        fps,
        delay: cap.delay
      },
      `cap-${i}`
    )),
    services.map((svc, i) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      ServiceConnector,
      {
        name: svc.name,
        emoji: svc.emoji,
        x: svc.x,
        y: svc.y,
        frame: localFrame,
        fps,
        delay: svc.delay
      },
      `svc-${i}`
    )),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      PhaseLabel,
      {
        text: "Core Capabilities",
        frame: localFrame,
        fps,
        delay: 70,
        position: "center",
        y: 22
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      PhaseLabel,
      {
        text: "External Services",
        frame: localFrame,
        fps,
        delay: 245,
        position: "left",
        y: 88
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      PhaseLabel,
      {
        text: "Integrations",
        frame: localFrame,
        fps,
        delay: 255,
        position: "right",
        y: 88
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(SummaryText, { frame: localFrame, fps }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Sparkle2, { x: 35, y: 28, frame: localFrame, delay: 80, size: 12 }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Sparkle2, { x: 65, y: 28, frame: localFrame, delay: 110, size: 10 }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Sparkle2, { x: 35, y: 72, frame: localFrame, delay: 170, size: 11 }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Sparkle2, { x: 65, y: 72, frame: localFrame, delay: 200, size: 9 }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Sparkle2, { x: 50, y: 80, frame: localFrame, delay: 320, size: 14 })
  ] });
};

// src/proj_87e55a0e_3971_4aa9_a85c_b31ef756238f/scenes/Scene6.tsx
var import_remotion7 = require("remotion");
var import_jsx_runtime7 = require("react/jsx-runtime");
var SettlingParticle = ({ startX, startY, frame, delay, color, size }) => {
  const particleFrame = frame - delay;
  if (particleFrame < 0) return null;
  const fallProgress = (0, import_remotion7.interpolate)(
    particleFrame,
    [0, 50],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  const y = startY + fallProgress * 80;
  const x = startX + Math.sin(particleFrame * 0.08 + delay) * 15;
  const opacity = (0, import_remotion7.interpolate)(
    particleFrame,
    [0, 20, 50],
    [0.6, 0.4, 0],
    { extrapolateRight: "clamp" }
  );
  const rotation = particleFrame * 2 + delay * 10;
  const scale = (0, import_remotion7.interpolate)(
    particleFrame,
    [0, 50],
    [1, 0.5],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: size > 8 ? 4 : 2,
        opacity,
        transform: `rotate(${rotation}deg) scale(${scale})`
      }
    }
  );
};
var ClearingWave = ({ frame, fps }) => {
  const waveProgress = (0, import_remotion7.spring)({
    frame: frame - 15,
    fps,
    config: { damping: 30, stiffness: 60, mass: 1 }
  });
  const waveX = (0, import_remotion7.interpolate)(
    waveProgress,
    [0, 1],
    [-20, 120],
    { extrapolateRight: "clamp" }
  );
  const waveOpacity = (0, import_remotion7.interpolate)(
    waveProgress,
    [0, 0.3, 0.7, 1],
    [0, 0.4, 0.3, 0],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${waveX}%`,
        top: 0,
        width: "30%",
        height: "100%",
        background: `linear-gradient(90deg, transparent 0%, ${COLORS.white}90 40%, ${COLORS.white}90 60%, transparent 100%)`,
        opacity: waveOpacity,
        pointerEvents: "none"
      }
    }
  );
};
var IdeaBubble = ({ frame, fps }) => {
  const bubbleProgress = (0, import_remotion7.spring)({
    frame: frame - 25,
    fps,
    config: { damping: 20, stiffness: 90, mass: 0.8 }
  });
  const glowPulse = (0, import_remotion7.interpolate)(
    frame % 40,
    [0, 20, 40],
    [0.5, 1, 0.5],
    { extrapolateRight: "clamp" }
  );
  const scale = (0, import_remotion7.interpolate)(
    bubbleProgress,
    [0, 1],
    [0.3, 1],
    { extrapolateRight: "clamp" }
  );
  const bounceY = (0, import_remotion7.interpolate)(
    bubbleProgress,
    [0, 0.7, 1],
    [30, -8, 0],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "40%",
        transform: `translate(-50%, -50%) translateY(${bounceY}px) scale(${scale})`,
        opacity: bubbleProgress
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              inset: -40,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${COLORS.accentYellow}${Math.floor(glowPulse * 50).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
              filter: "blur(10px)",
              pointerEvents: "none"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            style: {
              width: 100,
              height: 100,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${COLORS.accentYellow} 0%, #FBBF24 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 12px 40px ${COLORS.accentYellow}50`,
              border: `4px solid ${COLORS.white}`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("svg", { width: "50", height: "50", viewBox: "0 0 24 24", fill: "none", children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                "path",
                {
                  d: "M9 21h6M12 3a6 6 0 0 0-6 6c0 2.22 1.21 4.16 3 5.19V17a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-2.81c1.79-1.03 3-2.97 3-5.19a6 6 0 0 0-6-6z",
                  stroke: COLORS.textDark,
                  strokeWidth: 2.5,
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                  fill: "none"
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                "path",
                {
                  d: "M12 1v1M4.22 4.22l.7.7M1 12h1M4.22 19.78l.7-.7M23 12h-1M19.78 4.22l-.7.7",
                  stroke: COLORS.textDark,
                  strokeWidth: 2,
                  strokeLinecap: "round",
                  opacity: glowPulse
                }
              )
            ] })
          }
        )
      ]
    }
  );
};
var TransitionText = ({ frame, fps }) => {
  const textProgress = (0, import_remotion7.spring)({
    frame: frame - 40,
    fps,
    config: SPRING_CONFIG
  });
  const slideY = (0, import_remotion7.interpolate)(
    textProgress,
    [0, 1],
    [20, 0],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "62%",
        transform: `translate(-50%, -50%) translateY(${slideY}px)`,
        opacity: textProgress,
        textAlign: "center"
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "span",
        {
          style: {
            fontSize: 32,
            fontWeight: 700,
            color: COLORS.textDark,
            letterSpacing: 1
          },
          children: "Let's see a real example..."
        }
      )
    }
  );
};
var TransitionSparkle = ({ x, y, frame, delay, size = 12 }) => {
  const sparkleFrame = frame - delay;
  if (sparkleFrame < 0) return null;
  const cycle = 35;
  const progress = sparkleFrame % cycle / cycle;
  const opacity = (0, import_remotion7.interpolate)(
    progress,
    [0, 0.3, 0.5, 0.7, 1],
    [0, 0.8, 0.5, 0.8, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const scale = (0, import_remotion7.interpolate)(
    progress,
    [0, 0.3, 1],
    [0.4, 1.2, 0.5],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const rotation = progress * 180;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        opacity,
        transform: `scale(${scale}) rotate(${rotation}deg)`
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("svg", { viewBox: "0 0 24 24", width: size, height: size, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "path",
        {
          d: "M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z",
          fill: COLORS.accentYellow
        }
      ) })
    }
  );
};
var TransitionArrow = ({ frame, fps }) => {
  const arrowProgress = (0, import_remotion7.spring)({
    frame: frame - 50,
    fps,
    config: SPRING_CONFIG
  });
  const bounceY = (0, import_remotion7.interpolate)(
    frame % 30,
    [0, 15, 30],
    [0, 8, 0],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        bottom: "15%",
        transform: `translateX(-50%) translateY(${bounceY}px) scale(${arrowProgress})`,
        opacity: arrowProgress * 0.7
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("svg", { width: "50", height: "50", viewBox: "0 0 24 24", fill: "none", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "path",
        {
          d: "M12 5v14M5 12l7 7 7-7",
          stroke: COLORS.skillsBlue,
          strokeWidth: 3,
          strokeLinecap: "round",
          strokeLinejoin: "round"
        }
      ) })
    }
  );
};
var BackgroundTransition = ({ frame }) => {
  const chaosOpacity = (0, import_remotion7.interpolate)(
    frame,
    [0, 40],
    [0.15, 0],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        inset: 0,
        background: `radial-gradient(circle at 70% 50%, ${COLORS.mcpOrange}${Math.floor(chaosOpacity * 255).toString(16).padStart(2, "0")} 0%, transparent 50%)`,
        pointerEvents: "none"
      }
    }
  );
};
var Scene6 = ({ startFrame }) => {
  const frame = (0, import_remotion7.useCurrentFrame)();
  const { fps } = (0, import_remotion7.useVideoConfig)();
  const localFrame = frame - startFrame;
  const settlingParticles = [
    { x: 15, y: 10, delay: 0, color: COLORS.mcpOrange, size: 10 },
    { x: 25, y: 5, delay: 3, color: COLORS.mcpOrange, size: 8 },
    { x: 70, y: 8, delay: 2, color: COLORS.mcpOrange, size: 12 },
    { x: 80, y: 12, delay: 5, color: COLORS.mcpOrange, size: 9 },
    { x: 55, y: 6, delay: 1, color: COLORS.accentYellow, size: 7 },
    { x: 40, y: 10, delay: 4, color: COLORS.mcpOrange, size: 11 },
    { x: 85, y: 5, delay: 6, color: COLORS.accentYellow, size: 8 },
    { x: 10, y: 15, delay: 8, color: COLORS.mcpOrange, size: 6 }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_remotion7.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(BackgroundTransition, { frame: localFrame }),
    settlingParticles.map((p, i) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      SettlingParticle,
      {
        startX: p.x,
        startY: p.y,
        frame: localFrame,
        delay: p.delay,
        color: p.color,
        size: p.size
      },
      i
    )),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(ClearingWave, { frame: localFrame, fps }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IdeaBubble, { frame: localFrame, fps }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(TransitionText, { frame: localFrame, fps }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(TransitionArrow, { frame: localFrame, fps }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(TransitionSparkle, { x: 30, y: 35, frame: localFrame, delay: 30, size: 14 }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(TransitionSparkle, { x: 70, y: 38, frame: localFrame, delay: 35, size: 12 }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(TransitionSparkle, { x: 25, y: 55, frame: localFrame, delay: 45, size: 10 }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(TransitionSparkle, { x: 75, y: 52, frame: localFrame, delay: 50, size: 11 }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(TransitionSparkle, { x: 50, y: 28, frame: localFrame, delay: 40, size: 16 })
  ] });
};

// src/proj_87e55a0e_3971_4aa9_a85c_b31ef756238f/scenes/Scene7.tsx
var import_remotion8 = require("remotion");
var import_jsx_runtime8 = require("react/jsx-runtime");
var TRANSITION_FRAME = 270;
var MCPServer = ({ frame, fps }) => {
  const entranceProgress = (0, import_remotion8.spring)({
    frame: frame - 15,
    fps,
    config: SPRING_CONFIG
  });
  const pulse = (0, import_remotion8.interpolate)(
    frame % 50,
    [0, 25, 50],
    [1, 1.02, 1],
    { extrapolateRight: "clamp" }
  );
  const glowIntensity = (0, import_remotion8.interpolate)(
    frame % 40,
    [0, 20, 40],
    [0.4, 0.7, 0.4],
    { extrapolateRight: "clamp" }
  );
  const scale = (0, import_remotion8.interpolate)(entranceProgress, [0, 1], [0.5, 1], {
    extrapolateRight: "clamp"
  });
  const bounceY = (0, import_remotion8.interpolate)(entranceProgress, [0, 0.7, 1], [40, -8, 0], {
    extrapolateRight: "clamp"
  });
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "42%",
        transform: `translate(-50%, -50%) translateY(${bounceY}px) scale(${scale * pulse})`,
        opacity: entranceProgress
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              inset: -50,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${COLORS.mcpOrange}${Math.floor(glowIntensity * 45).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
              pointerEvents: "none"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "div",
          {
            style: {
              width: 140,
              height: 140,
              borderRadius: 28,
              background: `linear-gradient(135deg, ${COLORS.mcpOrange} 0%, #EA580C 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 20px 60px ${COLORS.mcpOrange}50`,
              border: `4px solid ${COLORS.white}90`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("svg", { width: "70", height: "70", viewBox: "0 0 24 24", fill: "none", children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("rect", { x: "2", y: "3", width: "20", height: "6", rx: "2", stroke: COLORS.white, strokeWidth: "2", fill: "none" }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("rect", { x: "2", y: "11", width: "20", height: "6", rx: "2", stroke: COLORS.white, strokeWidth: "2", fill: "none" }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("circle", { cx: "6", cy: "6", r: "1.5", fill: COLORS.white }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("circle", { cx: "6", cy: "14", r: "1.5", fill: COLORS.white }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("line", { x1: "10", y1: "6", x2: "18", y2: "6", stroke: COLORS.white, strokeWidth: "1.5" }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("line", { x1: "10", y1: "14", x2: "18", y2: "14", stroke: COLORS.white, strokeWidth: "1.5" }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("circle", { cx: "8", cy: "20", r: "1.5", fill: COLORS.white }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("circle", { cx: "12", cy: "20", r: "1.5", fill: COLORS.white }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("circle", { cx: "16", cy: "20", r: "1.5", fill: COLORS.white })
            ] })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              bottom: -45,
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: 26,
              fontWeight: 900,
              color: COLORS.mcpOrange,
              letterSpacing: 3,
              whiteSpace: "nowrap",
              textShadow: `0 2px 20px ${COLORS.mcpOrange}30`
            },
            children: "MCP SERVER"
          }
        )
      ]
    }
  );
};
var APIEndpoint = ({ method, endpoint, x, y, frame, fps, delay }) => {
  const progress = (0, import_remotion8.spring)({
    frame: frame - delay,
    fps,
    config: { damping: 20, stiffness: 100, mass: 0.7 }
  });
  const floatX = (0, import_remotion8.interpolate)(
    (frame + delay * 10) % 80,
    [0, 40, 80],
    [-4, 4, -4],
    { extrapolateRight: "clamp" }
  );
  const floatY = (0, import_remotion8.interpolate)(
    (frame + delay * 15) % 60,
    [0, 30, 60],
    [-3, 3, -3],
    { extrapolateRight: "clamp" }
  );
  if (progress <= 0.01) return null;
  const methodColors = {
    GET: "#10B981",
    POST: "#3B82F6",
    DELETE: "#EF4444",
    PUT: "#F97316"
  };
  const slideIn = (0, import_remotion8.interpolate)(progress, [0, 1], [30, 0], {
    extrapolateRight: "clamp"
  });
  const centerX = 50;
  const centerY = 42;
  const dirX = x > centerX ? slideIn : -slideIn;
  const dirY = y > centerY ? slideIn * 0.5 : -slideIn * 0.5;
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) translate(${dirX + floatX}px, ${dirY + floatY}px) scale(${progress})`,
        opacity: progress
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            borderRadius: 12,
            background: COLORS.white,
            border: `2px solid ${methodColors[method]}50`,
            boxShadow: `0 8px 24px rgba(0,0,0,0.1)`
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              "span",
              {
                style: {
                  fontSize: 11,
                  fontWeight: 800,
                  color: methodColors[method],
                  padding: "3px 8px",
                  borderRadius: 6,
                  backgroundColor: `${methodColors[method]}15`,
                  letterSpacing: 0.5
                },
                children: method
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              "span",
              {
                style: {
                  fontSize: 13,
                  fontWeight: 600,
                  color: COLORS.textDark,
                  fontFamily: "monospace"
                },
                children: endpoint
              }
            )
          ]
        }
      )
    }
  );
};
var ConnectionLine3 = ({ toX, toY, frame, fps, delay }) => {
  const drawProgress = (0, import_remotion8.spring)({
    frame: frame - delay + 10,
    fps,
    config: { damping: 25, stiffness: 80, mass: 0.9 }
  });
  if (drawProgress <= 0.05) return null;
  const fromX = 50;
  const fromY = 42;
  const endX = fromX + (toX - fromX) * drawProgress;
  const endY = fromY + (toY - fromY) * drawProgress;
  const dashOffset = frame * 0.5;
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    "svg",
    {
      style: {
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "visible"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("linearGradient", { id: `connLine-${toX}-${toY}`, x1: `${fromX}%`, y1: `${fromY}%`, x2: `${toX}%`, y2: `${toY}%`, children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("stop", { offset: "0%", stopColor: COLORS.mcpOrange, stopOpacity: 0.7 }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("stop", { offset: "100%", stopColor: COLORS.mcpOrange, stopOpacity: 0.3 })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "line",
          {
            x1: `${fromX}%`,
            y1: `${fromY}%`,
            x2: `${endX}%`,
            y2: `${endY}%`,
            stroke: `url(#connLine-${toX}-${toY})`,
            strokeWidth: 2.5,
            strokeLinecap: "round",
            strokeDasharray: "8 5",
            strokeDashoffset: -dashOffset,
            opacity: 0.6
          }
        )
      ]
    }
  );
};
var MCPTitle2 = ({ frame, fps }) => {
  const progress = (0, import_remotion8.spring)({
    frame: frame - 5,
    fps,
    config: SPRING_CONFIG
  });
  const slideY = (0, import_remotion8.interpolate)(progress, [0, 1], [30, 0], {
    extrapolateRight: "clamp"
  });
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        top: "6%",
        left: "50%",
        transform: `translateX(-50%) translateY(${slideY}px)`,
        opacity: progress,
        textAlign: "center"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "h1",
          {
            style: {
              fontSize: 42,
              fontWeight: 900,
              color: COLORS.mcpOrange,
              margin: 0,
              letterSpacing: 2,
              textShadow: `0 4px 30px ${COLORS.mcpOrange}30`
            },
            children: "The MCP Approach"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "p",
          {
            style: {
              fontSize: 20,
              fontWeight: 600,
              color: COLORS.textDark,
              opacity: 0.7,
              marginTop: 8
            },
            children: "Raw tools & infrastructure"
          }
        )
      ]
    }
  );
};
var ComplexityBadge = ({ frame, fps }) => {
  const progress = (0, import_remotion8.spring)({
    frame: frame - 150,
    fps,
    config: SPRING_CONFIG
  });
  if (progress <= 0.01) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        bottom: "10%",
        left: "50%",
        transform: `translateX(-50%) scale(${progress})`,
        opacity: progress,
        textAlign: "center"
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 28px",
            borderRadius: 16,
            background: `${COLORS.mcpOrange}15`,
            border: `2px solid ${COLORS.mcpOrange}40`
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { fontSize: 22 }, children: "\u2699\uFE0F" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              "span",
              {
                style: {
                  fontSize: 18,
                  fontWeight: 700,
                  color: COLORS.mcpOrange
                },
                children: "Requires setup & configuration"
              }
            )
          ]
        }
      )
    }
  );
};
var SkillsTitle = ({ frame, fps }) => {
  const localFrame = frame - TRANSITION_FRAME;
  const progress = (0, import_remotion8.spring)({
    frame: localFrame - 5,
    fps,
    config: SPRING_CONFIG
  });
  const slideY = (0, import_remotion8.interpolate)(progress, [0, 1], [30, 0], {
    extrapolateRight: "clamp"
  });
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        top: "6%",
        left: "50%",
        transform: `translateX(-50%) translateY(${slideY}px)`,
        opacity: progress,
        textAlign: "center"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "h1",
          {
            style: {
              fontSize: 42,
              fontWeight: 900,
              color: COLORS.skillsBlue,
              margin: 0,
              letterSpacing: 2,
              textShadow: `0 4px 30px ${COLORS.skillsBlue}30`
            },
            children: "The Skills Approach"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "p",
          {
            style: {
              fontSize: 20,
              fontWeight: 600,
              color: COLORS.textDark,
              opacity: 0.7,
              marginTop: 8
            },
            children: "Structured behavior & guidance"
          }
        )
      ]
    }
  );
};
var SkillFile = ({ frame, fps }) => {
  const localFrame = frame - TRANSITION_FRAME;
  const entranceProgress = (0, import_remotion8.spring)({
    frame: localFrame - 20,
    fps,
    config: { damping: 20, stiffness: 85, mass: 0.9 }
  });
  const bounceY = (0, import_remotion8.interpolate)(entranceProgress, [0, 0.7, 1], [60, -10, 0], {
    extrapolateRight: "clamp"
  });
  const float = (0, import_remotion8.interpolate)(
    localFrame % 80 / 80,
    [0, 0.5, 1],
    [0, -4, 0],
    { extrapolateRight: "clamp" }
  );
  const glowPulse = (0, import_remotion8.interpolate)(
    localFrame % 50,
    [0, 25, 50],
    [0.4, 0.7, 0.4],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "48%",
        transform: `translate(-50%, -50%) translateY(${bounceY + float}px) scale(${entranceProgress})`,
        opacity: entranceProgress
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              inset: -30,
              borderRadius: 30,
              background: `radial-gradient(circle, ${COLORS.skillsBlue}${Math.floor(glowPulse * 35).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
              pointerEvents: "none"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
          "div",
          {
            style: {
              width: 380,
              borderRadius: 20,
              background: COLORS.white,
              boxShadow: `0 25px 80px ${COLORS.skillsBlue}25`,
              overflow: "hidden",
              border: `3px solid ${COLORS.skillsBlue}50`
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "16px 20px",
                    borderBottom: `2px solid ${COLORS.skillsBlue}20`,
                    background: `linear-gradient(135deg, ${COLORS.skillsBlue}08 0%, transparent 100%)`
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                      "div",
                      {
                        style: {
                          padding: "6px 12px",
                          borderRadius: 8,
                          backgroundColor: COLORS.skillsBlue,
                          fontSize: 12,
                          fontWeight: 700,
                          color: COLORS.white,
                          letterSpacing: 0.5
                        },
                        children: "SKILL.MD"
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                      "span",
                      {
                        style: {
                          fontSize: 14,
                          fontWeight: 600,
                          color: COLORS.textDark,
                          opacity: 0.7
                        },
                        children: "drive-helper.md"
                      }
                    )
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(FrontMatterSection, { frame, fps }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(BodySection, { frame, fps })
            ]
          }
        )
      ]
    }
  );
};
var FrontMatterSection = ({ frame, fps }) => {
  const localFrame = frame - TRANSITION_FRAME;
  const sectionProgress = (0, import_remotion8.spring)({
    frame: localFrame - 50,
    fps,
    config: SPRING_FAST
  });
  const items = [
    { key: "name:", value: '"google-drive-helper"' },
    { key: "description:", value: '"Manage Drive files"' },
    { key: "triggers:", value: '["drive", "files"]' }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    "div",
    {
      style: {
        padding: "16px 20px",
        borderBottom: `2px dashed ${COLORS.accentYellow}60`,
        background: `linear-gradient(180deg, ${COLORS.accentYellow}12 0%, ${COLORS.accentYellow}05 100%)`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
              opacity: sectionProgress
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                "div",
                {
                  style: {
                    padding: "4px 10px",
                    borderRadius: 10,
                    background: `linear-gradient(135deg, #F59E0B 0%, #D97706 100%)`
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                    "span",
                    {
                      style: {
                        fontSize: 10,
                        fontWeight: 800,
                        color: COLORS.white,
                        letterSpacing: 1,
                        textTransform: "uppercase"
                      },
                      children: "Front Matter"
                    }
                  )
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                "span",
                {
                  style: {
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#D97706",
                    opacity: 0.8
                  },
                  children: "Metadata"
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "div",
          {
            style: {
              fontFamily: "monospace",
              fontSize: 13,
              display: "flex",
              flexDirection: "column",
              gap: 6
            },
            children: items.map((item, i) => {
              const lineProgress = (0, import_remotion8.spring)({
                frame: localFrame - 60 - i * 10,
                fps,
                config: SPRING_FAST
              });
              return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
                "div",
                {
                  style: {
                    display: "flex",
                    gap: 6,
                    opacity: lineProgress,
                    transform: `translateX(${(0, import_remotion8.interpolate)(lineProgress, [0, 1], [15, 0], { extrapolateRight: "clamp" })}px)`
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { color: "#D97706", fontWeight: 600 }, children: item.key }),
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { color: "#92400E" }, children: item.value })
                  ]
                },
                i
              );
            })
          }
        )
      ]
    }
  );
};
var BodySection = ({ frame, fps }) => {
  const localFrame = frame - TRANSITION_FRAME;
  const sectionProgress = (0, import_remotion8.spring)({
    frame: localFrame - 100,
    fps,
    config: SPRING_FAST
  });
  const bodyLines = [
    { text: "## When to use", isHeader: true },
    { text: "Use when working with Google Drive", isHeader: false },
    { text: "", isHeader: false },
    { text: "## Best Practices", isHeader: true },
    { text: "- Always check permissions first", isHeader: false },
    { text: "- Use structured folder naming", isHeader: false },
    { text: "- Handle errors gracefully", isHeader: false }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    "div",
    {
      style: {
        padding: "16px 20px",
        background: `linear-gradient(180deg, ${COLORS.skillsBlue}06 0%, transparent 100%)`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
              opacity: sectionProgress
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                "div",
                {
                  style: {
                    padding: "4px 10px",
                    borderRadius: 10,
                    background: `linear-gradient(135deg, ${COLORS.skillsBlue} 0%, #2563EB 100%)`
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                    "span",
                    {
                      style: {
                        fontSize: 10,
                        fontWeight: 800,
                        color: COLORS.white,
                        letterSpacing: 1,
                        textTransform: "uppercase"
                      },
                      children: "Body"
                    }
                  )
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                "span",
                {
                  style: {
                    fontSize: 11,
                    fontWeight: 600,
                    color: COLORS.skillsBlue,
                    opacity: 0.8
                  },
                  children: "Instructions"
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "div",
          {
            style: {
              fontFamily: "monospace",
              fontSize: 12,
              display: "flex",
              flexDirection: "column",
              gap: 4
            },
            children: bodyLines.map((line, i) => {
              const lineProgress = (0, import_remotion8.spring)({
                frame: localFrame - 115 - i * 8,
                fps,
                config: SPRING_FAST
              });
              return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                "div",
                {
                  style: {
                    minHeight: line.text === "" ? 8 : "auto",
                    opacity: lineProgress,
                    transform: `translateX(${(0, import_remotion8.interpolate)(lineProgress, [0, 1], [12, 0], { extrapolateRight: "clamp" })}px)`,
                    color: line.isHeader ? COLORS.skillsBlue : COLORS.textDark,
                    fontWeight: line.isHeader ? 700 : 400,
                    lineHeight: 1.4
                  },
                  children: line.text
                },
                i
              );
            })
          }
        )
      ]
    }
  );
};
var BenefitBadge = ({ emoji, text, x, y, frame, fps, delay }) => {
  const localFrame = frame - TRANSITION_FRAME;
  const progress = (0, import_remotion8.spring)({
    frame: localFrame - delay,
    fps,
    config: SPRING_CONFIG
  });
  const float = (0, import_remotion8.interpolate)(
    (localFrame + delay * 10) % 70 / 70,
    [0, 0.5, 1],
    [0, -5, 0],
    { extrapolateRight: "clamp" }
  );
  if (progress <= 0.01) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) translateY(${float}px) scale(${progress})`,
        opacity: progress
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            borderRadius: 14,
            background: COLORS.white,
            border: `2px solid ${COLORS.successGreen}40`,
            boxShadow: `0 8px 24px rgba(0,0,0,0.08)`
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { fontSize: 18 }, children: emoji }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              "span",
              {
                style: {
                  fontSize: 14,
                  fontWeight: 600,
                  color: COLORS.textDark
                },
                children: text
              }
            )
          ]
        }
      )
    }
  );
};
var Sparkle3 = ({ x, y, frame, delay, size = 12, color }) => {
  const sparkleFrame = frame - delay;
  if (sparkleFrame < 0) return null;
  const cycle = 40;
  const progress = sparkleFrame % cycle / cycle;
  const opacity = (0, import_remotion8.interpolate)(
    progress,
    [0, 0.3, 0.5, 0.7, 1],
    [0, 0.8, 0.5, 0.8, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const scale = (0, import_remotion8.interpolate)(
    progress,
    [0, 0.3, 1],
    [0.4, 1.2, 0.5],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        opacity,
        transform: `scale(${scale}) rotate(${progress * 180}deg)`
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("svg", { viewBox: "0 0 24 24", width: size, height: size, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        "path",
        {
          d: "M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z",
          fill: color
        }
      ) })
    }
  );
};
var TransitionWipe = ({ frame, fps }) => {
  const wipeStart = TRANSITION_FRAME - 15;
  const wipeEnd = TRANSITION_FRAME + 30;
  if (frame < wipeStart || frame > wipeEnd) return null;
  const wipeProgress = (0, import_remotion8.interpolate)(
    frame,
    [wipeStart, TRANSITION_FRAME, wipeEnd],
    [0, 0.5, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const waveX = (0, import_remotion8.interpolate)(
    wipeProgress,
    [0, 1],
    [-20, 120],
    { extrapolateRight: "clamp" }
  );
  const waveOpacity = (0, import_remotion8.interpolate)(
    wipeProgress,
    [0, 0.4, 0.6, 1],
    [0, 0.5, 0.5, 0],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${waveX}%`,
        top: 0,
        width: "40%",
        height: "100%",
        background: `linear-gradient(90deg,
          transparent 0%,
          ${COLORS.skillsBlue}40 30%,
          ${COLORS.white}90 50%,
          ${COLORS.skillsBlue}40 70%,
          transparent 100%)`,
        opacity: waveOpacity,
        pointerEvents: "none"
      }
    }
  );
};
var MCPSectionFade = ({ frame, children }) => {
  const fadeOut = (0, import_remotion8.interpolate)(
    frame,
    [TRANSITION_FRAME - 30, TRANSITION_FRAME + 5],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { opacity: fadeOut }, children });
};
var SkillsSectionFade = ({ frame, children }) => {
  const fadeIn = (0, import_remotion8.interpolate)(
    frame,
    [TRANSITION_FRAME - 5, TRANSITION_FRAME + 20],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { opacity: fadeIn }, children });
};
var Scene7 = ({ startFrame }) => {
  const frame = (0, import_remotion8.useCurrentFrame)();
  const { fps } = (0, import_remotion8.useVideoConfig)();
  const localFrame = frame - startFrame;
  const isMCPPhase = localFrame < TRANSITION_FRAME;
  const isSkillsPhase = localFrame >= TRANSITION_FRAME - 5;
  const apiEndpoints = [
    { method: "GET", endpoint: "/files/list", x: 18, y: 28, delay: 40 },
    { method: "POST", endpoint: "/files/create", x: 82, y: 30, delay: 55 },
    { method: "DELETE", endpoint: "/files/:id", x: 15, y: 58, delay: 70 },
    { method: "PUT", endpoint: "/files/update", x: 85, y: 55, delay: 85 },
    { method: "GET", endpoint: "/permissions", x: 22, y: 75, delay: 100 },
    { method: "POST", endpoint: "/folders", x: 78, y: 72, delay: 115 }
  ];
  const benefits = [
    { emoji: "\u2728", text: "Self-documenting", x: 15, y: 35, delay: 140 },
    { emoji: "\u{1F3AF}", text: "Context-aware", x: 85, y: 38, delay: 160 },
    { emoji: "\u{1F6E1}\uFE0F", text: "Best practices built-in", x: 12, y: 65, delay: 180 },
    { emoji: "\u{1F680}", text: "Ready to use", x: 88, y: 62, delay: 200 }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_remotion8.AbsoluteFill, { children: [
    isMCPPhase && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(MCPSectionFade, { frame: localFrame, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(MCPTitle2, { frame: localFrame, fps }),
      apiEndpoints.map((ep, i) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        ConnectionLine3,
        {
          toX: ep.x,
          toY: ep.y,
          frame: localFrame,
          fps,
          delay: ep.delay
        },
        `conn-${i}`
      )),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(MCPServer, { frame: localFrame, fps }),
      apiEndpoints.map((ep, i) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        APIEndpoint,
        {
          method: ep.method,
          endpoint: ep.endpoint,
          x: ep.x,
          y: ep.y,
          frame: localFrame,
          fps,
          delay: ep.delay
        },
        `ep-${i}`
      )),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(ComplexityBadge, { frame: localFrame, fps }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Sparkle3, { x: 10, y: 22, frame: localFrame, delay: 50, color: COLORS.mcpOrange, size: 14 }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Sparkle3, { x: 90, y: 25, frame: localFrame, delay: 70, color: COLORS.mcpOrange, size: 12 }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Sparkle3, { x: 8, y: 68, frame: localFrame, delay: 90, color: COLORS.mcpOrange, size: 10 }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Sparkle3, { x: 92, y: 65, frame: localFrame, delay: 110, color: COLORS.mcpOrange, size: 11 })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(TransitionWipe, { frame: localFrame, fps }),
    isSkillsPhase && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(SkillsSectionFade, { frame: localFrame, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(SkillsTitle, { frame: localFrame, fps }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(SkillFile, { frame: localFrame, fps }),
      benefits.map((benefit, i) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        BenefitBadge,
        {
          emoji: benefit.emoji,
          text: benefit.text,
          x: benefit.x,
          y: benefit.y,
          frame: localFrame,
          fps,
          delay: benefit.delay
        },
        `benefit-${i}`
      )),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Sparkle3, { x: 25, y: 25, frame: localFrame, delay: TRANSITION_FRAME + 30, color: COLORS.skillsBlue, size: 14 }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Sparkle3, { x: 75, y: 28, frame: localFrame, delay: TRANSITION_FRAME + 50, color: COLORS.skillsBlue, size: 12 }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Sparkle3, { x: 20, y: 78, frame: localFrame, delay: TRANSITION_FRAME + 70, color: COLORS.successGreen, size: 11 }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Sparkle3, { x: 80, y: 75, frame: localFrame, delay: TRANSITION_FRAME + 90, color: COLORS.skillsBlue, size: 13 }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Sparkle3, { x: 50, y: 88, frame: localFrame, delay: TRANSITION_FRAME + 110, color: COLORS.accentYellow, size: 16 })
    ] })
  ] });
};

// src/proj_87e55a0e_3971_4aa9_a85c_b31ef756238f/scenes/Scene8.tsx
var import_remotion9 = require("remotion");
var import_jsx_runtime9 = require("react/jsx-runtime");
var ToolIcon = ({ type, x, y, frame, delay }) => {
  const wobble = (0, import_remotion9.interpolate)(
    Math.sin((frame + delay * 15) * 0.12),
    [-1, 1],
    [-8, 8],
    { extrapolateRight: "clamp" }
  );
  const bounce = (0, import_remotion9.interpolate)(
    Math.sin((frame + delay * 10) * 0.15),
    [-1, 1],
    [-3, 3],
    { extrapolateRight: "clamp" }
  );
  const icons = {
    wrench: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
    hammer: "M15.9 14.9l-7.8 7.8a2 2 0 0 1-2.8 0l-.7-.7a2 2 0 0 1 0-2.8l7.8-7.8M6.5 9.5L3.7 6.7a2.4 2.4 0 0 1 0-3.4l.7-.7a2.4 2.4 0 0 1 3.4 0l2.8 2.8M15 5l4-4M19 9l4-4",
    gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
  };
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: `rotate(${wobble}deg) translateY(${bounce}px)`,
        width: 20,
        height: 20,
        opacity: 0.6
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("svg", { viewBox: "0 0 24 24", fill: "none", stroke: COLORS.mcpOrange, strokeWidth: 2, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("path", { d: icons[type] }) })
    }
  );
};
var OrganizedIcon = ({ type, x, y, frame, delay }) => {
  const pulse = (0, import_remotion9.interpolate)(
    Math.sin((frame + delay * 12) * 0.1),
    [-1, 1],
    [0.8, 1.1],
    { extrapolateRight: "clamp" }
  );
  const glow = (0, import_remotion9.interpolate)(
    Math.sin((frame + delay * 8) * 0.08),
    [-1, 1],
    [0.4, 0.8],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: `scale(${pulse})`,
        width: 18,
        height: 18,
        opacity: glow
      },
      children: [
        type === "star" && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("svg", { viewBox: "0 0 24 24", fill: COLORS.skillsBlue, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("path", { d: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" }) }),
        type === "sparkle" && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("svg", { viewBox: "0 0 24 24", fill: COLORS.skillsBlue, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("path", { d: "M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z" }) }),
        type === "check" && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("svg", { viewBox: "0 0 24 24", fill: "none", stroke: COLORS.skillsBlue, strokeWidth: 3, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("path", { d: "M20 6L9 17l-5-5" }) })
      ]
    }
  );
};
var SummaryCard = ({ title, emoji, color, position, frame, fps }) => {
  const isTop = position === "top";
  const delay = isTop ? 0 : 12;
  const cardProgress = (0, import_remotion9.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG
  });
  const slideY = (0, import_remotion9.interpolate)(
    cardProgress,
    [0, 1],
    [isTop ? -60 : 60, 0],
    { extrapolateRight: "clamp" }
  );
  const topPosition = isTop ? "18%" : "48%";
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: topPosition,
        transform: `translateX(-50%) translateY(${slideY}px) scale(${cardProgress})`,
        opacity: cardProgress,
        width: "85%",
        maxWidth: 520
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
        "div",
        {
          style: {
            padding: "22px 28px",
            borderRadius: 22,
            background: `linear-gradient(135deg, ${color}25 0%, ${color}10 100%)`,
            border: `4px solid ${color}70`,
            boxShadow: `0 18px 55px ${color}30`,
            textAlign: "center",
            position: "relative",
            overflow: "hidden"
          },
          children: [
            isTop && /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_jsx_runtime9.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(ToolIcon, { type: "wrench", x: 5, y: 20, frame, delay: 0 }),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(ToolIcon, { type: "hammer", x: 88, y: 25, frame, delay: 3 }),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(ToolIcon, { type: "gear", x: 8, y: 65, frame, delay: 6 }),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(ToolIcon, { type: "gear", x: 90, y: 60, frame, delay: 9 })
            ] }),
            !isTop && /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_jsx_runtime9.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(OrganizedIcon, { type: "star", x: 6, y: 22, frame, delay: 0 }),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(OrganizedIcon, { type: "sparkle", x: 88, y: 28, frame, delay: 4 }),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(OrganizedIcon, { type: "check", x: 8, y: 62, frame, delay: 8 }),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(OrganizedIcon, { type: "star", x: 90, y: 58, frame, delay: 12 })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
              "div",
              {
                style: {
                  fontSize: 34,
                  fontWeight: 900,
                  color,
                  textShadow: `0 4px 20px ${color}40`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 14
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { children: title }),
                  /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { style: { fontSize: 30 }, children: emoji })
                ]
              }
            )
          ]
        }
      )
    }
  );
};
var HorizontalSeparator = ({ frame, fps }) => {
  const progress = (0, import_remotion9.spring)({
    frame: frame - 8,
    fps,
    config: SPRING_FAST
  });
  const lineWidth = (0, import_remotion9.interpolate)(progress, [0, 1], [0, 120], {
    extrapolateRight: "clamp"
  });
  const glowPulse = (0, import_remotion9.interpolate)(
    frame % 40,
    [0, 20, 40],
    [0.4, 0.9, 0.4],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "39%",
        transform: "translate(-50%, -50%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        opacity: progress
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          "div",
          {
            style: {
              width: `${lineWidth * 1.5}px`,
              height: 4,
              background: `linear-gradient(90deg, transparent, ${COLORS.textDark}50)`,
              borderRadius: 2
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          "div",
          {
            style: {
              padding: "10px 20px",
              borderRadius: 14,
              background: `linear-gradient(135deg, ${COLORS.accentYellow} 0%, #FBBF24 100%)`,
              boxShadow: `0 6px 25px ${COLORS.accentYellow}${Math.floor(glowPulse * 70).toString(16).padStart(2, "0")}`,
              transform: `scale(${progress})`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
              "span",
              {
                style: {
                  fontSize: 22,
                  fontWeight: 900,
                  color: COLORS.textDark,
                  letterSpacing: 2
                },
                children: "VS"
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          "div",
          {
            style: {
              width: `${lineWidth * 1.5}px`,
              height: 4,
              background: `linear-gradient(90deg, ${COLORS.textDark}50, transparent)`,
              borderRadius: 2
            }
          }
        )
      ]
    }
  );
};
var CTASparkle = ({ x, y, size, frame, delay }) => {
  const pulse = (0, import_remotion9.interpolate)(
    Math.sin((frame + delay * 18) * 0.12),
    [-1, 1],
    [0.2, 1],
    { extrapolateRight: "clamp" }
  );
  const rotation = (0, import_remotion9.interpolate)(
    frame + delay * 8,
    [0, 150],
    [0, 360],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        transform: `rotate(${rotation}deg) scale(${pulse})`,
        opacity: pulse
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("svg", { viewBox: "0 0 24 24", fill: COLORS.accentYellow, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("path", { d: "M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z" }) })
    }
  );
};
var CTAButton = ({ frame, fps }) => {
  const ctaDelay = 40;
  const buttonProgress = (0, import_remotion9.spring)({
    frame: frame - ctaDelay,
    fps,
    config: { damping: 20, stiffness: 90, mass: 0.85 }
  });
  const pulse = (0, import_remotion9.interpolate)(
    Math.sin(frame * 0.1),
    [-1, 1],
    [0.97, 1.04],
    { extrapolateRight: "clamp" }
  );
  const glowIntensity = (0, import_remotion9.interpolate)(
    Math.sin(frame * 0.08),
    [-1, 1],
    [0.5, 1],
    { extrapolateRight: "clamp" }
  );
  const bounceY = (0, import_remotion9.interpolate)(
    buttonProgress,
    [0, 0.7, 1],
    [50, -8, 0],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "78%",
        transform: `translate(-50%, -50%) translateY(${bounceY}px) scale(${buttonProgress * pulse})`,
        opacity: buttonProgress
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              inset: -50,
              borderRadius: 40,
              background: `radial-gradient(circle, ${COLORS.accentYellow}${Math.floor(glowIntensity * 50).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
              filter: "blur(15px)"
            }
          }
        ),
        frame > ctaDelay + 20 && /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_jsx_runtime9.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(CTASparkle, { x: -12, y: -30, size: 20, frame, delay: 0 }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(CTASparkle, { x: 105, y: -25, size: 18, frame, delay: 4 }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(CTASparkle, { x: -8, y: 110, size: 16, frame, delay: 8 }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(CTASparkle, { x: 102, y: 105, size: 14, frame, delay: 12 }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(CTASparkle, { x: 50, y: -35, size: 22, frame, delay: 2 }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(CTASparkle, { x: -15, y: 50, size: 12, frame, delay: 6 }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(CTASparkle, { x: 108, y: 55, size: 13, frame, delay: 10 })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          "div",
          {
            style: {
              padding: "24px 48px",
              borderRadius: 22,
              background: `linear-gradient(135deg, ${COLORS.accentYellow} 0%, #FBBF24 100%)`,
              boxShadow: `0 14px 50px ${COLORS.accentYellow}60, 0 0 70px ${COLORS.accentYellow}${Math.floor(glowIntensity * 40).toString(16).padStart(2, "0")}`,
              border: `4px solid ${COLORS.white}95`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { style: { fontSize: 32 }, children: "\u{1F4AC}" }),
                  /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                    "span",
                    {
                      style: {
                        fontSize: 34,
                        fontWeight: 900,
                        color: COLORS.textDark,
                        letterSpacing: 1
                      },
                      children: "COMMENT SKILLS"
                    }
                  )
                ]
              }
            )
          }
        )
      ]
    }
  );
};
var CTASubtitle = ({ frame, fps }) => {
  const progress = (0, import_remotion9.spring)({
    frame: frame - 70,
    fps,
    config: SPRING_CONFIG
  });
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "89%",
        transform: `translateX(-50%) scale(${progress})`,
        opacity: progress,
        textAlign: "center"
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
        "span",
        {
          style: {
            fontSize: 18,
            fontWeight: 700,
            color: COLORS.textDark,
            opacity: 0.8
          },
          children: "Get the free lecture link!"
        }
      )
    }
  );
};
var ConfettiParticle = ({ x, angle, speed, color, shape, frame, startFrame }) => {
  const time = Math.max(0, frame - startFrame);
  const gravity = 0.15;
  const posX = x + Math.cos(angle) * speed * time * 0.8;
  const posY = 78 + Math.sin(angle) * speed * time * 0.5 + gravity * time * time * 0.3;
  const rotation = time * (speed * 3);
  const opacity = (0, import_remotion9.interpolate)(time, [0, 15, 50, 70], [0, 1, 1, 0], {
    extrapolateRight: "clamp"
  });
  const scale = (0, import_remotion9.interpolate)(time, [0, 10], [0, 1], {
    extrapolateRight: "clamp"
  });
  const dimensions = {
    circle: { width: 12, height: 12, borderRadius: "50%" },
    square: { width: 10, height: 10, borderRadius: 2 },
    rect: { width: 8, height: 16, borderRadius: 2 }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${posX}%`,
        top: `${posY}%`,
        ...dimensions[shape],
        backgroundColor: color,
        opacity,
        transform: `rotate(${rotation}deg) scale(${scale})`
      }
    }
  );
};
var CelebrationConfetti = ({ frame }) => {
  const startFrame = 120;
  if (frame < startFrame) return null;
  const particles = Array.from({ length: 30 });
  const colors = [COLORS.accentYellow, COLORS.skillsBlue, COLORS.successGreen, COLORS.mcpOrange, "#EC4899", "#8B5CF6"];
  const shapes = ["circle", "square", "rect"];
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_jsx_runtime9.Fragment, { children: particles.map((_, i) => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
    const speed = 2 + i % 6 * 0.8;
    const x = 50 + (i % 10 - 5) * 3;
    return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      ConfettiParticle,
      {
        x,
        angle: angle + i * 0.15,
        speed,
        color: colors[i % colors.length],
        shape: shapes[i % shapes.length],
        frame,
        startFrame: startFrame + i % 8 * 2
      },
      i
    );
  }) });
};
var Scene8 = ({ startFrame }) => {
  const frame = (0, import_remotion9.useCurrentFrame)();
  const { fps } = (0, import_remotion9.useVideoConfig)();
  const localFrame = frame - startFrame;
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_remotion9.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "4%",
          left: "50%",
          transform: "translateX(-50%)",
          opacity: (0, import_remotion9.interpolate)(localFrame, [0, 15], [0, 1], {
            extrapolateRight: "clamp"
          })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          "span",
          {
            style: {
              fontSize: 28,
              fontWeight: 800,
              color: COLORS.textDark,
              opacity: 0.8
            },
            children: "Quick Recap"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      SummaryCard,
      {
        title: "MCP = RAW TOOLS",
        emoji: "\u{1F527}",
        color: COLORS.mcpOrange,
        position: "top",
        frame: localFrame,
        fps
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(HorizontalSeparator, { frame: localFrame, fps }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      SummaryCard,
      {
        title: "SKILLS = BEHAVIOR",
        emoji: "\u2728",
        color: COLORS.skillsBlue,
        position: "bottom",
        frame: localFrame,
        fps
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(CTAButton, { frame: localFrame, fps }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(CelebrationConfetti, { frame: localFrame }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(CTASubtitle, { frame: localFrame, fps })
  ] });
};

// src/proj_87e55a0e_3971_4aa9_a85c_b31ef756238f/index.tsx
var import_jsx_runtime10 = require("react/jsx-runtime");
var MainComposition = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_remotion10.AbsoluteFill, { style: { backgroundColor: COLORS.backgroundStart }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Background, {}, "bg"),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
      import_remotion10.Sequence,
      {
        from: TIMING.scene1Start,
        durationInFrames: TIMING.scene1End - TIMING.scene1Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Scene1, { startFrame: 0 })
      },
      "scene1"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
      import_remotion10.Sequence,
      {
        from: TIMING.scene2Start,
        durationInFrames: TIMING.scene2End - TIMING.scene2Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Scene2, { startFrame: 0 })
      },
      "scene2"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
      import_remotion10.Sequence,
      {
        from: TIMING.scene3Start,
        durationInFrames: TIMING.scene3End - TIMING.scene3Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Scene3, { startFrame: 0 })
      },
      "scene3"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
      import_remotion10.Sequence,
      {
        from: TIMING.scene4Start,
        durationInFrames: TIMING.scene4End - TIMING.scene4Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Scene4, { startFrame: 0 })
      },
      "scene4"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
      import_remotion10.Sequence,
      {
        from: TIMING.scene5Start,
        durationInFrames: TIMING.scene5End - TIMING.scene5Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Scene5, { startFrame: 0 })
      },
      "scene5"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
      import_remotion10.Sequence,
      {
        from: TIMING.scene6Start,
        durationInFrames: TIMING.scene6End - TIMING.scene6Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Scene6, { startFrame: 0 })
      },
      "scene6"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
      import_remotion10.Sequence,
      {
        from: TIMING.scene7Start,
        durationInFrames: TIMING.scene7End - TIMING.scene7Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Scene7, { startFrame: 0 })
      },
      "scene7"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
      import_remotion10.Sequence,
      {
        from: TIMING.scene8Start,
        durationInFrames: TIMING.scene8End - TIMING.scene8Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Scene8, { startFrame: 0 })
      },
      "scene8"
    )
  ] });
};
var RemotionRoot = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
    import_remotion10.Composition,
    {
      id: "proj-87e55a0e-3971-4aa9-a85c-b31ef756238f",
      component: MainComposition,
      durationInFrames: TIMING.totalFrames,
      fps: TIMING.fps,
      width: TIMING.width,
      height: TIMING.height
    }
  );
};
var index_default = MainComposition;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  RemotionRoot
});
