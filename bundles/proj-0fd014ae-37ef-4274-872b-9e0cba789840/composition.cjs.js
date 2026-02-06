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

// src/proj_0fd014ae_37ef_4274_872b_9e0cba789840/index.tsx
var index_exports = {};
__export(index_exports, {
  RemotionRoot: () => RemotionRoot,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_remotion = require("remotion");
var import_three = require("@remotion/three");

// src/proj_0fd014ae_37ef_4274_872b_9e0cba789840/constants.ts
var COLORS = {
  // Primary: Cyan - for active elements, winners, highlights
  primary: "#00f5d4",
  // Secondary: Purple - for container, structure
  secondary: "#7b2cbf",
  // Accent: Magenta - for emphasis, algorithm actions
  accent: "#f72585",
  // Background: Dark
  background: "#0a0a0f",
  // Additional utility colors
  white: "#ffffff",
  warning: "#ff3333",
  success: "#4ade80",
  gold: "#ffd700"
};
var SPRING_CONFIG = { damping: 22, stiffness: 90, mass: 0.9 };
var VIDEO_CONFIG = {
  fps: 30,
  width: 1080,
  height: 1920,
  durationInFrames: 2340
  // ~78 seconds, covers all scenes
};
var TIMING = {
  // Scene 1: The Impossible Challenge
  scene1Start: 21,
  scene1End: 143,
  scene1KeySync: 129,
  // "millions"
  // Scene 2: The Memory Problem
  scene2Start: 146,
  scene2End: 466,
  scene2KeySync: 394,
  // "RAM"
  // Scene 3: The Fairness Challenge
  scene3Start: 472,
  scene3End: 829,
  scene3KeySync: 700,
  // "same"
  // Scene 4: Solution Revelation
  scene4Start: 835,
  scene4End: 965,
  scene4KeySync: 883,
  // "sampling"
  // Scene 5: The Algorithm Mechanism
  scene5Start: 973,
  scene5End: 1326,
  scene5KeySync: 1089,
  // "die"
  // Scene 6: Perfect Fairness Proof
  scene6Start: 1332,
  scene6End: 1606,
  scene6KeySync: 1547,
  // "probability"
  // Scene 7: The Extended Challenge
  scene7Start: 1616,
  scene7End: 2334,
  scene7KeySync: 1841
  // "five"
};
var LAYOUT = {
  safeMargin: 108,
  // 10% of 1080
  topSafeMargin: 192,
  // 10% of 1920
  maxContentWidth: 864,
  // 80% of 1080
  centerX: 540,
  // 50% of 1080
  centerY: 960,
  // 50% of 1920
  titleSize: 96,
  // 5% of 1920 height
  bodySize: 58,
  // 3% of 1920 height
  subtitleReserve: 288
  // Bottom 15% reserved for subtitles
};
var CONTAINER = {
  width: 648,
  // 60% of 1080
  height: 768,
  // 40% of 1920
  borderRadius: 24,
  borderWidth: 3
};

// src/proj_0fd014ae_37ef_4274_872b_9e0cba789840/index.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var AnimatedBackground = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height } = (0, import_remotion.useVideoConfig)();
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: { background: COLORS.background }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          width: "100%",
          height: "100%",
          background: `radial-gradient(ellipse at 50% 30%, ${COLORS.secondary}22 0%, transparent 60%)`
        }
      }
    ),
    Array.from({ length: 40 }).map((_, i) => {
      const baseX = i * 73 % width;
      const baseY = i * 127 % height;
      const speed = 0.3 + i % 5 * 0.15;
      const size = 3 + i % 4 * 2;
      const y = (baseY + frame * speed) % (height + 50) - 25;
      const x = baseX + Math.sin((frame + i * 20) * 0.015) * 30;
      const opacity = 0.1 + i % 3 * 0.1;
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
            background: i % 2 === 0 ? COLORS.primary : COLORS.accent,
            opacity,
            filter: `blur(${1 + i % 2}px)`
          }
        },
        `bg-particle-${i}`
      );
    })
  ] });
};
var GlassContainer = ({ x, y, width, height, glowColor = COLORS.secondary, cracked = false, crackProgress = 0 }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: x - width / 2,
        top: y - height / 2,
        width,
        height,
        background: "rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: `3px solid ${glowColor}66`,
        borderRadius: CONTAINER.borderRadius,
        boxShadow: `
          0 0 40px ${glowColor}33,
          inset 0 0 30px ${glowColor}11
        `,
        overflow: "hidden"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "30%",
              background: `linear-gradient(180deg, ${glowColor}22 0%, transparent 100%)`
            }
          }
        ),
        cracked && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "svg",
          {
            style: {
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              opacity: crackProgress
            },
            viewBox: "0 0 100 100",
            preserveAspectRatio: "none",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "path",
                {
                  d: "M50 0 L48 20 L55 35 L45 50 L52 70 L48 100",
                  stroke: COLORS.warning,
                  strokeWidth: "0.5",
                  fill: "none"
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "path",
                {
                  d: "M30 30 L45 50 L35 70",
                  stroke: COLORS.warning,
                  strokeWidth: "0.3",
                  fill: "none"
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "path",
                {
                  d: "M70 20 L55 35 L65 55",
                  stroke: COLORS.warning,
                  strokeWidth: "0.3",
                  fill: "none"
                }
              )
            ]
          }
        )
      ]
    }
  );
};
var CommentBall = ({ x, y, size, color, delay, glowing = false }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const scale = (0, import_remotion.spring)({
    frame: frame - delay,
    fps,
    config: { damping: 25, stiffness: 100, mass: 0.8 }
  });
  if (frame < delay) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle at 30% 30%, ${color}ee, ${color}88)`,
        transform: `scale(${scale})`,
        boxShadow: glowing ? `0 0 ${size}px ${color}, 0 0 ${size * 2}px ${color}66` : `0 0 ${size * 0.5}px ${color}66`
      }
    }
  );
};
var Counter = ({ target, startFrame, peakFrame, prefix = "", suffix = "" }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const value = Math.round(
    (0, import_remotion.interpolate)(frame, [startFrame, peakFrame], [0, target], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp"
    })
  );
  const opacity = (0, import_remotion.interpolate)(frame, [startFrame, startFrame + 15], [0, 1], {
    extrapolateRight: "clamp"
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "span",
    {
      style: {
        fontVariantNumeric: "tabular-nums",
        opacity,
        color: COLORS.white,
        fontSize: LAYOUT.bodySize,
        fontWeight: 700,
        fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif"
      },
      children: [
        prefix,
        value.toLocaleString(),
        suffix
      ]
    }
  );
};
var WarningIcon = ({
  size = 60,
  color = COLORS.warning
}) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
  "svg",
  {
    xmlns: "http://www.w3.org/2000/svg",
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "path",
      {
        fill: color,
        d: "M14.57 13.54L8.39 1.63c-.34-.67-1.43-.67-1.78 0L.43 13.54c-.16.31-.15.68.03.98s.51.48.86.48h12.36c.35 0 .67-.18.85-.48s.2-.67.04-.98M7 6c0-.28.22-.5.5-.5s.5.22.5.5v3.5c0 .28-.22.5-.5.5S7 9.78 7 9.5zm.5 7c-.55 0-1-.45-1-1s.45-1 1-1s1 .45 1 1s-.45 1-1 1"
      }
    )
  }
);
var CheckIcon = ({
  size = 60,
  color = COLORS.success
}) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
  "svg",
  {
    xmlns: "http://www.w3.org/2000/svg",
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "path",
      {
        fill: color,
        d: "m9 20.42l-6.21-6.21l2.83-2.83L9 14.77l9.88-9.89l2.83 2.83z"
      }
    )
  }
);
var UserIcon = ({
  size = 60,
  color = COLORS.primary
}) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
  "svg",
  {
    xmlns: "http://www.w3.org/2000/svg",
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "path",
      {
        fill: color,
        d: "M12 4a4 4 0 0 1 4 4a4 4 0 0 1-4 4a4 4 0 0 1-4-4a4 4 0 0 1 4-4m0 10c4.42 0 8 1.79 8 4v2H4v-2c0-2.21 3.58-4 8-4"
      }
    )
  }
);
var ScaleIcon = ({
  size = 60,
  color = COLORS.primary
}) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
  "svg",
  {
    xmlns: "http://www.w3.org/2000/svg",
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "g",
      {
        fill: "none",
        stroke: color,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: "2",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "path",
            {
              fill: color,
              d: "M12 3v18m7-13l3 8a5 5 0 0 1-6 0zV7"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "path",
            {
              fill: color,
              d: "M3 7h1a17 17 0 0 0 8-2a17 17 0 0 0 8 2h1M5 8l3 8a5 5 0 0 1-6 0zV7m2 14h10"
            }
          )
        ]
      }
    )
  }
);
var QuestionIcon = ({
  size = 60,
  color = COLORS.accent
}) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
  "svg",
  {
    xmlns: "http://www.w3.org/2000/svg",
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "path",
      {
        fill: color,
        d: "M10.6 16q0-2.025.363-2.912T12.5 11.15q1.025-.9 1.563-1.562t.537-1.513q0-1.025-.687-1.7T12 5.7q-1.275 0-1.937.775T9.125 8.05L6.55 6.95q.525-1.6 1.925-2.775T12 3q2.625 0 4.038 1.463t1.412 3.512q0 1.25-.537 2.138t-1.688 2.012Q14 13.3 13.738 13.913T13.475 16zm1.4 6q-.825 0-1.412-.587T10 20t.588-1.412T12 18t1.413.588T14 20t-.587 1.413T12 22"
      }
    )
  }
);
var Scene1 = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const keySync = TIMING.scene1KeySync - TIMING.scene1Start;
  const titleScale = (0, import_remotion.spring)({
    frame,
    fps,
    config: SPRING_CONFIG
  });
  const titleOpacity = (0, import_remotion.interpolate)(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp"
  });
  const containerScale = (0, import_remotion.spring)({
    frame: frame - 15,
    fps,
    config: { damping: 25, stiffness: 80, mass: 1 }
  });
  const cascadeIntensity = (0, import_remotion.interpolate)(
    frame,
    [0, keySync * 0.5, keySync],
    [0.2, 0.6, 1],
    { extrapolateRight: "clamp" }
  );
  const ballCount = Math.floor(25 * cascadeIntensity);
  const balls = Array.from({ length: ballCount }).map((_, i) => {
    const seed = i * 17;
    const xOffset = seed * 73 % CONTAINER.width - CONTAINER.width / 2;
    const yProgress = (frame * 2 + seed * 7) % (CONTAINER.height + 100) / (CONTAINER.height + 100);
    const yPos = -50 + yProgress * (CONTAINER.height + 100);
    const size = 20 + seed % 20;
    const colorChoice = i % 3 === 0 ? COLORS.primary : i % 3 === 1 ? COLORS.accent : COLORS.secondary;
    return {
      x: width / 2 + xOffset * 0.8,
      y: height / 2 - CONTAINER.height / 2 + 50 + yPos,
      size,
      color: colorChoice,
      delay: Math.floor(i * 2)
    };
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.15,
          left: 0,
          right: 0,
          textAlign: "center",
          transform: `scale(${titleScale})`,
          opacity: titleOpacity
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "h1",
            {
              style: {
                fontSize: LAYOUT.titleSize,
                fontWeight: 800,
                color: COLORS.white,
                fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif",
                textShadow: `0 0 40px ${COLORS.primary}66, 0 0 80px ${COLORS.primary}33`,
                margin: 0,
                letterSpacing: -2
              },
              children: "LIVE STREAM"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "h1",
            {
              style: {
                fontSize: LAYOUT.titleSize * 1.2,
                fontWeight: 900,
                background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif",
                margin: 0,
                marginTop: -10,
                letterSpacing: -2
              },
              children: "GIVEAWAY"
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { transform: `scale(${Math.max(0, containerScale)})` }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      GlassContainer,
      {
        x: width / 2,
        y: height / 2 + 50,
        width: CONTAINER.width,
        height: CONTAINER.height,
        glowColor: COLORS.secondary
      }
    ) }),
    balls.map((ball, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      CommentBall,
      {
        x: ball.x,
        y: ball.y,
        size: ball.size,
        color: ball.color,
        delay: ball.delay
      },
      `ball-${i}`
    )),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.75,
          left: 0,
          right: 0,
          textAlign: "center"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              display: "inline-block",
              padding: "16px 40px",
              background: "rgba(0, 0, 0, 0.5)",
              borderRadius: 16,
              border: `2px solid ${COLORS.primary}44`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              Counter,
              {
                target: 25e5,
                startFrame: 0,
                peakFrame: keySync,
                suffix: " comments"
              }
            )
          }
        )
      }
    )
  ] });
};
var MemoryBar = ({ progress, critical }) => {
  const barColor = critical ? COLORS.warning : `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.secondary})`;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        width: "70%",
        height: 24,
        background: "rgba(255, 255, 255, 0.1)",
        borderRadius: 12,
        overflow: "hidden",
        border: `2px solid ${critical ? COLORS.warning : COLORS.secondary}44`,
        position: "relative"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              width: `${progress * 100}%`,
              height: "100%",
              background: barColor,
              borderRadius: 10,
              transition: "width 0.1s",
              boxShadow: critical ? `0 0 20px ${COLORS.warning}` : "none"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "span",
          {
            style: {
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 14,
              fontWeight: 700,
              color: COLORS.white,
              fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif"
            },
            children: [
              Math.round(progress * 100),
              "%"
            ]
          }
        )
      ]
    }
  );
};
var Scene2 = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height } = (0, import_remotion.useVideoConfig)();
  const keySync = TIMING.scene2KeySync - TIMING.scene2Start;
  const memoryProgress = (0, import_remotion.interpolate)(
    frame,
    [0, keySync * 0.8, keySync],
    [0.6, 0.95, 1],
    { extrapolateRight: "clamp" }
  );
  const crackProgress = (0, import_remotion.interpolate)(
    frame,
    [keySync, keySync + 30],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const warningFlash = frame > keySync ? 0.5 + Math.abs(Math.sin((frame - keySync) * 0.3)) * 0.5 : 0;
  const shakeX = frame > keySync ? Math.sin((frame - keySync) * 0.8) * 5 * (1 - Math.min((frame - keySync) / 60, 1)) : 0;
  const openingProgress = (0, import_remotion.interpolate)(
    frame,
    [keySync + 20, keySync + 60],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const ballCount = 30;
  const balls = Array.from({ length: ballCount }).map((_, i) => {
    const seed = i * 23;
    const xOffset = seed * 73 % CONTAINER.width - CONTAINER.width / 2;
    const isSpilling = i > ballCount * 0.6 && frame > keySync;
    const spillProgress = isSpilling ? (0, import_remotion.interpolate)(frame, [keySync + i * 2, keySync + i * 2 + 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
    const baseY = height / 2 + 50 - CONTAINER.height / 2 + 100 + seed * 37 % (CONTAINER.height - 150);
    const spillY = baseY + spillProgress * 500;
    const size = 22 + seed % 18;
    const colorChoice = i % 3 === 0 ? COLORS.primary : i % 3 === 1 ? COLORS.accent : COLORS.secondary;
    return {
      x: width / 2 + xOffset * 0.7,
      y: spillY,
      size,
      color: colorChoice,
      delay: Math.floor(i * 1.5),
      opacity: isSpilling ? 1 - spillProgress * 0.5 : 1
    };
  });
  const streamParticles = frame > keySync + 30 ? Array.from({ length: 20 }).map((_, i) => {
    const streamFrame = frame - keySync - 30;
    const seed = i * 17;
    const x = width / 2 + seed * 31 % 200 - 100;
    const y = height / 2 + 50 + CONTAINER.height / 2 + (streamFrame * 3 + seed * 7) % 400;
    const size = 15 + seed % 10;
    const opacity = (0, import_remotion.interpolate)(y, [height / 2 + CONTAINER.height / 2, height], [0.8, 0], { extrapolateRight: "clamp" });
    return { x, y, size, color: i % 2 === 0 ? COLORS.primary : COLORS.accent, opacity };
  }) : [];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.1,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          gap: 8
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "span",
            {
              style: {
                fontSize: 20,
                fontWeight: 600,
                color: memoryProgress > 0.95 ? COLORS.warning : COLORS.white,
                fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif"
              },
              children: "MEMORY USAGE"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MemoryBar, { progress: memoryProgress, critical: memoryProgress > 0.95 }, "k1")
        ]
      }
    ),
    frame > keySync && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.22,
          left: 0,
          right: 0,
          textAlign: "center",
          transform: `translateX(${shakeX}px)`,
          opacity: warningFlash
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "div",
          {
            style: {
              display: "inline-flex",
              alignItems: "center",
              gap: 16,
              padding: "16px 32px",
              background: `${COLORS.warning}22`,
              borderRadius: 12,
              border: `2px solid ${COLORS.warning}`
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WarningIcon, { size: 40, color: COLORS.warning }, "k2"),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "span",
                {
                  style: {
                    fontSize: LAYOUT.bodySize,
                    fontWeight: 800,
                    color: COLORS.warning,
                    fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif",
                    letterSpacing: 2
                  },
                  children: "MEMORY FULL"
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WarningIcon, { size: 40, color: COLORS.warning }, "k3")
            ]
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      GlassContainer,
      {
        x: width / 2,
        y: height / 2 + 50,
        width: CONTAINER.width,
        height: CONTAINER.height,
        glowColor: frame > keySync ? COLORS.warning : COLORS.secondary,
        cracked: frame > keySync,
        crackProgress
      }
    ),
    openingProgress > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: width / 2 - 60,
          top: height / 2 + 50 + CONTAINER.height / 2 - 10,
          width: 120,
          height: 20 * openingProgress,
          background: `linear-gradient(180deg, transparent, ${COLORS.background})`,
          borderLeft: `2px solid ${COLORS.primary}66`,
          borderRight: `2px solid ${COLORS.primary}66`
        }
      }
    ),
    balls.map((ball, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: ball.x - ball.size / 2,
          top: ball.y - ball.size / 2,
          width: ball.size,
          height: ball.size,
          borderRadius: "50%",
          background: `radial-gradient(circle at 30% 30%, ${ball.color}ee, ${ball.color}88)`,
          opacity: ball.opacity,
          boxShadow: `0 0 ${ball.size * 0.5}px ${ball.color}66`
        }
      },
      `ball-${i}`
    )),
    streamParticles.map((particle, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: particle.x - particle.size / 2,
          top: particle.y - particle.size / 2,
          width: particle.size,
          height: particle.size,
          borderRadius: "50%",
          background: `radial-gradient(circle at 30% 30%, ${particle.color}ee, ${particle.color}66)`,
          opacity: particle.opacity
        }
      },
      `stream-${i}`
    ))
  ] });
};
var PersonCard = ({ label, x, y, delay }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const scale = (0, import_remotion.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG
  });
  const opacity = (0, import_remotion.interpolate)(frame, [delay, delay + 15], [0, 1], {
    extrapolateRight: "clamp"
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity,
        textAlign: "center"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              width: 120,
              height: 120,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${COLORS.secondary}44, ${COLORS.primary}44)`,
              border: `3px solid ${COLORS.primary}66`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
              boxShadow: `0 0 30px ${COLORS.primary}33`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserIcon, { size: 70, color: COLORS.primary }, "k4")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              fontSize: 28,
              fontWeight: 700,
              color: COLORS.white,
              fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif",
              textShadow: `0 0 20px ${COLORS.primary}66`
            },
            children: label
          }
        )
      ]
    }
  );
};
var BalanceScales = ({ x, y, wobble, balanced }) => {
  const rotation = balanced ? 0 : wobble * 8;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          ScaleIcon,
          {
            size: 180,
            color: balanced ? COLORS.success : COLORS.accent
          }
        ),
        balanced && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: -30,
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: 24,
              fontWeight: 800,
              color: COLORS.success,
              fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif"
            },
            children: "EQUAL?"
          }
        )
      ]
    }
  );
};
var FloatingQuestion = ({ x, y, delay, size }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const scale = (0, import_remotion.spring)({
    frame: frame - delay,
    fps,
    config: { damping: 25, stiffness: 80, mass: 1 }
  });
  const floatY = Math.sin((frame + delay) * 0.05) * 15;
  const floatX = Math.cos((frame + delay) * 0.03) * 10;
  const opacity = (0, import_remotion.interpolate)(frame, [delay, delay + 20], [0, 0.7], {
    extrapolateRight: "clamp"
  });
  if (frame < delay) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x + floatX,
        top: y + floatY,
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QuestionIcon, { size, color: COLORS.accent }, "k5")
    }
  );
};
var Scene3 = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height } = (0, import_remotion.useVideoConfig)();
  const keySync = TIMING.scene3KeySync - TIMING.scene3Start;
  const wobbleIntensity = (0, import_remotion.interpolate)(
    frame,
    [0, keySync * 0.5, keySync],
    [1, 0.5, 0],
    { extrapolateRight: "clamp" }
  );
  const wobble = Math.sin(frame * 0.15) * wobbleIntensity;
  const isBalanced = frame >= keySync;
  const questionMarks = [
    { x: width * 0.15, y: height * 0.25, delay: 20, size: 50 },
    { x: width * 0.85, y: height * 0.3, delay: 35, size: 40 },
    { x: width * 0.3, y: height * 0.6, delay: 50, size: 45 },
    { x: width * 0.7, y: height * 0.55, delay: 65, size: 55 },
    { x: width * 0.5, y: height * 0.2, delay: 80, size: 35 }
  ];
  const streamParticles = Array.from({ length: 15 }).map((_, i) => {
    const seed = i * 19;
    const x = width * 0.5 + seed * 31 % 200 - 100;
    const baseY = height * 0.75;
    const y = baseY + (frame * 2 + seed * 11) % 300;
    const size = 12 + seed % 8;
    const opacity = (0, import_remotion.interpolate)(y, [baseY, height], [0.4, 0], { extrapolateRight: "clamp" });
    return { x, y, size, color: i % 2 === 0 ? COLORS.primary : COLORS.accent, opacity };
  });
  const vsOpacity = (0, import_remotion.interpolate)(frame, [30, 50], [0, 1], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    streamParticles.map((p, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: p.x - p.size / 2,
          top: p.y - p.size / 2,
          width: p.size,
          height: p.size,
          borderRadius: "50%",
          background: p.color,
          opacity: p.opacity * 0.5,
          filter: "blur(2px)"
        }
      },
      `stream-bg-${i}`
    )),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      PersonCard,
      {
        label: "Person #1",
        x: width * 0.2,
        y: height * 0.4,
        delay: 0
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      PersonCard,
      {
        label: "Person #1,000,000",
        x: width * 0.8,
        y: height * 0.4,
        delay: 15
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: width * 0.5,
          top: height * 0.4,
          transform: "translate(-50%, -50%)",
          fontSize: 60,
          fontWeight: 900,
          color: COLORS.accent,
          fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif",
          opacity: vsOpacity,
          textShadow: `0 0 30px ${COLORS.accent}66`
        },
        children: "VS"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      BalanceScales,
      {
        x: width * 0.5,
        y: height * 0.6,
        wobble,
        balanced: isBalanced
      }
    ),
    questionMarks.map((q, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      FloatingQuestion,
      {
        x: q.x,
        y: q.y,
        delay: q.delay,
        size: q.size
      },
      `question-${i}`
    )),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: height * 0.15,
          left: 0,
          right: 0,
          textAlign: "center"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              display: "inline-block",
              padding: "20px 40px",
              background: "rgba(0, 0, 0, 0.6)",
              borderRadius: 16,
              border: `2px solid ${COLORS.accent}44`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "span",
              {
                style: {
                  fontSize: LAYOUT.bodySize * 0.9,
                  fontWeight: 600,
                  color: COLORS.white,
                  fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif"
                },
                children: [
                  "How can we be ",
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.primary }, children: "fair" }, "k6"),
                  " to everyone?"
                ]
              }
            )
          }
        )
      }
    )
  ] });
};
var WinnerZone = ({ x, y, width, height, delay, hasWinner = false }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const scale = (0, import_remotion.spring)({
    frame: frame - delay,
    fps,
    config: { damping: 25, stiffness: 80, mass: 1 }
  });
  if (frame < delay) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: x - width / 2,
        top: y - height / 2,
        width,
        height,
        transform: `scale(${scale})`,
        background: "rgba(0, 245, 212, 0.08)",
        border: `3px solid ${COLORS.primary}`,
        borderRadius: 16,
        boxShadow: `
          0 0 30px ${COLORS.primary}44,
          inset 0 0 20px ${COLORS.primary}22
        `,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            style: {
              position: "absolute",
              top: -30,
              fontSize: 18,
              fontWeight: 700,
              color: COLORS.primary,
              fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif",
              letterSpacing: 1
            },
            children: "CURRENT WINNER"
          }
        ),
        hasWinner && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              width: 60,
              height: 60,
              borderRadius: "50%",
              background: `radial-gradient(circle at 30% 30%, ${COLORS.primary}, ${COLORS.primary}88)`,
              boxShadow: `0 0 40px ${COLORS.primary}, 0 0 80px ${COLORS.primary}66`
            }
          }
        )
      ]
    }
  );
};
var AlgorithmTitle = ({ startFrame }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const title = "RESERVOIR SAMPLING";
  const letters = title.split("");
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        display: "flex",
        justifyContent: "center",
        gap: 4
      },
      children: letters.map((letter, i) => {
        const letterDelay = startFrame + i * 2;
        const scale = (0, import_remotion.spring)({
          frame: frame - letterDelay,
          fps,
          config: { damping: 20, stiffness: 120, mass: 0.8 }
        });
        const opacity = (0, import_remotion.interpolate)(
          frame,
          [letterDelay, letterDelay + 10],
          [0, 1],
          { extrapolateRight: "clamp" }
        );
        return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            style: {
              display: "inline-block",
              fontSize: LAYOUT.titleSize * 0.85,
              fontWeight: 900,
              color: letter === " " ? "transparent" : COLORS.gold,
              fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif",
              transform: `scale(${Math.max(0, scale)})`,
              opacity,
              textShadow: `0 0 30px ${COLORS.gold}88, 0 0 60px ${COLORS.gold}44`,
              minWidth: letter === " " ? 20 : "auto"
            },
            children: letter
          },
          `letter-${i}`
        );
      })
    }
  );
};
var GoldenParticles = ({ startFrame, x, y }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  if (frame < startFrame) return null;
  const particleCount = 20;
  const particles = Array.from({ length: particleCount }).map((_, i) => {
    const angle = i / particleCount * Math.PI * 2;
    const progress = (0, import_remotion.interpolate)(
      frame - startFrame,
      [0, 40],
      [0, 1],
      { extrapolateRight: "clamp" }
    );
    const radius = progress * 150;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    const opacity = (0, import_remotion.interpolate)(progress, [0, 0.3, 1], [0, 1, 0]);
    const size = 6 + i % 4 * 2;
    return { px, py, opacity, size };
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: particles.map((p, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: p.px - p.size / 2,
        top: p.py - p.size / 2,
        width: p.size,
        height: p.size,
        borderRadius: "50%",
        background: COLORS.gold,
        opacity: p.opacity,
        boxShadow: `0 0 10px ${COLORS.gold}`
      }
    },
    `gold-particle-${i}`
  )) });
};
var Scene4 = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height } = (0, import_remotion.useVideoConfig)();
  const keySync = TIMING.scene4KeySync - TIMING.scene4Start;
  const containerX = width * 0.38;
  const containerY = height * 0.5;
  const winnerZoneX = width * 0.75;
  const winnerZoneY = height * 0.5;
  const glowOpacity = (0, import_remotion.interpolate)(
    frame,
    [keySync, keySync + 30],
    [0, 0.3],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const subtitleOpacity = (0, import_remotion.interpolate)(
    frame,
    [keySync + 40, keySync + 60],
    [0, 1],
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
          background: `radial-gradient(ellipse at 50% 30%, ${COLORS.gold}${Math.round(glowOpacity * 255).toString(16).padStart(2, "0")} 0%, transparent 50%)`
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      GlassContainer,
      {
        x: containerX,
        y: containerY,
        width: CONTAINER.width * 0.8,
        height: CONTAINER.height * 0.8,
        glowColor: COLORS.secondary
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      WinnerZone,
      {
        x: winnerZoneX,
        y: winnerZoneY,
        width: 200,
        height: 250,
        delay: 10,
        hasWinner: frame > 30
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "svg",
      {
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "line",
          {
            x1: containerX + CONTAINER.width * 0.4,
            y1: containerY,
            x2: winnerZoneX - 100,
            y2: winnerZoneY,
            stroke: COLORS.primary,
            strokeWidth: 2,
            strokeDasharray: "10,5",
            opacity: (0, import_remotion.interpolate)(frame, [20, 40], [0, 0.5], { extrapolateRight: "clamp" })
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.2,
          left: 0,
          right: 0,
          textAlign: "center"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlgorithmTitle, { startFrame: keySync - 20 }, "k7")
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      GoldenParticles,
      {
        startFrame: keySync,
        x: width / 2,
        y: height * 0.2
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.32,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: subtitleOpacity
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            style: {
              fontSize: LAYOUT.bodySize * 0.8,
              fontWeight: 500,
              color: COLORS.white,
              fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif",
              opacity: 0.8
            },
            children: "The elegant solution to random selection"
          }
        )
      }
    ),
    Array.from({ length: 12 }).map((_, i) => {
      const seed = i * 23;
      const ballX = containerX - CONTAINER.width * 0.3 + seed * 31 % (CONTAINER.width * 0.5);
      const baseY = containerY - CONTAINER.height * 0.3;
      const ballY = baseY + (frame * 2 + seed * 11) % (CONTAINER.height * 0.5);
      const size = 18 + seed % 12;
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: ballX - size / 2,
            top: ballY - size / 2,
            width: size,
            height: size,
            borderRadius: "50%",
            background: `radial-gradient(circle at 30% 30%, ${i % 2 === 0 ? COLORS.primary : COLORS.accent}ee, ${i % 2 === 0 ? COLORS.primary : COLORS.accent}66)`,
            opacity: 0.7
          }
        },
        `container-ball-${i}`
      );
    })
  ] });
};
var DiceMesh = ({ rotationX, rotationY, rotationZ, scale, color }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", { rotation: [rotationX, rotationY, rotationZ], scale, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: [2, 2, 2] }, "k8"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "meshStandardMaterial",
      {
        color,
        metalness: 0.3,
        roughness: 0.4
      }
    )
  ] });
};
var Dice3D = ({ x, y, size, startFrame, rolling }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const entranceScale = (0, import_remotion.spring)({
    frame: frame - startFrame,
    fps,
    config: { damping: 20, stiffness: 100, mass: 0.8 }
  });
  const rollProgress = rolling ? (frame - startFrame) * 0.08 : 0;
  const rotationX = rollProgress * 1.2;
  const rotationY = rollProgress * 0.8;
  const rotationZ = rollProgress * 0.5;
  if (frame < startFrame) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          import_three.ThreeCanvas,
          {
            width: size,
            height: size,
            camera: { position: [0, 0, 5], fov: 50 },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ambientLight", { intensity: 0.6 }, "k9"),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pointLight", { position: [5, 5, 5], intensity: 1 }, "k10"),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pointLight", { position: [-5, -5, 5], intensity: 0.5, color: COLORS.primary }, "k11"),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                DiceMesh,
                {
                  rotationX,
                  rotationY,
                  rotationZ,
                  scale: entranceScale,
                  color: COLORS.accent
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
              bottom: -20,
              left: "50%",
              transform: "translateX(-50%)",
              width: size * 0.8,
              height: 20,
              background: `radial-gradient(ellipse, ${COLORS.accent}44 0%, transparent 70%)`,
              filter: "blur(10px)"
            }
          }
        )
      ]
    }
  );
};
var ProbabilityFormula = ({ n, startFrame }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const scale = (0, import_remotion.spring)({
    frame: frame - startFrame,
    fps,
    config: SPRING_CONFIG
  });
  const opacity = (0, import_remotion.interpolate)(
    frame,
    [startFrame, startFrame + 20],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  if (frame < startFrame) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transform: `scale(${scale})`,
        opacity
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            style: {
              fontSize: 80,
              fontWeight: 300,
              color: COLORS.white,
              fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif"
            },
            children: "1"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              width: 80,
              height: 4,
              background: COLORS.primary,
              borderRadius: 2
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            style: {
              fontSize: 80,
              fontWeight: 700,
              color: COLORS.primary,
              fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif"
            },
            children: n
          }
        )
      ]
    }
  );
};
var Scene5 = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height } = (0, import_remotion.useVideoConfig)();
  const keySync = TIMING.scene5KeySync - TIMING.scene5Start;
  const nValue = Math.floor(
    (0, import_remotion.interpolate)(frame, [0, 200], [5, 50], { extrapolateRight: "clamp" })
  );
  const isDiceRolling = frame >= keySync;
  const containerX = width * 0.25;
  const containerY = height * 0.35;
  const winnerZoneX = width * 0.75;
  const winnerZoneY = height * 0.35;
  const diceX = width * 0.5;
  const diceY = height * 0.5;
  const showNewComment = frame > 60 && frame < 200;
  const newCommentY = (0, import_remotion.interpolate)(
    frame,
    [60, 100],
    [height * 0.1, height * 0.25],
    { extrapolateRight: "clamp" }
  );
  const newCommentOpacity = (0, import_remotion.interpolate)(
    frame,
    [60, 80, 180, 200],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const containerBalls = Array.from({ length: 10 }).map((_, i) => {
    const seed = i * 17;
    const ballX = containerX - 100 + seed * 31 % 200;
    const baseY = containerY - 150;
    const ballY = baseY + (frame * 1.5 + seed * 13) % 250;
    const size = 16 + seed % 10;
    return { x: ballX, y: ballY, size, color: i % 2 === 0 ? COLORS.primary : COLORS.accent };
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      GlassContainer,
      {
        x: containerX,
        y: containerY,
        width: 280,
        height: 350,
        glowColor: COLORS.secondary
      }
    ),
    containerBalls.map((ball, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: ball.x - ball.size / 2,
          top: ball.y - ball.size / 2,
          width: ball.size,
          height: ball.size,
          borderRadius: "50%",
          background: `radial-gradient(circle at 30% 30%, ${ball.color}ee, ${ball.color}66)`,
          opacity: 0.7
        }
      },
      `container-ball-${i}`
    )),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      WinnerZone,
      {
        x: winnerZoneX,
        y: winnerZoneY,
        width: 180,
        height: 220,
        delay: 0,
        hasWinner: true
      }
    ),
    showNewComment && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          left: containerX,
          top: newCommentY,
          transform: "translate(-50%, -50%)",
          opacity: newCommentOpacity
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                width: 50,
                height: 50,
                borderRadius: "50%",
                background: `radial-gradient(circle at 30% 30%, ${COLORS.accent}, ${COLORS.accent}88)`,
                boxShadow: `0 0 30px ${COLORS.accent}`
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "span",
            {
              style: {
                position: "absolute",
                top: -25,
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: 14,
                fontWeight: 700,
                color: COLORS.accent,
                whiteSpace: "nowrap"
              },
              children: "NEW COMMENT"
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      Dice3D,
      {
        x: diceX,
        y: diceY,
        size: 200,
        startFrame: keySync,
        rolling: isDiceRolling
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: width * 0.5,
          top: height * 0.72,
          transform: "translateX(-50%)"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProbabilityFormula, { n: nValue, startFrame: keySync + 20 }, "k12")
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: height * 0.1,
          left: 0,
          right: 0,
          textAlign: "center"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              display: "inline-block",
              padding: "16px 32px",
              background: "rgba(0, 0, 0, 0.6)",
              borderRadius: 12,
              border: `2px solid ${COLORS.accent}44`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "span",
              {
                style: {
                  fontSize: LAYOUT.bodySize * 0.8,
                  fontWeight: 600,
                  color: COLORS.white,
                  fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif"
                },
                children: [
                  "Roll a die: ",
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { color: COLORS.primary }, children: [
                    "1/",
                    nValue
                  ] }),
                  " chance to replace"
                ]
              }
            )
          }
        )
      }
    )
  ] });
};
var PulsingBall = ({ x, y, size, showLabel, pulseIntensity, delay }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const scale = (0, import_remotion.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG
  });
  const glowSize = size * (1 + pulseIntensity * 0.5);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        transform: `scale(${Math.max(0, scale)})`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              width: size,
              height: size,
              borderRadius: "50%",
              background: `radial-gradient(circle at 30% 30%, ${COLORS.primary}ee, ${COLORS.primary}88)`,
              boxShadow: `
            0 0 ${glowSize}px ${COLORS.primary},
            0 0 ${glowSize * 2}px ${COLORS.primary}66
          `
            }
          }
        ),
        showLabel && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: -35,
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: 16,
              fontWeight: 700,
              color: COLORS.primary,
              fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif",
              whiteSpace: "nowrap",
              textShadow: `0 0 10px ${COLORS.primary}`
            },
            children: "1/\u221E"
          }
        )
      ]
    }
  );
};
var CelebratoryCheckmark = ({ x, y, startFrame }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const scale = (0, import_remotion.spring)({
    frame: frame - startFrame,
    fps,
    config: { damping: 15, stiffness: 100, mass: 0.8 }
  });
  const opacity = (0, import_remotion.interpolate)(
    frame,
    [startFrame, startFrame + 20],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  if (frame < startFrame) return null;
  const particles = Array.from({ length: 16 }).map((_, i) => {
    const angle = i / 16 * Math.PI * 2;
    const progress = (0, import_remotion.interpolate)(
      frame - startFrame,
      [0, 40],
      [0, 1],
      { extrapolateRight: "clamp" }
    );
    const radius = progress * 120;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    const particleOpacity = (0, import_remotion.interpolate)(progress, [0, 0.3, 1], [0, 1, 0]);
    return { px, py, opacity: particleOpacity };
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(-50%, -50%)"
      },
      children: [
        particles.map((p, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: p.px - 6,
              top: p.py - 6,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: i % 2 === 0 ? COLORS.success : COLORS.primary,
              opacity: p.opacity
            }
          },
          `check-particle-${i}`
        )),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              width: 120,
              height: 120,
              borderRadius: "50%",
              background: `${COLORS.success}22`,
              border: `4px solid ${COLORS.success}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${scale})`,
              opacity,
              boxShadow: `0 0 40px ${COLORS.success}, 0 0 80px ${COLORS.success}44`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckIcon, { size: 70, color: COLORS.success }, "k13")
          }
        )
      ]
    }
  );
};
var Scene6 = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height } = (0, import_remotion.useVideoConfig)();
  const keySync = TIMING.scene6KeySync - TIMING.scene6Start;
  const pulseIntensity = (0, import_remotion.interpolate)(
    frame,
    [keySync - 30, keySync, keySync + 30],
    [0.2, 1, 0.5],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const showLabels = frame >= keySync - 20;
  const balls = Array.from({ length: 12 }).map((_, i) => {
    const seed = i * 29;
    const x = width * 0.25 + seed * 31 % 300;
    const baseY = height * 0.25;
    const y = baseY + (frame * 1.5 + seed * 13) % (height * 0.5);
    const size = 30 + seed % 15;
    return { x, y, size, delay: i * 4 };
  });
  const scaleBalance = (0, import_remotion.interpolate)(
    frame,
    [keySync - 60, keySync],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const scaleRotation = Math.sin(frame * 0.1) * scaleBalance * 5;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    balls.map((ball, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      PulsingBall,
      {
        x: ball.x,
        y: ball.y,
        size: ball.size,
        showLabel: showLabels && i % 3 === 0,
        pulseIntensity,
        delay: ball.delay
      },
      `pulse-ball-${i}`
    )),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          left: width * 0.5,
          top: height * 0.12,
          transform: `translate(-50%, -50%) rotate(${scaleRotation}deg)`
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            ScaleIcon,
            {
              size: 140,
              color: scaleBalance < 0.1 ? COLORS.success : COLORS.accent
            }
          ),
          scaleBalance < 0.1 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "span",
            {
              style: {
                position: "absolute",
                top: -25,
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: 20,
                fontWeight: 800,
                color: COLORS.success,
                whiteSpace: "nowrap"
              },
              children: "BALANCED"
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      WinnerZone,
      {
        x: width * 0.75,
        y: height * 0.4,
        width: 160,
        height: 200,
        delay: 0,
        hasWinner: true
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: width * 0.6,
          top: height * 0.3,
          opacity: (0, import_remotion.interpolate)(frame, [keySync - 40, keySync], [0, 1], { extrapolateRight: "clamp" })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 24, fontWeight: 700, color: COLORS.white }, children: "Everyone has" }, "k14")
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: width * 0.6,
          top: height * 0.36,
          opacity: (0, import_remotion.interpolate)(frame, [keySync - 30, keySync + 10], [0, 1], { extrapolateRight: "clamp" })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            style: {
              fontSize: 48,
              fontWeight: 900,
              color: COLORS.primary,
              textShadow: `0 0 20px ${COLORS.primary}66`
            },
            children: "EQUAL"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: width * 0.6,
          top: height * 0.46,
          opacity: (0, import_remotion.interpolate)(frame, [keySync - 20, keySync + 20], [0, 1], { extrapolateRight: "clamp" })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 24, fontWeight: 700, color: COLORS.white }, children: "probability" }, "k15")
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      CelebratoryCheckmark,
      {
        x: width * 0.5,
        y: height * 0.7,
        startFrame: keySync + 30
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: height * 0.08,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: (0, import_remotion.interpolate)(frame, [keySync + 50, keySync + 80], [0, 1], { extrapolateRight: "clamp" })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "span",
          {
            style: {
              fontSize: LAYOUT.bodySize * 0.85,
              fontWeight: 600,
              color: COLORS.white,
              fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.gold }, children: "Mathematical elegance" }, "k16"),
              " guarantees fairness"
            ]
          }
        )
      }
    )
  ] });
};
var MultipleWinnerZones = ({ x, startY, width, height, count, startFrame }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const zones = Array.from({ length: count }).map((_, i) => {
    const delay = startFrame + i * 10;
    const scale = (0, import_remotion.spring)({
      frame: frame - delay,
      fps,
      config: { damping: 25, stiffness: 80, mass: 1 }
    });
    const y = startY + i * (height + 20);
    const hasWinner = frame > delay + 30;
    const hue = i * 15;
    return { y, scale, hasWinner, delay, hue };
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: zones.map((zone, i) => {
    if (frame < zone.delay) return null;
    const zoneColor = i === 0 ? COLORS.primary : `hsl(${180 + zone.hue}, 80%, 60%)`;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          left: x - width / 2,
          top: zone.y - height / 2,
          width,
          height,
          transform: `scale(${zone.scale})`,
          background: `${zoneColor}11`,
          border: `2px solid ${zoneColor}`,
          borderRadius: 12,
          boxShadow: `0 0 20px ${zoneColor}44`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "span",
            {
              style: {
                position: "absolute",
                left: 8,
                top: 4,
                fontSize: 14,
                fontWeight: 700,
                color: zoneColor
              },
              children: [
                "#",
                i + 1
              ]
            }
          ),
          zone.hasWinner && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                width: 35,
                height: 35,
                borderRadius: "50%",
                background: `radial-gradient(circle at 30% 30%, ${zoneColor}, ${zoneColor}88)`,
                boxShadow: `0 0 20px ${zoneColor}`
              }
            }
          )
        ]
      },
      `winner-zone-${i}`
    );
  }) });
};
var FloatingQuestionMark = ({ x, y, startFrame }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const scale = (0, import_remotion.spring)({
    frame: frame - startFrame,
    fps,
    config: { damping: 20, stiffness: 100, mass: 0.8 }
  });
  const floatY = Math.sin((frame - startFrame) * 0.08) * 10;
  if (frame < startFrame) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y + floatY,
        transform: `translate(-50%, -50%) scale(${scale})`
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: `${COLORS.accent}22`,
            border: `3px solid ${COLORS.accent}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 30px ${COLORS.accent}44`
          },
          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "span",
            {
              style: {
                fontSize: 50,
                fontWeight: 900,
                color: COLORS.accent
              },
              children: "?"
            }
          )
        }
      )
    }
  );
};
var Scene7 = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height } = (0, import_remotion.useVideoConfig)();
  const keySync = TIMING.scene7KeySync - TIMING.scene7Start;
  const containerHeight = (0, import_remotion.interpolate)(
    frame,
    [keySync - 30, keySync + 30],
    [CONTAINER.height * 0.6, height * 0.6],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const titleOpacity = (0, import_remotion.interpolate)(
    frame,
    [20, 50],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  const ctaOpacity = (0, import_remotion.interpolate)(
    frame,
    [keySync + 100, keySync + 140],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  const ctaPulse = 0.95 + Math.sin(frame * 0.1) * 0.05;
  const balls = Array.from({ length: 15 }).map((_, i) => {
    const seed = i * 19;
    const ballX = width * 0.32 - 120 + seed * 37 % 240;
    const baseY = height * 0.3;
    const ballY = baseY + (frame * 1.8 + seed * 11) % (containerHeight * 0.6);
    const size = 18 + seed % 12;
    return { x: ballX, y: ballY, size, color: i % 2 === 0 ? COLORS.primary : COLORS.accent };
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.12,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: titleOpacity
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "span",
            {
              style: {
                fontSize: LAYOUT.titleSize * 0.9,
                fontWeight: 900,
                color: COLORS.white,
                fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif"
              },
              children: "CHALLENGE:"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}, "k17"),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "span",
            {
              style: {
                fontSize: LAYOUT.titleSize,
                fontWeight: 900,
                background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif"
              },
              children: "5 WINNERS"
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      GlassContainer,
      {
        x: width * 0.32,
        y: height * 0.5,
        width: CONTAINER.width * 0.7,
        height: containerHeight,
        glowColor: COLORS.secondary
      }
    ),
    balls.map((ball, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: ball.x - ball.size / 2,
          top: ball.y - ball.size / 2,
          width: ball.size,
          height: ball.size,
          borderRadius: "50%",
          background: `radial-gradient(circle at 30% 30%, ${ball.color}ee, ${ball.color}66)`,
          opacity: 0.7
        }
      },
      `stream-ball-${i}`
    )),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      MultipleWinnerZones,
      {
        x: width * 0.72,
        startY: height * 0.28,
        width: 150,
        height: 80,
        count: 5,
        startFrame: keySync
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      FloatingQuestionMark,
      {
        x: width * 0.5,
        y: height * 0.68,
        startFrame: keySync + 60
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: width * 0.5,
          top: height * 0.76,
          transform: "translateX(-50%)",
          opacity: (0, import_remotion.interpolate)(frame, [keySync + 70, keySync + 100], [0, 0.8], { extrapolateRight: "clamp" })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            style: {
              fontSize: 32,
              fontWeight: 700,
              color: COLORS.accent,
              fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif"
            },
            children: "5/n ?"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: height * 0.08,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: ctaOpacity,
          transform: `scale(${ctaPulse})`
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              display: "inline-block",
              padding: "20px 40px",
              background: `linear-gradient(135deg, ${COLORS.secondary}44, ${COLORS.accent}44)`,
              borderRadius: 16,
              border: `2px solid ${COLORS.primary}`,
              boxShadow: `0 0 30px ${COLORS.primary}44`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "span",
              {
                style: {
                  fontSize: LAYOUT.bodySize,
                  fontWeight: 700,
                  color: COLORS.white,
                  fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif"
                },
                children: "Share your solution!"
              }
            )
          }
        )
      }
    )
  ] });
};
var MainComposition = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: { backgroundColor: COLORS.background }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AnimatedBackground, {}, "bg"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene1Start, durationInFrames: TIMING.scene1End - TIMING.scene1Start, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene1, {}) }, "scene1"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene2Start, durationInFrames: TIMING.scene2End - TIMING.scene2Start, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene2, {}) }, "scene2"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene3Start, durationInFrames: TIMING.scene3End - TIMING.scene3Start, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene3, {}) }, "scene3"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene4Start, durationInFrames: TIMING.scene4End - TIMING.scene4Start, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene4, {}) }, "scene4"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene5Start, durationInFrames: TIMING.scene5End - TIMING.scene5Start, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene5, {}) }, "scene5"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene6Start, durationInFrames: TIMING.scene6End - TIMING.scene6Start, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene6, {}) }, "scene6"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene7Start, durationInFrames: TIMING.scene7End - TIMING.scene7Start, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene7, {}) }, "scene7")
  ] });
};
var RemotionRoot = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_remotion.Composition,
    {
      id: "proj_0fd014ae_37ef_4274_872b_9e0cba789840",
      component: MainComposition,
      durationInFrames: VIDEO_CONFIG.durationInFrames,
      fps: VIDEO_CONFIG.fps,
      width: VIDEO_CONFIG.width,
      height: VIDEO_CONFIG.height
    }
  );
};
var index_default = MainComposition;
(0, import_remotion.registerRoot)(RemotionRoot);
