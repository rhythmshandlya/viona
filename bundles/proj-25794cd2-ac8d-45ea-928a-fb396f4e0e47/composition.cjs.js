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

// src/proj_25794cd2_ac8d_45ea_928a_fb396f4e0e47/index.tsx
var index_exports = {};
__export(index_exports, {
  RemotionRoot: () => RemotionRoot,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_remotion7 = require("remotion");

// src/proj_25794cd2_ac8d_45ea_928a_fb396f4e0e47/constants.ts
var COLORS = {
  // Frustration phase (Scene 1)
  frustrationGray: "#6B7280",
  frustrationBlue: "#475569",
  mutedBlue: "#64748B",
  // Solution phase (Scene 2)
  warmOrange: "#F97316",
  warmYellow: "#FBBF24",
  hopeGold: "#F59E0B",
  // Creativity phase (Scene 3)
  vibrantMagenta: "#EC4899",
  vibrantCyan: "#06B6D4",
  creativePink: "#F472B6",
  // Action phase (Scenes 4-5)
  electricBlue: "#3B82F6",
  electricGreen: "#10B981",
  actionTeal: "#14B8A6",
  // Neutrals
  background: "#0F172A",
  backgroundDark: "#020617",
  white: "#FFFFFF",
  sparkWhite: "#F8FAFC"
};
var SPRING_CONFIG = { damping: 22, stiffness: 90, mass: 0.9 };
var SPRING_SNAPPY = { damping: 20, stiffness: 120, mass: 0.8 };
var TIMING = {
  // Video specs from scenes.json
  totalFrames: 856,
  fps: 30,
  width: 1080,
  height: 1920,
  // Scene timing from scenes.json
  scene1Start: 0,
  scene1End: 195,
  scene1KeySync: 80,
  // "but" - visual shift
  scene2Start: 195,
  scene2End: 270,
  scene2KeySync: 225,
  // "Clipify" - brand reveal
  scene3Start: 270,
  scene3End: 450,
  scene3KeySync: 348,
  // "add" - motion graphics spring to life
  scene4Start: 450,
  scene4End: 630,
  scene4KeySync: 484,
  // "No" - barriers dissolve
  scene5Start: 630,
  scene5End: 856,
  scene5KeySync: 772
  // "Sign up" - CTA appears
};

// src/proj_25794cd2_ac8d_45ea_928a_fb396f4e0e47/components/Background.tsx
var import_remotion = require("remotion");
var import_jsx_runtime = require("react/jsx-runtime");
var Background = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const glowIntensity = (0, import_remotion.interpolate)(
    frame,
    [0, TIMING.scene2Start, TIMING.scene3Start, TIMING.scene4Start, TIMING.scene5Start],
    [0.1, 0.2, 0.4, 0.5, 0.6],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  let glowColor = COLORS.frustrationBlue;
  if (frame >= TIMING.scene5Start) {
    glowColor = COLORS.electricBlue;
  } else if (frame >= TIMING.scene4Start) {
    glowColor = COLORS.electricGreen;
  } else if (frame >= TIMING.scene3Start) {
    glowColor = COLORS.vibrantMagenta;
  } else if (frame >= TIMING.scene2Start) {
    glowColor = COLORS.warmOrange;
  }
  const gradientY = (0, import_remotion.interpolate)(
    frame,
    [0, TIMING.totalFrames],
    [40, 60],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_remotion.AbsoluteFill,
    {
      style: {
        background: `
          radial-gradient(
            ellipse 120% 80% at 50% ${gradientY}%,
            ${glowColor}${Math.round(glowIntensity * 40).toString(16).padStart(2, "0")} 0%,
            ${COLORS.background} 50%,
            ${COLORS.backgroundDark} 100%
          )
        `
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        import_remotion.AbsoluteFill,
        {
          style: {
            background: `
            radial-gradient(
              ellipse 80% 80% at 50% 50%,
              transparent 0%,
              ${COLORS.backgroundDark}40 100%
            )
          `
          }
        }
      )
    }
  );
};

// src/proj_25794cd2_ac8d_45ea_928a_fb396f4e0e47/scenes/Scene1.tsx
var import_remotion2 = require("remotion");
var import_jsx_runtime2 = require("react/jsx-runtime");
var Scene1 = ({ startFrame }) => {
  const frame = (0, import_remotion2.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion2.useVideoConfig)();
  const localFrame = frame - startFrame;
  const sceneDuration = TIMING.scene1End - TIMING.scene1Start;
  const keySyncFrame = TIMING.scene1KeySync;
  const sceneIn = (0, import_remotion2.spring)({
    frame: localFrame,
    fps,
    config: SPRING_CONFIG
  });
  const postKeySync = (0, import_remotion2.interpolate)(
    localFrame,
    [keySyncFrame - 10, keySyncFrame + 10],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const crackProgress = (0, import_remotion2.interpolate)(
    localFrame,
    [sceneDuration - 60, sceneDuration],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const sparkCycleLength = 40;
  const sparkCycle = localFrame % sparkCycleLength / sparkCycleLength;
  const sparkX = (0, import_remotion2.interpolate)(
    sparkCycle,
    [0, 0.25, 0.5, 0.75, 1],
    [0, 60, 0, -60, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const sparkY = (0, import_remotion2.interpolate)(
    sparkCycle,
    [0, 0.25, 0.5, 0.75, 1],
    [-40, 20, 50, 20, -40],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const sparkAgitation = (0, import_remotion2.interpolate)(postKeySync, [0, 1], [1, 1.5], {
    extrapolateRight: "clamp"
  });
  const sparkHue = (0, import_remotion2.interpolate)(
    postKeySync,
    [0, 1],
    [45, 220],
    // yellow hue to blue hue
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const cageStress = (0, import_remotion2.interpolate)(
    localFrame,
    [keySyncFrame, keySyncFrame + 30],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const text1In = (0, import_remotion2.spring)({
    frame: localFrame - 15,
    fps,
    config: SPRING_CONFIG
  });
  const text2In = (0, import_remotion2.spring)({
    frame: localFrame - 50,
    fps,
    config: SPRING_CONFIG
  });
  const butEmphasis = (0, import_remotion2.spring)({
    frame: localFrame - keySyncFrame,
    fps,
    config: { damping: 20, stiffness: 100, mass: 0.8 }
  });
  const cageBars = [
    { x: -80, y: -100, rotation: 30, length: 200 },
    { x: 80, y: -100, rotation: -30, length: 200 },
    { x: -120, y: 0, rotation: 90, length: 180 },
    { x: 120, y: 0, rotation: 90, length: 180 },
    { x: -80, y: 100, rotation: -30, length: 200 },
    { x: 80, y: 100, rotation: 30, length: 200 }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_remotion2.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.12,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: text1In,
          transform: `translateY(${(0, import_remotion2.interpolate)(text1In, [0, 1], [30, 0])}px)`
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          "span",
          {
            style: {
              fontSize: height * 0.04,
              fontWeight: 700,
              color: COLORS.white,
              textAlign: "center",
              fontFamily: "Inter, system-ui, sans-serif",
              padding: "0 60px",
              lineHeight: 1.3
            },
            children: [
              "Everyone wants to",
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("br", {}),
              "start creating content"
            ]
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.4,
          left: width * 0.5,
          transform: `translate(-50%, -50%) scale(${sceneIn})`
        },
        children: [
          cageBars.map((bar, index) => {
            const barShake = cageStress > 0 ? (0, import_remotion2.interpolate)(
              (localFrame + index * 5) % 8,
              [0, 4, 8],
              [0, 2, 0],
              { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
            ) * cageStress : 0;
            const crackOffset = crackProgress * (index % 2 === 0 ? 15 : -15);
            return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "div",
              {
                style: {
                  position: "absolute",
                  left: bar.x + barShake + crackOffset,
                  top: bar.y,
                  width: 8,
                  height: bar.length,
                  background: (0, import_remotion2.interpolate)(
                    crackProgress,
                    [0, 1],
                    [0, 1],
                    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
                  ) > 0.3 ? `linear-gradient(180deg, ${COLORS.frustrationGray}, ${COLORS.warmOrange}40)` : COLORS.frustrationGray,
                  borderRadius: 4,
                  transform: `translate(-50%, -50%) rotate(${bar.rotation}deg)`,
                  boxShadow: cageStress > 0 ? `0 0 ${10 * cageStress}px ${COLORS.warmOrange}60` : "none"
                }
              },
              index
            );
          }),
          crackProgress > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_jsx_runtime2.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
            "svg",
            {
              style: {
                position: "absolute",
                left: -150,
                top: -150,
                width: 300,
                height: 300,
                opacity: crackProgress
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                  "path",
                  {
                    d: `M 100 50 L ${100 + crackProgress * 30} ${50 + crackProgress * 20} L ${100 + crackProgress * 50} ${50 + crackProgress * 40}`,
                    stroke: COLORS.warmOrange,
                    strokeWidth: 2,
                    fill: "none",
                    strokeLinecap: "round"
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                  "path",
                  {
                    d: `M 200 100 L ${200 - crackProgress * 25} ${100 + crackProgress * 35}`,
                    stroke: COLORS.warmYellow,
                    strokeWidth: 2,
                    fill: "none",
                    strokeLinecap: "round"
                  }
                )
              ]
            }
          ) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: sparkX * sparkAgitation,
                top: sparkY * sparkAgitation,
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: `hsl(${sparkHue}, 80%, 60%)`,
                boxShadow: `
              0 0 20px hsl(${sparkHue}, 80%, 60%),
              0 0 40px hsl(${sparkHue}, 70%, 50%),
              0 0 60px hsl(${sparkHue}, 60%, 40%)
            `,
                transform: "translate(-50%, -50%)"
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                "div",
                {
                  style: {
                    position: "absolute",
                    inset: "20%",
                    borderRadius: "50%",
                    background: `hsl(${sparkHue}, 90%, 85%)`
                  }
                }
              )
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.68,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: text2In,
          transform: `translateY(${(0, import_remotion2.interpolate)(text2In, [0, 1], [30, 0])}px)`
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          "span",
          {
            style: {
              fontSize: height * 0.038,
              fontWeight: 600,
              color: COLORS.mutedBlue,
              textAlign: "center",
              fontFamily: "Inter, system-ui, sans-serif",
              padding: "0 60px",
              lineHeight: 1.3
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                "span",
                {
                  style: {
                    color: (0, import_remotion2.interpolate)(butEmphasis, [0, 1], [0, 1]) > 0.5 ? COLORS.warmOrange : COLORS.mutedBlue,
                    fontWeight: 700,
                    transform: `scale(${1 + butEmphasis * 0.1})`,
                    display: "inline-block"
                  },
                  children: "but"
                }
              ),
              " ",
              "editing stops",
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("br", {}),
              "most people"
            ]
          }
        )
      }
    )
  ] });
};

// src/proj_25794cd2_ac8d_45ea_928a_fb396f4e0e47/scenes/Scene2.tsx
var import_remotion3 = require("remotion");
var import_jsx_runtime3 = require("react/jsx-runtime");
var Scene2 = ({ startFrame }) => {
  const frame = (0, import_remotion3.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion3.useVideoConfig)();
  const localFrame = frame - startFrame;
  const sceneDuration = TIMING.scene2End - TIMING.scene2Start;
  const keySyncLocal = TIMING.scene2KeySync - TIMING.scene2Start;
  const explodeProgress = (0, import_remotion3.spring)({
    frame: localFrame,
    fps,
    config: SPRING_SNAPPY
  });
  const sparkGrowth = (0, import_remotion3.spring)({
    frame: localFrame,
    fps,
    config: { damping: 24, stiffness: 80, mass: 1 }
  });
  const brandReveal = (0, import_remotion3.spring)({
    frame: localFrame - keySyncLocal,
    fps,
    config: SPRING_CONFIG
  });
  const exitProgress = (0, import_remotion3.interpolate)(
    localFrame,
    [sceneDuration - 20, sceneDuration],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const cageFragments = [
    { angle: 30, speed: 1.2 },
    { angle: 90, speed: 1 },
    { angle: 150, speed: 1.3 },
    { angle: 210, speed: 1.1 },
    { angle: 270, speed: 1 },
    { angle: 330, speed: 1.2 }
  ];
  const particles = Array.from({ length: 12 }, (_, i) => ({
    angle: i * 30,
    delay: i * 2,
    size: 8 + i % 3 * 4
  }));
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_remotion3.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.12,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: (0, import_remotion3.interpolate)(localFrame, [0, 15], [0, 1], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp"
          }),
          transform: `translateY(${(0, import_remotion3.interpolate)(localFrame, [0, 15], [20, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" })}px)`
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "span",
          {
            style: {
              fontSize: height * 0.035,
              fontWeight: 600,
              color: COLORS.warmYellow,
              textAlign: "center",
              fontFamily: "Inter, system-ui, sans-serif",
              textShadow: `0 0 30px ${COLORS.warmOrange}80`
            },
            children: "That's why we built"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.35,
          left: width * 0.5,
          transform: "translate(-50%, -50%)"
        },
        children: [
          cageFragments.map((frag, index) => {
            const distance = explodeProgress * 300 * frag.speed;
            const fragX = distance * Math.cos(frag.angle * Math.PI / 180);
            const fragY = distance * Math.sin(frag.angle * Math.PI / 180);
            const fragOpacity = (0, import_remotion3.interpolate)(
              explodeProgress,
              [0, 0.3, 1],
              [1, 0.8, 0],
              { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
            );
            return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "div",
              {
                style: {
                  position: "absolute",
                  left: fragX,
                  top: fragY,
                  width: 6,
                  height: 40,
                  background: COLORS.frustrationGray,
                  borderRadius: 3,
                  transform: `translate(-50%, -50%) rotate(${frag.angle + explodeProgress * 180}deg)`,
                  opacity: fragOpacity
                }
              },
              index
            );
          }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: 0,
                top: 0,
                width: (0, import_remotion3.interpolate)(sparkGrowth, [0, 1], [40, 120], {
                  extrapolateRight: "clamp"
                }),
                height: (0, import_remotion3.interpolate)(sparkGrowth, [0, 1], [40, 120], {
                  extrapolateRight: "clamp"
                }),
                borderRadius: "50%",
                background: `radial-gradient(circle, ${COLORS.warmYellow} 0%, ${COLORS.warmOrange} 60%, transparent 100%)`,
                boxShadow: `
              0 0 40px ${COLORS.warmYellow},
              0 0 80px ${COLORS.warmOrange}80,
              0 0 120px ${COLORS.hopeGold}40
            `,
                transform: "translate(-50%, -50%)",
                opacity: (0, import_remotion3.interpolate)(brandReveal, [0, 0.5], [1, 0], {
                  extrapolateRight: "clamp",
                  extrapolateLeft: "clamp"
                })
              }
            }
          ),
          particles.map((particle, index) => {
            const burstDelay = particle.delay;
            const burstSpring = (0, import_remotion3.spring)({
              frame: localFrame - keySyncLocal - burstDelay,
              fps,
              config: { damping: 25, stiffness: 70, mass: 0.8 }
            });
            const distance = burstSpring * 250;
            const particleX = distance * Math.cos(particle.angle * Math.PI / 180);
            const particleY = distance * Math.sin(particle.angle * Math.PI / 180);
            return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "div",
              {
                style: {
                  position: "absolute",
                  left: particleX,
                  top: particleY,
                  width: particle.size,
                  height: particle.size,
                  borderRadius: "50%",
                  background: index % 2 === 0 ? COLORS.warmYellow : COLORS.warmOrange,
                  boxShadow: `0 0 ${particle.size * 2}px ${index % 2 === 0 ? COLORS.warmYellow : COLORS.warmOrange}`,
                  transform: "translate(-50%, -50%)",
                  opacity: (0, import_remotion3.interpolate)(
                    burstSpring,
                    [0, 0.3, 1],
                    [0, 1, 0.3],
                    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
                  )
                }
              },
              index
            );
          })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.35,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: brandReveal,
          transform: `scale(${(0, import_remotion3.interpolate)(brandReveal, [0, 1], [0.5, 1], { extrapolateRight: "clamp" })})`
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "span",
          {
            style: {
              fontSize: height * 0.08,
              fontWeight: 800,
              color: COLORS.white,
              textAlign: "center",
              fontFamily: "Inter, system-ui, sans-serif",
              letterSpacing: "-0.02em",
              textShadow: `
              0 0 40px ${COLORS.warmOrange},
              0 0 80px ${COLORS.warmYellow}80
            `
            },
            children: "Clipify"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.5,
          left: width * 0.5,
          transform: "translate(-50%, 0)",
          opacity: exitProgress
        },
        children: [0, 1, 2].map((i) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: (i - 1) * 30,
              top: exitProgress * 200,
              width: 4,
              height: 60,
              background: `linear-gradient(180deg, ${COLORS.warmOrange}, transparent)`,
              borderRadius: 2,
              opacity: 0.6 - i * 0.15
            }
          },
          i
        ))
      }
    )
  ] });
};

// src/proj_25794cd2_ac8d_45ea_928a_fb396f4e0e47/scenes/Scene3.tsx
var import_remotion4 = require("remotion");
var import_jsx_runtime4 = require("react/jsx-runtime");
var Scene3 = ({ startFrame }) => {
  const frame = (0, import_remotion4.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion4.useVideoConfig)();
  const localFrame = frame - startFrame;
  const keySyncLocal = TIMING.scene3KeySync - TIMING.scene3Start;
  const uploadIn = (0, import_remotion4.spring)({
    frame: localFrame,
    fps,
    config: SPRING_CONFIG
  });
  const uploadPulse = (0, import_remotion4.interpolate)(
    localFrame,
    [keySyncLocal - 30, keySyncLocal],
    [1, 1.1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const explosionProgress = (0, import_remotion4.spring)({
    frame: localFrame - keySyncLocal,
    fps,
    config: { damping: 20, stiffness: 80, mass: 0.9 }
  });
  const uploadDissolve = (0, import_remotion4.interpolate)(
    localFrame,
    [keySyncLocal, keySyncLocal + 15],
    [1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const motionElements = [
    { type: "circle", x: -180, y: -100, size: 60, color: COLORS.vibrantMagenta, delay: 0 },
    { type: "triangle", x: 150, y: -80, size: 50, color: COLORS.vibrantCyan, delay: 8 },
    { type: "rect", x: -120, y: 80, size: 45, color: COLORS.creativePink, delay: 16 },
    { type: "circle", x: 180, y: 100, size: 40, color: COLORS.warmYellow, delay: 24 },
    { type: "triangle", x: -60, y: -150, size: 55, color: COLORS.vibrantCyan, delay: 32 },
    { type: "rect", x: 80, y: 140, size: 50, color: COLORS.vibrantMagenta, delay: 40 },
    { type: "circle", x: 0, y: -180, size: 35, color: COLORS.warmOrange, delay: 48 },
    { type: "triangle", x: -150, y: 150, size: 45, color: COLORS.creativePink, delay: 56 }
  ];
  const particles = Array.from({ length: 20 }, (_, i) => ({
    x: i * 137 % 400 - 200,
    y: i * 89 % 350 - 175,
    size: 4 + i % 4 * 2,
    delay: i * 4,
    color: i % 3 === 0 ? COLORS.vibrantMagenta : i % 3 === 1 ? COLORS.vibrantCyan : COLORS.warmYellow
  }));
  const textIn = (0, import_remotion4.spring)({
    frame: localFrame - keySyncLocal - 40,
    fps,
    config: SPRING_CONFIG
  });
  const renderShape = (type, size, color, progress) => {
    const scale = (0, import_remotion4.interpolate)(progress, [0, 1], [0, 1], {
      extrapolateRight: "clamp"
    });
    const rotation = (0, import_remotion4.interpolate)(progress, [0, 1], [0, 15], {
      extrapolateRight: "clamp"
    });
    if (type === "circle") {
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "div",
        {
          style: {
            width: size,
            height: size,
            borderRadius: "50%",
            background: color,
            boxShadow: `0 0 ${size}px ${color}80`,
            transform: `scale(${scale})`
          }
        }
      );
    }
    if (type === "triangle") {
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "div",
        {
          style: {
            width: 0,
            height: 0,
            borderLeft: `${size / 2}px solid transparent`,
            borderRight: `${size / 2}px solid transparent`,
            borderBottom: `${size}px solid ${color}`,
            filter: `drop-shadow(0 0 ${size / 2}px ${color}80)`,
            transform: `scale(${scale}) rotate(${rotation}deg)`
          }
        }
      );
    }
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "div",
      {
        style: {
          width: size,
          height: size * 0.6,
          borderRadius: 8,
          background: color,
          boxShadow: `0 0 ${size}px ${color}80`,
          transform: `scale(${scale}) rotate(${rotation}deg)`
        }
      }
    );
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_remotion4.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.08,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: (0, import_remotion4.interpolate)(localFrame, [0, 20], [0, 1], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp"
          })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "span",
          {
            style: {
              fontSize: height * 0.038,
              fontWeight: 600,
              color: COLORS.white,
              textAlign: "center",
              fontFamily: "Inter, system-ui, sans-serif",
              padding: "0 60px"
            },
            children: "Just upload your video"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.42,
          left: width * 0.5,
          transform: "translate(-50%, -50%)"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: -120,
                top: -80,
                width: 240,
                height: 160,
                border: `3px dashed ${COLORS.mutedBlue}`,
                borderRadius: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: uploadDissolve * uploadIn,
                transform: `scale(${uploadPulse * uploadIn})`
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("svg", { width: "60", height: "60", viewBox: "0 0 24 24", fill: "none", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                  "path",
                  {
                    d: "M12 4L12 16M12 4L8 8M12 4L16 8",
                    stroke: COLORS.mutedBlue,
                    strokeWidth: "2",
                    strokeLinecap: "round",
                    strokeLinejoin: "round"
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                  "path",
                  {
                    d: "M4 17V19C4 20.1046 4.89543 21 6 21H18C19.1046 21 20 20.1046 20 19V17",
                    stroke: COLORS.mutedBlue,
                    strokeWidth: "2",
                    strokeLinecap: "round",
                    strokeLinejoin: "round"
                  }
                )
              ] })
            }
          ),
          motionElements.map((elem, index) => {
            const elemProgress = (0, import_remotion4.spring)({
              frame: localFrame - keySyncLocal - elem.delay,
              fps,
              config: SPRING_CONFIG
            });
            const floatOffset = (0, import_remotion4.interpolate)(
              localFrame - keySyncLocal - elem.delay,
              [30, 60, 90, 120],
              [0, 8, 0, -8],
              { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
            );
            return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              "div",
              {
                style: {
                  position: "absolute",
                  left: elem.x * explosionProgress,
                  top: elem.y * explosionProgress + floatOffset,
                  transform: "translate(-50%, -50%)",
                  opacity: elemProgress
                },
                children: renderShape(elem.type, elem.size, elem.color, elemProgress)
              },
              index
            );
          }),
          particles.map((particle, index) => {
            const particleProgress = (0, import_remotion4.spring)({
              frame: localFrame - keySyncLocal - particle.delay,
              fps,
              config: { damping: 28, stiffness: 60, mass: 0.6 }
            });
            return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              "div",
              {
                style: {
                  position: "absolute",
                  left: particle.x * particleProgress,
                  top: particle.y * particleProgress,
                  width: particle.size,
                  height: particle.size,
                  borderRadius: "50%",
                  background: particle.color,
                  boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
                  transform: "translate(-50%, -50%)",
                  opacity: (0, import_remotion4.interpolate)(
                    particleProgress,
                    [0, 0.3, 1],
                    [0, 1, 0.7],
                    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
                  )
                }
              },
              `p-${index}`
            );
          })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.78,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          opacity: textIn,
          transform: `translateY(${(0, import_remotion4.interpolate)(textIn, [0, 1], [30, 0], { extrapolateRight: "clamp" })}px)`
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
            "span",
            {
              style: {
                fontSize: height * 0.035,
                fontWeight: 600,
                color: COLORS.white,
                textAlign: "center",
                fontFamily: "Inter, system-ui, sans-serif"
              },
              children: [
                "and we'll",
                " ",
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { color: COLORS.vibrantMagenta }, children: "add" })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "span",
            {
              style: {
                fontSize: height * 0.042,
                fontWeight: 700,
                background: `linear-gradient(90deg, ${COLORS.vibrantMagenta}, ${COLORS.vibrantCyan})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                textAlign: "center",
                fontFamily: "Inter, system-ui, sans-serif"
              },
              children: "beautiful motion graphics"
            }
          )
        ]
      }
    )
  ] });
};

// src/proj_25794cd2_ac8d_45ea_928a_fb396f4e0e47/scenes/Scene4.tsx
var import_remotion5 = require("remotion");
var import_jsx_runtime5 = require("react/jsx-runtime");
var Scene4 = ({ startFrame }) => {
  const frame = (0, import_remotion5.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion5.useVideoConfig)();
  const localFrame = frame - startFrame;
  const keySyncLocal = TIMING.scene4KeySync - TIMING.scene4Start;
  const barriers = [
    {
      label: "Complex Software",
      icon: "timeline",
      y: 0.22,
      dissolveDelay: 0
    },
    {
      label: "Expensive Tools",
      icon: "price",
      y: 0.42,
      dissolveDelay: 15
    },
    {
      label: "Skills Required",
      icon: "skills",
      y: 0.62,
      dissolveDelay: 30
    }
  ];
  const barrierIn = (0, import_remotion5.spring)({
    frame: localFrame,
    fps,
    config: SPRING_CONFIG
  });
  const noEmphasis = (0, import_remotion5.spring)({
    frame: localFrame - keySyncLocal,
    fps,
    config: { damping: 18, stiffness: 100, mass: 0.8 }
  });
  const clearPath = (0, import_remotion5.spring)({
    frame: localFrame - keySyncLocal - 60,
    fps,
    config: { damping: 25, stiffness: 70, mass: 1 }
  });
  const renderBarrier = (barrier, index) => {
    const dissolveProgress = (0, import_remotion5.interpolate)(
      localFrame - keySyncLocal - barrier.dissolveDelay,
      [0, 40],
      [0, 1],
      { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
    );
    const barrierOpacity = (0, import_remotion5.interpolate)(
      dissolveProgress,
      [0, 0.5, 1],
      [1, 0.5, 0],
      { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
    );
    const barrierScale = (0, import_remotion5.interpolate)(
      dissolveProgress,
      [0, 0.3, 1],
      [1, 1.05, 0.8],
      { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
    );
    const sparkles = Array.from({ length: 8 }, (_, i) => ({
      x: i * 45 % 200 - 100,
      y: i * 30 % 60 - 30,
      delay: i * 3
    }));
    const renderIcon = () => {
      if (barrier.icon === "timeline") {
        return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("svg", { width: "28", height: "28", viewBox: "0 0 24 24", fill: "none", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("rect", { x: "2", y: "4", width: "20", height: "4", rx: "1", fill: COLORS.frustrationGray }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("rect", { x: "2", y: "10", width: "14", height: "4", rx: "1", fill: COLORS.frustrationGray }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("rect", { x: "2", y: "16", width: "18", height: "4", rx: "1", fill: COLORS.frustrationGray })
        ] });
      }
      if (barrier.icon === "price") {
        return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("svg", { width: "28", height: "28", viewBox: "0 0 24 24", fill: "none", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "text",
          {
            x: "12",
            y: "17",
            textAnchor: "middle",
            fontSize: "16",
            fontWeight: "bold",
            fill: COLORS.frustrationGray,
            children: "$$$"
          }
        ) });
      }
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("svg", { width: "28", height: "28", viewBox: "0 0 24 24", fill: "none", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("circle", { cx: "12", cy: "8", r: "4", fill: COLORS.frustrationGray }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "path",
          {
            d: "M4 20c0-4 4-6 8-6s8 2 8 6",
            fill: COLORS.frustrationGray
          }
        )
      ] });
    };
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * barrier.y,
          left: width * 0.5,
          transform: `translate(-50%, -50%) scale(${barrierIn * barrierScale})`,
          opacity: barrierOpacity * barrierIn
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "16px 32px",
                background: `${COLORS.frustrationBlue}40`,
                border: `2px solid ${COLORS.frustrationGray}`,
                borderRadius: 12,
                backdropFilter: "blur(8px)"
              },
              children: [
                renderIcon(),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "span",
                  {
                    style: {
                      fontSize: height * 0.028,
                      fontWeight: 600,
                      color: COLORS.frustrationGray,
                      fontFamily: "Inter, system-ui, sans-serif"
                    },
                    children: barrier.label
                  }
                )
              ]
            }
          ),
          dissolveProgress > 0 && sparkles.map((sparkle, sIdx) => {
            const sparkleProgress = (0, import_remotion5.interpolate)(
              localFrame - keySyncLocal - barrier.dissolveDelay - sparkle.delay,
              [0, 30],
              [0, 1],
              { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
            );
            return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "div",
              {
                style: {
                  position: "absolute",
                  left: sparkle.x * sparkleProgress * 2,
                  top: sparkle.y * sparkleProgress * 3 - 20,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: sIdx % 2 === 0 ? COLORS.electricGreen : COLORS.electricBlue,
                  boxShadow: `0 0 12px ${sIdx % 2 === 0 ? COLORS.electricGreen : COLORS.electricBlue}`,
                  opacity: (0, import_remotion5.interpolate)(
                    sparkleProgress,
                    [0, 0.3, 1],
                    [0, 1, 0],
                    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
                  )
                }
              },
              sIdx
            );
          })
        ]
      },
      index
    );
  };
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_remotion5.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.08,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: noEmphasis,
          transform: `scale(${(0, import_remotion5.interpolate)(noEmphasis, [0, 1], [0.8, 1], { extrapolateRight: "clamp" })})`
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "span",
          {
            style: {
              fontSize: height * 0.06,
              fontWeight: 800,
              color: COLORS.electricGreen,
              textAlign: "center",
              fontFamily: "Inter, system-ui, sans-serif",
              textShadow: `0 0 30px ${COLORS.electricGreen}80`
            },
            children: "No"
          }
        )
      }
    ),
    barriers.map((barrier, index) => renderBarrier(barrier, index)),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.42,
          left: width * 0.5,
          transform: "translate(-50%, -50%)",
          opacity: clearPath
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              width: width * 0.8 * clearPath,
              height: 4,
              background: `linear-gradient(90deg, transparent, ${COLORS.electricGreen}, transparent)`,
              borderRadius: 2
            }
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.82,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          opacity: clearPath,
          transform: `translateY(${(0, import_remotion5.interpolate)(clearPath, [0, 1], [20, 0], { extrapolateRight: "clamp" })}px)`
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "span",
            {
              style: {
                fontSize: height * 0.032,
                fontWeight: 500,
                color: COLORS.white,
                textAlign: "center",
                fontFamily: "Inter, system-ui, sans-serif"
              },
              children: "editing skills required"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "span",
            {
              style: {
                fontSize: height * 0.032,
                fontWeight: 500,
                color: COLORS.white,
                textAlign: "center",
                fontFamily: "Inter, system-ui, sans-serif"
              },
              children: "expensive software needed"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "span",
            {
              style: {
                fontSize: height * 0.032,
                fontWeight: 500,
                color: COLORS.white,
                textAlign: "center",
                fontFamily: "Inter, system-ui, sans-serif"
              },
              children: "ongoing subscription costs"
            }
          )
        ]
      }
    )
  ] });
};

// src/proj_25794cd2_ac8d_45ea_928a_fb396f4e0e47/scenes/Scene5.tsx
var import_remotion6 = require("remotion");
var import_jsx_runtime6 = require("react/jsx-runtime");
var Scene5 = ({ startFrame }) => {
  const frame = (0, import_remotion6.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion6.useVideoConfig)();
  const localFrame = frame - startFrame;
  const sceneDuration = TIMING.scene5End - TIMING.scene5Start;
  const keySyncLocal = TIMING.scene5KeySync - TIMING.scene5Start;
  const ctaReveal = (0, import_remotion6.spring)({
    frame: localFrame - keySyncLocal + 30,
    // Start earlier for buildup
    fps,
    config: { damping: 20, stiffness: 80, mass: 0.9 }
  });
  const pulsePhase = (localFrame - keySyncLocal) / 20;
  const pulseMagnitude = (0, import_remotion6.interpolate)(
    pulsePhase % 1,
    [0, 0.5, 1],
    [1, 1.03, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const finalBurst = (0, import_remotion6.spring)({
    frame: localFrame - sceneDuration + 30,
    fps,
    config: { damping: 15, stiffness: 100, mass: 0.8 }
  });
  const energyStreams = [
    { angle: 0, delay: 0 },
    { angle: 45, delay: 8 },
    { angle: 90, delay: 4 },
    { angle: 135, delay: 12 },
    { angle: 180, delay: 6 },
    { angle: 225, delay: 10 },
    { angle: 270, delay: 2 },
    { angle: 315, delay: 14 }
  ];
  const particles = Array.from({ length: 24 }, (_, i) => ({
    angle: i * 15,
    distance: 400 + i % 3 * 100,
    size: 6 + i % 4 * 2,
    delay: i % 8 * 4,
    color: i % 3 === 0 ? COLORS.electricBlue : i % 3 === 1 ? COLORS.electricGreen : COLORS.actionTeal
  }));
  const urgencyIn = (0, import_remotion6.spring)({
    frame: localFrame - 30,
    fps,
    config: SPRING_CONFIG
  });
  const brandIn = (0, import_remotion6.spring)({
    frame: localFrame - keySyncLocal - 20,
    fps,
    config: SPRING_CONFIG
  });
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_remotion6.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.15,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          opacity: urgencyIn,
          transform: `translateY(${(0, import_remotion6.interpolate)(urgencyIn, [0, 1], [30, 0], { extrapolateRight: "clamp" })}px)`
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "span",
            {
              style: {
                fontSize: height * 0.035,
                fontWeight: 600,
                color: COLORS.white,
                textAlign: "center",
                fontFamily: "Inter, system-ui, sans-serif"
              },
              children: "Ready to create?"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "span",
            {
              style: {
                fontSize: height * 0.028,
                fontWeight: 500,
                color: COLORS.electricGreen,
                textAlign: "center",
                fontFamily: "Inter, system-ui, sans-serif"
              },
              children: "Start for free today"
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.55,
          left: width * 0.5,
          transform: "translate(-50%, -50%)"
        },
        children: [
          energyStreams.map((stream, index) => {
            const streamProgress = (0, import_remotion6.interpolate)(
              localFrame - stream.delay,
              [0, keySyncLocal],
              [0, 1],
              { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
            );
            const startDist = 350;
            const endDist = 80;
            const currentDist = (0, import_remotion6.interpolate)(
              streamProgress,
              [0, 1],
              [startDist, endDist],
              { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
            );
            const streamX = currentDist * Math.cos(stream.angle * Math.PI / 180);
            const streamY = currentDist * Math.sin(stream.angle * Math.PI / 180);
            return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              "div",
              {
                style: {
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: 60,
                  height: 4,
                  background: `linear-gradient(90deg, ${COLORS.electricBlue}, ${COLORS.electricGreen})`,
                  borderRadius: 2,
                  transform: `translate(${streamX}px, ${streamY}px) rotate(${stream.angle + 180}deg)`,
                  transformOrigin: "left center",
                  opacity: streamProgress * 0.8,
                  boxShadow: `0 0 15px ${COLORS.electricBlue}80`
                }
              },
              index
            );
          }),
          particles.map((particle, index) => {
            const particleProgress = (0, import_remotion6.interpolate)(
              localFrame - particle.delay,
              [0, keySyncLocal + 20],
              [0, 1],
              { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
            );
            const currentDist = (0, import_remotion6.interpolate)(
              particleProgress,
              [0, 1],
              [particle.distance, 0],
              { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
            );
            const particleX = currentDist * Math.cos(particle.angle * Math.PI / 180);
            const particleY = currentDist * Math.sin(particle.angle * Math.PI / 180);
            return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              "div",
              {
                style: {
                  position: "absolute",
                  left: particleX,
                  top: particleY,
                  width: particle.size,
                  height: particle.size,
                  borderRadius: "50%",
                  background: particle.color,
                  boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
                  transform: "translate(-50%, -50%)",
                  opacity: (0, import_remotion6.interpolate)(
                    particleProgress,
                    [0, 0.1, 0.9, 1],
                    [0, 1, 1, 0],
                    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
                  )
                }
              },
              index
            );
          })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.55,
          left: width * 0.5,
          transform: `translate(-50%, -50%) scale(${ctaReveal * pulseMagnitude})`,
          opacity: ctaReveal
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "div",
            {
              style: {
                padding: "24px 56px",
                background: `linear-gradient(135deg, ${COLORS.electricBlue}, ${COLORS.electricGreen})`,
                borderRadius: 16,
                boxShadow: `
              0 0 40px ${COLORS.electricBlue}80,
              0 0 80px ${COLORS.electricGreen}40,
              inset 0 1px 0 rgba(255,255,255,0.2)
            `
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                "span",
                {
                  style: {
                    fontSize: height * 0.042,
                    fontWeight: 700,
                    color: COLORS.white,
                    fontFamily: "Inter, system-ui, sans-serif",
                    letterSpacing: "-0.01em",
                    textShadow: "0 2px 4px rgba(0,0,0,0.3)"
                  },
                  children: "Start Free Today"
                }
              )
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                inset: -8,
                borderRadius: 24,
                border: `2px solid ${COLORS.electricGreen}40`,
                opacity: pulseMagnitude - 1 + 0.5
              }
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.72,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: ctaReveal,
          transform: `translateY(${(0, import_remotion6.interpolate)(ctaReveal, [0, 1], [20, 0], { extrapolateRight: "clamp" })}px)`
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "span",
          {
            style: {
              fontSize: height * 0.03,
              fontWeight: 500,
              color: COLORS.sparkWhite,
              textAlign: "center",
              fontFamily: "Inter, system-ui, sans-serif",
              opacity: 0.8
            },
            children: "Sign up now and start creating"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.88,
          left: width * 0.5,
          transform: `translate(-50%, -50%) scale(${brandIn})`,
          opacity: brandIn
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "span",
          {
            style: {
              fontSize: height * 0.045,
              fontWeight: 800,
              color: COLORS.white,
              fontFamily: "Inter, system-ui, sans-serif",
              letterSpacing: "-0.02em",
              textShadow: `0 0 20px ${COLORS.electricBlue}60`
            },
            children: "Clipify"
          }
        )
      }
    ),
    finalBurst > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.55,
          left: width * 0.5,
          transform: "translate(-50%, -50%)"
        },
        children: Array.from({ length: 16 }, (_, i) => {
          const burstAngle = i * 22.5;
          const burstDist = finalBurst * 200;
          const burstX = burstDist * Math.cos(burstAngle * Math.PI / 180);
          const burstY = burstDist * Math.sin(burstAngle * Math.PI / 180);
          return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: burstX,
                top: burstY,
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: i % 2 === 0 ? COLORS.electricBlue : COLORS.electricGreen,
                boxShadow: `0 0 20px ${i % 2 === 0 ? COLORS.electricBlue : COLORS.electricGreen}`,
                transform: "translate(-50%, -50%)",
                opacity: (0, import_remotion6.interpolate)(
                  finalBurst,
                  [0, 0.5, 1],
                  [0, 1, 0],
                  { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
                )
              }
            },
            i
          );
        })
      }
    )
  ] });
};

// src/proj_25794cd2_ac8d_45ea_928a_fb396f4e0e47/index.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
var MainComposition = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_remotion7.AbsoluteFill, { style: { backgroundColor: COLORS.backgroundDark }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Background, {}, "bg"),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      import_remotion7.Sequence,
      {
        from: TIMING.scene1Start,
        durationInFrames: TIMING.scene1End - TIMING.scene1Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Scene1, { startFrame: 0 })
      },
      "scene1"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      import_remotion7.Sequence,
      {
        from: TIMING.scene2Start,
        durationInFrames: TIMING.scene2End - TIMING.scene2Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Scene2, { startFrame: 0 })
      },
      "scene2"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      import_remotion7.Sequence,
      {
        from: TIMING.scene3Start,
        durationInFrames: TIMING.scene3End - TIMING.scene3Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Scene3, { startFrame: 0 })
      },
      "scene3"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      import_remotion7.Sequence,
      {
        from: TIMING.scene4Start,
        durationInFrames: TIMING.scene4End - TIMING.scene4Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Scene4, { startFrame: 0 })
      },
      "scene4"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      import_remotion7.Sequence,
      {
        from: TIMING.scene5Start,
        durationInFrames: TIMING.scene5End - TIMING.scene5Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Scene5, { startFrame: 0 })
      },
      "scene5"
    )
  ] });
};
var RemotionRoot = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
    import_remotion7.Composition,
    {
      id: "proj-25794cd2-ac8d-45ea-928a-fb396f4e0e47",
      component: MainComposition,
      durationInFrames: TIMING.totalFrames,
      fps: TIMING.fps,
      width: TIMING.width,
      height: TIMING.height
    }
  );
};
var index_default = MainComposition;
