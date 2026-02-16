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
var import_remotion8 = require("remotion");

// src/proj_25794cd2_ac8d_45ea_928a_fb396f4e0e47/constants.ts
var COLORS = {
  // Frustrated Phase (Scene 1)
  frustrationStart: "#64748B",
  frustrationEnd: "#475569",
  // Solution Phase (Scene 2)
  solutionStart: "#F97316",
  solutionEnd: "#FB923C",
  // Magic Phase (Scene 3)
  magicStart: "#8B5CF6",
  magicEnd: "#06B6D4",
  // Action Phase (Scene 4-5)
  actionStart: "#10B981",
  actionEnd: "#3B82F6",
  // Background
  background: "#0F172A",
  backgroundLight: "#1E293B",
  // Creative Spark
  sparkWarm: "#F97316",
  sparkCool: "#64748B",
  sparkFree: "#FBBF24",
  // UI Elements
  white: "#FFFFFF",
  textPrimary: "#F8FAFC",
  textSecondary: "#94A3B8"
};
var SPRING_CONFIG = {
  damping: 22,
  stiffness: 90,
  mass: 0.9
};
var SPRING_SNAPPY = {
  damping: 28,
  stiffness: 120,
  mass: 0.8
};
var SPRING_GENTLE = {
  damping: 30,
  stiffness: 60,
  mass: 1.2
};
var TIMING = {
  // Video specs from scenes.json (MUST MATCH EXACTLY)
  totalFrames: 856,
  fps: 30,
  width: 1080,
  height: 1920,
  // Scene timing from scenes.json
  scene1Start: 0,
  scene1End: 195,
  scene2Start: 195,
  scene2End: 270,
  scene3Start: 270,
  scene3End: 450,
  scene4Start: 450,
  scene4End: 630,
  scene5Start: 630,
  scene5End: 856,
  // Key sync points from scenes.json
  scene1KeyFrame: 80,
  // "but" - frustration shift
  scene2KeyFrame: 225,
  // "Clipify" - brand reveal
  scene3KeyFrame: 348,
  // "add" - graphics explosion
  scene4KeyFrame: 484,
  // "No" - barriers dissolve
  scene5KeyFrame: 772
  // "Sign up" - CTA pulse
};

// src/proj_25794cd2_ac8d_45ea_928a_fb396f4e0e47/components/Background.tsx
var import_remotion = require("remotion");
var import_jsx_runtime = require("react/jsx-runtime");
var Background = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const gradientStart = COLORS.background;
  let gradientEnd = COLORS.backgroundLight;
  if (frame < TIMING.scene2Start) {
    gradientEnd = COLORS.frustrationEnd;
  } else if (frame < TIMING.scene3Start) {
    gradientEnd = COLORS.solutionStart;
  } else if (frame < TIMING.scene4Start) {
    gradientEnd = COLORS.magicStart;
  } else {
    gradientEnd = COLORS.actionStart;
  }
  const pulseIntensity = (0, import_remotion.interpolate)(
    frame % 60,
    [0, 30, 60],
    [1, 1.02, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    import_remotion.AbsoluteFill,
    {
      style: {
        background: `radial-gradient(ellipse at 50% 50%, ${gradientEnd}15, ${gradientStart} 70%)`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              inset: 0,
              background: `radial-gradient(circle at 50% 30%, ${gradientEnd}08, transparent 60%)`,
              transform: `scale(${pulseIntensity})`
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              inset: 0,
              background: "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.4) 100%)"
            }
          }
        )
      ]
    }
  );
};

// src/proj_25794cd2_ac8d_45ea_928a_fb396f4e0e47/scenes/Scene1.tsx
var import_remotion3 = require("remotion");

// src/proj_25794cd2_ac8d_45ea_928a_fb396f4e0e47/components/CreativeSpark.tsx
var import_remotion2 = require("remotion");
var import_jsx_runtime2 = require("react/jsx-runtime");
var CreativeSpark = ({
  x,
  y,
  size = 40,
  color = COLORS.sparkWarm,
  glowIntensity = 1,
  squash = 1,
  rotation = 0,
  opacity = 1
}) => {
  const frame = (0, import_remotion2.useCurrentFrame)();
  const glowPulse = (0, import_remotion2.interpolate)(
    frame % 30,
    [0, 15, 30],
    [0.8, 1.2, 0.8],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const scaleX = 1 / squash;
  const scaleY = squash;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        transform: `translate(-50%, -50%) scaleX(${scaleX}) scaleY(${scaleY}) rotate(${rotation}deg)`,
        opacity
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              inset: -size * 0.8 * glowIntensity * glowPulse,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${color}40, ${color}00)`,
              filter: `blur(${size * 0.3}px)`
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              inset: -size * 0.4 * glowIntensity * glowPulse,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${color}80, ${color}20)`,
              filter: `blur(${size * 0.15}px)`
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              inset: size * 0.15,
              borderRadius: "50%",
              background: `radial-gradient(circle at 30% 30%, ${COLORS.white}, ${color})`,
              boxShadow: `0 0 ${size * 0.5}px ${color}`
            }
          }
        )
      ]
    }
  );
};

// src/proj_25794cd2_ac8d_45ea_928a_fb396f4e0e47/scenes/Scene1.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var CageBar = ({ x, y, width, height, rotation = 0, stressFracture = 0 }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        background: `linear-gradient(135deg, ${COLORS.frustrationStart}, ${COLORS.frustrationEnd})`,
        borderRadius: 4,
        boxShadow: `0 0 20px ${COLORS.frustrationEnd}40`,
        opacity: 1 - stressFracture * 0.3
      },
      children: stressFracture > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            inset: 0,
            background: `linear-gradient(${45 + Math.random() * 90}deg, transparent 40%, ${COLORS.solutionStart}${Math.floor(stressFracture * 60).toString(16).padStart(2, "0")} 50%, transparent 60%)`,
            borderRadius: 4
          }
        }
      )
    }
  );
};
var Scene1 = ({ startFrame }) => {
  const frame = (0, import_remotion3.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion3.useVideoConfig)();
  const localFrame = frame - startFrame;
  const sceneDuration = TIMING.scene1End - TIMING.scene1Start;
  const cageX = width * 0.5;
  const cageY = height * 0.4;
  const cageWidth = width * 0.35;
  const cageHeight = height * 0.15;
  const bouncePhase = localFrame * 0.08 % 4;
  const bounceProgress = bouncePhase % 1;
  let sparkOffsetX = 0;
  let sparkOffsetY = 0;
  let squash = 1;
  const bounceIndex = Math.floor(bouncePhase);
  if (bounceIndex === 0) {
    sparkOffsetX = (0, import_remotion3.interpolate)(bounceProgress, [0, 0.5, 1], [-cageWidth * 0.35, 0, cageWidth * 0.35], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
    sparkOffsetY = (0, import_remotion3.interpolate)(bounceProgress, [0, 0.5, 1], [0, -cageHeight * 0.3, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
    squash = bounceProgress > 0.9 ? 1 + (bounceProgress - 0.9) * 3 : 1;
  } else if (bounceIndex === 1) {
    sparkOffsetX = cageWidth * 0.35;
    sparkOffsetY = (0, import_remotion3.interpolate)(bounceProgress, [0, 0.3, 0.5, 1], [0, -cageHeight * 0.45, -cageHeight * 0.45, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
    squash = bounceProgress < 0.1 ? 1.3 - bounceProgress * 3 : bounceProgress > 0.9 ? 1 + (bounceProgress - 0.9) * 2 : 1;
  } else if (bounceIndex === 2) {
    sparkOffsetX = (0, import_remotion3.interpolate)(bounceProgress, [0, 0.5, 1], [cageWidth * 0.35, 0, -cageWidth * 0.35], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
    sparkOffsetY = (0, import_remotion3.interpolate)(bounceProgress, [0, 0.5, 1], [0, -cageHeight * 0.25, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
    squash = bounceProgress > 0.9 ? 1 + (bounceProgress - 0.9) * 3 : 1;
  } else {
    sparkOffsetX = -cageWidth * 0.35;
    sparkOffsetY = (0, import_remotion3.interpolate)(bounceProgress, [0, 0.4, 0.6, 1], [0, cageHeight * 0.3, cageHeight * 0.3, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
    squash = bounceProgress < 0.1 ? 1.2 - bounceProgress * 2 : 1;
  }
  const postKeyFrame = localFrame > TIMING.scene1KeyFrame;
  const intensityMultiplier = postKeyFrame ? 1.3 : 1;
  sparkOffsetX *= intensityMultiplier;
  sparkOffsetY *= intensityMultiplier;
  const colorTransition = (0, import_remotion3.interpolate)(
    localFrame,
    [TIMING.scene1KeyFrame - 10, TIMING.scene1KeyFrame + 20],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const sparkColor = colorTransition < 0.5 ? COLORS.sparkWarm : COLORS.sparkCool;
  const stressFractureProgress = (0, import_remotion3.interpolate)(
    localFrame,
    [sceneDuration * 0.7, sceneDuration],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const text1Opacity = (0, import_remotion3.interpolate)(
    localFrame,
    [10, 30, 60, 75],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const text2Opacity = (0, import_remotion3.interpolate)(
    localFrame,
    [TIMING.scene1KeyFrame, TIMING.scene1KeyFrame + 20, sceneDuration - 30, sceneDuration - 10],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const entranceProgress = (0, import_remotion3.spring)({
    frame: localFrame,
    fps,
    config: SPRING_CONFIG
  });
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_remotion3.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: width * 0.1,
          top: height * 0.65,
          width: width * 0.2,
          height: height * 0.25,
          background: `linear-gradient(180deg, ${COLORS.frustrationEnd}20, transparent)`,
          borderRadius: "50% 50% 0 0",
          opacity: 0.4 * entranceProgress
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          right: width * 0.1,
          top: height * 0.68,
          width: width * 0.18,
          height: height * 0.22,
          background: `linear-gradient(180deg, ${COLORS.frustrationEnd}20, transparent)`,
          borderRadius: "50% 50% 0 0",
          opacity: 0.3 * entranceProgress
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: width * 0.35,
          top: height * 0.72,
          width: width * 0.15,
          height: height * 0.18,
          background: `linear-gradient(180deg, ${COLORS.frustrationEnd}15, transparent)`,
          borderRadius: "50% 50% 0 0",
          opacity: 0.25 * entranceProgress
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          left: cageX,
          top: cageY,
          transform: `translate(-50%, -50%) scale(${entranceProgress})`
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            CageBar,
            {
              x: 0,
              y: -cageHeight * 0.5,
              width: cageWidth,
              height: 12,
              stressFracture: stressFractureProgress * 0.8
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            CageBar,
            {
              x: 0,
              y: cageHeight * 0.5,
              width: cageWidth,
              height: 12,
              stressFracture: stressFractureProgress * 0.6
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            CageBar,
            {
              x: -cageWidth * 0.5,
              y: 0,
              width: 12,
              height: cageHeight,
              stressFracture: stressFractureProgress
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            CageBar,
            {
              x: cageWidth * 0.5,
              y: 0,
              width: 12,
              height: cageHeight,
              stressFracture: stressFractureProgress * 0.9
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            CageBar,
            {
              x: -cageWidth * 0.25,
              y: 0,
              width: 8,
              height: cageHeight,
              stressFracture: stressFractureProgress * 0.5
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            CageBar,
            {
              x: cageWidth * 0.25,
              y: 0,
              width: 8,
              height: cageHeight,
              stressFracture: stressFractureProgress * 0.7
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            CreativeSpark,
            {
              x: sparkOffsetX,
              y: sparkOffsetY,
              size: 50,
              color: sparkColor,
              glowIntensity: postKeyFrame ? 0.6 : 1,
              squash,
              opacity: entranceProgress
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.15,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: text1Opacity
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "span",
          {
            style: {
              fontSize: height * 0.035,
              fontWeight: 600,
              color: COLORS.textPrimary,
              fontFamily: "Inter, system-ui, sans-serif",
              letterSpacing: "0.02em"
            },
            children: "Everyone wants to create"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.15,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: text2Opacity
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "span",
          {
            style: {
              fontSize: height * 0.035,
              fontWeight: 600,
              color: COLORS.textSecondary,
              fontFamily: "Inter, system-ui, sans-serif",
              letterSpacing: "0.02em"
            },
            children: "but editing stops most people"
          }
        )
      }
    )
  ] });
};

// src/proj_25794cd2_ac8d_45ea_928a_fb396f4e0e47/scenes/Scene2.tsx
var import_remotion4 = require("remotion");
var import_jsx_runtime4 = require("react/jsx-runtime");
var CageFragment = ({ delay, angle, distance, width, height, localFrame, fps }) => {
  const explosionProgress = (0, import_remotion4.spring)({
    frame: Math.max(0, localFrame - delay),
    fps,
    config: { damping: 25, stiffness: 80, mass: 1 }
  });
  const x = Math.cos(angle) * distance * explosionProgress;
  const y = Math.sin(angle) * distance * explosionProgress;
  const rotation = angle * (180 / Math.PI) + explosionProgress * 180;
  const opacity = (0, import_remotion4.interpolate)(
    explosionProgress,
    [0, 0.3, 1],
    [1, 0.8, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        height,
        background: `linear-gradient(135deg, ${COLORS.frustrationStart}, ${COLORS.frustrationEnd})`,
        borderRadius: 2,
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rotation}deg)`,
        opacity
      }
    }
  );
};
var EnergyParticle = ({ delay, angle, maxDistance, size, localFrame, fps, color }) => {
  const progress = (0, import_remotion4.spring)({
    frame: Math.max(0, localFrame - delay),
    fps,
    config: { damping: 20, stiffness: 100, mass: 0.6 }
  });
  const outProgress = (0, import_remotion4.interpolate)(
    progress,
    [0, 0.5, 1],
    [0, 1, 0.3],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const distance = maxDistance * outProgress;
  const x = Math.cos(angle) * distance;
  const y = Math.sin(angle) * distance;
  const opacity = (0, import_remotion4.interpolate)(
    progress,
    [0, 0.2, 0.8, 1],
    [0, 1, 1, 0.5],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "50%",
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color}, ${color}00)`,
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
        opacity,
        boxShadow: `0 0 ${size * 2}px ${color}80`
      }
    }
  );
};
var Scene2 = ({ startFrame }) => {
  const frame = (0, import_remotion4.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion4.useVideoConfig)();
  const localFrame = frame - startFrame;
  const sceneDuration = TIMING.scene2End - TIMING.scene2Start;
  const keyFrame = TIMING.scene2KeyFrame - TIMING.scene2Start;
  const anticipation = (0, import_remotion4.interpolate)(
    localFrame,
    [0, 8, 10],
    [1, 0.95, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const explosionFrame = 10;
  const hasExploded = localFrame >= explosionFrame;
  const logoProgress = (0, import_remotion4.spring)({
    frame: Math.max(0, localFrame - keyFrame + 15),
    fps,
    config: SPRING_CONFIG
  });
  const logoPulse = (0, import_remotion4.interpolate)(
    (localFrame - keyFrame) % 30,
    [0, 15, 30],
    [1, 1.05, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const centerX = width * 0.5;
  const centerY = height * 0.35;
  const fragments = [];
  for (let i = 0; i < 12; i++) {
    const angle = i / 12 * Math.PI * 2;
    fragments.push({
      angle,
      delay: explosionFrame + i % 3 * 2,
      distance: 300 + Math.random() * 200,
      width: 20 + Math.random() * 40,
      height: 8 + Math.random() * 8
    });
  }
  const particles = [];
  for (let i = 0; i < 24; i++) {
    const angle = i / 24 * Math.PI * 2 + Math.random() * 0.3;
    particles.push({
      angle,
      delay: explosionFrame + 5 + i % 6 * 2,
      maxDistance: 150 + Math.random() * 250,
      size: 15 + Math.random() * 25,
      color: i % 2 === 0 ? COLORS.solutionStart : COLORS.solutionEnd
    });
  }
  const sparkScale = (0, import_remotion4.spring)({
    frame: Math.max(0, localFrame - explosionFrame - 5),
    fps,
    config: SPRING_SNAPPY
  });
  const sparkGlow = (0, import_remotion4.interpolate)(
    localFrame,
    [explosionFrame, explosionFrame + 30, sceneDuration],
    [1, 2, 1.5],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const textOpacity = (0, import_remotion4.interpolate)(
    localFrame,
    [keyFrame - 5, keyFrame + 10, sceneDuration - 15, sceneDuration],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_remotion4.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          left: centerX,
          top: centerY,
          transform: `scale(${anticipation})`
        },
        children: [
          !hasExploded && // Pre-explosion cage (stressed)
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: 0,
                top: 0,
                width: width * 0.35,
                height: height * 0.15,
                border: `6px solid ${COLORS.frustrationStart}`,
                borderRadius: 8,
                transform: "translate(-50%, -50%)",
                boxShadow: `0 0 30px ${COLORS.solutionStart}60, inset 0 0 20px ${COLORS.solutionStart}40`
              }
            }
          ),
          hasExploded && fragments.map((frag, i) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            CageFragment,
            {
              delay: frag.delay,
              angle: frag.angle,
              distance: frag.distance,
              width: frag.width,
              height: frag.height,
              localFrame,
              fps
            },
            i
          ))
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: centerX,
          top: centerY
        },
        children: hasExploded && particles.map((particle, i) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          EnergyParticle,
          {
            delay: particle.delay,
            angle: particle.angle,
            maxDistance: particle.maxDistance,
            size: particle.size,
            localFrame,
            fps,
            color: particle.color
          },
          i
        ))
      }
    ),
    hasExploded && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      CreativeSpark,
      {
        x: centerX,
        y: centerY,
        size: 60 * sparkScale,
        color: COLORS.sparkFree,
        glowIntensity: sparkGlow,
        opacity: sparkScale
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: centerX,
          top: height * 0.3,
          transform: `translate(-50%, -50%) scale(${logoProgress * logoPulse})`,
          opacity: logoProgress
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "div",
          {
            style: {
              fontSize: height * 0.06,
              fontWeight: 800,
              fontFamily: "Inter, system-ui, sans-serif",
              background: `linear-gradient(135deg, ${COLORS.solutionStart}, ${COLORS.solutionEnd})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: `0 0 60px ${COLORS.solutionStart}60`,
              letterSpacing: "-0.02em"
            },
            children: "Clipify"
          }
        )
      }
    ),
    hasExploded && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: centerX,
          top: centerY,
          width: 400 * sparkScale,
          height: 400 * sparkScale,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.solutionStart}30, ${COLORS.solutionEnd}10, transparent 70%)`,
          transform: "translate(-50%, -50%)",
          filter: "blur(20px)"
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.75,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: textOpacity
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "span",
          {
            style: {
              fontSize: height * 0.028,
              fontWeight: 500,
              color: COLORS.textSecondary,
              fontFamily: "Inter, system-ui, sans-serif"
            },
            children: "The solution you've been waiting for"
          }
        )
      }
    )
  ] });
};

// src/proj_25794cd2_ac8d_45ea_928a_fb396f4e0e47/scenes/Scene3.tsx
var import_remotion5 = require("remotion");
var import_jsx_runtime5 = require("react/jsx-runtime");
var MotionGraphicElement = ({ type, x, y, size, color, delay, localFrame, fps, rotation = 0 }) => {
  const progress = (0, import_remotion5.spring)({
    frame: Math.max(0, localFrame - delay),
    fps,
    config: SPRING_CONFIG
  });
  const floatOffset = Math.sin((localFrame - delay) * 0.05) * 5 * progress;
  const opacity = (0, import_remotion5.interpolate)(
    progress,
    [0, 0.3, 1],
    [0, 1, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const scale = (0, import_remotion5.interpolate)(
    progress,
    [0, 0.5, 0.8, 1],
    [0, 1.1, 0.95, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  let shape;
  switch (type) {
    case "circle":
      shape = /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "div",
        {
          style: {
            width: size,
            height: size,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${color}, ${color}88)`,
            boxShadow: `0 0 ${size * 0.5}px ${color}40`
          }
        }
      );
      break;
    case "square":
      shape = /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "div",
        {
          style: {
            width: size,
            height: size,
            borderRadius: size * 0.15,
            background: `linear-gradient(135deg, ${color}, ${color}88)`,
            boxShadow: `0 0 ${size * 0.5}px ${color}40`
          }
        }
      );
      break;
    case "triangle":
      shape = /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "div",
        {
          style: {
            width: 0,
            height: 0,
            borderLeft: `${size * 0.5}px solid transparent`,
            borderRight: `${size * 0.5}px solid transparent`,
            borderBottom: `${size * 0.866}px solid ${color}`,
            filter: `drop-shadow(0 0 ${size * 0.3}px ${color}40)`
          }
        }
      );
      break;
    case "line":
      shape = /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "div",
        {
          style: {
            width: size * 2,
            height: size * 0.2,
            borderRadius: size * 0.1,
            background: `linear-gradient(90deg, ${color}, ${color}00)`
          }
        }
      );
      break;
    case "blob":
      shape = /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "div",
        {
          style: {
            width: size,
            height: size * 0.7,
            borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
            background: `radial-gradient(ellipse at 30% 30%, ${color}, ${color}66)`,
            boxShadow: `0 0 ${size * 0.5}px ${color}30`
          }
        }
      );
      break;
  }
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y + floatOffset,
        transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotation + progress * 15}deg)`,
        opacity
      },
      children: shape
    }
  );
};
var UploadInterface = ({ progress, glow, width, height }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "div",
    {
      style: {
        position: "relative",
        width: width * 0.5,
        height: height * 0.08,
        background: `linear-gradient(135deg, ${COLORS.backgroundLight}, ${COLORS.background})`,
        borderRadius: 16,
        border: `2px solid ${COLORS.magicStart}${Math.floor(glow * 255).toString(16).padStart(2, "0")}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        boxShadow: `0 0 ${40 * glow}px ${COLORS.magicStart}40, inset 0 0 20px ${COLORS.magicStart}10`,
        transform: `scale(${0.95 + glow * 0.05})`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              width: 40,
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("svg", { width: "32", height: "32", viewBox: "0 0 24 24", fill: "none", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                "path",
                {
                  d: "M12 4L12 16M12 4L8 8M12 4L16 8",
                  stroke: COLORS.magicStart,
                  strokeWidth: "2.5",
                  strokeLinecap: "round",
                  strokeLinejoin: "round"
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                "path",
                {
                  d: "M4 17V19C4 20.1046 4.89543 21 6 21H18C19.1046 21 20 20.1046 20 19V17",
                  stroke: COLORS.magicEnd,
                  strokeWidth: "2.5",
                  strokeLinecap: "round"
                }
              )
            ] })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "span",
          {
            style: {
              fontSize: 22,
              fontWeight: 600,
              color: COLORS.textPrimary,
              fontFamily: "Inter, system-ui, sans-serif"
            },
            children: "Upload video"
          }
        )
      ]
    }
  );
};
var Scene3 = ({ startFrame }) => {
  const frame = (0, import_remotion5.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion5.useVideoConfig)();
  const localFrame = frame - startFrame;
  const sceneDuration = TIMING.scene3End - TIMING.scene3Start;
  const keyFrame = TIMING.scene3KeyFrame - TIMING.scene3Start;
  const uploadEntrance = (0, import_remotion5.spring)({
    frame: localFrame,
    fps,
    config: SPRING_CONFIG
  });
  const anticipationGlow = (0, import_remotion5.interpolate)(
    localFrame,
    [keyFrame - 30, keyFrame - 5, keyFrame],
    [0.3, 1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const uploadOpacity = (0, import_remotion5.interpolate)(
    localFrame,
    [0, 20, keyFrame - 10, keyFrame + 10],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const graphicsStarted = localFrame >= keyFrame;
  const elements = [
    // Row 1 - top elements
    { type: "circle", x: 0.25, y: 0.25, size: 60, color: COLORS.magicStart, delay: 0 },
    { type: "square", x: 0.4, y: 0.22, size: 45, color: COLORS.magicEnd, delay: 6 },
    { type: "triangle", x: 0.6, y: 0.2, size: 50, color: COLORS.solutionStart, delay: 12 },
    { type: "blob", x: 0.75, y: 0.25, size: 55, color: COLORS.magicStart, delay: 18 },
    // Row 2 - mid-top elements
    { type: "line", x: 0.3, y: 0.35, size: 40, color: COLORS.magicEnd, delay: 8 },
    { type: "circle", x: 0.5, y: 0.32, size: 80, color: COLORS.magicStart, delay: 14 },
    { type: "square", x: 0.7, y: 0.35, size: 35, color: COLORS.solutionEnd, delay: 20 },
    // Row 3 - middle elements (hero area)
    { type: "blob", x: 0.2, y: 0.45, size: 70, color: COLORS.magicEnd, delay: 10 },
    { type: "triangle", x: 0.35, y: 0.48, size: 65, color: COLORS.magicStart, delay: 16 },
    { type: "circle", x: 0.65, y: 0.45, size: 55, color: COLORS.solutionStart, delay: 22 },
    { type: "square", x: 0.8, y: 0.48, size: 50, color: COLORS.magicEnd, delay: 28 },
    // Row 4 - mid-bottom elements
    { type: "line", x: 0.25, y: 0.58, size: 50, color: COLORS.magicStart, delay: 24 },
    { type: "blob", x: 0.45, y: 0.55, size: 45, color: COLORS.magicEnd, delay: 30 },
    { type: "triangle", x: 0.55, y: 0.6, size: 40, color: COLORS.solutionEnd, delay: 36 },
    { type: "circle", x: 0.75, y: 0.58, size: 60, color: COLORS.magicStart, delay: 32 },
    // Row 5 - bottom elements
    { type: "square", x: 0.3, y: 0.7, size: 50, color: COLORS.magicEnd, delay: 26 },
    { type: "blob", x: 0.5, y: 0.68, size: 65, color: COLORS.magicStart, delay: 34 },
    { type: "circle", x: 0.7, y: 0.72, size: 45, color: COLORS.solutionStart, delay: 38 }
  ];
  const uploadTextOpacity = (0, import_remotion5.interpolate)(
    localFrame,
    [10, 25, keyFrame - 20, keyFrame - 5],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const magicTextOpacity = (0, import_remotion5.interpolate)(
    localFrame,
    [keyFrame + 20, keyFrame + 35, sceneDuration - 20, sceneDuration],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_remotion5.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: width * 0.5,
          top: height * 0.25,
          transform: `translate(-50%, -50%) scale(${uploadEntrance})`,
          opacity: uploadOpacity
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          UploadInterface,
          {
            progress: uploadEntrance,
            glow: anticipationGlow,
            width,
            height
          }
        )
      }
    ),
    graphicsStarted && elements.map((el, i) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      MotionGraphicElement,
      {
        type: el.type,
        x: width * el.x,
        y: height * el.y,
        size: el.size,
        color: el.color,
        delay: keyFrame + el.delay,
        localFrame,
        fps,
        rotation: i * 15
      },
      i
    )),
    graphicsStarted && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: width * 0.5,
          top: height * 0.35,
          transform: "translate(-50%, -50%)"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              width: (0, import_remotion5.interpolate)(
                localFrame - keyFrame,
                [0, 30],
                [0, 500],
                { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
              ),
              height: (0, import_remotion5.interpolate)(
                localFrame - keyFrame,
                [0, 30],
                [0, 500],
                { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
              ),
              borderRadius: "50%",
              background: `radial-gradient(circle, ${COLORS.magicStart}40, ${COLORS.magicEnd}20, transparent 70%)`,
              opacity: (0, import_remotion5.interpolate)(
                localFrame - keyFrame,
                [0, 10, 40],
                [1, 0.8, 0],
                { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
              ),
              filter: "blur(10px)"
            }
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.82,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: uploadTextOpacity
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "span",
          {
            style: {
              fontSize: height * 0.03,
              fontWeight: 500,
              color: COLORS.textSecondary,
              fontFamily: "Inter, system-ui, sans-serif"
            },
            children: "Upload your video"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.82,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: magicTextOpacity
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "span",
          {
            style: {
              fontSize: height * 0.035,
              fontWeight: 600,
              background: `linear-gradient(90deg, ${COLORS.magicStart}, ${COLORS.magicEnd})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontFamily: "Inter, system-ui, sans-serif"
            },
            children: "Beautiful motion graphics"
          }
        )
      }
    )
  ] });
};

// src/proj_25794cd2_ac8d_45ea_928a_fb396f4e0e47/scenes/Scene4.tsx
var import_remotion6 = require("remotion");
var import_jsx_runtime6 = require("react/jsx-runtime");
var DissolutionParticle = ({ startX, startY, delay, localFrame, fps, color, size, direction }) => {
  const progress = (0, import_remotion6.spring)({
    frame: Math.max(0, localFrame - delay),
    fps,
    config: { damping: 30, stiffness: 50, mass: 1 }
  });
  const moveDistance = 200 + Math.random() * 150;
  const x = startX + Math.cos(direction) * moveDistance * progress;
  const y = startY + Math.sin(direction) * moveDistance * progress - 50 * progress;
  const opacity = (0, import_remotion6.interpolate)(
    progress,
    [0, 0.2, 0.8, 1],
    [1, 1, 0.5, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const scale = (0, import_remotion6.interpolate)(
    progress,
    [0, 0.3, 1],
    [1, 1.2, 0.3],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color}, ${color}00)`,
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity
      }
    }
  );
};
var Barrier = ({ label, icon, x, y, dissolveStart, localFrame, fps, width, height }) => {
  const entranceProgress = (0, import_remotion6.spring)({
    frame: localFrame,
    fps,
    config: SPRING_CONFIG
  });
  const dissolveProgress = (0, import_remotion6.spring)({
    frame: Math.max(0, localFrame - dissolveStart),
    fps,
    config: { damping: 25, stiffness: 60, mass: 1 }
  });
  const barrierOpacity = (0, import_remotion6.interpolate)(
    dissolveProgress,
    [0, 0.3, 0.6],
    [1, 0.6, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const barrierScale = (0, import_remotion6.interpolate)(
    dissolveProgress,
    [0, 0.2, 0.5],
    [1, 1.05, 0.9],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const particles = [];
  if (dissolveProgress > 0) {
    for (let i = 0; i < 20; i++) {
      particles.push({
        delay: dissolveStart + i * 2,
        direction: i / 20 * Math.PI * 2 + Math.random() * 0.5,
        color: i % 2 === 0 ? COLORS.magicStart : COLORS.magicEnd,
        size: 10 + Math.random() * 15
      });
    }
  }
  const renderIcon = () => {
    switch (icon) {
      case "software":
        return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("svg", { width: "36", height: "36", viewBox: "0 0 24 24", fill: "none", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("rect", { x: "3", y: "3", width: "18", height: "14", rx: "2", stroke: COLORS.frustrationStart, strokeWidth: "2" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("path", { d: "M7 21H17M12 17V21", stroke: COLORS.frustrationStart, strokeWidth: "2", strokeLinecap: "round" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("path", { d: "M7 8H10M7 11H14", stroke: COLORS.frustrationStart, strokeWidth: "2", strokeLinecap: "round" })
        ] });
      case "price":
        return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("svg", { width: "36", height: "36", viewBox: "0 0 24 24", fill: "none", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("path", { d: "M12 2V22M17 5H9.5C8.57174 5 7.6815 5.36875 7.02513 6.02513C6.36875 6.6815 6 7.57174 6 8.5C6 9.42826 6.36875 10.3185 7.02513 10.9749C7.6815 11.6313 8.57174 12 9.5 12H14.5C15.4283 12 16.3185 12.3687 16.9749 13.0251C17.6313 13.6815 18 14.5717 18 15.5C18 16.4283 17.6313 17.3185 16.9749 17.9749C16.3185 18.6313 15.4283 19 14.5 19H6", stroke: COLORS.frustrationStart, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }) });
      case "skill":
        return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("svg", { width: "36", height: "36", viewBox: "0 0 24 24", fill: "none", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("path", { d: "M12 15L8.5 21L9.5 17L6 16L12 9L11.5 13L15 14L12 15Z", stroke: COLORS.frustrationStart, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("circle", { cx: "12", cy: "12", r: "9", stroke: COLORS.frustrationStart, strokeWidth: "2" })
        ] });
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: x,
          top: y,
          transform: `translate(-50%, -50%) scale(${entranceProgress * barrierScale})`,
          opacity: barrierOpacity * entranceProgress
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
          "div",
          {
            style: {
              width: width * 0.6,
              padding: "20px 32px",
              background: `linear-gradient(135deg, ${COLORS.backgroundLight}, ${COLORS.background})`,
              borderRadius: 16,
              border: `2px solid ${COLORS.frustrationStart}40`,
              display: "flex",
              alignItems: "center",
              gap: 20,
              boxShadow: `0 10px 40px ${COLORS.background}80`
            },
            children: [
              renderIcon(),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                "span",
                {
                  style: {
                    fontSize: height * 0.025,
                    fontWeight: 600,
                    color: COLORS.frustrationStart,
                    fontFamily: "Inter, system-ui, sans-serif"
                  },
                  children: label
                }
              )
            ]
          }
        )
      }
    ),
    particles.map((p, i) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      DissolutionParticle,
      {
        startX: x,
        startY: y,
        delay: p.delay,
        localFrame,
        fps,
        color: p.color,
        size: p.size,
        direction: p.direction
      },
      i
    ))
  ] });
};
var Scene4 = ({ startFrame }) => {
  const frame = (0, import_remotion6.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion6.useVideoConfig)();
  const localFrame = frame - startFrame;
  const sceneDuration = TIMING.scene4End - TIMING.scene4Start;
  const keyFrame = TIMING.scene4KeyFrame - TIMING.scene4Start;
  const no1Progress = (0, import_remotion6.spring)({
    frame: Math.max(0, localFrame - keyFrame),
    fps,
    config: SPRING_CONFIG
  });
  const no2Progress = (0, import_remotion6.spring)({
    frame: Math.max(0, localFrame - keyFrame - 30),
    fps,
    config: SPRING_CONFIG
  });
  const no3Progress = (0, import_remotion6.spring)({
    frame: Math.max(0, localFrame - keyFrame - 60),
    fps,
    config: SPRING_CONFIG
  });
  const barrier1Dissolve = keyFrame + 5;
  const barrier2Dissolve = keyFrame + 35;
  const barrier3Dissolve = keyFrame + 65;
  const clearPathOpacity = (0, import_remotion6.interpolate)(
    localFrame,
    [keyFrame + 90, keyFrame + 110],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_remotion6.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      Barrier,
      {
        label: "Complex Software",
        icon: "software",
        x: width * 0.5,
        y: height * 0.2,
        dissolveStart: barrier1Dissolve,
        localFrame,
        fps,
        width,
        height
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      Barrier,
      {
        label: "Expensive Pricing",
        icon: "price",
        x: width * 0.5,
        y: height * 0.4,
        dissolveStart: barrier2Dissolve,
        localFrame,
        fps,
        width,
        height
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      Barrier,
      {
        label: "Skills Required",
        icon: "skill",
        x: width * 0.5,
        y: height * 0.6,
        dissolveStart: barrier3Dissolve,
        localFrame,
        fps,
        width,
        height
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: width * 0.15,
          top: height * 0.2,
          transform: `translate(-50%, -50%) scale(${no1Progress})`,
          opacity: no1Progress * (0, import_remotion6.interpolate)(localFrame, [barrier1Dissolve + 40, barrier1Dissolve + 60], [1, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "span",
          {
            style: {
              fontSize: height * 0.08,
              fontWeight: 800,
              background: `linear-gradient(135deg, ${COLORS.magicStart}, ${COLORS.magicEnd})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontFamily: "Inter, system-ui, sans-serif"
            },
            children: "No"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: width * 0.85,
          top: height * 0.4,
          transform: `translate(-50%, -50%) scale(${no2Progress})`,
          opacity: no2Progress * (0, import_remotion6.interpolate)(localFrame, [barrier2Dissolve + 40, barrier2Dissolve + 60], [1, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "span",
          {
            style: {
              fontSize: height * 0.08,
              fontWeight: 800,
              background: `linear-gradient(135deg, ${COLORS.magicEnd}, ${COLORS.actionStart})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontFamily: "Inter, system-ui, sans-serif"
            },
            children: "No"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: width * 0.5,
          top: height * 0.75,
          transform: `translate(-50%, -50%) scale(${no3Progress})`,
          opacity: no3Progress * (0, import_remotion6.interpolate)(localFrame, [barrier3Dissolve + 50, sceneDuration], [1, 0.8], { extrapolateRight: "clamp", extrapolateLeft: "clamp" })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "span",
          {
            style: {
              fontSize: height * 0.1,
              fontWeight: 800,
              background: `linear-gradient(135deg, ${COLORS.actionStart}, ${COLORS.actionEnd})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontFamily: "Inter, system-ui, sans-serif"
            },
            children: "No barriers."
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: width * 0.5,
          top: height * 0.5,
          width: width * 0.6,
          height: height * 0.4,
          borderRadius: "50%",
          background: `radial-gradient(ellipse, ${COLORS.actionStart}20, transparent 70%)`,
          transform: "translate(-50%, -50%)",
          opacity: clearPathOpacity,
          filter: "blur(30px)"
        }
      }
    )
  ] });
};

// src/proj_25794cd2_ac8d_45ea_928a_fb396f4e0e47/scenes/Scene5.tsx
var import_remotion7 = require("remotion");
var import_jsx_runtime7 = require("react/jsx-runtime");
var EnergyStream = ({ startX, startY, endX, endY, delay, localFrame, fps, color, width }) => {
  const progress = (0, import_remotion7.spring)({
    frame: Math.max(0, localFrame - delay),
    fps,
    config: { damping: 35, stiffness: 40, mass: 1.2 }
  });
  const currentX = (0, import_remotion7.interpolate)(
    progress,
    [0, 1],
    [startX, endX],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const currentY = (0, import_remotion7.interpolate)(
    progress,
    [0, 1],
    [startY, endY],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const streamLength = (0, import_remotion7.interpolate)(
    progress,
    [0, 0.5, 1],
    [100, 80, 20],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const angle = Math.atan2(endY - startY, endX - startX) * (180 / Math.PI);
  const opacity = (0, import_remotion7.interpolate)(
    progress,
    [0, 0.2, 0.8, 1],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: currentX,
        top: currentY,
        width: streamLength,
        height: width,
        background: `linear-gradient(90deg, ${color}00, ${color}, ${color}00)`,
        borderRadius: width / 2,
        transform: `translate(-50%, -50%) rotate(${angle}deg)`,
        opacity,
        boxShadow: `0 0 ${width * 3}px ${color}60`
      }
    }
  );
};
var ConvergenceParticle = ({ angle, distance, delay, localFrame, fps, color, endX, endY }) => {
  const progress = (0, import_remotion7.spring)({
    frame: Math.max(0, localFrame - delay),
    fps,
    config: { damping: 30, stiffness: 50, mass: 0.8 }
  });
  const startX = endX + Math.cos(angle) * distance;
  const startY = endY + Math.sin(angle) * distance;
  const x = (0, import_remotion7.interpolate)(progress, [0, 1], [startX, endX], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const y = (0, import_remotion7.interpolate)(progress, [0, 1], [startY, endY], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const opacity = (0, import_remotion7.interpolate)(
    progress,
    [0, 0.3, 0.9, 1],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const size = (0, import_remotion7.interpolate)(
    progress,
    [0, 0.5, 1],
    [15, 20, 8],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color}, ${color}00)`,
        transform: "translate(-50%, -50%)",
        opacity,
        boxShadow: `0 0 ${size}px ${color}80`
      }
    }
  );
};
var Scene5 = ({ startFrame }) => {
  const frame = (0, import_remotion7.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion7.useVideoConfig)();
  const localFrame = frame - startFrame;
  const sceneDuration = TIMING.scene5End - TIMING.scene5Start;
  const keyFrame = TIMING.scene5KeyFrame - TIMING.scene5Start;
  const ctaX = width * 0.5;
  const ctaY = height * 0.6;
  const ctaEntrance = (0, import_remotion7.spring)({
    frame: Math.max(0, localFrame - keyFrame + 30),
    fps,
    config: SPRING_GENTLE
  });
  const ctaPulse = (0, import_remotion7.interpolate)(
    (localFrame - keyFrame) % 45,
    [0, 22, 45],
    [1, 1.05, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const glowIntensity = (0, import_remotion7.interpolate)(
    localFrame,
    [keyFrame, keyFrame + 60, sceneDuration],
    [0.5, 1, 1.2],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const streams = [
    // From top
    { startX: width * 0.3, startY: 0, delay: 10, color: COLORS.magicStart },
    { startX: width * 0.5, startY: 0, delay: 18, color: COLORS.magicEnd },
    { startX: width * 0.7, startY: 0, delay: 26, color: COLORS.solutionStart },
    // From bottom
    { startX: width * 0.25, startY: height, delay: 14, color: COLORS.actionStart },
    { startX: width * 0.5, startY: height, delay: 22, color: COLORS.actionEnd },
    { startX: width * 0.75, startY: height, delay: 30, color: COLORS.magicStart },
    // From left
    { startX: 0, startY: height * 0.3, delay: 12, color: COLORS.solutionEnd },
    { startX: 0, startY: height * 0.5, delay: 20, color: COLORS.actionStart },
    { startX: 0, startY: height * 0.7, delay: 28, color: COLORS.magicEnd },
    // From right
    { startX: width, startY: height * 0.3, delay: 16, color: COLORS.magicStart },
    { startX: width, startY: height * 0.5, delay: 24, color: COLORS.solutionStart },
    { startX: width, startY: height * 0.7, delay: 32, color: COLORS.actionEnd }
  ];
  const particles = [];
  for (let i = 0; i < 24; i++) {
    const angle = i / 24 * Math.PI * 2;
    particles.push({
      angle,
      distance: 400 + Math.random() * 200,
      delay: 40 + i * 3,
      color: [COLORS.actionStart, COLORS.actionEnd, COLORS.magicStart, COLORS.magicEnd][i % 4]
    });
  }
  const urgencyOpacity = (0, import_remotion7.interpolate)(
    localFrame,
    [keyFrame - 50, keyFrame - 30, sceneDuration - 30, sceneDuration],
    [0, 1, 1, 0.8],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const brandOpacity = (0, import_remotion7.interpolate)(
    localFrame,
    [sceneDuration - 60, sceneDuration - 40],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_remotion7.AbsoluteFill, { children: [
    streams.map((stream, i) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      EnergyStream,
      {
        startX: stream.startX,
        startY: stream.startY,
        endX: ctaX,
        endY: ctaY,
        delay: stream.delay,
        localFrame,
        fps,
        color: stream.color,
        width: 8
      },
      i
    )),
    particles.map((p, i) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      ConvergenceParticle,
      {
        angle: p.angle,
        distance: p.distance,
        delay: p.delay,
        localFrame,
        fps,
        color: p.color,
        endX: ctaX,
        endY: ctaY
      },
      i
    )),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: ctaX,
          top: ctaY,
          width: 400 * ctaEntrance * glowIntensity,
          height: 400 * ctaEntrance * glowIntensity,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.actionStart}40, ${COLORS.actionEnd}20, transparent 70%)`,
          transform: "translate(-50%, -50%)",
          filter: "blur(30px)"
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: ctaX,
          top: ctaY,
          transform: `translate(-50%, -50%) scale(${ctaEntrance * ctaPulse})`,
          opacity: ctaEntrance
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            style: {
              padding: "28px 64px",
              background: `linear-gradient(135deg, ${COLORS.actionStart}, ${COLORS.actionEnd})`,
              borderRadius: 20,
              boxShadow: `
              0 0 ${60 * glowIntensity}px ${COLORS.actionStart}60,
              0 0 ${100 * glowIntensity}px ${COLORS.actionEnd}40,
              0 10px 40px rgba(0,0,0,0.3)
            `,
              border: `2px solid ${COLORS.white}20`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
              "span",
              {
                style: {
                  fontSize: height * 0.04,
                  fontWeight: 700,
                  color: COLORS.white,
                  fontFamily: "Inter, system-ui, sans-serif",
                  letterSpacing: "0.02em",
                  textShadow: "0 2px 10px rgba(0,0,0,0.3)"
                },
                children: "Start Free Today"
              }
            )
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.4,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          opacity: urgencyOpacity
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "span",
          {
            style: {
              fontSize: height * 0.028,
              fontWeight: 500,
              color: COLORS.textSecondary,
              fontFamily: "Inter, system-ui, sans-serif"
            },
            children: "Ready to create?"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: height * 0.1,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: brandOpacity
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            style: {
              fontSize: height * 0.035,
              fontWeight: 700,
              background: `linear-gradient(90deg, ${COLORS.solutionStart}, ${COLORS.solutionEnd})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontFamily: "Inter, system-ui, sans-serif"
            },
            children: "Clipify"
          }
        )
      }
    ),
    localFrame > sceneDuration - 30 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: ctaX,
          top: ctaY,
          width: (0, import_remotion7.interpolate)(
            localFrame,
            [sceneDuration - 30, sceneDuration],
            [0, 600],
            { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
          ),
          height: (0, import_remotion7.interpolate)(
            localFrame,
            [sceneDuration - 30, sceneDuration],
            [0, 600],
            { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
          ),
          borderRadius: "50%",
          border: `3px solid ${COLORS.actionStart}`,
          transform: "translate(-50%, -50%)",
          opacity: (0, import_remotion7.interpolate)(
            localFrame,
            [sceneDuration - 30, sceneDuration - 10, sceneDuration],
            [0, 0.6, 0],
            { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
          )
        }
      }
    )
  ] });
};

// src/proj_25794cd2_ac8d_45ea_928a_fb396f4e0e47/index.tsx
var import_jsx_runtime8 = require("react/jsx-runtime");
var MainComposition = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_remotion8.AbsoluteFill, { style: { backgroundColor: COLORS.background }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Background, {}, "bg"),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      import_remotion8.Sequence,
      {
        from: TIMING.scene1Start,
        durationInFrames: TIMING.scene1End - TIMING.scene1Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Scene1, { startFrame: 0 })
      },
      "scene1"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      import_remotion8.Sequence,
      {
        from: TIMING.scene2Start,
        durationInFrames: TIMING.scene2End - TIMING.scene2Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Scene2, { startFrame: 0 })
      },
      "scene2"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      import_remotion8.Sequence,
      {
        from: TIMING.scene3Start,
        durationInFrames: TIMING.scene3End - TIMING.scene3Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Scene3, { startFrame: 0 })
      },
      "scene3"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      import_remotion8.Sequence,
      {
        from: TIMING.scene4Start,
        durationInFrames: TIMING.scene4End - TIMING.scene4Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Scene4, { startFrame: 0 })
      },
      "scene4"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      import_remotion8.Sequence,
      {
        from: TIMING.scene5Start,
        durationInFrames: TIMING.scene5End - TIMING.scene5Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Scene5, { startFrame: 0 })
      },
      "scene5"
    )
  ] });
};
var RemotionRoot = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
    import_remotion8.Composition,
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
