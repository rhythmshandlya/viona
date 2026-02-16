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
  // Scene 1: Frustration colors
  grayDark: "#2D3436",
  grayMedium: "#636E72",
  grayLight: "#B2BEC3",
  blueMuted: "#74B9FF",
  // Scene 2: Solution colors
  orangeWarm: "#FDCB6E",
  yellowBright: "#F1C40F",
  orangeDeep: "#E17055",
  // Scene 3: Creativity colors
  magentaVibrant: "#E056FD",
  cyanBright: "#00CEC9",
  pinkHot: "#FD79A8",
  purpleDeep: "#A29BFE",
  // Scene 4-5: Action colors
  electricBlue: "#0984E3",
  electricGreen: "#00B894",
  neonCyan: "#00F5FF",
  // Background
  backgroundDark: "#1A1A2E",
  backgroundMid: "#16213E",
  // Spark colors
  sparkYellow: "#FFE66D",
  sparkWhite: "#FFFFFF"
};
var SPRING_CONFIG = { damping: 22, stiffness: 90, mass: 0.9 };
var TIMING = {
  // Video specs
  totalFrames: 856,
  fps: 30,
  width: 1080,
  height: 1920,
  // Scene 1: The Creative Struggle
  scene1Start: 0,
  scene1End: 195,
  scene1KeySync: 80,
  // "but" - visual shift
  // Scene 2: The Solution Emerges
  scene2Start: 195,
  scene2End: 270,
  scene2KeySync: 225,
  // "Clipify" - brand reveal
  // Scene 3: The Magic Process
  scene3Start: 270,
  scene3End: 450,
  scene3KeySync: 348,
  // "add" - motion graphics spring to life
  // Scene 4: Barriers Eliminated
  scene4Start: 450,
  scene4End: 630,
  scene4KeySync: 484,
  // "No" - barriers dissolve
  // Scene 5: The Call to Action
  scene5Start: 630,
  scene5End: 856,
  scene5KeySync: 772
  // "Sign up" - CTA appears
};
var RESPONSIVE = {
  safeMargin: 0.1,
  // 10%
  titleSize: 0.05,
  // 5% of height
  bodySize: 0.03,
  // 3% of height
  smallSize: 0.02,
  // 2% of height
  maxContentWidth: 0.8
  // 80%
};

// src/proj_25794cd2_ac8d_45ea_928a_fb396f4e0e47/components/Background.tsx
var import_remotion = require("remotion");
var import_jsx_runtime = require("react/jsx-runtime");
var Background = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const colorProgress = (0, import_remotion.interpolate)(
    frame,
    [0, TIMING.scene2Start, TIMING.scene3Start, TIMING.scene4Start, TIMING.scene5Start],
    [0, 0.25, 0.5, 0.75, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const gradientColor1 = colorProgress < 0.5 ? COLORS.backgroundDark : colorProgress < 0.75 ? COLORS.backgroundMid : COLORS.backgroundDark;
  const gradientColor2 = COLORS.backgroundMid;
  const glowIntensity = (0, import_remotion.interpolate)(
    frame,
    [0, TIMING.scene3Start, TIMING.scene5Start, TIMING.totalFrames],
    [0.1, 0.3, 0.5, 0.7],
    { extrapolateRight: "clamp" }
  );
  const getGlowColor = () => {
    if (frame < TIMING.scene2Start) return COLORS.blueMuted;
    if (frame < TIMING.scene3Start) return COLORS.orangeWarm;
    if (frame < TIMING.scene4Start) return COLORS.magentaVibrant;
    return COLORS.electricBlue;
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          background: `linear-gradient(180deg, ${gradientColor1} 0%, ${gradientColor2} 100%)`
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "150%",
          height: "150%",
          background: `radial-gradient(circle, ${getGlowColor()}${Math.round(glowIntensity * 40).toString(16).padStart(2, "0")} 0%, transparent 60%)`,
          pointerEvents: "none"
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundImage: `
            linear-gradient(${COLORS.grayDark}10 1px, transparent 1px),
            linear-gradient(90deg, ${COLORS.grayDark}10 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
          opacity: (0, import_remotion.interpolate)(frame, [0, 100], [0.3, 0.15], { extrapolateRight: "clamp" })
        }
      }
    )
  ] });
};

// src/proj_25794cd2_ac8d_45ea_928a_fb396f4e0e47/scenes/Scene1.tsx
var import_remotion3 = require("remotion");

// src/proj_25794cd2_ac8d_45ea_928a_fb396f4e0e47/components/CreativeSpark.tsx
var import_remotion2 = require("remotion");
var import_jsx_runtime2 = require("react/jsx-runtime");
var CreativeSpark = ({
  x,
  y,
  size = 30,
  color = COLORS.sparkYellow,
  glowIntensity = 1,
  opacity = 1
}) => {
  const frame = (0, import_remotion2.useCurrentFrame)();
  const { fps } = (0, import_remotion2.useVideoConfig)();
  const pulse = (0, import_remotion2.spring)({
    frame: frame % 30,
    // Loop every second
    fps,
    config: { ...SPRING_CONFIG, stiffness: 120 }
  });
  const scale = (0, import_remotion2.interpolate)(pulse, [0, 1], [0.9, 1.1], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: size * 3 * glowIntensity,
              height: size * 3 * glowIntensity,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${color}80 0%, ${color}40 30%, transparent 70%)`,
              filter: `blur(${size * 0.3}px)`
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
              transform: "translate(-50%, -50%)",
              width: size,
              height: size,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${COLORS.sparkWhite} 0%, ${color} 50%, ${color}00 100%)`,
              boxShadow: `0 0 ${size}px ${color}, 0 0 ${size * 2}px ${color}80`
            }
          }
        )
      ]
    }
  );
};

// src/proj_25794cd2_ac8d_45ea_928a_fb396f4e0e47/scenes/Scene1.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var CageBar = ({ x, y, width, height, rotation = 0, crackAmount }) => {
  const crackOffset = crackAmount * 3;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        backgroundColor: COLORS.grayMedium,
        borderRadius: 4,
        transform: `rotate(${rotation}deg)`,
        boxShadow: `0 0 10px ${COLORS.grayDark}`,
        // Crack effect - slight displacement
        clipPath: crackAmount > 0 ? `polygon(0 0, 100% 0, 100% ${50 - crackOffset}%, ${50 + crackOffset}% 50%, 100% ${50 + crackOffset}%, 100% 100%, 0 100%, 0 ${50 + crackOffset}%, ${50 - crackOffset}% 50%, 0 ${50 - crackOffset}%)` : void 0
      }
    }
  );
};
var Scene1 = ({ startFrame }) => {
  const frame = (0, import_remotion3.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion3.useVideoConfig)();
  const localFrame = frame - startFrame;
  const keySyncFrame = TIMING.scene1KeySync - TIMING.scene1Start;
  const entranceProgress = (0, import_remotion3.spring)({
    frame: localFrame,
    fps,
    config: SPRING_CONFIG
  });
  const frustrationProgress = (0, import_remotion3.interpolate)(
    localFrame,
    [keySyncFrame, keySyncFrame + 30],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const crackProgress = (0, import_remotion3.interpolate)(
    localFrame,
    [keySyncFrame + 30, 195],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const cageWidth = width * 0.5;
  const cageHeight = height * 0.2;
  const cageX = width * 0.5;
  const cageY = height * 0.4;
  const barThickness = 12;
  const bouncePhase = localFrame % 60;
  const sparkXOffset = (0, import_remotion3.interpolate)(
    bouncePhase,
    [0, 15, 30, 45, 60],
    [0, cageWidth * 0.35, 0, -cageWidth * 0.35, 0],
    { extrapolateRight: "clamp" }
  );
  const sparkYOffset = (0, import_remotion3.interpolate)(
    bouncePhase,
    [0, 15, 30, 45, 60],
    [-cageHeight * 0.3, 0, cageHeight * 0.3, 0, -cageHeight * 0.3],
    { extrapolateRight: "clamp" }
  );
  const sparkColor = frustrationProgress < 0.5 ? COLORS.sparkYellow : COLORS.blueMuted;
  const sparkScale = 1 + frustrationProgress * 0.3;
  const text1Progress = (0, import_remotion3.spring)({
    frame: localFrame - 10,
    fps,
    config: SPRING_CONFIG
  });
  const text2Progress = (0, import_remotion3.spring)({
    frame: localFrame - (keySyncFrame + 10),
    fps,
    config: SPRING_CONFIG
  });
  const titleSize = height * RESPONSIVE.titleSize;
  const bodySize = height * RESPONSIVE.bodySize;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_remotion3.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.12,
          left: "50%",
          transform: `translateX(-50%) translateY(${(0, import_remotion3.interpolate)(text1Progress, [0, 1], [30, 0], { extrapolateRight: "clamp" })}px)`,
          opacity: text1Progress,
          textAlign: "center",
          width: width * 0.85
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "div",
            {
              style: {
                fontSize: titleSize * 0.8,
                fontWeight: 700,
                color: COLORS.sparkWhite,
                lineHeight: 1.2,
                textShadow: `0 2px 20px ${COLORS.grayDark}`
              },
              children: "Everyone wants to start"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "div",
            {
              style: {
                fontSize: titleSize,
                fontWeight: 800,
                color: COLORS.orangeWarm,
                lineHeight: 1.2,
                marginTop: 10
              },
              children: "creating content"
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          left: cageX - cageWidth / 2,
          top: cageY - cageHeight / 2,
          width: cageWidth,
          height: cageHeight,
          opacity: entranceProgress,
          transform: `scale(${(0, import_remotion3.interpolate)(entranceProgress, [0, 1], [0.8, 1], { extrapolateRight: "clamp" })})`
        },
        children: [
          [0, 0.2, 0.4, 0.6, 0.8, 1].map((pos, i) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            CageBar,
            {
              x: cageWidth * pos - barThickness / 2,
              y: 0,
              width: barThickness,
              height: cageHeight,
              crackAmount: i === 2 || i === 3 ? crackProgress * 5 : 0
            },
            `v-${i}`
          )),
          [0, 0.5, 1].map((pos, i) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            CageBar,
            {
              x: 0,
              y: cageHeight * pos - barThickness / 2,
              width: cageWidth,
              height: barThickness,
              crackAmount: i === 1 ? crackProgress * 3 : 0
            },
            `h-${i}`
          )),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            CreativeSpark,
            {
              x: cageWidth / 2 + sparkXOffset,
              y: cageHeight / 2 + sparkYOffset,
              size: 35 * sparkScale,
              color: sparkColor,
              glowIntensity: 1 + frustrationProgress * 0.5
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.65,
          left: "50%",
          transform: `translateX(-50%) translateY(${(0, import_remotion3.interpolate)(text2Progress, [0, 1], [30, 0], { extrapolateRight: "clamp" })}px)`,
          opacity: text2Progress,
          textAlign: "center",
          width: width * 0.8
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "div",
            {
              style: {
                fontSize: bodySize,
                fontWeight: 600,
                color: COLORS.grayLight,
                lineHeight: 1.4
              },
              children: "but editing"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "div",
            {
              style: {
                fontSize: titleSize * 0.9,
                fontWeight: 800,
                color: COLORS.blueMuted,
                lineHeight: 1.2,
                marginTop: 8
              },
              children: "stops most people"
            }
          )
        ]
      }
    ),
    frustrationProgress > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_jsx_runtime3.Fragment, { children: [0, 1, 2, 3].map((i) => {
      const impactFrame = (localFrame + i * 15) % 60;
      const impactOpacity = (0, import_remotion3.interpolate)(
        impactFrame,
        [0, 5, 15],
        [0, 0.8, 0],
        { extrapolateRight: "clamp" }
      );
      const angle = i * 90 + 45;
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: cageX + sparkXOffset,
            top: cageY + sparkYOffset,
            width: 40,
            height: 4,
            backgroundColor: sparkColor,
            opacity: impactOpacity * frustrationProgress,
            transform: `translate(-50%, -50%) rotate(${angle}deg) translateX(50px)`,
            borderRadius: 2,
            boxShadow: `0 0 10px ${sparkColor}`
          }
        },
        `impact-${i}`
      );
    }) })
  ] });
};

// src/proj_25794cd2_ac8d_45ea_928a_fb396f4e0e47/scenes/Scene2.tsx
var import_remotion4 = require("remotion");
var import_jsx_runtime4 = require("react/jsx-runtime");
var CageShard = ({ index, progress, originX, originY }) => {
  const angle = index * 45 + 22.5;
  const distance = 200 + index % 3 * 100;
  const rotation = index * 90 + progress * 360;
  const x = originX + progress * distance * Math.cos(angle * Math.PI / 180);
  const y = originY + progress * distance * Math.sin(angle * Math.PI / 180);
  const opacity = (0, import_remotion4.interpolate)(progress, [0, 0.3, 1], [1, 0.8, 0], { extrapolateRight: "clamp" });
  const scale = (0, import_remotion4.interpolate)(progress, [0, 1], [1, 0.3], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        width: 20 + index % 3 * 10,
        height: 8,
        backgroundColor: COLORS.grayMedium,
        opacity,
        transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`,
        borderRadius: 2
      }
    }
  );
};
var EnergyParticle = ({ index, progress, centerX, centerY, color }) => {
  const angle = index * 36;
  const startRadius = 50;
  const endRadius = 400;
  const radius = startRadius + progress * (endRadius - startRadius);
  const x = centerX + radius * Math.cos(angle * Math.PI / 180);
  const y = centerY + radius * Math.sin(angle * Math.PI / 180);
  const opacity = (0, import_remotion4.interpolate)(progress, [0, 0.2, 0.8, 1], [0, 1, 0.8, 0], { extrapolateRight: "clamp" });
  const size = (0, import_remotion4.interpolate)(progress, [0, 0.5, 1], [5, 15, 8], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: "50%",
        opacity,
        transform: "translate(-50%, -50%)",
        boxShadow: `0 0 ${size * 2}px ${color}`
      }
    }
  );
};
var Scene2 = ({ startFrame }) => {
  const frame = (0, import_remotion4.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion4.useVideoConfig)();
  const localFrame = frame - startFrame;
  const keySyncLocal = TIMING.scene2KeySync - TIMING.scene2Start;
  const shatterTrigger = localFrame >= 5 ? localFrame - 5 : 0;
  const shatterProgress = (0, import_remotion4.spring)({
    frame: shatterTrigger,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 150 }
  });
  const logoTrigger = localFrame >= keySyncLocal - TIMING.scene2Start ? localFrame - (keySyncLocal - TIMING.scene2Start) : 0;
  const logoProgress = (0, import_remotion4.spring)({
    frame: logoTrigger,
    fps,
    config: SPRING_CONFIG
  });
  const energyProgress = (0, import_remotion4.interpolate)(
    localFrame,
    [10, 60],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const textProgress = (0, import_remotion4.spring)({
    frame: localFrame - 15,
    fps,
    config: SPRING_CONFIG
  });
  const centerX = width / 2;
  const centerY = height * 0.35;
  const titleSize = height * RESPONSIVE.titleSize;
  const sparkSize = (0, import_remotion4.interpolate)(shatterProgress, [0, 1], [35, 60], { extrapolateRight: "clamp" });
  const sparkGlow = (0, import_remotion4.interpolate)(shatterProgress, [0, 1], [1, 2.5], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_remotion4.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.12,
          left: "50%",
          transform: `translateX(-50%) translateY(${(0, import_remotion4.interpolate)(textProgress, [0, 1], [20, 0], { extrapolateRight: "clamp" })}px)`,
          opacity: textProgress,
          textAlign: "center",
          width: width * 0.8
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "div",
          {
            style: {
              fontSize: titleSize * 0.7,
              fontWeight: 600,
              color: COLORS.sparkWhite,
              lineHeight: 1.3
            },
            children: "That's where"
          }
        )
      }
    ),
    shatterProgress > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_jsx_runtime4.Fragment, { children: Array.from({ length: 12 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      CageShard,
      {
        index: i,
        progress: shatterProgress,
        originX: centerX,
        originY: centerY
      },
      `shard-${i}`
    )) }),
    energyProgress > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_jsx_runtime4.Fragment, { children: Array.from({ length: 10 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      EnergyParticle,
      {
        index: i,
        progress: energyProgress,
        centerX,
        centerY,
        color: i % 2 === 0 ? COLORS.orangeWarm : COLORS.yellowBright
      },
      `energy-${i}`
    )) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      CreativeSpark,
      {
        x: centerX,
        y: centerY,
        size: sparkSize,
        color: COLORS.orangeWarm,
        glowIntensity: sparkGlow,
        opacity: 1
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.5,
          left: "50%",
          transform: `translateX(-50%) scale(${(0, import_remotion4.interpolate)(logoProgress, [0, 1], [0.5, 1], { extrapolateRight: "clamp" })})`,
          opacity: logoProgress,
          textAlign: "center"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "div",
            {
              style: {
                fontSize: titleSize * 1.4,
                fontWeight: 900,
                background: `linear-gradient(135deg, ${COLORS.orangeWarm} 0%, ${COLORS.yellowBright} 50%, ${COLORS.orangeDeep} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                textShadow: "none",
                filter: `drop-shadow(0 0 30px ${COLORS.orangeWarm}80)`,
                letterSpacing: "-0.02em"
              },
              children: "Clipify"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "div",
            {
              style: {
                fontSize: titleSize * 0.5,
                fontWeight: 600,
                color: COLORS.sparkWhite,
                marginTop: 15,
                opacity: 0.9
              },
              children: "comes in"
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: centerX,
          top: height * 0.55,
          transform: "translate(-50%, -50%)",
          width: 400 * logoProgress,
          height: 400 * logoProgress,
          background: `radial-gradient(circle, ${COLORS.orangeWarm}40 0%, ${COLORS.yellowBright}20 40%, transparent 70%)`,
          borderRadius: "50%",
          pointerEvents: "none"
        }
      }
    ),
    logoProgress > 0.5 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_jsx_runtime4.Fragment, { children: [
      { x: -120, y: -40, delay: 0 },
      { x: 130, y: -30, delay: 6 },
      { x: -100, y: 50, delay: 12 },
      { x: 110, y: 60, delay: 18 }
    ].map((sparkle, i) => {
      const sparkleProgress = (0, import_remotion4.spring)({
        frame: localFrame - keySyncLocal + TIMING.scene2Start - sparkle.delay,
        fps,
        config: { ...SPRING_CONFIG, stiffness: 120 }
      });
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: centerX + sparkle.x,
            top: height * 0.55 + sparkle.y,
            width: 8,
            height: 8,
            backgroundColor: COLORS.sparkWhite,
            borderRadius: "50%",
            opacity: sparkleProgress * 0.8,
            transform: `scale(${sparkleProgress})`,
            boxShadow: `0 0 10px ${COLORS.sparkWhite}`
          }
        },
        `sparkle-${i}`
      );
    }) })
  ] });
};

// src/proj_25794cd2_ac8d_45ea_928a_fb396f4e0e47/scenes/Scene3.tsx
var import_remotion5 = require("remotion");
var import_jsx_runtime5 = require("react/jsx-runtime");
var MouseCursor = ({ x, y, clicking, opacity }) => {
  const scale = clicking ? 0.85 : 1;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        zIndex: 100,
        pointerEvents: "none"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("svg", { width: "32", height: "40", viewBox: "0 0 24 30", fill: "none", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "path",
          {
            d: "M2 2L2 24L8 18L13 28L17 26L12 16L20 16L2 2Z",
            fill: COLORS.sparkWhite,
            stroke: COLORS.backgroundDark,
            strokeWidth: "2",
            strokeLinejoin: "round"
          }
        ) }),
        clicking && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: 0,
              top: 0,
              width: 30,
              height: 30,
              borderRadius: "50%",
              border: `3px solid ${COLORS.cyanBright}`,
              opacity: 0.8,
              transform: "translate(-10px, -10px)"
            }
          }
        )
      ]
    }
  );
};
var UploadButton = ({ x, y, width, height, hovered, clicked, progress }) => {
  const scale = clicked ? 0.95 : hovered ? 1.02 : 1;
  const glowOpacity = hovered ? 0.6 : 0.3;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        transform: `translate(-50%, -50%) scale(${scale * progress})`,
        opacity: progress
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: width * 1.2,
              height: height * 1.4,
              background: `radial-gradient(ellipse, ${COLORS.orangeWarm}${Math.round(glowOpacity * 100).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
              borderRadius: 30,
              filter: "blur(15px)"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
          "div",
          {
            style: {
              width: "100%",
              height: "100%",
              background: `linear-gradient(135deg, ${COLORS.orangeWarm} 0%, ${COLORS.orangeDeep} 100%)`,
              borderRadius: 20,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              boxShadow: `0 8px 30px ${COLORS.orangeWarm}50, inset 0 2px 0 rgba(255,255,255,0.2)`,
              border: `3px solid ${hovered ? COLORS.sparkWhite : COLORS.orangeWarm}40`
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", flexDirection: "column", alignItems: "center" }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "div",
                  {
                    style: {
                      width: 0,
                      height: 0,
                      borderLeft: "20px solid transparent",
                      borderRight: "20px solid transparent",
                      borderBottom: `28px solid ${COLORS.sparkWhite}`
                    }
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "div",
                  {
                    style: {
                      width: 16,
                      height: 20,
                      backgroundColor: COLORS.sparkWhite,
                      marginTop: -8
                    }
                  }
                )
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                "div",
                {
                  style: {
                    fontSize: 28,
                    fontWeight: 700,
                    color: COLORS.sparkWhite,
                    textShadow: "0 2px 8px rgba(0,0,0,0.3)"
                  },
                  children: "Upload Video"
                }
              )
            ]
          }
        )
      ]
    }
  );
};
var VideoPreview = ({ x, y, width, height, uploadProgress, appearProgress, isAnimating, animationIntensity, localFrame }) => {
  const shimmerOffset = localFrame * 3 % 150;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        transform: `translate(-50%, -50%) scale(${appearProgress})`,
        opacity: appearProgress
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
        "div",
        {
          style: {
            width: "100%",
            height: "100%",
            backgroundColor: COLORS.backgroundMid,
            borderRadius: 16,
            overflow: "hidden",
            border: `3px solid ${isAnimating ? COLORS.magentaVibrant : COLORS.grayMedium}`,
            boxShadow: isAnimating ? `0 0 40px ${COLORS.magentaVibrant}60, 0 8px 30px rgba(0,0,0,0.4)` : "0 8px 30px rgba(0,0,0,0.4)",
            position: "relative"
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
              "div",
              {
                style: {
                  width: "100%",
                  height: "100%",
                  background: `linear-gradient(135deg, ${COLORS.grayDark} 0%, ${COLORS.backgroundMid} 100%)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  overflow: "hidden"
                },
                children: [
                  uploadProgress < 1 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                    "div",
                    {
                      style: {
                        position: "absolute",
                        top: 0,
                        left: `${shimmerOffset - 50}%`,
                        width: "50%",
                        height: "100%",
                        background: `linear-gradient(90deg, transparent 0%, ${COLORS.grayMedium}30 50%, transparent 100%)`
                      }
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                    "div",
                    {
                      style: {
                        width: 70,
                        height: 70,
                        backgroundColor: `${COLORS.sparkWhite}20`,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: `3px solid ${COLORS.sparkWhite}40`
                      },
                      children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                        "div",
                        {
                          style: {
                            width: 0,
                            height: 0,
                            borderTop: "18px solid transparent",
                            borderBottom: "18px solid transparent",
                            borderLeft: `30px solid ${COLORS.sparkWhite}80`,
                            marginLeft: 6
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
                        bottom: 55,
                        left: "50%",
                        transform: "translateX(-50%)",
                        backgroundColor: `${COLORS.backgroundDark}D0`,
                        padding: "8px 16px",
                        borderRadius: 8,
                        fontSize: 18,
                        fontWeight: 600,
                        color: COLORS.grayLight
                      },
                      children: "my_video.mp4"
                    }
                  )
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "div",
              {
                style: {
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 8,
                  backgroundColor: COLORS.grayDark
                },
                children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "div",
                  {
                    style: {
                      height: "100%",
                      width: `${uploadProgress * 100}%`,
                      background: uploadProgress < 1 ? `linear-gradient(90deg, ${COLORS.orangeWarm} 0%, ${COLORS.yellowBright} 100%)` : `linear-gradient(90deg, ${COLORS.magentaVibrant} 0%, ${COLORS.cyanBright} 100%)`,
                      borderRadius: uploadProgress >= 1 ? 0 : "0 4px 4px 0"
                    }
                  }
                )
              }
            ),
            uploadProgress < 1 && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
              "div",
              {
                style: {
                  position: "absolute",
                  bottom: 20,
                  left: "50%",
                  transform: "translateX(-50%)",
                  fontSize: 20,
                  fontWeight: 700,
                  color: COLORS.orangeWarm
                },
                children: [
                  Math.round(uploadProgress * 100),
                  "%"
                ]
              }
            ),
            isAnimating && animationIntensity > 0.2 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "div",
              {
                style: {
                  position: "absolute",
                  bottom: 20,
                  left: "50%",
                  transform: "translateX(-50%)",
                  fontSize: 22,
                  fontWeight: 700,
                  background: `linear-gradient(90deg, ${COLORS.magentaVibrant} 0%, ${COLORS.cyanBright} 100%)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  opacity: animationIntensity
                },
                children: "Adding magic..."
              }
            )
          ]
        }
      )
    }
  );
};
var MotionGraphicElement = ({ type, originX, originY, targetX, targetY, size, color, delay, localFrame, fps, label }) => {
  const triggerFrame = Math.max(0, localFrame - delay);
  const burstProgress = (0, import_remotion5.spring)({
    frame: triggerFrame,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 100 }
  });
  const floatPhase = triggerFrame % 50 / 50;
  const floatOffset = burstProgress > 0.8 ? (0, import_remotion5.interpolate)(floatPhase, [0, 0.5, 1], [0, -6, 0], { extrapolateRight: "clamp" }) : 0;
  const currentX = (0, import_remotion5.interpolate)(burstProgress, [0, 1], [originX, targetX], { extrapolateRight: "clamp" });
  const currentY = (0, import_remotion5.interpolate)(burstProgress, [0, 1], [originY, targetY + floatOffset], { extrapolateRight: "clamp" });
  const scale = (0, import_remotion5.interpolate)(burstProgress, [0, 0.3, 1], [0, 1.3, 1], { extrapolateRight: "clamp" });
  const opacity = (0, import_remotion5.interpolate)(burstProgress, [0, 0.1, 1], [0, 1, 1], { extrapolateRight: "clamp" });
  const rotation = (0, import_remotion5.interpolate)(burstProgress, [0, 1], [0, type === "square" ? 45 : 0], { extrapolateRight: "clamp" });
  const baseStyle = {
    position: "absolute",
    left: currentX,
    top: currentY,
    transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg)`,
    opacity
  };
  switch (type) {
    case "circle":
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "div",
        {
          style: {
            ...baseStyle,
            width: size,
            height: size,
            borderRadius: "50%",
            backgroundColor: color,
            boxShadow: `0 0 ${size}px ${color}80`
          }
        }
      );
    case "square":
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "div",
        {
          style: {
            ...baseStyle,
            width: size,
            height: size,
            backgroundColor: color,
            borderRadius: size * 0.15,
            boxShadow: `0 0 ${size / 2}px ${color}60`
          }
        }
      );
    case "triangle":
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "div",
        {
          style: {
            ...baseStyle,
            width: 0,
            height: 0,
            borderLeft: `${size / 2}px solid transparent`,
            borderRight: `${size / 2}px solid transparent`,
            borderBottom: `${size}px solid ${color}`,
            backgroundColor: "transparent",
            filter: `drop-shadow(0 0 ${size / 3}px ${color})`
          }
        }
      );
    case "line":
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "div",
        {
          style: {
            ...baseStyle,
            width: size * 2.5,
            height: 5,
            backgroundColor: color,
            borderRadius: 3,
            boxShadow: `0 0 12px ${color}`
          }
        }
      );
    case "star":
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "div",
        {
          style: {
            ...baseStyle,
            width: size,
            height: size,
            backgroundColor: color,
            clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
            boxShadow: `0 0 ${size}px ${color}`
          }
        }
      );
    case "text":
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "div",
        {
          style: {
            ...baseStyle,
            fontSize: size,
            fontWeight: 800,
            color: COLORS.sparkWhite,
            textShadow: `0 0 20px ${color}, 0 0 40px ${color}80`,
            whiteSpace: "nowrap"
          },
          children: label || "TITLE"
        }
      );
    default:
      return null;
  }
};
var EnergyBurst = ({ x, y, progress }) => {
  const size = (0, import_remotion5.interpolate)(progress, [0, 0.5, 1], [0, 400, 500], { extrapolateRight: "clamp" });
  const opacity = (0, import_remotion5.interpolate)(progress, [0, 0.2, 0.6, 1], [0, 0.8, 0.4, 0], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        transform: "translate(-50%, -50%)",
        background: `radial-gradient(circle, ${COLORS.magentaVibrant}80 0%, ${COLORS.cyanBright}40 40%, transparent 70%)`,
        borderRadius: "50%",
        opacity,
        pointerEvents: "none"
      }
    }
  );
};
var Scene3 = ({ startFrame }) => {
  const frame = (0, import_remotion5.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion5.useVideoConfig)();
  const localFrame = frame - startFrame;
  const keySyncLocal = TIMING.scene3KeySync - TIMING.scene3Start;
  const buttonProgress = (0, import_remotion5.spring)({
    frame: localFrame,
    fps,
    config: SPRING_CONFIG
  });
  const cursorStartX = width * 0.15;
  const cursorStartY = height * 0.15;
  const buttonX = width / 2;
  const buttonY = height * 0.22;
  const cursorMoveProgress = (0, import_remotion5.interpolate)(localFrame, [5, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cursorX = (0, import_remotion5.interpolate)(cursorMoveProgress, [0, 1], [cursorStartX, buttonX + 30], { extrapolateRight: "clamp" });
  const cursorY = (0, import_remotion5.interpolate)(cursorMoveProgress, [0, 1], [cursorStartY, buttonY + 20], { extrapolateRight: "clamp" });
  const isClicking = localFrame >= 32 && localFrame < 38;
  const cursorOpacity = (0, import_remotion5.interpolate)(localFrame, [0, 8, 45, 55], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const buttonVisible = localFrame < 45;
  const buttonHovered = localFrame >= 25;
  const buttonClicked = localFrame >= 32 && localFrame < 38;
  const videoAppearProgress = (0, import_remotion5.spring)({
    frame: Math.max(0, localFrame - 42),
    fps,
    config: SPRING_CONFIG
  });
  const uploadProgress = (0, import_remotion5.interpolate)(localFrame, [50, 95], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const animationStartFrame = Math.max(keySyncLocal - 10, 98);
  const isAnimating = localFrame >= animationStartFrame;
  const animationIntensity = (0, import_remotion5.interpolate)(localFrame, [animationStartFrame, animationStartFrame + 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const burstProgress = (0, import_remotion5.interpolate)(localFrame, [animationStartFrame, animationStartFrame + 35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleSize = height * RESPONSIVE.titleSize;
  const centerX = width / 2;
  const videoY = height * 0.38;
  const videoWidth = width * 0.7;
  const videoHeight = height * 0.28;
  const motionGraphics = [
    // First wave - geometric shapes bursting outward
    { type: "circle", targetX: width * 0.15, targetY: height * 0.25, size: 45, color: COLORS.magentaVibrant, delay: animationStartFrame },
    { type: "square", targetX: width * 0.85, targetY: height * 0.28, size: 38, color: COLORS.cyanBright, delay: animationStartFrame + 4 },
    { type: "triangle", targetX: width * 0.12, targetY: height * 0.48, size: 35, color: COLORS.pinkHot, delay: animationStartFrame + 8 },
    { type: "star", targetX: width * 0.88, targetY: height * 0.45, size: 40, color: COLORS.yellowBright, delay: animationStartFrame + 12 },
    // Second wave - text animations
    { type: "text", targetX: width * 0.22, targetY: height * 0.58, size: 26, color: COLORS.magentaVibrant, delay: animationStartFrame + 16, label: "WOW" },
    { type: "line", targetX: width * 0.78, targetY: height * 0.55, size: 25, color: COLORS.cyanBright, delay: animationStartFrame + 20 },
    // Third wave - more shapes
    { type: "circle", targetX: width * 0.25, targetY: height * 0.32, size: 28, color: COLORS.purpleDeep, delay: animationStartFrame + 24 },
    { type: "square", targetX: width * 0.75, targetY: height * 0.58, size: 32, color: COLORS.orangeWarm, delay: animationStartFrame + 28 },
    { type: "triangle", targetX: width * 0.9, targetY: height * 0.32, size: 30, color: COLORS.electricGreen, delay: animationStartFrame + 32 },
    { type: "star", targetX: width * 0.1, targetY: height * 0.38, size: 35, color: COLORS.cyanBright, delay: animationStartFrame + 36 },
    // Fourth wave - accent elements
    { type: "line", targetX: width * 0.3, targetY: height * 0.62, size: 20, color: COLORS.pinkHot, delay: animationStartFrame + 40 },
    { type: "circle", targetX: width * 0.7, targetY: height * 0.22, size: 22, color: COLORS.magentaVibrant, delay: animationStartFrame + 44 },
    { type: "text", targetX: width * 0.78, targetY: height * 0.62, size: 22, color: COLORS.cyanBright, delay: animationStartFrame + 48, label: "PRO" }
  ];
  const topTextProgress = (0, import_remotion5.spring)({
    frame: localFrame - 5,
    fps,
    config: SPRING_CONFIG
  });
  const bottomTextProgress = (0, import_remotion5.spring)({
    frame: Math.max(0, localFrame - animationStartFrame - 10),
    fps,
    config: SPRING_CONFIG
  });
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_remotion5.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.05,
          left: "50%",
          transform: `translateX(-50%) translateY(${(0, import_remotion5.interpolate)(topTextProgress, [0, 1], [20, 0], { extrapolateRight: "clamp" })}px)`,
          opacity: topTextProgress,
          textAlign: "center",
          width: width * 0.9
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              fontSize: titleSize * 0.6,
              fontWeight: 600,
              color: COLORS.sparkWhite,
              lineHeight: 1.3
            },
            children: "Just upload your video"
          }
        )
      }
    ),
    buttonVisible && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      UploadButton,
      {
        x: buttonX,
        y: buttonY,
        width: width * 0.55,
        height: height * 0.12,
        hovered: buttonHovered,
        clicked: buttonClicked,
        progress: buttonProgress
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      MouseCursor,
      {
        x: cursorX,
        y: cursorY,
        clicking: isClicking,
        opacity: cursorOpacity
      }
    ),
    localFrame >= 42 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      VideoPreview,
      {
        x: centerX,
        y: videoY,
        width: videoWidth,
        height: videoHeight,
        uploadProgress,
        appearProgress: videoAppearProgress,
        isAnimating,
        animationIntensity,
        localFrame
      }
    ),
    burstProgress > 0 && burstProgress < 1 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      EnergyBurst,
      {
        x: centerX,
        y: videoY,
        progress: burstProgress
      }
    ),
    motionGraphics.map((mg, i) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      MotionGraphicElement,
      {
        type: mg.type,
        originX: centerX,
        originY: videoY,
        targetX: mg.targetX,
        targetY: mg.targetY,
        size: mg.size,
        color: mg.color,
        delay: mg.delay,
        localFrame,
        fps,
        label: "label" in mg ? mg.label : void 0
      },
      `mg-${i}`
    )),
    isAnimating && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_jsx_runtime5.Fragment, { children: Array.from({ length: 12 }).map((_, i) => {
      const particleDelay = animationStartFrame + i * 5;
      const particleProgress = (0, import_remotion5.interpolate)(
        localFrame - particleDelay,
        [0, 40],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      );
      if (particleProgress <= 0) return null;
      const angle = i * 30;
      const distance = 80 + particleProgress * 200;
      const px = centerX + distance * Math.cos(angle * Math.PI / 180);
      const py = videoY + distance * 0.6 * Math.sin(angle * Math.PI / 180);
      const sparkleOpacity = (0, import_remotion5.interpolate)(particleProgress, [0, 0.2, 0.7, 1], [0, 1, 0.8, 0], { extrapolateRight: "clamp" });
      const colors = [COLORS.magentaVibrant, COLORS.cyanBright, COLORS.pinkHot, COLORS.sparkWhite];
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: px,
            top: py,
            width: 7,
            height: 7,
            borderRadius: "50%",
            backgroundColor: colors[i % colors.length],
            opacity: sparkleOpacity,
            transform: "translate(-50%, -50%)",
            boxShadow: `0 0 12px ${colors[i % colors.length]}`
          }
        },
        `particle-${i}`
      );
    }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.72,
          left: "50%",
          transform: `translateX(-50%) translateY(${(0, import_remotion5.interpolate)(bottomTextProgress, [0, 1], [30, 0], { extrapolateRight: "clamp" })}px)`,
          opacity: bottomTextProgress,
          textAlign: "center",
          width: width * 0.85
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "div",
            {
              style: {
                fontSize: titleSize * 0.55,
                fontWeight: 600,
                color: COLORS.sparkWhite,
                lineHeight: 1.4
              },
              children: "and we automatically add"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "div",
            {
              style: {
                fontSize: titleSize * 0.85,
                fontWeight: 800,
                background: `linear-gradient(135deg, ${COLORS.magentaVibrant} 0%, ${COLORS.cyanBright} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                marginTop: 10
              },
              children: "beautiful motion graphics"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "div",
            {
              style: {
                fontSize: titleSize * 0.45,
                fontWeight: 600,
                color: COLORS.grayLight,
                marginTop: 12,
                opacity: 0.9
              },
              children: "that make your content look professional"
            }
          )
        ]
      }
    )
  ] });
};

// src/proj_25794cd2_ac8d_45ea_928a_fb396f4e0e47/scenes/Scene4.tsx
var import_react = __toESM(require("react"));
var import_remotion6 = require("remotion");
var import_jsx_runtime6 = require("react/jsx-runtime");
var ExplosionShard = ({ originX, originY, index, progress, intensity, color }) => {
  const baseAngle = index * (360 / (12 + intensity * 4)) + index * 7;
  const angle = baseAngle + Math.random() * 1e-3 * index;
  const baseDistance = 150 + intensity * 80;
  const distance = baseDistance + index % 5 * 50;
  const xProgress = progress;
  const yProgress = progress + progress * progress * 0.3;
  const x = originX + xProgress * distance * Math.cos(angle * Math.PI / 180);
  const y = originY + yProgress * distance * 0.8 * Math.sin(angle * Math.PI / 180);
  const opacity = (0, import_remotion6.interpolate)(progress, [0, 0.1, 0.7, 1], [1, 1, 0.6, 0], { extrapolateRight: "clamp" });
  const rotation = progress * (300 + index * 40);
  const scale = (0, import_remotion6.interpolate)(progress, [0, 0.2, 1], [1, 1.2, 0.3], { extrapolateRight: "clamp" });
  const shardWidth = 15 + index % 4 * 8;
  const shardHeight = 6 + index % 3 * 4;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        width: shardWidth,
        height: shardHeight,
        backgroundColor: color,
        opacity,
        transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`,
        borderRadius: 2,
        boxShadow: `0 0 ${10 + intensity * 5}px ${color}`
      }
    }
  );
};
var ImpactFlash = ({ progress, intensity, color }) => {
  const flashOpacity = (0, import_remotion6.interpolate)(progress, [0, 0.05, 0.15, 0.4], [0, 0.3 + intensity * 0.15, 0.1, 0], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        backgroundColor: color,
        opacity: flashOpacity,
        pointerEvents: "none",
        zIndex: 100
      }
    }
  );
};
var EnergyWave = ({ progress, y, width, height, intensity }) => {
  const waveWidth = (0, import_remotion6.interpolate)(progress, [0, 1], [0, width * 2], { extrapolateRight: "clamp" });
  const waveOpacity = (0, import_remotion6.interpolate)(progress, [0, 0.1, 0.5, 1], [0, 0.8, 0.4, 0], { extrapolateRight: "clamp" });
  const waveHeight = 100 + intensity * 40;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: width / 2,
        top: y,
        width: waveWidth,
        height: waveHeight,
        transform: "translate(-50%, -50%)",
        background: `radial-gradient(ellipse at center,
          ${COLORS.electricGreen}${Math.round(waveOpacity * 80).toString(16).padStart(2, "0")} 0%,
          ${COLORS.cyanBright}${Math.round(waveOpacity * 50).toString(16).padStart(2, "0")} 40%,
          transparent 70%)`,
        opacity: waveOpacity,
        pointerEvents: "none",
        filter: `blur(${20 - intensity * 3}px)`
      }
    }
  );
};
var ExperienceBarrier = ({ scale, opacity }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    transform: `scale(${scale})`,
    opacity
  }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: {
    width: 70,
    height: 70,
    backgroundColor: COLORS.grayMedium,
    borderRadius: 8,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    border: `3px solid ${COLORS.grayLight}`,
    position: "relative"
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
      width: 35,
      height: 35,
      backgroundColor: COLORS.grayLight,
      clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)"
    } }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
      fontSize: 12,
      fontWeight: 700,
      color: COLORS.grayLight,
      marginTop: 4
    }, children: "PRO" }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
      position: "absolute",
      bottom: -20,
      display: "flex",
      gap: 3
    }, children: [0, 1, 2, 3, 4].map((i) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
      width: 8,
      height: 14 - i * 2,
      backgroundColor: i < 3 ? COLORS.orangeWarm : COLORS.grayDark,
      borderRadius: 2
    } }, i)) })
  ] }) });
};
var SoftwareBarrier = ({ scale, opacity }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    transform: `scale(${scale})`,
    opacity
  }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: {
    width: 120,
    height: 80,
    backgroundColor: COLORS.grayDark,
    borderRadius: 8,
    overflow: "hidden",
    border: `2px solid ${COLORS.grayMedium}`,
    display: "flex",
    flexDirection: "column"
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
      height: 14,
      backgroundColor: COLORS.grayMedium,
      display: "flex",
      alignItems: "center",
      padding: "0 6px",
      gap: 3
    }, children: [0, 1, 2].map((i) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
      width: 6,
      height: 6,
      borderRadius: "50%",
      backgroundColor: i === 0 ? "#E74C3C" : i === 1 ? "#F39C12" : "#27AE60"
    } }, i)) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
      flex: 1,
      padding: 4,
      display: "flex",
      flexDirection: "column",
      gap: 3
    }, children: [0, 1, 2, 3].map((i) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
      height: 10,
      display: "flex",
      gap: 2
    }, children: [0, 1, 2, 3].map((j) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
      width: 20 + j * i % 15,
      height: "100%",
      backgroundColor: [COLORS.magentaVibrant, COLORS.cyanBright, COLORS.orangeWarm, COLORS.purpleDeep][j % 4] + "60",
      borderRadius: 2
    } }, j)) }, i)) })
  ] }) });
};
var PriceBarrier = ({ scale, opacity }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    transform: `scale(${scale})`,
    opacity
  }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: {
    backgroundColor: "#E74C3C",
    padding: "12px 24px",
    borderRadius: 8,
    position: "relative",
    boxShadow: "0 4px 15px rgba(231, 76, 60, 0.4)"
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
      position: "absolute",
      left: -8,
      top: "50%",
      transform: "translateY(-50%)",
      width: 16,
      height: 16,
      backgroundColor: COLORS.backgroundDark,
      borderRadius: "50%",
      border: `3px solid #E74C3C`
    } }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
      fontSize: 32,
      fontWeight: 900,
      color: COLORS.sparkWhite,
      letterSpacing: "-0.02em"
    }, children: "$499" }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
      fontSize: 14,
      fontWeight: 600,
      color: COLORS.sparkWhite,
      opacity: 0.8,
      textAlign: "center"
    }, children: "/year" })
  ] }) });
};
var Barrier = ({ type, label, x, y, entranceDelay, shatterProgress, localFrame, fps, intensity, width, height }) => {
  const entranceProgress = (0, import_remotion6.spring)({
    frame: Math.max(0, localFrame - entranceDelay),
    fps,
    config: SPRING_CONFIG
  });
  const tensionProgress = (0, import_remotion6.interpolate)(shatterProgress, [0, 0.05], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const tensionScale = 1 + tensionProgress * 0.1;
  const shatterScale = shatterProgress > 0.05 ? (0, import_remotion6.interpolate)(shatterProgress, [0.05, 0.2], [1.1, 0], { extrapolateRight: "clamp" }) : 1;
  const shatterOpacity = shatterProgress > 0.05 ? (0, import_remotion6.interpolate)(shatterProgress, [0.05, 0.15], [1, 0], { extrapolateRight: "clamp" }) : 1;
  const shakeAmount = tensionProgress * 4;
  const shakeX = shatterProgress < 0.05 ? shakeAmount * Math.sin(localFrame * 2) : 0;
  const shakeY = shatterProgress < 0.05 ? shakeAmount * Math.cos(localFrame * 3) : 0;
  const finalScale = entranceProgress * tensionScale * shatterScale;
  const finalOpacity = entranceProgress * shatterOpacity;
  const renderBarrierIcon = () => {
    switch (type) {
      case "experience":
        return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(ExperienceBarrier, { scale: 1, opacity: 1 });
      case "software":
        return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(SoftwareBarrier, { scale: 1, opacity: 1 });
      case "price":
        return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(PriceBarrier, { scale: 1, opacity: 1 });
      default:
        return null;
    }
  };
  const shatterColors = {
    experience: [COLORS.orangeWarm, COLORS.yellowBright, COLORS.grayLight],
    software: [COLORS.magentaVibrant, COLORS.cyanBright, COLORS.grayMedium],
    price: ["#E74C3C", "#C0392B", COLORS.sparkWhite]
  };
  const colors = shatterColors[type];
  const shardCount = 12 + intensity * 6;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
    shatterOpacity > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: x + shakeX,
          top: y + shakeY,
          transform: `translate(-50%, -50%) scale(${finalScale})`,
          opacity: finalOpacity,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
          "div",
          {
            style: {
              backgroundColor: `${COLORS.grayDark}F0`,
              borderRadius: 20,
              padding: "24px 32px",
              border: `3px solid ${tensionProgress > 0 ? "#E74C3C" : COLORS.grayMedium}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              boxShadow: tensionProgress > 0 ? `0 0 ${30 * tensionProgress}px rgba(231, 76, 60, 0.6)` : "0 8px 30px rgba(0,0,0,0.4)",
              transition: "border-color 0.1s"
            },
            children: [
              renderBarrierIcon(),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                "div",
                {
                  style: {
                    fontSize: 24,
                    fontWeight: 700,
                    color: COLORS.sparkWhite,
                    textAlign: "center",
                    textShadow: "0 2px 8px rgba(0,0,0,0.5)"
                  },
                  children: label
                }
              )
            ]
          }
        )
      }
    ),
    shatterProgress > 0.05 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_jsx_runtime6.Fragment, { children: Array.from({ length: shardCount }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      ExplosionShard,
      {
        originX: x,
        originY: y,
        index: i,
        progress: (0, import_remotion6.interpolate)(shatterProgress, [0.05, 0.8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        intensity,
        color: colors[i % colors.length]
      },
      `shard-${i}`
    )) }),
    shatterProgress > 0 && shatterProgress < 0.4 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      ImpactFlash,
      {
        progress: shatterProgress,
        intensity,
        color: colors[0]
      }
    )
  ] });
};
var NoText = ({ progress, x, y, intensity, fps, localFrame }) => {
  const slamProgress = (0, import_remotion6.spring)({
    frame: Math.max(0, Math.round(progress * 30)),
    fps,
    config: { damping: 20, stiffness: 200, mass: 0.8 }
  });
  const scale = (0, import_remotion6.interpolate)(slamProgress, [0, 1], [3, 1], { extrapolateRight: "clamp" });
  const opacity = (0, import_remotion6.interpolate)(progress, [0, 0.1, 0.8, 1], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  const baseSize = 80 + intensity * 20;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity,
        fontSize: baseSize,
        fontWeight: 900,
        color: "#E74C3C",
        textShadow: `0 0 ${20 + intensity * 10}px rgba(231, 76, 60, 0.8), 0 0 ${40 + intensity * 20}px rgba(231, 76, 60, 0.4)`,
        letterSpacing: "-0.05em",
        zIndex: 50
      },
      children: "NO"
    }
  );
};
var ClearPath = ({ progress, width, height, localFrame }) => {
  const pathOpacity = (0, import_remotion6.interpolate)(progress, [0, 0.5, 1], [0, 0.3, 0.6], { extrapolateRight: "clamp" });
  const pathScale = (0, import_remotion6.interpolate)(progress, [0, 1], [0.5, 1], { extrapolateRight: "clamp" });
  const particleCount = 20;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: width / 2,
          top: height * 0.1,
          width: width * 0.15,
          height: height * 0.8,
          transform: `translateX(-50%) scaleY(${pathScale})`,
          background: `linear-gradient(180deg,
            transparent 0%,
            ${COLORS.electricGreen}${Math.round(pathOpacity * 50).toString(16).padStart(2, "0")} 20%,
            ${COLORS.cyanBright}${Math.round(pathOpacity * 60).toString(16).padStart(2, "0")} 50%,
            ${COLORS.electricGreen}${Math.round(pathOpacity * 50).toString(16).padStart(2, "0")} 80%,
            transparent 100%
          )`,
          opacity: pathOpacity,
          filter: "blur(30px)",
          pointerEvents: "none"
        }
      }
    ),
    progress > 0.3 && Array.from({ length: particleCount }).map((_, i) => {
      const particlePhase = (localFrame + i * 12) % 90 / 90;
      const baseX = width / 2 + (i % 2 === 0 ? -1 : 1) * (10 + i % 5 * 15);
      const startY = height * 0.85;
      const endY = height * 0.1;
      const currentY = (0, import_remotion6.interpolate)(particlePhase, [0, 1], [startY, endY], { extrapolateRight: "clamp" });
      const particleOpacity = (0, import_remotion6.interpolate)(particlePhase, [0, 0.1, 0.8, 1], [0, 0.8, 0.8, 0], { extrapolateRight: "clamp" }) * progress;
      const colors = [COLORS.electricGreen, COLORS.cyanBright, COLORS.neonCyan, COLORS.sparkWhite];
      return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: baseX,
            top: currentY,
            width: 6 + i % 3 * 2,
            height: 6 + i % 3 * 2,
            backgroundColor: colors[i % colors.length],
            borderRadius: "50%",
            opacity: particleOpacity,
            transform: "translate(-50%, -50%)",
            boxShadow: `0 0 12px ${colors[i % colors.length]}`
          }
        },
        `flow-${i}`
      );
    })
  ] });
};
var Scene4 = ({ startFrame }) => {
  const frame = (0, import_remotion6.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion6.useVideoConfig)();
  const localFrame = frame - startFrame;
  const noTimings = [33, 78, 126];
  const barriers = [
    {
      type: "experience",
      label: "Experience Required",
      y: height * 0.25,
      entranceDelay: 0,
      shatterFrame: noTimings[0],
      intensity: 1
    },
    {
      type: "software",
      label: "Complicated Software",
      y: height * 0.48,
      entranceDelay: 8,
      shatterFrame: noTimings[1],
      intensity: 2
    },
    {
      type: "price",
      label: "Expensive Cost",
      y: height * 0.71,
      entranceDelay: 16,
      shatterFrame: noTimings[2],
      intensity: 3
      // Most powerful
    }
  ];
  const titleProgress = (0, import_remotion6.spring)({
    frame: localFrame - 5,
    fps,
    config: SPRING_CONFIG
  });
  const clearPathProgress = (0, import_remotion6.interpolate)(
    localFrame,
    [noTimings[2] + 20, noTimings[2] + 60],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const subtitleProgress = (0, import_remotion6.spring)({
    frame: Math.max(0, localFrame - noTimings[2] - 40),
    fps,
    config: SPRING_CONFIG
  });
  const titleSize = height * RESPONSIVE.titleSize;
  const centerX = width / 2;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_remotion6.AbsoluteFill, { children: [
    clearPathProgress > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      ClearPath,
      {
        progress: clearPathProgress,
        width,
        height,
        localFrame
      }
    ),
    barriers.map((barrier, i) => {
      const shatterDuration = 45;
      const shatterProgress = (0, import_remotion6.interpolate)(
        localFrame,
        [barrier.shatterFrame, barrier.shatterFrame + shatterDuration],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      );
      const waveDelay = 10;
      const waveProgress = (0, import_remotion6.interpolate)(
        localFrame,
        [barrier.shatterFrame + waveDelay, barrier.shatterFrame + waveDelay + 35],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      );
      const noTextProgress = (0, import_remotion6.interpolate)(
        localFrame,
        [barrier.shatterFrame, barrier.shatterFrame + 40],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      );
      return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_react.default.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          Barrier,
          {
            type: barrier.type,
            label: barrier.label,
            x: centerX,
            y: barrier.y,
            entranceDelay: barrier.entranceDelay,
            shatterProgress,
            localFrame,
            fps,
            intensity: barrier.intensity,
            width,
            height
          }
        ),
        waveProgress > 0 && waveProgress < 1 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          EnergyWave,
          {
            progress: waveProgress,
            y: barrier.y,
            width,
            height,
            intensity: barrier.intensity
          }
        ),
        noTextProgress > 0 && noTextProgress < 1 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          NoText,
          {
            progress: noTextProgress,
            x: centerX,
            y: barrier.y,
            intensity: barrier.intensity,
            fps,
            localFrame
          }
        )
      ] }, `barrier-${i}`);
    }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.04,
          left: "50%",
          transform: `translateX(-50%) translateY(${(0, import_remotion6.interpolate)(titleProgress, [0, 1], [20, 0], { extrapolateRight: "clamp" })}px)`,
          opacity: titleProgress,
          textAlign: "center",
          width: width * 0.9,
          zIndex: 10
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "div",
          {
            style: {
              fontSize: titleSize * 0.7,
              fontWeight: 700,
              color: COLORS.grayLight,
              lineHeight: 1.3
            },
            children: "Traditional editing means..."
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.86,
          left: "50%",
          transform: `translateX(-50%) translateY(${(0, import_remotion6.interpolate)(subtitleProgress, [0, 1], [30, 0], { extrapolateRight: "clamp" })}px)`,
          opacity: subtitleProgress,
          textAlign: "center",
          width: width * 0.85,
          zIndex: 10
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "div",
          {
            style: {
              fontSize: titleSize * 0.9,
              fontWeight: 800,
              background: `linear-gradient(135deg, ${COLORS.electricBlue} 0%, ${COLORS.electricGreen} 50%, ${COLORS.neonCyan} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text"
            },
            children: "The path is clear."
          }
        )
      }
    ),
    barriers.map((barrier, i) => {
      const impactFrame = barrier.shatterFrame;
      const shakeProgress = (0, import_remotion6.interpolate)(
        localFrame,
        [impactFrame, impactFrame + 8],
        [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      );
      if (shakeProgress <= 0) return null;
      return null;
    })
  ] });
};

// src/proj_25794cd2_ac8d_45ea_928a_fb396f4e0e47/scenes/Scene5.tsx
var import_remotion7 = require("remotion");
var import_jsx_runtime7 = require("react/jsx-runtime");
var EnergyStream = ({ startX, startY, endX, endY, progress, color, width }) => {
  const currentX = startX + (endX - startX) * progress;
  const currentY = startY + (endY - startY) * progress;
  const trailProgress = Math.max(0, progress - 0.2);
  const trailX = startX + (endX - startX) * trailProgress;
  const trailY = startY + (endY - startY) * trailProgress;
  const opacity = (0, import_remotion7.interpolate)(progress, [0, 0.1, 0.8, 1], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: trailX,
          top: trailY,
          width: Math.sqrt(Math.pow(currentX - trailX, 2) + Math.pow(currentY - trailY, 2)),
          height: width,
          backgroundColor: color,
          opacity: opacity * 0.5,
          transform: `translate(0, -50%) rotate(${Math.atan2(currentY - trailY, currentX - trailX) * (180 / Math.PI)}deg)`,
          transformOrigin: "left center",
          borderRadius: width / 2,
          filter: `blur(${width / 2}px)`
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: currentX,
          top: currentY,
          width: width * 2,
          height: width * 2,
          backgroundColor: color,
          borderRadius: "50%",
          opacity,
          transform: "translate(-50%, -50%)",
          boxShadow: `0 0 ${width * 3}px ${color}`
        }
      }
    )
  ] });
};
var CTAButton = ({ x, y, width: btnWidth, height: btnHeight, progress, localFrame, fps }) => {
  const pulsePhase = localFrame % 30 / 30;
  const pulse = (0, import_remotion7.interpolate)(pulsePhase, [0, 0.5, 1], [1, 1.05, 1], { extrapolateRight: "clamp" });
  const scale = progress * pulse;
  const glowIntensity = (0, import_remotion7.interpolate)(pulsePhase, [0, 0.5, 1], [0.5, 1, 0.5], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity: progress
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: btnWidth * 1.3,
              height: btnHeight * 1.5,
              background: `radial-gradient(ellipse, ${COLORS.electricGreen}${Math.round(glowIntensity * 60).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
              borderRadius: btnHeight,
              filter: "blur(20px)"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            style: {
              width: btnWidth,
              height: btnHeight,
              background: `linear-gradient(135deg, ${COLORS.electricGreen} 0%, ${COLORS.electricBlue} 100%)`,
              borderRadius: btnHeight / 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `
            0 8px 30px ${COLORS.electricGreen}60,
            0 0 60px ${COLORS.electricBlue}40,
            inset 0 2px 0 rgba(255,255,255,0.2)
          `,
              border: `3px solid ${COLORS.sparkWhite}30`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
              "span",
              {
                style: {
                  fontSize: 42,
                  fontWeight: 900,
                  color: COLORS.sparkWhite,
                  textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                  letterSpacing: "-0.02em"
                },
                children: "Start Free Today"
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: 0,
              left: 0,
              width: btnWidth,
              height: btnHeight,
              borderRadius: btnHeight / 2,
              background: `linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.2) 50%, transparent 60%)`,
              backgroundSize: "200% 100%",
              backgroundPosition: `${-100 + pulsePhase * 300}% 0`,
              pointerEvents: "none"
            }
          }
        )
      ]
    }
  );
};
var Scene5 = ({ startFrame }) => {
  const frame = (0, import_remotion7.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion7.useVideoConfig)();
  const localFrame = frame - startFrame;
  const keySyncLocal = TIMING.scene5KeySync - TIMING.scene5Start;
  const sceneDuration = TIMING.scene5End - TIMING.scene5Start;
  const urgencyProgress = (0, import_remotion7.spring)({
    frame: localFrame - 10,
    fps,
    config: SPRING_CONFIG
  });
  const ctaProgress = (0, import_remotion7.spring)({
    frame: Math.max(0, localFrame - keySyncLocal + 50),
    fps,
    config: { ...SPRING_CONFIG, stiffness: 80 }
  });
  const brandProgress = (0, import_remotion7.spring)({
    frame: localFrame - keySyncLocal - 20,
    fps,
    config: SPRING_CONFIG
  });
  const titleSize = height * RESPONSIVE.titleSize;
  const centerX = width / 2;
  const ctaY = height * 0.55;
  const energyStreams = [
    { startX: 0, startY: height * 0.2, color: COLORS.electricBlue, delay: 0, width: 4 },
    { startX: width, startY: height * 0.3, color: COLORS.electricGreen, delay: 8, width: 5 },
    { startX: 0, startY: height * 0.5, color: COLORS.cyanBright, delay: 16, width: 3 },
    { startX: width, startY: height * 0.6, color: COLORS.magentaVibrant, delay: 24, width: 4 },
    { startX: 0, startY: height * 0.8, color: COLORS.electricGreen, delay: 32, width: 5 },
    { startX: width, startY: height * 0.9, color: COLORS.electricBlue, delay: 40, width: 3 },
    { startX: width * 0.2, startY: 0, color: COLORS.neonCyan, delay: 12, width: 4 },
    { startX: width * 0.8, startY: height, color: COLORS.pinkHot, delay: 28, width: 4 }
  ];
  const finalBurstProgress = (0, import_remotion7.interpolate)(
    localFrame,
    [sceneDuration - 30, sceneDuration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_remotion7.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.12,
          left: "50%",
          transform: `translateX(-50%) translateY(${(0, import_remotion7.interpolate)(urgencyProgress, [0, 1], [30, 0], { extrapolateRight: "clamp" })}px)`,
          opacity: urgencyProgress,
          textAlign: "center",
          width: width * 0.9
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            "div",
            {
              style: {
                fontSize: titleSize * 0.65,
                fontWeight: 600,
                color: COLORS.sparkWhite,
                lineHeight: 1.3
              },
              children: "Ready to create"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            "div",
            {
              style: {
                fontSize: titleSize,
                fontWeight: 900,
                background: `linear-gradient(135deg, ${COLORS.electricBlue} 0%, ${COLORS.electricGreen} 50%, ${COLORS.neonCyan} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                lineHeight: 1.2,
                marginTop: 8
              },
              children: "stunning content?"
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
          top: height * 0.35,
          left: "50%",
          transform: `translateX(-50%) scale(${urgencyProgress})`,
          opacity: urgencyProgress
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            style: {
              backgroundColor: COLORS.electricGreen,
              color: COLORS.backgroundDark,
              fontSize: 28,
              fontWeight: 800,
              padding: "12px 30px",
              borderRadius: 50,
              boxShadow: `0 4px 20px ${COLORS.electricGreen}60`
            },
            children: "100% FREE"
          }
        )
      }
    ),
    energyStreams.map((stream, i) => {
      const streamProgress = (0, import_remotion7.interpolate)(
        localFrame - stream.delay,
        [0, 60],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      );
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        EnergyStream,
        {
          startX: stream.startX,
          startY: stream.startY,
          endX: centerX,
          endY: ctaY,
          progress: streamProgress,
          color: stream.color,
          width: stream.width
        },
        `stream-${i}`
      );
    }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      CTAButton,
      {
        x: centerX,
        y: ctaY,
        width: width * 0.75,
        height: 100,
        progress: ctaProgress,
        localFrame,
        fps
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.68,
          left: "50%",
          transform: `translateX(-50%)`,
          opacity: ctaProgress,
          textAlign: "center"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            style: {
              fontSize: 26,
              fontWeight: 500,
              color: COLORS.grayLight
            },
            children: "No credit card required"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.85,
          left: "50%",
          transform: `translateX(-50%) translateY(${(0, import_remotion7.interpolate)(brandProgress, [0, 1], [20, 0], { extrapolateRight: "clamp" })}px)`,
          opacity: brandProgress,
          textAlign: "center"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            "div",
            {
              style: {
                fontSize: titleSize * 0.8,
                fontWeight: 900,
                background: `linear-gradient(135deg, ${COLORS.orangeWarm} 0%, ${COLORS.yellowBright} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text"
              },
              children: "Clipify"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            "div",
            {
              style: {
                fontSize: 20,
                fontWeight: 500,
                color: COLORS.grayLight,
                marginTop: 5
              },
              children: "Create. Captivate. Convert."
            }
          )
        ]
      }
    ),
    finalBurstProgress > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_jsx_runtime7.Fragment, { children: Array.from({ length: 20 }).map((_, i) => {
      const angle = i * 18;
      const distance = 50 + finalBurstProgress * 300;
      const x = centerX + distance * Math.cos(angle * Math.PI / 180);
      const y = ctaY + distance * 0.6 * Math.sin(angle * Math.PI / 180);
      const colors = [COLORS.electricGreen, COLORS.electricBlue, COLORS.neonCyan, COLORS.sparkWhite];
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: x,
            top: y,
            width: 8,
            height: 8,
            backgroundColor: colors[i % colors.length],
            borderRadius: "50%",
            opacity: (0, import_remotion7.interpolate)(finalBurstProgress, [0, 0.3, 1], [0, 1, 0], { extrapolateRight: "clamp" }),
            transform: "translate(-50%, -50%)",
            boxShadow: `0 0 15px ${colors[i % colors.length]}`
          }
        },
        `burst-${i}`
      );
    }) }),
    Array.from({ length: 6 }).map((_, i) => {
      const floatPhase = (localFrame + i * 30) % 90 / 90;
      const baseY = height * (0.3 + i % 3 * 0.2);
      const floatY = baseY + (0, import_remotion7.interpolate)(floatPhase, [0, 0.5, 1], [0, -15, 0], { extrapolateRight: "clamp" });
      const baseX = width * (0.15 + i % 4 * 0.2);
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: baseX,
            top: floatY,
            width: 6,
            height: 6,
            backgroundColor: i % 2 === 0 ? COLORS.electricBlue : COLORS.electricGreen,
            borderRadius: "50%",
            opacity: 0.4,
            boxShadow: `0 0 10px ${i % 2 === 0 ? COLORS.electricBlue : COLORS.electricGreen}`
          }
        },
        `ambient-${i}`
      );
    })
  ] });
};

// src/proj_25794cd2_ac8d_45ea_928a_fb396f4e0e47/index.tsx
var import_jsx_runtime8 = require("react/jsx-runtime");
var MainComposition = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_remotion8.AbsoluteFill, { style: { backgroundColor: COLORS.backgroundDark }, children: [
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  RemotionRoot
});
