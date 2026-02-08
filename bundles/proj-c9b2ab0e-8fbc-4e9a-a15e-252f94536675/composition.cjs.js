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

// src/proj_c9b2ab0e_8fbc_4e9a_a15e_252f94536675/index.tsx
var index_exports = {};
__export(index_exports, {
  RemotionRoot: () => RemotionRoot,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_remotion = require("remotion");
var import_three = require("@remotion/three");

// src/proj_c9b2ab0e_8fbc_4e9a_a15e_252f94536675/constants.ts
var COLORS = {
  primary: "#00f5d4",
  // Cyan - Comments and system elements
  secondary: "#7b2cbf",
  // Purple - Background and containers
  accent: "#feca57",
  // Gold - Winners and highlights
  warning: "#f72585",
  // Magenta - Constraints and problems
  dark: "#0a0a0f",
  // Background
  white: "#ffffff",
  glass: "rgba(255, 255, 255, 0.1)",
  glassStroke: "rgba(255, 255, 255, 0.2)"
};
var SPRING_CONFIG = { damping: 22, stiffness: 90, mass: 0.9 };
var TIMING = {
  fps: 30,
  totalFrames: 2334,
  // Scene 1: The Scenario Setup
  scene1: { start: 0, end: 450, keySync: 129 },
  // Scene 2: The Memory Crisis
  scene2: { start: 451, end: 829, keySync: 394 },
  // Scene 3: The Solution Reveal
  scene3: { start: 830, end: 1034, keySync: 883 },
  // Scene 4: Algorithm Mechanics (3D dice)
  scene4: { start: 1035, end: 1606, keySync: 1089 },
  // Scene 5: Mathematical Fairness Proof
  scene5: { start: 1607, end: 1714, keySync: 1537 },
  // Scene 6: The Challenge
  scene6: { start: 1715, end: 1994, keySync: 1849 },
  // Scene 7: Call to Action
  scene7: { start: 1995, end: 2334, keySync: 1949 }
};
var VIDEO = {
  width: 1080,
  height: 1920,
  fps: 30
};

// src/proj_c9b2ab0e_8fbc_4e9a_a15e_252f94536675/index.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var AnimatedBackground = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const gradientPosition = Math.sin(frame * 0.01) * 10 + 50;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_remotion.AbsoluteFill,
    {
      style: {
        background: `radial-gradient(ellipse at 50% ${gradientPosition}%, ${COLORS.secondary}22 0%, ${COLORS.dark} 70%)`
      }
    }
  );
};
var CommentBall = ({
  x,
  y,
  size = 40,
  isWinner = false,
  opacity = 1,
  delay = 0
}) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const scale = (0, import_remotion.spring)({ frame: frame - delay, fps, config: SPRING_CONFIG });
  const color = isWinner ? COLORS.accent : COLORS.primary;
  const glowColor = isWinner ? COLORS.accent : COLORS.primary;
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
        background: `radial-gradient(circle at 30% 30%, ${color}, ${color}88)`,
        boxShadow: `0 0 ${size * 0.5}px ${glowColor}88, 0 0 ${size}px ${glowColor}44`,
        opacity: opacity * Math.min(scale, 1),
        transform: `scale(${Math.min(scale, 1)})`
      }
    }
  );
};
var MemoryBucket = ({
  width,
  height,
  x,
  y,
  showCracks = false,
  slots = 1
}) => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x - width / 2,
        top: y - height / 2,
        width,
        height,
        background: COLORS.glass,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: `2px solid ${showCracks ? COLORS.warning : COLORS.glassStroke}`,
        borderRadius: 16,
        boxShadow: `0 8px 32px rgba(0, 0, 0, 0.3), inset 0 0 20px ${showCracks ? COLORS.warning + "22" : "transparent"}`,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 8
      },
      children: Array.from({ length: slots }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            width: (width - 32) / slots - 8,
            height: height - 32,
            border: `1px dashed ${COLORS.glassStroke}`,
            borderRadius: 8
          }
        },
        i
      ))
    }
  );
};
var Scene1 = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const titleOpacity = (0, import_remotion.interpolate)(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  const titleY = (0, import_remotion.interpolate)(frame, [0, 30], [-50, 0], { extrapolateRight: "clamp" });
  const keySyncFrame = 129;
  const ballMultiplier = frame < keySyncFrame ? 1 : (0, import_remotion.interpolate)(
    frame,
    [keySyncFrame, keySyncFrame + 30],
    [1, 4],
    { extrapolateRight: "clamp" }
  );
  const baseBallCount = 8;
  const totalBalls = Math.floor(baseBallCount * ballMultiplier);
  const bucketScale = (0, import_remotion.spring)({ frame: frame - 15, fps, config: SPRING_CONFIG });
  const bucketWidth = width * 0.2;
  const bucketHeight = height * 0.12;
  const bucketY = height * 0.78;
  const balls = Array.from({ length: totalBalls }).map((_, i) => {
    const seed = i * 137.5;
    const startX = seed * 7 % (width * 0.7) + width * 0.15;
    const startDelay = i * 12 % 100;
    const cycleLength = 180;
    const progress = (frame - startDelay) % cycleLength / cycleLength;
    const y = progress * (height * 0.65) + height * 0.1;
    const x = startX + Math.sin(progress * Math.PI * 2 + i) * 30;
    const opacity = (0, import_remotion.interpolate)(progress, [0, 0.1, 0.9, 1], [0, 1, 1, 0], { extrapolateRight: "clamp" });
    return { x, y, opacity, delay: i * 2 };
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.15,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "h1",
          {
            style: {
              fontSize: height * 0.045,
              fontWeight: 800,
              color: COLORS.white,
              letterSpacing: 4,
              textTransform: "uppercase",
              margin: 0,
              textShadow: `0 0 40px ${COLORS.primary}66`
            },
            children: "GIVEAWAY SYSTEM"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.05,
          left: width * 0.1,
          right: width * 0.1,
          height: height * 0.06,
          background: COLORS.glass,
          backdropFilter: "blur(10px)",
          borderRadius: 12,
          border: `1px solid ${COLORS.glassStroke}`,
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          gap: 12,
          opacity: (0, import_remotion.interpolate)(frame, [5, 25], [0, 1], { extrapolateRight: "clamp" })
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { width: 12, height: 12, borderRadius: "50%", background: "#ff5f56" } }, "k1"),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { width: 12, height: 12, borderRadius: "50%", background: "#ffbd2e" } }, "k2"),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { width: 12, height: 12, borderRadius: "50%", background: "#27ca3f" } }, "k3"),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.white, fontSize: 18, marginLeft: 16, opacity: 0.7 }, children: "live_stream.exe" }, "k4")
        ]
      }
    ),
    balls.map((ball, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      CommentBall,
      {
        x: ball.x,
        y: ball.y,
        size: 30 + i % 3 * 8,
        opacity: ball.opacity,
        delay: ball.delay
      },
      i
    )),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { transform: `scale(${Math.min(bucketScale, 1)})` }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      MemoryBucket,
      {
        width: bucketWidth,
        height: bucketHeight,
        x: width / 2,
        y: bucketY
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: height * 0.12,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: (0, import_remotion.interpolate)(frame, [40, 60], [0, 1], { extrapolateRight: "clamp" })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            style: {
              fontSize: height * 0.02,
              color: COLORS.white,
              opacity: 0.6,
              letterSpacing: 2
            },
            children: "MEMORY"
          }
        )
      }
    )
  ] });
};
var WarningIcon = ({
  size = 60,
  color = COLORS.warning
}) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
  "path",
  {
    d: "M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    fill: `${color}22`
  }
) });
var Scene2 = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const bucketWidthProgress = (0, import_remotion.interpolate)(frame, [0, 120], [0.2, 0.6], { extrapolateRight: "clamp" });
  const bucketWidth = width * bucketWidthProgress;
  const bucketHeight = height * 0.15;
  const bucketY = height * 0.6;
  const crackOpacity = (0, import_remotion.interpolate)(frame, [30, 60], [0, 1], { extrapolateRight: "clamp" });
  const warningPulse = (0, import_remotion.interpolate)(
    frame % 30 / 30,
    [0, 0.5, 1],
    [0.6, 1, 0.6],
    { extrapolateRight: "clamp" }
  );
  const ballCount = 40;
  const balls = Array.from({ length: ballCount }).map((_, i) => {
    const seed = i * 137.5;
    const startX = seed * 7 % (width * 0.8) + width * 0.1;
    const startDelay = i * 8 % 60;
    const cycleLength = 90;
    const progress = (frame - startDelay) % cycleLength / cycleLength;
    const y = progress * (height * 0.5) + height * 0.08;
    const x = startX + Math.sin(progress * Math.PI * 2 + i) * 20;
    const opacity = (0, import_remotion.interpolate)(progress, [0, 0.1, 0.85, 1], [0, 1, 1, 0], { extrapolateRight: "clamp" });
    return { x, y, opacity, delay: i };
  });
  const overflowBalls = Array.from({ length: 20 }).map((_, i) => {
    const appearFrame = 60 + i * 4;
    const progress = (0, import_remotion.spring)({
      frame: frame - appearFrame,
      fps,
      config: { damping: 25, stiffness: 80, mass: 1 }
    });
    const angle = i / 20 * Math.PI + Math.PI;
    const radius = 80 + i % 5 * 30;
    const x = width / 2 + Math.cos(angle) * radius * progress;
    const y = bucketY + bucketHeight / 2 + 30 + Math.abs(Math.sin(angle)) * 60 * progress;
    const opacity = (0, import_remotion.interpolate)(frame - appearFrame, [0, 10], [0, 0.8], { extrapolateRight: "clamp" });
    return { x, y, opacity, size: 20 + i % 4 * 8 };
  });
  const cracks = [
    { x1: 0.2, y1: 0.3, x2: 0.4, y2: 0.1, delay: 0 },
    { x1: 0.8, y1: 0.2, x2: 0.6, y2: 0.5, delay: 10 },
    { x1: 0.1, y1: 0.7, x2: 0.3, y2: 0.9, delay: 20 },
    { x1: 0.9, y1: 0.6, x2: 0.7, y2: 0.8, delay: 30 }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.12,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: (0, import_remotion.interpolate)(frame, [20, 50], [0, 1], { extrapolateRight: "clamp" })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WarningIcon, { size: 50 }, "k5"),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "h1",
            {
              style: {
                fontSize: height * 0.04,
                fontWeight: 800,
                color: COLORS.warning,
                letterSpacing: 4,
                textTransform: "uppercase",
                margin: 0,
                opacity: warningPulse,
                textShadow: `0 0 30px ${COLORS.warning}88`
              },
              children: "MEMORY OVERFLOW"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WarningIcon, { size: 50 }, "k6")
        ] })
      }
    ),
    balls.map((ball, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      CommentBall,
      {
        x: ball.x,
        y: ball.y,
        size: 24 + i % 3 * 6,
        opacity: ball.opacity,
        delay: ball.delay
      },
      `fall-${i}`
    )),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          left: width / 2 - bucketWidth / 2,
          top: bucketY - bucketHeight / 2,
          width: bucketWidth,
          height: bucketHeight,
          background: COLORS.glass,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: `3px solid ${COLORS.warning}`,
          borderRadius: 16,
          boxShadow: `0 8px 32px rgba(0, 0, 0, 0.3), inset 0 0 40px ${COLORS.warning}33, 0 0 60px ${COLORS.warning}22`,
          overflow: "hidden"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "svg",
            {
              style: {
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                opacity: crackOpacity
              },
              children: cracks.map((crack, i) => {
                const lineProgress = (0, import_remotion.interpolate)(
                  frame - crack.delay - 30,
                  [0, 20],
                  [0, 1],
                  { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
                );
                return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "line",
                  {
                    x1: `${crack.x1 * 100}%`,
                    y1: `${crack.y1 * 100}%`,
                    x2: `${crack.x1 + (crack.x2 - crack.x1) * lineProgress * 100}%`,
                    y2: `${crack.y1 + (crack.y2 - crack.y1) * lineProgress * 100}%`,
                    stroke: COLORS.warning,
                    strokeWidth: 3,
                    strokeLinecap: "round"
                  },
                  i
                );
              })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                bottom: 10,
                left: 10,
                right: 10,
                display: "flex",
                flexWrap: "wrap",
                gap: 4,
                justifyContent: "center"
              },
              children: Array.from({ length: 15 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "div",
                {
                  style: {
                    width: 20 + i % 3 * 5,
                    height: 20 + i % 3 * 5,
                    borderRadius: "50%",
                    background: `radial-gradient(circle at 30% 30%, ${COLORS.primary}, ${COLORS.primary}88)`,
                    boxShadow: `0 0 10px ${COLORS.primary}66`
                  }
                },
                i
              ))
            }
          )
        ]
      }
    ),
    overflowBalls.map((ball, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      CommentBall,
      {
        x: ball.x,
        y: ball.y,
        size: ball.size,
        opacity: ball.opacity
      },
      `overflow-${i}`
    )),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: height * 0.2,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: (0, import_remotion.interpolate)(frame, [80, 110], [0, 1], { extrapolateRight: "clamp" })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            style: {
              fontSize: height * 0.025,
              color: COLORS.warning,
              letterSpacing: 3,
              fontWeight: 600,
              textShadow: `0 0 20px ${COLORS.warning}66`
            },
            children: "OUT OF RAM"
          }
        )
      }
    )
  ] });
};
var Scene3 = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const keySyncFrame = 53;
  const fadeIn = (0, import_remotion.interpolate)(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  const bucketProgress = (0, import_remotion.spring)({
    frame: frame - 20,
    fps,
    config: SPRING_CONFIG
  });
  const bucketWidth = width * 0.3;
  const bucketHeight = height * 0.18;
  const bucketY = height * 0.55;
  const ballProgress = (0, import_remotion.spring)({
    frame: frame - 35,
    fps,
    config: SPRING_CONFIG
  });
  const ballPulse = (0, import_remotion.interpolate)(
    frame % 60 / 60,
    [0, 0.5, 1],
    [1, 1.1, 1],
    { extrapolateRight: "clamp" }
  );
  const titleText = "RESERVOIR SAMPLING";
  const subtitleOpacity = (0, import_remotion.interpolate)(
    frame - keySyncFrame - 30,
    [0, 20],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: { opacity: fadeIn }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.18,
          left: 0,
          right: 0,
          textAlign: "center"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "h1",
          {
            style: {
              fontSize: height * 0.05,
              fontWeight: 800,
              color: COLORS.white,
              letterSpacing: 6,
              margin: 0,
              display: "flex",
              justifyContent: "center",
              gap: 2
            },
            children: titleText.split("").map((char, i) => {
              const charDelay = i * 2;
              const charProgress = (0, import_remotion.interpolate)(
                frame - keySyncFrame - charDelay,
                [0, 15],
                [0, 1],
                { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
              );
              return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "span",
                {
                  style: {
                    opacity: charProgress,
                    transform: `translateY(${(1 - charProgress) * 20}px)`,
                    display: "inline-block",
                    textShadow: `0 0 30px ${COLORS.primary}88`
                  },
                  children: char === " " ? "\xA0" : char
                },
                i
              );
            })
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.26,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: subtitleOpacity
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "p",
          {
            style: {
              fontSize: height * 0.025,
              color: COLORS.primary,
              letterSpacing: 3,
              margin: 0,
              fontWeight: 500,
              textShadow: `0 0 20px ${COLORS.primary}66`
            },
            children: "One variable. Infinite fairness."
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: width / 2 - bucketWidth / 2,
          top: bucketY - bucketHeight / 2,
          width: bucketWidth,
          height: bucketHeight,
          background: COLORS.glass,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: `2px solid ${COLORS.glassStroke}`,
          borderRadius: 20,
          boxShadow: `0 8px 32px rgba(0, 0, 0, 0.3), 0 0 60px ${COLORS.accent}22`,
          transform: `scale(${Math.min(bucketProgress, 1)})`,
          display: "flex",
          justifyContent: "center",
          alignItems: "center"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: `radial-gradient(circle at 30% 30%, ${COLORS.accent}, ${COLORS.accent}88)`,
              boxShadow: `0 0 40px ${COLORS.accent}88, 0 0 80px ${COLORS.accent}44`,
              transform: `scale(${Math.min(ballProgress, 1) * ballPulse})`
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
          top: bucketY + bucketHeight / 2 + 30,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: (0, import_remotion.interpolate)(frame, [50, 70], [0, 1], { extrapolateRight: "clamp" })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            style: {
              fontSize: height * 0.018,
              color: COLORS.accent,
              letterSpacing: 3,
              fontWeight: 600,
              textTransform: "uppercase"
            },
            children: "Current Winner"
          }
        )
      }
    )
  ] });
};
var Dice3D = ({ rotation, scale, size }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    import_three.ThreeCanvas,
    {
      width: size,
      height: size,
      camera: { position: [0, 0, 5], fov: 50 },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ambientLight", { intensity: 0.6 }, "k7"),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pointLight", { position: [5, 5, 5], intensity: 1 }, "k8"),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pointLight", { position: [-5, -5, 5], intensity: 0.5, color: COLORS.primary }, "k9"),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", { rotation: [rotation * 0.7, rotation, rotation * 0.3], scale, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: [2, 2, 2] }, "k10"),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "meshStandardMaterial",
            {
              color: COLORS.accent,
              metalness: 0.3,
              roughness: 0.4,
              emissive: COLORS.accent,
              emissiveIntensity: 0.1
            }
          )
        ] })
      ]
    }
  );
};
var Scene4 = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const keySyncFrame = 54;
  const iterationLength = 120;
  const currentIteration = Math.floor(frame / iterationLength);
  const iterationFrame = frame % iterationLength;
  const n = Math.min(currentIteration + 2, 10);
  const bucketWidth = width * 0.3;
  const bucketHeight = height * 0.15;
  const bucketY = height * 0.7;
  const ballApproachProgress = (0, import_remotion.interpolate)(
    iterationFrame,
    [0, 60],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  const newBallY = height * 0.15 + ballApproachProgress * (height * 0.35);
  const newBallOpacity = (0, import_remotion.interpolate)(iterationFrame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const diceAppearFrame = frame < iterationLength ? keySyncFrame : 20;
  const diceProgress = (0, import_remotion.spring)({
    frame: iterationFrame - diceAppearFrame,
    fps,
    config: SPRING_CONFIG
  });
  const diceRotation = iterationFrame * 0.08;
  const diceScale = Math.min(diceProgress, 1) * 1.5;
  const diceRollFrame = diceAppearFrame + 40;
  const diceResult = (currentIteration * 7 + 3) % n;
  const isWinner = diceResult === 0;
  const replacementProgress = (0, import_remotion.interpolate)(
    iterationFrame - diceRollFrame - 20,
    [0, 30],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const winnerBallScale = isWinner ? (0, import_remotion.interpolate)(replacementProgress, [0, 0.5, 1], [1, 0.5, 1], { extrapolateRight: "clamp" }) : 1;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          left: width * 0.08,
          top: height * 0.35,
          width: width * 0.25,
          textAlign: "center"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.03,
                color: COLORS.white,
                opacity: 0.7,
                marginBottom: 10
              },
              children: "PROBABILITY"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "div",
            {
              style: {
                fontSize: height * 0.08,
                fontWeight: 800,
                color: COLORS.primary,
                textShadow: `0 0 30px ${COLORS.primary}88`
              },
              children: [
                "1/",
                n
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "div",
            {
              style: {
                fontSize: height * 0.02,
                color: COLORS.white,
                opacity: 0.5,
                marginTop: 15
              },
              children: [
                "n = ",
                n,
                " comments"
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
          left: width / 2 - 30,
          top: newBallY - 30,
          width: 60,
          height: 60,
          borderRadius: "50%",
          background: `radial-gradient(circle at 30% 30%, ${COLORS.primary}, ${COLORS.primary}88)`,
          boxShadow: `0 0 30px ${COLORS.primary}88`,
          opacity: newBallOpacity * (1 - replacementProgress)
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          left: width / 2,
          top: newBallY + 45,
          transform: "translateX(-50%)",
          fontSize: height * 0.018,
          color: COLORS.primary,
          opacity: newBallOpacity * (1 - replacementProgress),
          whiteSpace: "nowrap"
        },
        children: [
          "Comment #",
          n
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          right: width * 0.08,
          top: height * 0.3,
          width: width * 0.22,
          height: width * 0.22,
          opacity: Math.min(diceProgress, 1)
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dice3D, { rotation: diceRotation, scale: diceScale, size: Math.round(width * 0.22) }, "k11"),
          iterationFrame > diceRollFrame && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                bottom: -40,
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: height * 0.025,
                fontWeight: 700,
                color: isWinner ? COLORS.accent : COLORS.warning,
                textShadow: `0 0 20px ${isWinner ? COLORS.accent : COLORS.warning}88`
              },
              children: isWinner ? "REPLACE!" : "KEEP"
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
          left: width / 2 - bucketWidth / 2,
          top: bucketY - bucketHeight / 2,
          width: bucketWidth,
          height: bucketHeight,
          background: COLORS.glass,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: `2px solid ${COLORS.glassStroke}`,
          borderRadius: 20,
          boxShadow: `0 8px 32px rgba(0, 0, 0, 0.3), 0 0 40px ${COLORS.accent}22`,
          display: "flex",
          justifyContent: "center",
          alignItems: "center"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              width: 70,
              height: 70,
              borderRadius: "50%",
              background: isWinner && replacementProgress > 0.5 ? `radial-gradient(circle at 30% 30%, ${COLORS.primary}, ${COLORS.primary}88)` : `radial-gradient(circle at 30% 30%, ${COLORS.accent}, ${COLORS.accent}88)`,
              boxShadow: `0 0 30px ${isWinner && replacementProgress > 0.5 ? COLORS.primary : COLORS.accent}88`,
              transform: `scale(${winnerBallScale})`
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
          top: bucketY + bucketHeight / 2 + 20,
          left: 0,
          right: 0,
          textAlign: "center"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            style: {
              fontSize: height * 0.018,
              color: COLORS.accent,
              letterSpacing: 2,
              fontWeight: 600
            },
            children: "RESERVOIR (k=1)"
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
          textAlign: "center"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "span",
          {
            style: {
              fontSize: height * 0.02,
              color: COLORS.white,
              opacity: 0.5
            },
            children: [
              "Step ",
              currentIteration + 1
            ]
          }
        )
      }
    )
  ] });
};
var Scene5 = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const leftBallProgress = (0, import_remotion.spring)({
    frame: frame - 10,
    fps,
    config: SPRING_CONFIG
  });
  const rightBallProgress = (0, import_remotion.spring)({
    frame: frame - 25,
    fps,
    config: SPRING_CONFIG
  });
  const formulaProgress = (0, import_remotion.spring)({
    frame: frame - 40,
    fps,
    config: SPRING_CONFIG
  });
  const pulsePhase = frame % 45 / 45;
  const pulseIntensity = (0, import_remotion.interpolate)(
    pulsePhase,
    [0, 0.5, 1],
    [0.7, 1, 0.7],
    { extrapolateRight: "clamp" }
  );
  const equalPulse = frame > 60 ? (0, import_remotion.interpolate)(
    (frame - 60) % 30 / 30,
    [0, 0.5, 1],
    [1, 1.3, 1],
    { extrapolateRight: "clamp" }
  ) : 1;
  const ballSize = 100;
  const leftX = width * 0.25;
  const rightX = width * 0.75;
  const ballY = height * 0.45;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.12,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: (0, import_remotion.interpolate)(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "h1",
          {
            style: {
              fontSize: height * 0.035,
              fontWeight: 700,
              color: COLORS.white,
              letterSpacing: 3,
              margin: 0,
              textShadow: `0 0 30px ${COLORS.primary}44`
            },
            children: "EQUAL PROBABILITY"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          left: leftX - ballSize / 2,
          top: ballY - ballSize / 2,
          transform: `scale(${Math.min(leftBallProgress, 1)})`
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                width: ballSize,
                height: ballSize,
                borderRadius: "50%",
                background: `radial-gradient(circle at 30% 30%, ${COLORS.accent}, ${COLORS.accent}88)`,
                boxShadow: `0 0 ${40 * pulseIntensity}px ${COLORS.accent}aa, 0 0 ${80 * pulseIntensity}px ${COLORS.accent}55`,
                transform: `scale(${pulseIntensity})`
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "div",
            {
              style: {
                position: "absolute",
                top: ballSize + 20,
                left: "50%",
                transform: "translateX(-50%)",
                textAlign: "center",
                whiteSpace: "nowrap"
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: height * 0.022, color: COLORS.white, fontWeight: 600 }, children: "1st COMMENTER" }, "k12"),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: height * 0.016, color: COLORS.primary, marginTop: 8, opacity: 0.8 }, children: "Joined first" }, "k13")
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
          left: width / 2,
          top: height * 0.38,
          transform: `translateX(-50%) scale(${Math.min(formulaProgress, 1)})`,
          textAlign: "center"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.06,
                fontWeight: 800,
                color: COLORS.white,
                textShadow: `0 0 40px ${COLORS.primary}66`
              },
              children: "P = 1/n"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                fontSize: height * 0.09,
                fontWeight: 800,
                color: COLORS.accent,
                marginTop: 20,
                transform: `scale(${equalPulse})`,
                textShadow: `0 0 30px ${COLORS.accent}88`
              },
              children: "="
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
          left: rightX - ballSize / 2,
          top: ballY - ballSize / 2,
          transform: `scale(${Math.min(rightBallProgress, 1)})`
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                width: ballSize,
                height: ballSize,
                borderRadius: "50%",
                background: `radial-gradient(circle at 30% 30%, ${COLORS.accent}, ${COLORS.accent}88)`,
                boxShadow: `0 0 ${40 * pulseIntensity}px ${COLORS.accent}aa, 0 0 ${80 * pulseIntensity}px ${COLORS.accent}55`,
                transform: `scale(${pulseIntensity})`
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "div",
            {
              style: {
                position: "absolute",
                top: ballSize + 20,
                left: "50%",
                transform: "translateX(-50%)",
                textAlign: "center",
                whiteSpace: "nowrap"
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: height * 0.022, color: COLORS.white, fontWeight: 600 }, children: "1,000,000th COMMENTER" }, "k14"),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: height * 0.016, color: COLORS.primary, marginTop: 8, opacity: 0.8 }, children: "Joined last" }, "k15")
              ]
            }
          )
        ]
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
            x1: leftX + ballSize / 2 + 20,
            y1: ballY,
            x2: rightX - ballSize / 2 - 20,
            y2: ballY,
            stroke: COLORS.accent,
            strokeWidth: 2,
            strokeDasharray: "10,10",
            opacity: (0, import_remotion.interpolate)(frame, [50, 70], [0, 0.4], { extrapolateRight: "clamp" })
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: height * 0.12,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: (0, import_remotion.interpolate)(frame, [70, 90], [0, 1], { extrapolateRight: "clamp" })
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "p",
          {
            style: {
              fontSize: height * 0.022,
              color: COLORS.primary,
              margin: 0,
              letterSpacing: 2
            },
            children: "Same chance to win. Always fair."
          }
        )
      }
    )
  ] });
};
var Scene6 = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const keySyncFrame = 134;
  const bucketExpansionProgress = (0, import_remotion.interpolate)(
    frame - keySyncFrame,
    [0, 40],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const bucketWidth = (0, import_remotion.interpolate)(
    bucketExpansionProgress,
    [0, 1],
    [width * 0.3, width * 0.6],
    { extrapolateRight: "clamp" }
  );
  const bucketHeight = height * 0.15;
  const bucketY = height * 0.55;
  const singleBallOpacity = (0, import_remotion.interpolate)(
    bucketExpansionProgress,
    [0, 0.5],
    [1, 0],
    { extrapolateRight: "clamp" }
  );
  const questionProgress = (0, import_remotion.spring)({
    frame: frame - 30,
    fps,
    config: SPRING_CONFIG
  });
  const questionPulse = (0, import_remotion.interpolate)(
    frame % 40 / 40,
    [0, 0.5, 1],
    [1, 1.15, 1],
    { extrapolateRight: "clamp" }
  );
  const approachingBalls = Array.from({ length: 8 }).map((_, i) => {
    const angle = i / 8 * Math.PI * 2 - Math.PI / 2;
    const startRadius = 400;
    const endRadius = 180;
    const progress = (0, import_remotion.interpolate)(
      frame - i * 8,
      [40, 120],
      [0, 1],
      { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
    );
    const radius = startRadius - (startRadius - endRadius) * progress;
    const x = width / 2 + Math.cos(angle) * radius;
    const y = bucketY - 100 + Math.sin(angle) * (radius * 0.3);
    const opacity = (0, import_remotion.interpolate)(progress, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });
    return { x, y, opacity, size: 35 + i % 3 * 8 };
  });
  const textOpacity = (0, import_remotion.interpolate)(
    frame - keySyncFrame - 30,
    [0, 25],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: width / 2,
          top: height * 0.25,
          transform: `translateX(-50%) scale(${Math.min(questionProgress, 1) * questionPulse})`,
          fontSize: height * 0.15,
          fontWeight: 800,
          color: COLORS.accent,
          textShadow: `0 0 60px ${COLORS.accent}88, 0 0 120px ${COLORS.accent}44`
        },
        children: "?"
      }
    ),
    approachingBalls.map((ball, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: ball.x - ball.size / 2,
          top: ball.y - ball.size / 2,
          width: ball.size,
          height: ball.size,
          borderRadius: "50%",
          background: `radial-gradient(circle at 30% 30%, ${COLORS.primary}, ${COLORS.primary}88)`,
          boxShadow: `0 0 20px ${COLORS.primary}88`,
          opacity: ball.opacity
        }
      },
      i
    )),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          left: width / 2 - bucketWidth / 2,
          top: bucketY - bucketHeight / 2,
          width: bucketWidth,
          height: bucketHeight,
          background: COLORS.glass,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: `2px solid ${COLORS.glassStroke}`,
          borderRadius: 20,
          boxShadow: `0 8px 32px rgba(0, 0, 0, 0.3), 0 0 40px ${COLORS.accent}22`,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 10,
          padding: "0 15px"
        },
        children: [
          bucketExpansionProgress < 0.5 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                width: 70,
                height: 70,
                borderRadius: "50%",
                background: `radial-gradient(circle at 30% 30%, ${COLORS.accent}, ${COLORS.accent}88)`,
                boxShadow: `0 0 30px ${COLORS.accent}88`,
                opacity: singleBallOpacity
              }
            }
          ),
          bucketExpansionProgress > 0 && Array.from({ length: 5 }).map((_, i) => {
            const slotProgress = (0, import_remotion.spring)({
              frame: frame - keySyncFrame - 10 - i * 6,
              fps,
              config: SPRING_CONFIG
            });
            const slotWidth = (bucketWidth - 60) / 5;
            return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "div",
              {
                style: {
                  width: slotWidth,
                  height: bucketHeight - 30,
                  border: `2px dashed ${COLORS.glassStroke}`,
                  borderRadius: 12,
                  opacity: Math.min(slotProgress, 1) * bucketExpansionProgress,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center"
                },
                children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "span",
                  {
                    style: {
                      fontSize: height * 0.025,
                      color: COLORS.accent,
                      opacity: 0.5,
                      fontWeight: 700
                    },
                    children: i + 1
                  }
                )
              },
              i
            );
          })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: bucketY + bucketHeight / 2 + 25,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: bucketExpansionProgress
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            style: {
              fontSize: height * 0.02,
              color: COLORS.accent,
              letterSpacing: 2,
              fontWeight: 600
            },
            children: "RESERVOIR (k=5)"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: height * 0.1,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: textOpacity
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "h2",
            {
              style: {
                fontSize: height * 0.03,
                fontWeight: 700,
                color: COLORS.white,
                letterSpacing: 2,
                margin: 0,
                textShadow: `0 0 30px ${COLORS.primary}44`
              },
              children: "THE CHALLENGE:"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "p",
            {
              style: {
                fontSize: height * 0.025,
                color: COLORS.primary,
                marginTop: 15,
                letterSpacing: 1
              },
              children: "5 Winners, Same Rules?"
            }
          )
        ]
      }
    )
  ] });
};
var CheckmarkIcon = ({
  size = 120,
  color = COLORS.accent
}) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", children: [
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12", cy: "12", r: "10", fill: `${color}22`, stroke: color, strokeWidth: "2" }, "k16"),
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "path",
    {
      d: "M8 12l3 3 5-6",
      stroke: color,
      strokeWidth: "3",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      fill: "none"
    }
  )
] });
var Scene7 = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const checkProgress = (0, import_remotion.spring)({
    frame: frame - 10,
    fps,
    config: SPRING_CONFIG
  });
  const checkPulse = (0, import_remotion.interpolate)(
    frame % 50 / 50,
    [0, 0.5, 1],
    [1, 1.08, 1],
    { extrapolateRight: "clamp" }
  );
  const promptOpacity = (0, import_remotion.interpolate)(frame, [30, 55], [0, 1], { extrapolateRight: "clamp" });
  const promptY = (0, import_remotion.interpolate)(frame, [30, 55], [20, 0], { extrapolateRight: "clamp" });
  const presenterProgress = (0, import_remotion.interpolate)(frame, [70, 100], [0, 1], { extrapolateRight: "clamp" });
  const presenterY = (0, import_remotion.interpolate)(presenterProgress, [0, 1], [80, 0], { extrapolateRight: "clamp" });
  const socialOpacity = (0, import_remotion.interpolate)(frame, [110, 140], [0, 1], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: width / 2,
          top: height * 0.28,
          transform: `translateX(-50%) scale(${Math.min(checkProgress, 1) * checkPulse})`
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              filter: `drop-shadow(0 0 40px ${COLORS.accent}88) drop-shadow(0 0 80px ${COLORS.accent}44)`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckmarkIcon, { size: height * 0.12 }, "k17")
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.45,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: promptOpacity,
          transform: `translateY(${promptY}px)`
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "h1",
            {
              style: {
                fontSize: height * 0.04,
                fontWeight: 700,
                color: COLORS.white,
                letterSpacing: 3,
                margin: 0,
                textShadow: `0 0 30px ${COLORS.accent}44`
              },
              children: "Share Your Solution"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "p",
            {
              style: {
                fontSize: height * 0.022,
                color: COLORS.primary,
                marginTop: 20,
                opacity: 0.8
              },
              children: "Comment below with your approach!"
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
          bottom: height * 0.2,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: presenterProgress,
          transform: `translateY(${presenterY}px)`
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "div",
          {
            style: {
              display: "inline-block",
              padding: "20px 40px",
              background: COLORS.glass,
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: `1px solid ${COLORS.glassStroke}`,
              borderRadius: 16
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "div",
                {
                  style: {
                    fontSize: height * 0.028,
                    fontWeight: 700,
                    color: COLORS.white
                  },
                  children: "Prasanna"
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "div",
                {
                  style: {
                    fontSize: height * 0.018,
                    color: COLORS.primary,
                    marginTop: 8,
                    opacity: 0.8
                  },
                  children: "Technical Architect at Zoho"
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
          position: "absolute",
          bottom: height * 0.08,
          left: width * 0.1,
          opacity: socialOpacity
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "div",
          {
            style: {
              fontSize: height * 0.018,
              color: COLORS.white,
              opacity: 0.7,
              display: "flex",
              alignItems: "center",
              gap: 8
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.primary }, children: "@" }, "k18"),
              " Follow for more"
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
          bottom: height * 0.08,
          right: width * 0.1,
          opacity: socialOpacity
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "div",
          {
            style: {
              fontSize: height * 0.018,
              color: COLORS.white,
              opacity: 0.7,
              display: "flex",
              alignItems: "center",
              gap: 8
            },
            children: [
              "Subscribe ",
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.warning }, children: "\u2665" }, "k19")
            ]
          }
        )
      }
    ),
    Array.from({ length: 12 }).map((_, i) => {
      const angle = i / 12 * Math.PI * 2;
      const radius = 300 + Math.sin(frame * 0.02 + i) * 50;
      const x = width / 2 + Math.cos(angle + frame * 5e-3) * radius;
      const y = height * 0.35 + Math.sin(angle + frame * 5e-3) * (radius * 0.3);
      const opacity = 0.15 + Math.sin(frame * 0.03 + i) * 0.1;
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
            background: COLORS.accent,
            opacity
          }
        },
        i
      );
    })
  ] });
};
var MainComposition = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: { backgroundColor: COLORS.dark }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AnimatedBackground, {}, "bg"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene1.start, durationInFrames: TIMING.scene1.end - TIMING.scene1.start, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene1, {}) }, "scene1"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene2.start, durationInFrames: TIMING.scene2.end - TIMING.scene2.start, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene2, {}) }, "scene2"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene3.start, durationInFrames: TIMING.scene3.end - TIMING.scene3.start, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene3, {}) }, "scene3"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene4.start, durationInFrames: TIMING.scene4.end - TIMING.scene4.start, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene4, {}) }, "scene4"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene5.start, durationInFrames: TIMING.scene5.end - TIMING.scene5.start, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene5, {}) }, "scene5"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene6.start, durationInFrames: TIMING.scene6.end - TIMING.scene6.start, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene6, {}) }, "scene6"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.scene7.start, durationInFrames: TIMING.scene7.end - TIMING.scene7.start, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene7, {}) }, "scene7")
  ] });
};
var RemotionRoot = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_remotion.Composition,
    {
      id: "proj_c9b2ab0e_8fbc_4e9a_a15e_252f94536675",
      component: MainComposition,
      durationInFrames: TIMING.totalFrames,
      fps: VIDEO.fps,
      width: VIDEO.width,
      height: VIDEO.height
    }
  );
};
var index_default = MainComposition;
(0, import_remotion.registerRoot)(RemotionRoot);
