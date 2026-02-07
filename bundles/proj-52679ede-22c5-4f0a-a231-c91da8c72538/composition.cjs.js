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

// src/proj_52679ede_22c5_4f0a_a231_c91da8c72538/index.tsx
var index_exports = {};
__export(index_exports, {
  RemotionRoot: () => RemotionRoot,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_remotion10 = require("remotion");

// src/proj_52679ede_22c5_4f0a_a231_c91da8c72538/constants.ts
var COLORS = {
  primary: "#00f5d4",
  // Cyan - timing wheels and positive elements
  secondary: "#7b2cbf",
  // Purple - background depth
  accent: "#f72585",
  // Magenta - problems and warnings
  success: "#00ff88",
  // Bright Green - solution highlights
  dark: "#0a0a0f",
  // Deep background
  white: "#ffffff",
  gray: "#4a4a5a"
};
var SPRING_CONFIG = { damping: 22, stiffness: 90, mass: 0.9 };
var TIMING = {
  scene1Start: 0,
  scene1End: 120,
  scene2Start: 120,
  scene2End: 602,
  scene3Start: 602,
  scene3End: 1167,
  scene4Start: 1167,
  scene4End: 1268,
  scene5Start: 1268,
  scene5End: 1635,
  scene6Start: 1635,
  scene6End: 2258,
  scene7Start: 2258,
  scene7End: 2645,
  scene8Start: 2645,
  scene8End: 2967
};
var KEY_SYNCS = {
  challenge: 43,
  // "challenge" word - box materializes
  binary: 404,
  // "binary" - heap assembles
  but: 611,
  // "But" - scene shifts, warnings appear
  yes: 1193,
  // "Yes" - timing wheel emerges
  picture: 1279,
  // "Picture" - clock face assembles
  what: 1642,
  // "What" - second wheel slides in
  this: 2423,
  // "This" - logos appear
  follow: 2770
  // "Follow" - button pulses
};
var VIDEO_CONFIG = {
  fps: 30,
  width: 1080,
  height: 1920,
  durationInFrames: 2967
};

// src/proj_52679ede_22c5_4f0a_a231_c91da8c72538/components/Background.tsx
var import_remotion = require("remotion");
var import_jsx_runtime = require("react/jsx-runtime");
var Background = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height } = (0, import_remotion.useVideoConfig)();
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: { backgroundColor: COLORS.dark }, children: [
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
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "svg",
      {
        style: {
          position: "absolute",
          width: "100%",
          height: "100%",
          opacity: 0.08
        },
        children: [
          Array.from({ length: 12 }).map((_, i) => {
            const x = width / 12 * (i + 0.5);
            const yOffset = (frame * 0.5 + i * 20) % 60 - 30;
            return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "line",
              {
                x1: x,
                y1: 0,
                x2: x,
                y2: height,
                stroke: COLORS.primary,
                strokeWidth: 1,
                strokeDasharray: "4 8",
                transform: `translate(0, ${yOffset})`
              },
              `v-${i}`
            );
          }),
          Array.from({ length: 20 }).map((_, i) => {
            const y = height / 20 * (i + 0.5);
            const xOffset = (frame * 0.3 + i * 15) % 40 - 20;
            return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "line",
              {
                x1: 0,
                y1: y,
                x2: width,
                y2: y,
                stroke: COLORS.secondary,
                strokeWidth: 1,
                strokeDasharray: "2 12",
                transform: `translate(${xOffset}, 0)`
              },
              `h-${i}`
            );
          })
        ]
      }
    ),
    Array.from({ length: 20 }).map((_, i) => {
      const baseX = i * 137.5 % width;
      const baseY = i * 89.3 % height;
      const floatX = (0, import_remotion.interpolate)(
        (frame + i * 30) % 180,
        [0, 90, 180],
        [0, 20, 0],
        { extrapolateRight: "clamp" }
      );
      const floatY = (0, import_remotion.interpolate)(
        (frame + i * 45) % 240,
        [0, 120, 240],
        [0, -30, 0],
        { extrapolateRight: "clamp" }
      );
      const opacity = (0, import_remotion.interpolate)(
        (frame + i * 20) % 120,
        [0, 60, 120],
        [0.1, 0.4, 0.1],
        { extrapolateRight: "clamp" }
      );
      const size = 3 + i % 4 * 2;
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: baseX + floatX,
            top: baseY + floatY,
            width: size,
            height: size,
            borderRadius: "50%",
            background: i % 2 === 0 ? COLORS.primary : COLORS.secondary,
            opacity,
            boxShadow: `0 0 ${size * 2}px ${i % 2 === 0 ? COLORS.primary : COLORS.secondary}`
          }
        },
        `particle-${i}`
      );
    }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          width: "100%",
          height: "100%",
          background: `radial-gradient(ellipse at center, transparent 40%, ${COLORS.dark}dd 100%)`,
          pointerEvents: "none"
        }
      }
    )
  ] });
};

// src/proj_52679ede_22c5_4f0a_a231_c91da8c72538/scenes/Scene1.tsx
var import_remotion2 = require("remotion");

// src/proj_52679ede_22c5_4f0a_a231_c91da8c72538/components/Icons.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var GearIcon = ({ size = 24, color = "currentColor" }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { fill: color, d: "M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5a3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97s-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1s.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64z" }) });
var WarningIcon = ({ size = 24, color = "currentColor" }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 16 16", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { fill: color, d: "M14.57 13.54L8.39 1.63c-.34-.67-1.43-.67-1.78 0L.43 13.54c-.16.31-.15.68.03.98s.51.48.86.48h12.36c.35 0 .67-.18.85-.48s.2-.67.04-.98M7 6c0-.28.22-.5.5-.5s.5.22.5.5v3.5c0 .28-.22.5-.5.5S7 9.78 7 9.5zm.5 7c-.55 0-1-.45-1-1s.45-1 1-1s1 .45 1 1s-.45 1-1 1" }) });
var CheckCircleIcon = ({ size = 24, color = "currentColor" }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { fill: color, d: "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10s10-4.5 10-10S17.5 2 12 2m-2 15l-5-5l1.41-1.41L10 14.17l7.59-7.59L19 8z" }) });
var ClockIcon = ({ size = 24, color = "currentColor" }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { fill: color, d: "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10s10-4.5 10-10S17.5 2 12 2m.5 11H11V7h1.5z" }) });
var NetworkNodeIcon = ({ size = 24, color = "currentColor" }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { fill: color, d: "M5.5 22q-1.45 0-2.475-1.025T2 18.5t1.025-2.475T5.5 15q.45 0 .875.112t.8.313L11 11.6V8.85q-1.1-.325-1.8-1.237T8.5 5.5q0-1.45 1.025-2.475T12 2t2.475 1.025T15.5 5.5q0 1.2-.7 2.113T13 8.85v2.75l3.85 3.825q.375-.2.788-.312T18.5 15q1.45 0 2.475 1.025T22 18.5t-1.025 2.475T18.5 22t-2.475-1.025T15 18.5q0-.45.112-.875t.313-.8L12 13.4l-3.425 3.425q.2.375.313.8T9 18.5q0 1.45-1.025 2.475T5.5 22m13-2q.625 0 1.063-.437T20 18.5t-.437-1.062T18.5 17t-1.062.438T17 18.5t.438 1.063T18.5 20M12 7q.625 0 1.063-.437T13.5 5.5t-.437-1.062T12 4t-1.062.438T10.5 5.5t.438 1.063T12 7M5.5 20q.625 0 1.063-.437T7 18.5t-.437-1.062T5.5 17t-1.062.438T4 18.5t.438 1.063T5.5 20" }) });
var FollowIcon = ({ size = 24, color = "currentColor" }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", children: [
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { fill: color, cx: "12", cy: "8", r: "4" }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { fill: color, d: "M12 14c-4.42 0-8 1.79-8 4v2h16v-2c0-2.21-3.58-4-8-4z" }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { fill: color, d: "M20 9v2h2V9h-2zm0 4v2h2v-2h-2z", opacity: "0.6" })
] });

// src/proj_52679ede_22c5_4f0a_a231_c91da8c72538/scenes/Scene1.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var RotatingGear = ({ x, y, size, speed, delay, opacity }) => {
  const frame = (0, import_remotion2.useCurrentFrame)();
  const rotation = (frame + delay) * speed;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        transform: `rotate(${rotation}deg)`,
        opacity
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(GearIcon, { size, color: COLORS.secondary })
    }
  );
};
var NetworkParticle = ({ index }) => {
  const frame = (0, import_remotion2.useCurrentFrame)();
  const { width, height } = (0, import_remotion2.useVideoConfig)();
  const baseX = index * 97 % width;
  const speed = 1 + index % 3 * 0.5;
  const yPosition = (frame * speed + index * 150) % (height + 100) - 50;
  const opacity = (0, import_remotion2.interpolate)(
    yPosition,
    [0, height * 0.3, height * 0.7, height],
    [0, 0.6, 0.6, 0],
    { extrapolateRight: "clamp" }
  );
  const size = 12 + index % 4 * 4;
  const xOffset = (0, import_remotion2.interpolate)(
    (frame + index * 20) % 60,
    [0, 30, 60],
    [-10, 10, -10],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: baseX + xOffset,
        top: yPosition,
        opacity
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(NetworkNodeIcon, { size, color: COLORS.primary })
    }
  );
};
var ChallengeBox = () => {
  const frame = (0, import_remotion2.useCurrentFrame)();
  const { fps } = (0, import_remotion2.useVideoConfig)();
  const scaleProgress = (0, import_remotion2.spring)({
    frame,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 120 }
  });
  const impactPulse = (0, import_remotion2.interpolate)(
    frame,
    [KEY_SYNCS.challenge - 3, KEY_SYNCS.challenge, KEY_SYNCS.challenge + 10],
    [0, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const glowIntensity = (0, import_remotion2.interpolate)(
    frame,
    [0, 20, KEY_SYNCS.challenge, 60],
    [0, 0.5, 1, 0.7],
    { extrapolateRight: "clamp" }
  );
  const boxWidth = 60;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        top: "30%",
        left: "50%",
        transform: `translateX(-50%) scale(${scaleProgress * (1 + impactPulse * 0.08)})`,
        width: `${boxWidth}%`,
        padding: "40px 30px",
        background: `linear-gradient(135deg, ${COLORS.dark}ee, ${COLORS.secondary}33)`,
        backdropFilter: "blur(20px)",
        border: `3px solid ${COLORS.primary}`,
        borderRadius: 20,
        boxShadow: `
          0 0 ${20 + impactPulse * 40}px ${COLORS.primary}${Math.round(glowIntensity * 99).toString().padStart(2, "0")},
          0 0 ${40 + impactPulse * 60}px ${COLORS.primary}55,
          inset 0 0 30px ${COLORS.primary}22
        `,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: -2,
              left: -2,
              width: 40,
              height: 40,
              borderTop: `4px solid ${COLORS.accent}`,
              borderLeft: `4px solid ${COLORS.accent}`,
              borderRadius: "20px 0 0 0"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: -2,
              right: -2,
              width: 40,
              height: 40,
              borderTop: `4px solid ${COLORS.accent}`,
              borderRight: `4px solid ${COLORS.accent}`,
              borderRadius: "0 20px 0 0"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              bottom: -2,
              left: -2,
              width: 40,
              height: 40,
              borderBottom: `4px solid ${COLORS.accent}`,
              borderLeft: `4px solid ${COLORS.accent}`,
              borderRadius: "0 0 0 20px"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              bottom: -2,
              right: -2,
              width: 40,
              height: 40,
              borderBottom: `4px solid ${COLORS.accent}`,
              borderRight: `4px solid ${COLORS.accent}`,
              borderRadius: "0 0 20px 0"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "div",
          {
            style: {
              fontSize: 56,
              fontWeight: 900,
              fontFamily: "system-ui, sans-serif",
              color: COLORS.white,
              textAlign: "center",
              textTransform: "uppercase",
              letterSpacing: 4,
              textShadow: `
            0 0 10px ${COLORS.primary},
            0 0 20px ${COLORS.primary}88
          `
            },
            children: "System Design"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "div",
          {
            style: {
              fontSize: 72,
              fontWeight: 900,
              fontFamily: "system-ui, sans-serif",
              color: COLORS.primary,
              textAlign: "center",
              textTransform: "uppercase",
              letterSpacing: 6,
              textShadow: `
            0 0 15px ${COLORS.primary},
            0 0 30px ${COLORS.primary}88,
            0 0 45px ${COLORS.primary}44
          `
            },
            children: "Challenge"
          }
        )
      ]
    }
  );
};
var Scene1 = ({ startFrame = 0 }) => {
  const frame = (0, import_remotion2.useCurrentFrame)();
  (0, import_remotion2.useVideoConfig)();
  const fadeIn = (0, import_remotion2.interpolate)(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_remotion2.AbsoluteFill, { style: { opacity: fadeIn }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(RotatingGear, { x: 80, y: 200, size: 80, speed: 0.5, delay: 0, opacity: 0.15 }, "gear1"),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(RotatingGear, { x: 920, y: 350, size: 60, speed: -0.3, delay: 20, opacity: 0.12 }, "gear2"),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(RotatingGear, { x: 150, y: 1400, size: 100, speed: 0.4, delay: 40, opacity: 0.1 }, "gear3"),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(RotatingGear, { x: 850, y: 1200, size: 70, speed: -0.6, delay: 60, opacity: 0.15 }, "gear4"),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(RotatingGear, { x: 500, y: 1600, size: 90, speed: 0.35, delay: 80, opacity: 0.08 }, "gear5"),
    Array.from({ length: 15 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(NetworkParticle, { index: i }, `net-${i}`)),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ChallengeBox, {}),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "25%",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 28,
          fontWeight: 500,
          fontFamily: "system-ui, sans-serif",
          color: COLORS.gray,
          textAlign: "center",
          opacity: (0, import_remotion2.interpolate)(frame, [30, 50], [0, 0.8], { extrapolateRight: "clamp" })
        },
        children: "How do you handle millions of connections?"
      }
    )
  ] });
};

// src/proj_52679ede_22c5_4f0a_a231_c91da8c72538/scenes/Scene2.tsx
var import_remotion3 = require("remotion");
var import_jsx_runtime4 = require("react/jsx-runtime");
var TaskOrb = ({ index, panelHeight, panelWidth }) => {
  const frame = (0, import_remotion3.useCurrentFrame)();
  const speed = 2 + index % 3;
  const startY = -50 - index * 40 % 200;
  const y = startY + frame * speed;
  const wrappedY = (y % (panelHeight + 100) + panelHeight + 100) % (panelHeight + 100) - 50;
  const x = 60 + index * 47 % (panelWidth - 120);
  const xWobble = (0, import_remotion3.interpolate)(
    (frame + index * 15) % 40,
    [0, 20, 40],
    [-8, 8, -8],
    { extrapolateRight: "clamp" }
  );
  const size = 14 + index % 4 * 4;
  const opacity = (0, import_remotion3.interpolate)(
    wrappedY,
    [0, 100, panelHeight - 100, panelHeight],
    [0, 0.9, 0.9, 0.3],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x + xWobble,
        top: wrappedY,
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle at 30% 30%, ${COLORS.primary}, ${COLORS.secondary})`,
        boxShadow: `0 0 ${size}px ${COLORS.primary}88`,
        opacity
      }
    }
  );
};
var HeapNode = ({ x, y, size, delay, value, isPulsing = false }) => {
  const frame = (0, import_remotion3.useCurrentFrame)();
  const { fps } = (0, import_remotion3.useVideoConfig)();
  const scaleProgress = (0, import_remotion3.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG
  });
  const pulseScale = isPulsing ? (0, import_remotion3.interpolate)((frame - delay) % 30, [0, 15, 30], [1, 1.15, 1], { extrapolateRight: "clamp" }) : 1;
  const scale = Math.max(0, scaleProgress) * pulseScale;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle at 30% 30%, ${COLORS.secondary}, ${COLORS.accent}88)`,
        border: `2px solid ${COLORS.secondary}`,
        boxShadow: isPulsing ? `0 0 20px ${COLORS.accent}88` : `0 0 10px ${COLORS.secondary}66`,
        transform: `scale(${scale})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: 700,
        color: COLORS.white,
        fontFamily: "system-ui, sans-serif"
      },
      children: value
    }
  );
};
var HeapConnection = ({ x1, y1, x2, y2, delay }) => {
  const frame = (0, import_remotion3.useCurrentFrame)();
  const { fps } = (0, import_remotion3.useVideoConfig)();
  const progress = (0, import_remotion3.spring)({
    frame: frame - delay,
    fps,
    config: { ...SPRING_CONFIG, damping: 30 }
  });
  const opacity = Math.max(0, progress);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "line",
    {
      x1,
      y1,
      x2: x1 + (x2 - x1) * progress,
      y2: y1 + (y2 - y1) * progress,
      stroke: COLORS.secondary,
      strokeWidth: 3,
      opacity: opacity * 0.7
    }
  );
};
var BinaryHeapTree = ({ width, height }) => {
  const frame = (0, import_remotion3.useCurrentFrame)();
  const heapValues = [1, 3, 2, 7, 6, 4, 5, 15, 12, 9, 8];
  const nodeSize = 50;
  const levelHeight = 90;
  const centerX = width / 2;
  const startY = 80;
  const getNodePosition = (index) => {
    const level = Math.floor(Math.log2(index + 1));
    const levelStart = Math.pow(2, level) - 1;
    const positionInLevel = index - levelStart;
    const nodesInLevel = Math.pow(2, level);
    const levelWidth = width * 0.85;
    const spacing = levelWidth / nodesInLevel;
    const x = centerX - levelWidth / 2 + spacing * (positionInLevel + 0.5);
    const y = startY + level * levelHeight;
    return { x, y };
  };
  const pulsingNode = Math.floor(frame / 20 % heapValues.length);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { position: "relative", width: "100%", height: "100%" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "svg",
      {
        style: {
          position: "absolute",
          width: "100%",
          height: "100%"
        },
        children: heapValues.slice(0, -1).map((_, i) => {
          const leftChild = 2 * i + 1;
          const rightChild = 2 * i + 2;
          const parent = getNodePosition(i);
          return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("g", { children: [
            leftChild < heapValues.length && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              HeapConnection,
              {
                x1: parent.x,
                y1: parent.y + nodeSize / 2,
                x2: getNodePosition(leftChild).x,
                y2: getNodePosition(leftChild).y - nodeSize / 2,
                delay: i * 8 + 20
              }
            ),
            rightChild < heapValues.length && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              HeapConnection,
              {
                x1: parent.x,
                y1: parent.y + nodeSize / 2,
                x2: getNodePosition(rightChild).x,
                y2: getNodePosition(rightChild).y - nodeSize / 2,
                delay: i * 8 + 24
              }
            )
          ] }, `conn-${i}`);
        })
      }
    ),
    heapValues.map((value, i) => {
      const pos = getNodePosition(i);
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        HeapNode,
        {
          x: pos.x,
          y: pos.y,
          size: nodeSize,
          delay: i * 8,
          value,
          isPulsing: i === pulsingNode && frame > 60
        },
        `node-${i}`
      );
    }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: 40,
          left: "50%",
          transform: "translateX(-50%)",
          padding: "12px 24px",
          background: `${COLORS.dark}cc`,
          border: `2px solid ${COLORS.accent}`,
          borderRadius: 12,
          fontSize: 28,
          fontWeight: 700,
          fontFamily: "monospace",
          color: COLORS.accent
        },
        children: "O(log n) per insert"
      }
    )
  ] });
};
var TaskCounter = () => {
  const frame = (0, import_remotion3.useCurrentFrame)();
  const count = Math.round(
    (0, import_remotion3.interpolate)(frame, [0, 300], [0, 1e6], { extrapolateRight: "clamp" })
  );
  const formattedCount = count.toLocaleString();
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        top: "5%",
        left: "50%",
        transform: "translateX(-50%)",
        padding: "16px 40px",
        background: `linear-gradient(135deg, ${COLORS.dark}ee, ${COLORS.secondary}22)`,
        border: `2px solid ${COLORS.primary}`,
        borderRadius: 16,
        fontSize: 36,
        fontWeight: 700,
        fontFamily: "system-ui, sans-serif",
        color: COLORS.white,
        textAlign: "center",
        boxShadow: `0 0 20px ${COLORS.primary}44`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { color: COLORS.gray, fontSize: 24 }, children: "TASKS: " }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { fontVariantNumeric: "tabular-nums", color: COLORS.primary }, children: formattedCount })
      ]
    }
  );
};
var Scene2 = ({ startFrame = 0 }) => {
  const frame = (0, import_remotion3.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion3.useVideoConfig)();
  const splitProgress = (0, import_remotion3.spring)({
    frame,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 60 }
  });
  const panelWidth = width * 0.45;
  const panelHeight = height * 0.65;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_remotion3.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(TaskCounter, {}),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          left: `${2.5 + (1 - splitProgress) * 50}%`,
          top: "18%",
          width: panelWidth,
          height: panelHeight,
          overflow: "hidden",
          borderRadius: 20,
          background: `${COLORS.dark}88`,
          border: `1px solid ${COLORS.primary}44`,
          opacity: splitProgress
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                top: 20,
                left: 20,
                fontSize: 24,
                fontWeight: 600,
                color: COLORS.primary,
                fontFamily: "system-ui, sans-serif"
              },
              children: "Incoming Tasks"
            }
          ),
          Array.from({ length: 25 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            TaskOrb,
            {
              index: i,
              panelHeight,
              panelWidth
            },
            `orb-${i}`
          ))
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: "50%",
          top: "15%",
          width: 2,
          height: "70%",
          background: `linear-gradient(to bottom, transparent, ${COLORS.primary}88, ${COLORS.primary}88, transparent)`,
          transform: `scaleY(${splitProgress})`,
          transformOrigin: "top"
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          right: `${2.5 + (1 - splitProgress) * 50}%`,
          top: "18%",
          width: panelWidth,
          height: panelHeight,
          overflow: "hidden",
          borderRadius: 20,
          background: `${COLORS.dark}88`,
          border: `1px solid ${COLORS.secondary}44`,
          opacity: splitProgress
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                top: 20,
                left: 20,
                fontSize: 24,
                fontWeight: 600,
                color: COLORS.secondary,
                fontFamily: "system-ui, sans-serif"
              },
              children: "Priority Queue (Binary Heap)"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BinaryHeapTree, { width: panelWidth, height: panelHeight })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "8%",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 26,
          fontWeight: 500,
          color: COLORS.gray,
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          opacity: (0, import_remotion3.interpolate)(frame, [60, 90], [0, 1], { extrapolateRight: "clamp" })
        },
        children: "The intuitive solution: sort tasks by expiration time"
      }
    )
  ] });
};

// src/proj_52679ede_22c5_4f0a_a231_c91da8c72538/scenes/Scene3.tsx
var import_remotion4 = require("remotion");
var import_jsx_runtime5 = require("react/jsx-runtime");
var StressedHeapNode = ({ x, y, size, value, stressLevel }) => {
  const frame = (0, import_remotion4.useCurrentFrame)();
  const shakeX = stressLevel > 0.3 ? (0, import_remotion4.interpolate)(frame * 3 % 8, [0, 2, 4, 6, 8], [-3, 3, -2, 2, -3]) * stressLevel : 0;
  const shakeY = stressLevel > 0.3 ? (0, import_remotion4.interpolate)((frame * 3 + 2) % 8, [0, 2, 4, 6, 8], [-2, 2, -3, 3, -2]) * stressLevel : 0;
  const nodeColor = stressLevel > 0.5 ? COLORS.accent : COLORS.secondary;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x - size / 2 + shakeX,
        top: y - size / 2 + shakeY,
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle at 30% 30%, ${nodeColor}, ${COLORS.accent}88)`,
        border: `2px solid ${nodeColor}`,
        boxShadow: stressLevel > 0.5 ? `0 0 ${20 + stressLevel * 20}px ${COLORS.accent}aa` : `0 0 10px ${COLORS.secondary}66`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.35,
        fontWeight: 700,
        color: COLORS.white,
        fontFamily: "system-ui, sans-serif"
      },
      children: value
    }
  );
};
var GrindingGear = ({ x, y, size, speed, stressLevel }) => {
  const frame = (0, import_remotion4.useCurrentFrame)();
  const baseRotation = frame * speed;
  const stutter = stressLevel > 0.5 ? (0, import_remotion4.interpolate)(frame * 2 % 10, [0, 3, 5, 7, 10], [0, -5, 0, 5, 0]) : 0;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        transform: `rotate(${baseRotation + stutter}deg)`,
        opacity: 0.4 + stressLevel * 0.3
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(GearIcon, { size, color: stressLevel > 0.5 ? COLORS.accent : COLORS.secondary })
    }
  );
};
var WarningIndicator = ({ x, y, delay }) => {
  const frame = (0, import_remotion4.useCurrentFrame)();
  const { fps } = (0, import_remotion4.useVideoConfig)();
  const appear = (0, import_remotion4.spring)({
    frame: frame - delay,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 150 }
  });
  const pulse = (0, import_remotion4.interpolate)(
    (frame - delay) % 20,
    [0, 10, 20],
    [1, 1.2, 1],
    { extrapolateRight: "clamp" }
  );
  if (appear <= 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        transform: `scale(${appear * pulse})`,
        filter: `drop-shadow(0 0 10px ${COLORS.accent})`
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(WarningIcon, { size: 50, color: COLORS.accent })
    }
  );
};
var PerformanceGraph = ({ stressLevel }) => {
  const frame = (0, import_remotion4.useCurrentFrame)();
  const { fps } = (0, import_remotion4.useVideoConfig)();
  const graphAppear = (0, import_remotion4.spring)({
    frame: frame - 30,
    fps,
    config: SPRING_CONFIG
  });
  const lineProgress = (0, import_remotion4.interpolate)(frame, [30, 200], [0, 1], { extrapolateRight: "clamp" });
  const graphWidth = 600;
  const graphHeight = 200;
  const points = [];
  for (let i = 0; i <= 50; i++) {
    const x = i / 50 * graphWidth;
    const normalizedX = i / 50;
    const y = graphHeight - Math.log(normalizedX * 10 + 1) / Math.log(11) * graphHeight * 0.85 * Math.min(1, lineProgress * 2);
    if (i <= lineProgress * 50) {
      points.push(`${x},${y}`);
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        bottom: "12%",
        left: "50%",
        transform: `translateX(-50%) scale(${graphAppear})`,
        width: graphWidth + 100,
        height: graphHeight + 80,
        background: `${COLORS.dark}dd`,
        border: `2px solid ${COLORS.accent}44`,
        borderRadius: 16,
        padding: 20
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              fontSize: 22,
              fontWeight: 600,
              color: COLORS.accent,
              fontFamily: "system-ui, sans-serif",
              marginBottom: 10,
              textAlign: "center"
            },
            children: "Time Complexity: O(log n) per operation"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("svg", { width: graphWidth + 60, height: graphHeight + 20, style: { marginLeft: 20 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("line", { x1: 30, y1: graphHeight, x2: graphWidth + 30, y2: graphHeight, stroke: COLORS.gray, strokeWidth: 2 }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("line", { x1: 30, y1: 0, x2: 30, y2: graphHeight, stroke: COLORS.gray, strokeWidth: 2 }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("text", { x: graphWidth / 2 + 30, y: graphHeight + 18, fill: COLORS.gray, fontSize: 14, textAnchor: "middle", children: "Number of Tasks" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("text", { x: 10, y: graphHeight / 2, fill: COLORS.gray, fontSize: 14, textAnchor: "middle", transform: `rotate(-90, 10, ${graphHeight / 2})`, children: "Time" }),
          points.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "polyline",
            {
              points: points.map((p) => {
                const [px, py] = p.split(",").map(Number);
                return `${px + 30},${py}`;
              }).join(" "),
              fill: "none",
              stroke: COLORS.accent,
              strokeWidth: 4,
              strokeLinecap: "round",
              strokeLinejoin: "round"
            }
          ),
          lineProgress > 0.7 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "rect",
            {
              x: graphWidth * 0.7 + 30,
              y: 0,
              width: graphWidth * 0.3,
              height: graphHeight,
              fill: `${COLORS.accent}22`,
              opacity: stressLevel
            }
          )
        ] })
      ]
    }
  );
};
var BottleneckOrbs = ({ stressLevel }) => {
  const frame = (0, import_remotion4.useCurrentFrame)();
  const orbCount = Math.floor((0, import_remotion4.interpolate)(frame, [0, 200], [0, 20], { extrapolateRight: "clamp" }));
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_jsx_runtime5.Fragment, { children: Array.from({ length: orbCount }).map((_, i) => {
    const row = Math.floor(i / 5);
    const col = i % 5;
    const baseX = 440 + col * 45;
    const baseY = 700 + row * 40;
    const jitterX = stressLevel > 0.5 ? (0, import_remotion4.interpolate)((frame + i * 7) % 6, [0, 3, 6], [-3, 3, -3]) : 0;
    const jitterY = stressLevel > 0.5 ? (0, import_remotion4.interpolate)((frame + i * 5) % 6, [0, 3, 6], [-2, 2, -2]) : 0;
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: baseX + jitterX,
          top: baseY + jitterY,
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: `radial-gradient(circle at 30% 30%, ${COLORS.primary}, ${COLORS.accent}88)`,
          boxShadow: `0 0 12px ${COLORS.primary}66`,
          opacity: 0.8
        }
      },
      `bottleneck-${i}`
    );
  }) });
};
var Scene3 = ({ startFrame = 0 }) => {
  const frame = (0, import_remotion4.useCurrentFrame)();
  const { width } = (0, import_remotion4.useVideoConfig)();
  const stressLevel = (0, import_remotion4.interpolate)(frame, [0, 400], [0.2, 1], { extrapolateRight: "clamp" });
  const flashOpacity = (0, import_remotion4.interpolate)(
    frame,
    [6, 9, 15, 25],
    [0, 0.4, 0.2, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const screenShake = frame < 30 ? (0, import_remotion4.interpolate)(frame, [6, 9, 20, 30], [0, 1, 0.5, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  const shakeX = screenShake * (0, import_remotion4.interpolate)(frame * 4 % 8, [0, 4, 8], [-8, 8, -8]);
  const shakeY = screenShake * (0, import_remotion4.interpolate)((frame * 4 + 2) % 8, [0, 4, 8], [-5, 5, -5]);
  const heapValues = [1, 3, 2, 7, 6, 4, 5, 15, 12, 9];
  const nodeSize = 55;
  const centerX = width / 2;
  const startY = 180;
  const levelHeight = 100;
  const getNodePosition = (index) => {
    const level = Math.floor(Math.log2(index + 1));
    const levelStart = Math.pow(2, level) - 1;
    const positionInLevel = index - levelStart;
    const nodesInLevel = Math.pow(2, level);
    const levelWidth = width * 0.65;
    const spacing = levelWidth / nodesInLevel;
    const x = centerX - levelWidth / 2 + spacing * (positionInLevel + 0.5);
    const y = startY + level * levelHeight;
    return { x, y };
  };
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_remotion4.AbsoluteFill, { style: { transform: `translate(${shakeX}px, ${shakeY}px)` }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          width: "100%",
          height: "100%",
          background: COLORS.accent,
          opacity: flashOpacity,
          pointerEvents: "none",
          zIndex: 100
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "5%",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 42,
          fontWeight: 800,
          color: COLORS.accent,
          fontFamily: "system-ui, sans-serif",
          textShadow: `0 0 20px ${COLORS.accent}88`,
          opacity: (0, import_remotion4.interpolate)(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" })
        },
        children: "THE BOTTLENECK"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(GrindingGear, { x: 100, y: 300, size: 100, speed: 0.8, stressLevel }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(GrindingGear, { x: 880, y: 250, size: 80, speed: -0.6, stressLevel }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(GrindingGear, { x: 150, y: 600, size: 70, speed: 0.5, stressLevel }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(GrindingGear, { x: 850, y: 550, size: 90, speed: -0.7, stressLevel }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(WarningIndicator, { x: 300, y: 200, delay: 15 }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(WarningIndicator, { x: 700, y: 180, delay: 25 }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(WarningIndicator, { x: 200, y: 450, delay: 35 }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(WarningIndicator, { x: 820, y: 400, delay: 45 }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "svg",
      {
        style: {
          position: "absolute",
          width: "100%",
          height: "100%",
          pointerEvents: "none"
        },
        children: heapValues.slice(0, -1).map((_, i) => {
          const leftChild = 2 * i + 1;
          const rightChild = 2 * i + 2;
          const parent = getNodePosition(i);
          return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("g", { children: [
            leftChild < heapValues.length && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "line",
              {
                x1: parent.x,
                y1: parent.y + nodeSize / 2,
                x2: getNodePosition(leftChild).x,
                y2: getNodePosition(leftChild).y - nodeSize / 2,
                stroke: stressLevel > 0.6 ? COLORS.accent : COLORS.secondary,
                strokeWidth: 3,
                opacity: 0.6
              }
            ),
            rightChild < heapValues.length && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "line",
              {
                x1: parent.x,
                y1: parent.y + nodeSize / 2,
                x2: getNodePosition(rightChild).x,
                y2: getNodePosition(rightChild).y - nodeSize / 2,
                stroke: stressLevel > 0.6 ? COLORS.accent : COLORS.secondary,
                strokeWidth: 3,
                opacity: 0.6
              }
            )
          ] }, `conn-${i}`);
        })
      }
    ),
    heapValues.map((value, i) => {
      const pos = getNodePosition(i);
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        StressedHeapNode,
        {
          x: pos.x,
          y: pos.y,
          size: nodeSize,
          value,
          stressLevel
        },
        `stressed-node-${i}`
      );
    }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(BottleneckOrbs, { stressLevel }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(PerformanceGraph, { stressLevel })
  ] });
};

// src/proj_52679ede_22c5_4f0a_a231_c91da8c72538/scenes/Scene4.tsx
var import_remotion5 = require("remotion");
var import_jsx_runtime6 = require("react/jsx-runtime");
var DissolveParticle = ({ index, centerX, centerY }) => {
  const frame = (0, import_remotion5.useCurrentFrame)();
  const angle = index / 30 * Math.PI * 2;
  const speed = 8 + index % 5 * 2;
  const distance = frame * speed;
  const x = centerX + distance * Math.cos(angle);
  const y = centerY + distance * Math.sin(angle);
  const opacity = (0, import_remotion5.interpolate)(frame, [0, 5, 30], [0, 1, 0], { extrapolateRight: "clamp" });
  const size = (0, import_remotion5.interpolate)(frame, [0, 30], [15, 5], { extrapolateRight: "clamp" });
  if (opacity <= 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: "50%",
        background: index % 2 === 0 ? COLORS.accent : COLORS.secondary,
        opacity,
        boxShadow: `0 0 ${size}px ${index % 2 === 0 ? COLORS.accent : COLORS.secondary}`
      }
    }
  );
};
var TimingWheel = ({ size, rotation, scale, glowIntensity }) => {
  const slotCount = 60;
  const outerRadius = size / 2;
  const innerRadius = outerRadius * 0.75;
  const tickLength = outerRadius - innerRadius - 10;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "40%",
        transform: `translate(-50%, -50%) scale(${scale}) rotateZ(${rotation}deg)`,
        width: size,
        height: size,
        transformStyle: "preserve-3d",
        perspective: 1e3
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              border: `4px solid ${COLORS.primary}`,
              boxShadow: `
            0 0 ${20 + glowIntensity * 40}px ${COLORS.primary}aa,
            0 0 ${40 + glowIntensity * 60}px ${COLORS.primary}55,
            inset 0 0 ${30 + glowIntensity * 30}px ${COLORS.primary}33
          `,
              background: `radial-gradient(circle at center, ${COLORS.dark}ee, ${COLORS.secondary}22)`
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: innerRadius * 2,
              height: innerRadius * 2,
              borderRadius: "50%",
              border: `2px solid ${COLORS.primary}66`,
              background: `radial-gradient(circle at center, ${COLORS.dark}, ${COLORS.secondary}11)`
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "svg",
          {
            style: {
              position: "absolute",
              width: "100%",
              height: "100%"
            },
            viewBox: `0 0 ${size} ${size}`,
            children: Array.from({ length: slotCount }).map((_, i) => {
              const angle = i / slotCount * 360 - 90;
              const radians = angle * Math.PI / 180;
              const isMajor = i % 5 === 0;
              const tickStart = outerRadius - 8;
              const tickEnd = tickStart - (isMajor ? tickLength : tickLength * 0.5);
              const x1 = outerRadius + tickStart * Math.cos(radians);
              const y1 = outerRadius + tickStart * Math.sin(radians);
              const x2 = outerRadius + tickEnd * Math.cos(radians);
              const y2 = outerRadius + tickEnd * Math.sin(radians);
              return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                "line",
                {
                  x1,
                  y1,
                  x2,
                  y2,
                  stroke: COLORS.primary,
                  strokeWidth: isMajor ? 3 : 1.5,
                  opacity: isMajor ? 1 : 0.6
                },
                `tick-${i}`
              );
            })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: COLORS.primary,
              boxShadow: `0 0 20px ${COLORS.primary}`
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 4,
              height: innerRadius * 0.8,
              background: `linear-gradient(to top, ${COLORS.primary}, ${COLORS.success})`,
              borderRadius: 2,
              transformOrigin: "bottom center",
              transform: "translateX(-50%) translateY(-100%)",
              boxShadow: `0 0 10px ${COLORS.primary}`
            }
          }
        )
      ]
    }
  );
};
var SuccessIndicator = ({ appear }) => {
  if (appear <= 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        top: "18%",
        left: "50%",
        transform: `translateX(-50%) scale(${appear})`,
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "16px 32px",
        background: `${COLORS.dark}ee`,
        border: `2px solid ${COLORS.success}`,
        borderRadius: 16,
        boxShadow: `0 0 30px ${COLORS.success}44`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(CheckCircleIcon, { size: 40, color: COLORS.success }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "span",
          {
            style: {
              fontSize: 32,
              fontWeight: 700,
              color: COLORS.success,
              fontFamily: "system-ui, sans-serif"
            },
            children: "O(1) Insertion!"
          }
        )
      ]
    }
  );
};
var Scene4 = ({ startFrame = 0 }) => {
  const frame = (0, import_remotion5.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion5.useVideoConfig)();
  const centerX = width / 2;
  const centerY = height * 0.4;
  const wheelScale = (0, import_remotion5.spring)({
    frame: frame - 15,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 80 }
  });
  const rotation = (0, import_remotion5.interpolate)(frame, [15, 100], [0, 30], { extrapolateRight: "clamp" });
  const glowIntensity = (0, import_remotion5.interpolate)(
    frame,
    [20, 26, 40, 60],
    [0.3, 1, 0.7, 0.5],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const successAppear = (0, import_remotion5.spring)({
    frame: frame - 35,
    fps,
    config: SPRING_CONFIG
  });
  const flashOpacity = (0, import_remotion5.interpolate)(
    frame,
    [22, 26, 35],
    [0, 0.3, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_remotion5.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          width: "100%",
          height: "100%",
          background: COLORS.primary,
          opacity: flashOpacity,
          pointerEvents: "none",
          zIndex: 50
        }
      }
    ),
    Array.from({ length: 30 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      DissolveParticle,
      {
        index: i,
        centerX,
        centerY
      },
      `dissolve-${i}`
    )),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      TimingWheel,
      {
        size: 500,
        rotation,
        scale: Math.max(0, wheelScale),
        glowIntensity
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(SuccessIndicator, { appear: Math.max(0, successAppear) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "20%",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 48,
          fontWeight: 800,
          color: COLORS.primary,
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          textShadow: `0 0 20px ${COLORS.primary}88`,
          opacity: (0, import_remotion5.interpolate)(frame, [40, 60], [0, 1], { extrapolateRight: "clamp" })
        },
        children: "TIMING WHEEL"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "12%",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 28,
          fontWeight: 500,
          color: COLORS.gray,
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          opacity: (0, import_remotion5.interpolate)(frame, [55, 75], [0, 1], { extrapolateRight: "clamp" })
        },
        children: "No sorting. Just placement."
      }
    )
  ] });
};

// src/proj_52679ede_22c5_4f0a_a231_c91da8c72538/scenes/Scene5.tsx
var import_remotion6 = require("remotion");
var import_jsx_runtime7 = require("react/jsx-runtime");
var DroppingTask = ({ targetSlot, startFrame, wheelRadius, centerX, centerY }) => {
  const frame = (0, import_remotion6.useCurrentFrame)();
  const { fps } = (0, import_remotion6.useVideoConfig)();
  const localFrame = frame - startFrame;
  if (localFrame < 0) return null;
  const angle = (targetSlot / 60 * 360 - 90) * (Math.PI / 180);
  const slotRadius = wheelRadius * 0.65;
  const targetX = centerX + slotRadius * Math.cos(angle);
  const targetY = centerY + slotRadius * Math.sin(angle);
  const dropProgress = (0, import_remotion6.spring)({
    frame: localFrame,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 100 }
  });
  const startY = centerY - wheelRadius - 100;
  const currentX = centerX + (targetX - centerX) * dropProgress;
  const currentY = startY + (targetY - startY) * dropProgress;
  const glowIntensity = (0, import_remotion6.interpolate)(
    localFrame,
    [20, 30, 50],
    [0, 1, 0.3],
    { extrapolateRight: "clamp" }
  );
  const opacity = (0, import_remotion6.interpolate)(localFrame, [0, 5], [0, 1], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: currentX - 15,
          top: currentY - 15,
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: `radial-gradient(circle at 30% 30%, ${COLORS.primary}, ${COLORS.secondary})`,
          boxShadow: `0 0 ${15 + glowIntensity * 25}px ${COLORS.primary}`,
          opacity,
          zIndex: 20
        }
      }
    ),
    dropProgress > 0.9 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: targetX - 25,
          top: targetY - 25,
          width: 50,
          height: 50,
          borderRadius: "50%",
          border: `3px solid ${COLORS.success}`,
          opacity: glowIntensity,
          boxShadow: `0 0 20px ${COLORS.success}88`
        }
      }
    )
  ] });
};
var DetailedTimingWheel = ({ size, rotation, assemblyProgress }) => {
  const frame = (0, import_remotion6.useCurrentFrame)();
  const slotCount = 60;
  const outerRadius = size / 2;
  const innerRadius = outerRadius * 0.5;
  const slotRadius = outerRadius * 0.65;
  const handRotation = frame * 0.5 % 360;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "42%",
        transform: `translate(-50%, -50%) scale(${assemblyProgress})`,
        width: size,
        height: size
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              border: `5px solid ${COLORS.primary}`,
              boxShadow: `
            0 0 30px ${COLORS.primary}66,
            inset 0 0 40px ${COLORS.primary}22
          `,
              background: `radial-gradient(circle at center, ${COLORS.dark}ee, ${COLORS.secondary}15)`
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "svg",
          {
            style: {
              position: "absolute",
              width: "100%",
              height: "100%"
            },
            viewBox: `0 0 ${size} ${size}`,
            children: Array.from({ length: slotCount }).map((_, i) => {
              const angle = (i / slotCount * 360 - 90) * (Math.PI / 180);
              const isMajor = i % 5 === 0;
              const tickStart = outerRadius - 10;
              const tickEnd = tickStart - (isMajor ? 25 : 12);
              const x1 = outerRadius + tickStart * Math.cos(angle);
              const y1 = outerRadius + tickStart * Math.sin(angle);
              const x2 = outerRadius + tickEnd * Math.cos(angle);
              const y2 = outerRadius + tickEnd * Math.sin(angle);
              const numRadius = outerRadius - 55;
              const numX = outerRadius + numRadius * Math.cos(angle);
              const numY = outerRadius + numRadius * Math.sin(angle);
              const stagger = i * 0.5;
              const tickOpacity = (0, import_remotion6.interpolate)(
                assemblyProgress,
                [0.3 + stagger / 100, 0.5 + stagger / 100],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
              );
              return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("g", { opacity: tickOpacity, children: [
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                  "line",
                  {
                    x1,
                    y1,
                    x2,
                    y2,
                    stroke: isMajor ? COLORS.primary : COLORS.gray,
                    strokeWidth: isMajor ? 3 : 1.5
                  }
                ),
                isMajor && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                  "text",
                  {
                    x: numX,
                    y: numY,
                    fill: COLORS.primary,
                    fontSize: 18,
                    fontWeight: 600,
                    fontFamily: "system-ui, sans-serif",
                    textAnchor: "middle",
                    dominantBaseline: "middle",
                    children: i
                  }
                )
              ] }, `slot-${i}`);
            })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: innerRadius * 2,
              height: innerRadius * 2,
              borderRadius: "50%",
              border: `2px dashed ${COLORS.primary}44`,
              background: `radial-gradient(circle at center, ${COLORS.dark}dd, transparent)`
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: `radial-gradient(circle at 30% 30%, ${COLORS.primary}, ${COLORS.secondary})`,
              boxShadow: `0 0 20px ${COLORS.primary}`
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 6,
              height: slotRadius,
              background: `linear-gradient(to top, ${COLORS.primary}, ${COLORS.success})`,
              borderRadius: 3,
              transformOrigin: "bottom center",
              transform: `translateX(-50%) translateY(-100%) rotate(${handRotation}deg)`,
              boxShadow: `0 0 15px ${COLORS.primary}88`
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, 60px)",
              fontSize: 28,
              fontWeight: 800,
              color: COLORS.success,
              fontFamily: "monospace",
              textShadow: `0 0 15px ${COLORS.success}88`,
              opacity: assemblyProgress > 0.8 ? 1 : 0
            },
            children: "O(1)"
          }
        )
      ]
    }
  );
};
var Scene5 = ({ startFrame = 0 }) => {
  const frame = (0, import_remotion6.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion6.useVideoConfig)();
  const centerX = width / 2;
  const centerY = height * 0.42;
  const wheelRadius = 280;
  const assemblyProgress = (0, import_remotion6.spring)({
    frame,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 60 }
  });
  const taskDrops = [
    { slot: 12, startFrame: 50 },
    { slot: 35, startFrame: 100 },
    { slot: 7, startFrame: 150 },
    { slot: 48, startFrame: 200 },
    { slot: 22, startFrame: 250 }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_remotion6.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "5%",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 40,
          fontWeight: 800,
          color: COLORS.primary,
          fontFamily: "system-ui, sans-serif",
          textShadow: `0 0 20px ${COLORS.primary}66`,
          opacity: (0, import_remotion6.interpolate)(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" })
        },
        children: "60-SLOT TIMING WHEEL"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      DetailedTimingWheel,
      {
        size: wheelRadius * 2,
        rotation: 0,
        assemblyProgress: Math.max(0, assemblyProgress)
      }
    ),
    taskDrops.map((task, i) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      DroppingTask,
      {
        targetSlot: task.slot,
        startFrame: task.startFrame,
        wheelRadius,
        centerX,
        centerY
      },
      `task-${i}`
    )),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "18%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "80%",
          padding: "20px 30px",
          background: `${COLORS.dark}dd`,
          border: `2px solid ${COLORS.primary}44`,
          borderRadius: 16,
          opacity: (0, import_remotion6.interpolate)(frame, [60, 90], [0, 1], { extrapolateRight: "clamp" })
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            "div",
            {
              style: {
                fontSize: 26,
                fontWeight: 600,
                color: COLORS.white,
                fontFamily: "system-ui, sans-serif",
                textAlign: "center",
                marginBottom: 12
              },
              children: "Direct Placement"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            "div",
            {
              style: {
                fontSize: 22,
                color: COLORS.gray,
                fontFamily: "system-ui, sans-serif",
                textAlign: "center"
              },
              children: "Tasks go directly to their time slot - no sorting needed!"
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "8%",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 40
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            "div",
            {
              style: {
                padding: "12px 24px",
                background: `${COLORS.dark}ee`,
                border: `2px solid ${COLORS.success}`,
                borderRadius: 12,
                fontSize: 20,
                fontWeight: 600,
                color: COLORS.success,
                fontFamily: "monospace",
                opacity: (0, import_remotion6.interpolate)(frame, [100, 130], [0, 1], { extrapolateRight: "clamp" })
              },
              children: "Insert: O(1)"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            "div",
            {
              style: {
                padding: "12px 24px",
                background: `${COLORS.dark}ee`,
                border: `2px solid ${COLORS.success}`,
                borderRadius: 12,
                fontSize: 20,
                fontWeight: 600,
                color: COLORS.success,
                fontFamily: "monospace",
                opacity: (0, import_remotion6.interpolate)(frame, [120, 150], [0, 1], { extrapolateRight: "clamp" })
              },
              children: "Remove: O(1)"
            }
          )
        ]
      }
    )
  ] });
};

// src/proj_52679ede_22c5_4f0a_a231_c91da8c72538/scenes/Scene6.tsx
var import_remotion7 = require("remotion");
var import_jsx_runtime8 = require("react/jsx-runtime");
var WheelRing = ({ size, rotation, slotCount, color, label, opacity }) => {
  const outerRadius = size / 2;
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "45%",
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        width: size,
        height: size,
        opacity
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              border: `4px solid ${color}`,
              boxShadow: `0 0 25px ${color}55, inset 0 0 20px ${color}22`,
              background: "transparent"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "svg",
          {
            style: {
              position: "absolute",
              width: "100%",
              height: "100%"
            },
            viewBox: `0 0 ${size} ${size}`,
            children: Array.from({ length: slotCount }).map((_, i) => {
              const angle = (i / slotCount * 360 - 90) * (Math.PI / 180);
              const isMajor = i % (slotCount / 12) === 0;
              const tickStart = outerRadius - 5;
              const tickEnd = tickStart - (isMajor ? 20 : 10);
              const x1 = outerRadius + tickStart * Math.cos(angle);
              const y1 = outerRadius + tickStart * Math.sin(angle);
              const x2 = outerRadius + tickEnd * Math.cos(angle);
              const y2 = outerRadius + tickEnd * Math.sin(angle);
              return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                "line",
                {
                  x1,
                  y1,
                  x2,
                  y2,
                  stroke: color,
                  strokeWidth: isMajor ? 3 : 1.5,
                  opacity: isMajor ? 1 : 0.5
                },
                `tick-${i}`
              );
            })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: `translate(-50%, -50%) rotate(${-rotation}deg)`,
              fontSize: size * 0.08,
              fontWeight: 700,
              color,
              fontFamily: "system-ui, sans-serif",
              textTransform: "uppercase",
              letterSpacing: 2,
              textShadow: `0 0 10px ${color}88`,
              whiteSpace: "nowrap"
            },
            children: label
          }
        )
      ]
    }
  );
};
var CascadeParticle = ({ startFrame, outerRadius, innerRadius, sourceSlot, targetSlot }) => {
  const frame = (0, import_remotion7.useCurrentFrame)();
  const { fps } = (0, import_remotion7.useVideoConfig)();
  const localFrame = frame - startFrame;
  if (localFrame < 0 || localFrame > 60) return null;
  const progress = (0, import_remotion7.spring)({
    frame: localFrame,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 60 }
  });
  const sourceAngle = (sourceSlot / 12 * 360 - 90) * (Math.PI / 180);
  const sourceX = Math.cos(sourceAngle) * outerRadius * 0.85;
  const sourceY = Math.sin(sourceAngle) * outerRadius * 0.85;
  const targetAngle = (targetSlot / 60 * 360 - 90) * (Math.PI / 180);
  const targetX = Math.cos(targetAngle) * innerRadius * 0.65;
  const targetY = Math.sin(targetAngle) * innerRadius * 0.65;
  const x = sourceX + (targetX - sourceX) * progress;
  const y = sourceY + (targetY - sourceY) * progress;
  const opacity = (0, import_remotion7.interpolate)(localFrame, [0, 10, 50, 60], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  const size = 20 + (1 - progress) * 10;
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `calc(50% + ${x}px)`,
        top: `calc(45% + ${y}px)`,
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle at 30% 30%, ${COLORS.success}, ${COLORS.primary})`,
        boxShadow: `0 0 ${size}px ${COLORS.success}88`,
        transform: "translate(-50%, -50%)",
        opacity,
        zIndex: 30
      }
    }
  );
};
var Scene6 = ({ startFrame = 0 }) => {
  const frame = (0, import_remotion7.useCurrentFrame)();
  const { fps, width } = (0, import_remotion7.useVideoConfig)();
  const innerWheelSize = width * 0.4;
  const outerWheelSize = width * 0.75;
  const outerWheelAppear = (0, import_remotion7.spring)({
    frame,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 50 }
  });
  const innerWheelOpacity = (0, import_remotion7.interpolate)(frame, [0, 20], [0.5, 1], { extrapolateRight: "clamp" });
  const innerRotation = frame * 0.3 % 360;
  const outerRotation = frame * 0.1 % 360;
  const cascadeEvents = [
    { startFrame: 80, sourceSlot: 0, targetSlot: 0 },
    { startFrame: 180, sourceSlot: 3, targetSlot: 15 },
    { startFrame: 280, sourceSlot: 6, targetSlot: 30 },
    { startFrame: 380, sourceSlot: 9, targetSlot: 45 }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_remotion7.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "4%",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 38,
          fontWeight: 800,
          color: COLORS.primary,
          fontFamily: "system-ui, sans-serif",
          textShadow: `0 0 20px ${COLORS.primary}66`,
          opacity: (0, import_remotion7.interpolate)(frame, [20, 50], [0, 1], { extrapolateRight: "clamp" }),
          textAlign: "center"
        },
        children: "HIERARCHICAL TIMING WHEELS"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      WheelRing,
      {
        size: outerWheelSize,
        rotation: outerRotation,
        slotCount: 12,
        color: COLORS.secondary,
        label: "MINUTES",
        opacity: Math.max(0, outerWheelAppear)
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      WheelRing,
      {
        size: innerWheelSize,
        rotation: innerRotation,
        slotCount: 60,
        color: COLORS.primary,
        label: "SECONDS",
        opacity: innerWheelOpacity
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: "50%",
          top: "45%",
          transform: "translate(-50%, -50%)",
          width: 50,
          height: 50,
          borderRadius: "50%",
          background: `radial-gradient(circle at 30% 30%, ${COLORS.primary}, ${COLORS.secondary})`,
          boxShadow: `0 0 30px ${COLORS.primary}`,
          zIndex: 20
        }
      }
    ),
    cascadeEvents.map((event, i) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      CascadeParticle,
      {
        startFrame: event.startFrame,
        outerRadius: outerWheelSize / 2,
        innerRadius: innerWheelSize / 2,
        sourceSlot: event.sourceSlot,
        targetSlot: event.targetSlot
      },
      `cascade-${i}`
    )),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
      "svg",
      {
        style: {
          position: "absolute",
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          opacity: (0, import_remotion7.interpolate)(frame, [50, 80], [0, 0.6], { extrapolateRight: "clamp" })
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "marker",
            {
              id: "arrowhead",
              markerWidth: "10",
              markerHeight: "7",
              refX: "9",
              refY: "3.5",
              orient: "auto",
              children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("polygon", { points: "0 0, 10 3.5, 0 7", fill: COLORS.success })
            }
          ) }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "line",
            {
              x1: "50%",
              y1: `calc(45% - ${outerWheelSize / 2 - 30}px)`,
              x2: "50%",
              y2: `calc(45% - ${innerWheelSize / 2 + 20}px)`,
              stroke: COLORS.success,
              strokeWidth: 3,
              markerEnd: "url(#arrowhead)",
              strokeDasharray: "8 4"
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
          bottom: "10%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "85%",
          padding: "24px 30px",
          background: `${COLORS.dark}ee`,
          border: `2px solid ${COLORS.success}44`,
          borderRadius: 16,
          opacity: (0, import_remotion7.interpolate)(frame, [100, 140], [0, 1], { extrapolateRight: "clamp" })
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "div",
            {
              style: {
                fontSize: 26,
                fontWeight: 700,
                color: COLORS.success,
                fontFamily: "system-ui, sans-serif",
                textAlign: "center",
                marginBottom: 12
              },
              children: "Cascade Mechanism"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
            "div",
            {
              style: {
                fontSize: 20,
                color: COLORS.gray,
                fontFamily: "system-ui, sans-serif",
                textAlign: "center",
                lineHeight: 1.5
              },
              children: [
                "When the minute wheel ticks, tasks cascade down to the second wheel.",
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("br", {}),
                "Handle any duration with constant-time operations!"
              ]
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          right: "5%",
          top: "25%",
          padding: "12px 20px",
          background: `${COLORS.secondary}33`,
          border: `2px solid ${COLORS.secondary}`,
          borderRadius: 12,
          fontSize: 18,
          fontWeight: 600,
          color: COLORS.secondary,
          fontFamily: "system-ui, sans-serif",
          opacity: (0, import_remotion7.interpolate)(frame, [60, 90], [0, 1], { extrapolateRight: "clamp" })
        },
        children: "1-60 minutes"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: "5%",
          top: "50%",
          padding: "12px 20px",
          background: `${COLORS.primary}33`,
          border: `2px solid ${COLORS.primary}`,
          borderRadius: 12,
          fontSize: 18,
          fontWeight: 600,
          color: COLORS.primary,
          fontFamily: "system-ui, sans-serif",
          opacity: (0, import_remotion7.interpolate)(frame, [40, 70], [0, 1], { extrapolateRight: "clamp" })
        },
        children: "0-59 seconds"
      }
    )
  ] });
};

// src/proj_52679ede_22c5_4f0a_a231_c91da8c72538/scenes/Scene7.tsx
var import_remotion8 = require("remotion");
var import_jsx_runtime9 = require("react/jsx-runtime");
var LogoCard = ({ name, description, color, delay }) => {
  const frame = (0, import_remotion8.useCurrentFrame)();
  const { fps } = (0, import_remotion8.useVideoConfig)();
  const appear = (0, import_remotion8.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG
  });
  if (appear <= 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        transform: `scale(${appear})`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          "div",
          {
            style: {
              width: 120,
              height: 120,
              borderRadius: 24,
              background: `linear-gradient(135deg, ${color}33, ${color}11)`,
              border: `3px solid ${color}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 30px ${color}44`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(ClockIcon, { size: 60, color })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          "div",
          {
            style: {
              fontSize: 32,
              fontWeight: 800,
              color: COLORS.white,
              fontFamily: "system-ui, sans-serif"
            },
            children: name
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          "div",
          {
            style: {
              fontSize: 18,
              color: COLORS.gray,
              fontFamily: "system-ui, sans-serif",
              textAlign: "center",
              maxWidth: 200
            },
            children: description
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(CheckCircleIcon, { size: 24, color: COLORS.success }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { style: { fontSize: 16, color: COLORS.success, fontWeight: 600 }, children: "Uses Timing Wheels" })
        ] })
      ]
    }
  );
};
var PerformanceBar = ({ label, value, maxValue, color, delay }) => {
  const frame = (0, import_remotion8.useCurrentFrame)();
  const { fps } = (0, import_remotion8.useVideoConfig)();
  const progress = (0, import_remotion8.spring)({
    frame: frame - delay,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 60 }
  });
  const barWidth = Math.max(0, progress) * (value / maxValue) * 100;
  const displayValue = Math.round(progress * value);
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: { marginBottom: 24 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
      "div",
      {
        style: {
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 8
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            "span",
            {
              style: {
                fontSize: 20,
                fontWeight: 600,
                color: COLORS.white,
                fontFamily: "system-ui, sans-serif"
              },
              children: label
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
            "span",
            {
              style: {
                fontSize: 20,
                fontWeight: 700,
                color,
                fontFamily: "monospace"
              },
              children: [
                displayValue.toLocaleString(),
                " ops/sec"
              ]
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      "div",
      {
        style: {
          width: "100%",
          height: 30,
          background: `${COLORS.dark}`,
          borderRadius: 8,
          overflow: "hidden",
          border: `1px solid ${COLORS.gray}44`
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          "div",
          {
            style: {
              width: `${barWidth}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${color}88, ${color})`,
              borderRadius: 8,
              boxShadow: `0 0 15px ${color}66`
            }
          }
        )
      }
    )
  ] });
};
var Scene7 = ({ startFrame = 0 }) => {
  const frame = (0, import_remotion8.useCurrentFrame)();
  (0, import_remotion8.useVideoConfig)();
  const titleOpacity = (0, import_remotion8.interpolate)(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  const logosDelay = 30;
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_remotion8.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "5%",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 42,
          fontWeight: 800,
          color: COLORS.success,
          fontFamily: "system-ui, sans-serif",
          textShadow: `0 0 20px ${COLORS.success}66`,
          opacity: titleOpacity,
          textAlign: "center"
        },
        children: "REAL-WORLD VALIDATION"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "10%",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 24,
          color: COLORS.gray,
          fontFamily: "system-ui, sans-serif",
          opacity: (0, import_remotion8.interpolate)(frame, [20, 50], [0, 1], { extrapolateRight: "clamp" })
        },
        children: "Production systems using timing wheels"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: "18%",
          left: "0",
          right: "0",
          display: "flex",
          justifyContent: "space-around",
          padding: "0 10%"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            LogoCard,
            {
              name: "Apache Kafka",
              description: "Distributed event streaming platform",
              color: COLORS.primary,
              delay: logosDelay
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            LogoCard,
            {
              name: "Netty",
              description: "Async event-driven network framework",
              color: COLORS.secondary,
              delay: logosDelay + 15
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "12%",
          left: "10%",
          right: "10%",
          padding: "30px",
          background: `${COLORS.dark}ee`,
          border: `2px solid ${COLORS.primary}44`,
          borderRadius: 20,
          opacity: (0, import_remotion8.interpolate)(frame, [80, 110], [0, 1], { extrapolateRight: "clamp" })
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            "div",
            {
              style: {
                fontSize: 26,
                fontWeight: 700,
                color: COLORS.white,
                fontFamily: "system-ui, sans-serif",
                marginBottom: 24,
                textAlign: "center"
              },
              children: "Throughput Comparison"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            PerformanceBar,
            {
              label: "Binary Heap",
              value: 5e4,
              maxValue: 5e5,
              color: COLORS.accent,
              delay: 120
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            PerformanceBar,
            {
              label: "Timing Wheel",
              value: 5e5,
              maxValue: 5e5,
              color: COLORS.success,
              delay: 140
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            "div",
            {
              style: {
                textAlign: "center",
                marginTop: 20,
                fontSize: 28,
                fontWeight: 800,
                color: COLORS.success,
                opacity: (0, import_remotion8.interpolate)(frame, [180, 210], [0, 1], { extrapolateRight: "clamp" })
              },
              children: "10x Performance Improvement!"
            }
          )
        ]
      }
    )
  ] });
};

// src/proj_52679ede_22c5_4f0a_a231_c91da8c72538/scenes/Scene8.tsx
var import_remotion9 = require("remotion");
var import_jsx_runtime10 = require("react/jsx-runtime");
var CelebrationParticle = ({ index }) => {
  const frame = (0, import_remotion9.useCurrentFrame)();
  const { width, height } = (0, import_remotion9.useVideoConfig)();
  const baseX = index * 83 % width;
  const baseY = index * 137 % height;
  const floatX = (0, import_remotion9.interpolate)(
    (frame + index * 20) % 120,
    [0, 60, 120],
    [-15, 15, -15],
    { extrapolateRight: "clamp" }
  );
  const floatY = (0, import_remotion9.interpolate)(
    (frame + index * 30) % 150,
    [0, 75, 150],
    [0, -20, 0],
    { extrapolateRight: "clamp" }
  );
  const opacity = (0, import_remotion9.interpolate)(
    (frame + index * 25) % 100,
    [0, 50, 100],
    [0.2, 0.6, 0.2],
    { extrapolateRight: "clamp" }
  );
  const size = 6 + index % 5 * 3;
  const colors = [COLORS.primary, COLORS.secondary, COLORS.success, COLORS.accent];
  const color = colors[index % colors.length];
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: baseX + floatX,
        top: baseY + floatY,
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        opacity,
        boxShadow: `0 0 ${size * 2}px ${color}`
      }
    }
  );
};
var FollowButton = ({ pulseFrame }) => {
  const frame = (0, import_remotion9.useCurrentFrame)();
  const { fps } = (0, import_remotion9.useVideoConfig)();
  const appear = (0, import_remotion9.spring)({
    frame: frame - 40,
    fps,
    config: SPRING_CONFIG
  });
  const isPulseActive = frame >= pulseFrame && frame < pulseFrame + 40;
  const pulseScale = isPulseActive ? (0, import_remotion9.interpolate)(
    (frame - pulseFrame) % 20,
    [0, 10, 20],
    [1, 1.1, 1],
    { extrapolateRight: "clamp" }
  ) : 1;
  const glowIntensity = isPulseActive ? 1.5 : 1;
  if (appear <= 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "24px 60px",
        background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.secondary})`,
        borderRadius: 50,
        transform: `scale(${appear * pulseScale})`,
        boxShadow: `
          0 0 ${30 * glowIntensity}px ${COLORS.accent}88,
          0 10px 40px ${COLORS.dark}88
        `,
        cursor: "pointer"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(FollowIcon, { size: 36, color: COLORS.white }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
          "span",
          {
            style: {
              fontSize: 36,
              fontWeight: 800,
              color: COLORS.white,
              fontFamily: "system-ui, sans-serif",
              letterSpacing: 2,
              textTransform: "uppercase"
            },
            children: "Follow"
          }
        )
      ]
    }
  );
};
var PinnedComment = () => {
  const frame = (0, import_remotion9.useCurrentFrame)();
  const { fps } = (0, import_remotion9.useVideoConfig)();
  const appear = (0, import_remotion9.spring)({
    frame: frame - 80,
    fps,
    config: SPRING_CONFIG
  });
  if (appear <= 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "16px 28px",
        background: `${COLORS.dark}ee`,
        border: `2px solid ${COLORS.primary}44`,
        borderRadius: 16,
        transform: `scale(${appear})`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
          "div",
          {
            style: {
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: COLORS.success,
              boxShadow: `0 0 10px ${COLORS.success}`
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
          "span",
          {
            style: {
              fontSize: 22,
              color: COLORS.gray,
              fontFamily: "system-ui, sans-serif"
            },
            children: "Check the pinned comment for resources!"
          }
        )
      ]
    }
  );
};
var Scene8 = ({ startFrame = 0 }) => {
  const frame = (0, import_remotion9.useCurrentFrame)();
  (0, import_remotion9.useVideoConfig)();
  const pulseFrame = 125;
  const introOpacity = (0, import_remotion9.interpolate)(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_remotion9.AbsoluteFill, { children: [
    Array.from({ length: 25 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(CelebrationParticle, { index: i }, `particle-${i}`)),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: "20%",
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
          opacity: introOpacity
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            "div",
            {
              style: {
                width: 120,
                height: 120,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`,
                margin: "0 auto 24px",
                border: `4px solid ${COLORS.primary}`,
                boxShadow: `0 0 30px ${COLORS.primary}44`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 48,
                fontWeight: 800,
                color: COLORS.white,
                fontFamily: "system-ui, sans-serif"
              },
              children: "P"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            "div",
            {
              style: {
                fontSize: 48,
                fontWeight: 800,
                color: COLORS.white,
                fontFamily: "system-ui, sans-serif",
                marginBottom: 12
              },
              children: "Prasanna"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            "div",
            {
              style: {
                fontSize: 24,
                color: COLORS.gray,
                fontFamily: "system-ui, sans-serif",
                marginBottom: 8
              },
              children: "System Design Expert"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            "div",
            {
              style: {
                fontSize: 20,
                color: COLORS.secondary,
                fontFamily: "system-ui, sans-serif"
              },
              children: "@ Zoho"
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
          top: "55%",
          left: "50%",
          transform: "translateX(-50%)"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(FollowButton, { pulseFrame })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "70%",
          left: "50%",
          transform: "translateX(-50%)"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(PinnedComment, {})
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "10%",
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
          opacity: (0, import_remotion9.interpolate)(frame, [100, 130], [0, 1], { extrapolateRight: "clamp" })
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            "div",
            {
              style: {
                fontSize: 28,
                fontWeight: 600,
                color: COLORS.primary,
                fontFamily: "system-ui, sans-serif",
                marginBottom: 8
              },
              children: "More System Design Content"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            "div",
            {
              style: {
                fontSize: 20,
                color: COLORS.gray,
                fontFamily: "system-ui, sans-serif"
              },
              children: "Every week on this channel"
            }
          )
        ]
      }
    )
  ] });
};

// src/proj_52679ede_22c5_4f0a_a231_c91da8c72538/index.tsx
var import_jsx_runtime11 = require("react/jsx-runtime");
var MainComposition = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(import_remotion10.AbsoluteFill, { style: { backgroundColor: COLORS.dark }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Background, {}, "bg"),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      import_remotion10.Sequence,
      {
        from: TIMING.scene1Start,
        durationInFrames: TIMING.scene1End - TIMING.scene1Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Scene1, {})
      },
      "scene1"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      import_remotion10.Sequence,
      {
        from: TIMING.scene2Start,
        durationInFrames: TIMING.scene2End - TIMING.scene2Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Scene2, {})
      },
      "scene2"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      import_remotion10.Sequence,
      {
        from: TIMING.scene3Start,
        durationInFrames: TIMING.scene3End - TIMING.scene3Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Scene3, {})
      },
      "scene3"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      import_remotion10.Sequence,
      {
        from: TIMING.scene4Start,
        durationInFrames: TIMING.scene4End - TIMING.scene4Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Scene4, {})
      },
      "scene4"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      import_remotion10.Sequence,
      {
        from: TIMING.scene5Start,
        durationInFrames: TIMING.scene5End - TIMING.scene5Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Scene5, {})
      },
      "scene5"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      import_remotion10.Sequence,
      {
        from: TIMING.scene6Start,
        durationInFrames: TIMING.scene6End - TIMING.scene6Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Scene6, {})
      },
      "scene6"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      import_remotion10.Sequence,
      {
        from: TIMING.scene7Start,
        durationInFrames: TIMING.scene7End - TIMING.scene7Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Scene7, {})
      },
      "scene7"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      import_remotion10.Sequence,
      {
        from: TIMING.scene8Start,
        durationInFrames: TIMING.scene8End - TIMING.scene8Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Scene8, {})
      },
      "scene8"
    )
  ] });
};
var RemotionRoot = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
    import_remotion10.Composition,
    {
      id: "proj_52679ede_22c5_4f0a_a231_c91da8c72538",
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
