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
var import_remotion9 = require("remotion");

// src/proj_52679ede_22c5_4f0a_a231_c91da8c72538/constants.ts
var COLORS = {
  primary: "#00D4FF",
  // Electric blue
  secondary: "#6366F1",
  // Deep purple
  accent: "#FF6B35",
  // Vibrant orange
  background: "#0F172A",
  // Dark gradient start
  backgroundEnd: "#1E293B",
  // Dark gradient end
  white: "#FFFFFF",
  success: "#22C55E",
  // Green for O(1) success
  warning: "#EF4444"
  // Red for stress/warning
};
var SPRING_CONFIG = { damping: 22, stiffness: 90, mass: 0.9 };
var TIMING = {
  // Video specs from scenes.json (MUST MATCH EXACTLY)
  totalFrames: 2967,
  fps: 30,
  width: 1080,
  height: 1920,
  // Scene timing from scenes.json.scenes[].frames
  scene1Start: 0,
  scene1End: 630,
  scene2Start: 630,
  scene2End: 1140,
  scene3Start: 1140,
  scene3End: 1260,
  scene4Start: 1260,
  scene4End: 1530,
  scene5Start: 1530,
  scene5End: 2340,
  scene6Start: 2340,
  scene6End: 2760,
  scene7Start: 2760,
  scene7End: 2967
};
var TYPOGRAPHY = {
  hero: 96,
  // 5% of canvas height
  section: 67,
  // 3.5% of canvas height
  body: 58,
  // 3% of canvas height
  caption: 38
  // 2% of canvas height
};

// src/proj_52679ede_22c5_4f0a_a231_c91da8c72538/components/Background.tsx
var import_remotion = require("remotion");
var import_jsx_runtime = require("react/jsx-runtime");
var Background = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const rotation = (0, import_remotion.interpolate)(
    frame,
    [0, TIMING.totalFrames],
    [0, 360],
    { extrapolateRight: "clamp" }
  );
  const pulseOpacity = (0, import_remotion.interpolate)(
    frame % 60,
    [0, 30, 60],
    [0.03, 0.06, 0.03],
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
          background: `linear-gradient(135deg, ${COLORS.background} 0%, ${COLORS.backgroundEnd} 50%, ${COLORS.background} 100%)`
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          width: "100%",
          height: "100%",
          background: `radial-gradient(ellipse at 50% 40%, ${COLORS.primary}15 0%, transparent 50%)`,
          opacity: 0.5
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          width: "200%",
          height: "200%",
          left: "-50%",
          top: "-50%",
          transform: `rotate(${rotation * 0.1}deg)`,
          backgroundImage: `
            linear-gradient(${COLORS.secondary}08 1px, transparent 1px),
            linear-gradient(90deg, ${COLORS.secondary}08 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          opacity: pulseOpacity * 10
        }
      }
    ),
    [...Array(20)].map((_, i) => {
      const yPos = 5 + i * 5;
      const lineWidth = (0, import_remotion.interpolate)(
        (frame + i * 17) % 180,
        [0, 90, 180],
        [10, 40, 10],
        { extrapolateRight: "clamp" }
      );
      const lineOpacity = (0, import_remotion.interpolate)(
        (frame + i * 23) % 120,
        [0, 60, 120],
        [0.02, 0.05, 0.02],
        { extrapolateRight: "clamp" }
      );
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: "10%",
            top: `${yPos}%`,
            width: `${lineWidth}%`,
            height: 2,
            background: `linear-gradient(90deg, ${COLORS.primary}${Math.round(lineOpacity * 255).toString(16).padStart(2, "0")}, transparent)`,
            borderRadius: 1
          }
        },
        i
      );
    })
  ] });
};

// src/proj_52679ede_22c5_4f0a_a231_c91da8c72538/scenes/Scene1.tsx
var import_remotion2 = require("remotion");
var import_jsx_runtime2 = require("react/jsx-runtime");
var ServerIcon = ({ color, size }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("g", { fill: "none", stroke: color, strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", children: [
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { width: "20", height: "8", x: "2", y: "2", rx: "2", ry: "2" }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { width: "20", height: "8", x: "2", y: "14", rx: "2", ry: "2" }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M6 6h.01M6 18h.01" })
] }) });
var DatabaseIcon = ({ color, size }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("g", { fill: "none", stroke: color, strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", children: [
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ellipse", { cx: "12", cy: "5", rx: "9", ry: "3" }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M3 5v14a9 3 0 0 0 18 0V5" }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M3 12a9 3 0 0 0 18 0" })
] }) });
var ClockIcon = ({ color, size }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("g", { fill: "none", stroke: color, strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", children: [
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "12", cy: "12", r: "10" }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M12 6v6l4 2" })
] }) });
var NetworkIcon = ({ color, size }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("g", { fill: "none", stroke: color, strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", children: [
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { width: "6", height: "6", x: "16", y: "16", rx: "1" }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { width: "6", height: "6", x: "2", y: "16", rx: "1" }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { width: "6", height: "6", x: "9", y: "2", rx: "1" }),
  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3m-7-4V8" })
] }) });
var Particle = ({ frame, delay, startX, speed, size, opacity }) => {
  const adjustedFrame = Math.max(0, frame - delay);
  const yOffset = adjustedFrame * speed;
  const fadeIn = (0, import_remotion2.interpolate)(adjustedFrame, [0, 30], [0, opacity], {
    extrapolateRight: "clamp"
  });
  const drift = Math.sin(adjustedFrame * 0.02 + startX) * 20;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${startX}%`,
        bottom: `${-5 + yOffset % 120}%`,
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${COLORS.primary}, ${COLORS.secondary})`,
        opacity: fadeIn * (1 - yOffset % 120 / 120),
        transform: `translateX(${drift}px)`
      }
    }
  );
};
var Scene1 = ({ startFrame }) => {
  const frame = (0, import_remotion2.useCurrentFrame)();
  const { fps } = (0, import_remotion2.useVideoConfig)();
  const localFrame = frame - startFrame;
  const titleProgress = (0, import_remotion2.spring)({
    frame: localFrame,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 120 },
    durationInFrames: 50
  });
  const glowIntensity = (0, import_remotion2.interpolate)(
    localFrame,
    [30, 43, 80],
    [0, 1, 0.3],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const subtitleProgress = (0, import_remotion2.spring)({
    frame: localFrame - 60,
    fps,
    config: SPRING_CONFIG
  });
  const icons = [
    { Icon: ServerIcon, delay: 90, x: 15 },
    { Icon: DatabaseIcon, delay: 98, x: 35 },
    { Icon: ClockIcon, delay: 106, x: 55 },
    { Icon: NetworkIcon, delay: 114, x: 75 }
  ];
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    startX: 10 + i * 2.7,
    delay: i * 8,
    speed: 0.3 + i % 5 * 0.1,
    size: 4 + i % 4 * 3,
    opacity: 0.3 + i % 3 * 0.2
  }));
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_remotion2.AbsoluteFill, { children: [
    particles.map((p) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      Particle,
      {
        frame: localFrame,
        delay: p.delay,
        startX: p.startX,
        speed: p.speed,
        size: p.size,
        opacity: p.opacity
      },
      p.id
    )),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "20%",
          left: "10%",
          right: "10%",
          textAlign: "center"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          "div",
          {
            style: {
              fontSize: TYPOGRAPHY.hero,
              fontWeight: 800,
              color: COLORS.white,
              textTransform: "uppercase",
              letterSpacing: 4,
              lineHeight: 1.2,
              transform: `scale(${0.5 + titleProgress * 0.5})`,
              opacity: titleProgress,
              textShadow: `
              0 0 ${20 + glowIntensity * 40}px ${COLORS.primary}${Math.round(glowIntensity * 200).toString(16).padStart(2, "0")},
              0 0 ${40 + glowIntensity * 60}px ${COLORS.primary}${Math.round(glowIntensity * 150).toString(16).padStart(2, "0")},
              0 0 ${60 + glowIntensity * 80}px ${COLORS.secondary}${Math.round(glowIntensity * 100).toString(16).padStart(2, "0")}
            `
            },
            children: [
              "System Design",
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("br", {}),
              "Challenge"
            ]
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "55%",
          left: "10%",
          right: "10%",
          height: "25%"
        },
        children: icons.map(({ Icon, delay, x }, i) => {
          const iconProgress = (0, import_remotion2.spring)({
            frame: localFrame - delay,
            fps,
            config: SPRING_CONFIG
          });
          const floatOffset = (0, import_remotion2.interpolate)(
            (localFrame - delay) % 60,
            [0, 30, 60],
            [0, -15, 0],
            { extrapolateRight: "clamp" }
          );
          return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: `${x}%`,
                top: "50%",
                transform: `
                  translateX(-50%)
                  translateY(${-50 + (1 - iconProgress) * 100 + floatOffset}%)
                  scale(${iconProgress})
                `,
                opacity: iconProgress
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { color: COLORS.primary, size: 64 })
            },
            i
          );
        })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "85%",
          left: "10%",
          right: "10%",
          textAlign: "center",
          fontSize: TYPOGRAPHY.body,
          fontWeight: 500,
          color: COLORS.white,
          opacity: subtitleProgress * 0.9,
          transform: `translateY(${(1 - subtitleProgress) * 30}px)`
        },
        children: "Handling millions of delayed tasks"
      }
    )
  ] });
};

// src/proj_52679ede_22c5_4f0a_a231_c91da8c72538/scenes/Scene2.tsx
var import_remotion3 = require("remotion");
var import_jsx_runtime3 = require("react/jsx-runtime");
var TreeNode = ({ x, y, value, stress, pulse, scale }) => {
  const baseColor = (0, import_remotion3.interpolate)(stress, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const nodeColor = `rgb(${Math.round(0 + baseColor * 239)}, ${Math.round(212 - baseColor * 143)}, ${Math.round(255 - baseColor * 186)})`;
  const glowColor = stress > 0.5 ? COLORS.warning : COLORS.primary;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) scale(${scale * (1 + pulse * 0.1)})`,
        width: 70,
        height: 70,
        borderRadius: "50%",
        background: `radial-gradient(circle at 30% 30%, ${nodeColor}, ${COLORS.secondary})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 24,
        fontWeight: 700,
        color: COLORS.white,
        boxShadow: `0 0 ${15 + stress * 25}px ${glowColor}${Math.round((0.3 + stress * 0.5) * 255).toString(16).padStart(2, "0")}`,
        border: `3px solid ${nodeColor}`
      },
      children: value
    }
  );
};
var TreeEdge = ({ x1, y1, x2, y2, stress, opacity }) => {
  const edgeColor = (0, import_remotion3.interpolate)(stress, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const color = `rgb(${Math.round(99 + edgeColor * 140)}, ${Math.round(102 - edgeColor * 33)}, ${Math.round(241 - edgeColor * 172)})`;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "svg",
    {
      style: {
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none"
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "line",
        {
          x1: `${x1}%`,
          y1: `${y1}%`,
          x2: `${x2}%`,
          y2: `${y2}%`,
          stroke: color,
          strokeWidth: 3,
          opacity
        }
      )
    }
  );
};
var Scene2 = ({ startFrame }) => {
  const frame = (0, import_remotion3.useCurrentFrame)();
  const { fps } = (0, import_remotion3.useVideoConfig)();
  const localFrame = frame - startFrame;
  const keySyncFrame = 112;
  const entranceProgress = (0, import_remotion3.spring)({
    frame: localFrame,
    fps,
    config: SPRING_CONFIG,
    durationInFrames: 45
  });
  const stress = (0, import_remotion3.interpolate)(
    localFrame,
    [0, keySyncFrame - 30, keySyncFrame, keySyncFrame + 60],
    [0, 0.3, 1, 0.8],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const shakeIntensity = (0, import_remotion3.interpolate)(
    localFrame,
    [keySyncFrame - 10, keySyncFrame, keySyncFrame + 30],
    [0, 8, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const shakeX = Math.sin(localFrame * 1.5) * shakeIntensity;
  const shakeY = Math.cos(localFrame * 2) * shakeIntensity * 0.5;
  const getPulse = (offset) => (0, import_remotion3.interpolate)(
    (localFrame + offset * 7) % 30,
    [0, 15, 30],
    [0, 1, 0],
    { extrapolateRight: "clamp" }
  );
  const treeData = [
    // Level 0
    { id: 0, x: 50, y: 15, value: 1, parent: null },
    // Level 1
    { id: 1, x: 30, y: 35, value: 3, parent: 0 },
    { id: 2, x: 70, y: 35, value: 5, parent: 0 },
    // Level 2
    { id: 3, x: 18, y: 55, value: 7, parent: 1 },
    { id: 4, x: 42, y: 55, value: 9, parent: 1 },
    { id: 5, x: 58, y: 55, value: 11, parent: 2 },
    { id: 6, x: 82, y: 55, value: 13, parent: 2 },
    // Level 3 (partial)
    { id: 7, x: 12, y: 75, value: 15, parent: 3 },
    { id: 8, x: 24, y: 75, value: 17, parent: 3 },
    { id: 9, x: 36, y: 75, value: 19, parent: 4 },
    { id: 10, x: 48, y: 75, value: 21, parent: 4 }
  ];
  const rebalancePhase = Math.floor((localFrame + 20) / 45) % 4;
  const rebalanceProgress = (0, import_remotion3.interpolate)(
    (localFrame + 20) % 45,
    [0, 15, 30, 45],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp" }
  );
  const getNodePosition = (node) => {
    const offsetX = rebalancePhase === node.id % 4 ? rebalanceProgress * 8 - 4 : 0;
    const offsetY = rebalancePhase === (node.id + 2) % 4 ? rebalanceProgress * 6 - 3 : 0;
    return { x: node.x + offsetX, y: node.y + offsetY };
  };
  const complexityOpacity = (0, import_remotion3.spring)({
    frame: localFrame - 30,
    fps,
    config: SPRING_CONFIG
  });
  const descriptionOpacity = (0, import_remotion3.spring)({
    frame: localFrame - 60,
    fps,
    config: SPRING_CONFIG
  });
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_remotion3.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: "8%",
          left: "50%",
          transform: "translateX(-50%)",
          opacity: complexityOpacity
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "div",
            {
              style: {
                fontSize: TYPOGRAPHY.section,
                fontWeight: 700,
                color: (0, import_remotion3.interpolate)(stress, [0, 0.5, 1], [0, 0, 1], { extrapolateRight: "clamp" }) > 0.5 ? COLORS.warning : COLORS.primary,
                textAlign: "center",
                textShadow: `0 0 20px ${stress > 0.5 ? COLORS.warning : COLORS.primary}80`
              },
              children: "O(log n)"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "div",
            {
              style: {
                fontSize: TYPOGRAPHY.caption,
                color: COLORS.white,
                opacity: 0.7,
                textAlign: "center",
                marginTop: 8
              },
              children: "Priority Queue Complexity"
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
          top: "18%",
          left: "10%",
          right: "10%",
          height: "55%",
          transform: `translate(${shakeX}px, ${shakeY}px) scale(${entranceProgress})`,
          opacity: entranceProgress
        },
        children: [
          treeData.map((node) => {
            if (node.parent === null) return null;
            const parentNode = treeData[node.parent];
            const nodePos = getNodePosition(node);
            const parentPos = getNodePosition(parentNode);
            return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              TreeEdge,
              {
                x1: parentPos.x,
                y1: parentPos.y + 5,
                x2: nodePos.x,
                y2: nodePos.y - 5,
                stress,
                opacity: entranceProgress * 0.8
              },
              `edge-${node.id}`
            );
          }),
          treeData.map((node, i) => {
            const nodePos = getNodePosition(node);
            const nodeDelay = i * 3;
            const nodeScale = (0, import_remotion3.spring)({
              frame: localFrame - nodeDelay,
              fps,
              config: SPRING_CONFIG
            });
            return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              TreeNode,
              {
                x: nodePos.x,
                y: nodePos.y,
                value: node.value,
                stress: stress * (0.5 + node.id % 3 * 0.25),
                pulse: getPulse(node.id),
                scale: nodeScale
              },
              node.id
            );
          }),
          localFrame > 80 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_jsx_runtime3.Fragment, { children: [0, 1, 2].map((i) => {
            const taskProgress = (localFrame - 80 + i * 40) % 120 / 120;
            const taskOpacity = (0, import_remotion3.interpolate)(
              taskProgress,
              [0, 0.1, 0.9, 1],
              [0, 0.8, 0.8, 0],
              { extrapolateRight: "clamp" }
            );
            return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
              "div",
              {
                style: {
                  position: "absolute",
                  left: `${20 + i * 25}%`,
                  top: `${-10 + taskProgress * 30}%`,
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: COLORS.accent,
                  opacity: taskOpacity,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  fontWeight: 600,
                  color: COLORS.white,
                  transform: "translate(-50%, -50%)"
                },
                children: [
                  "+",
                  Math.floor(Math.random() * 100)
                ]
              },
              i
            );
          }) })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "10%",
          left: "10%",
          right: "10%",
          textAlign: "center",
          opacity: descriptionOpacity,
          transform: `translateY(${(1 - descriptionOpacity) * 20}px)`
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "div",
            {
              style: {
                fontSize: TYPOGRAPHY.body,
                fontWeight: 600,
                color: COLORS.white,
                marginBottom: 12
              },
              children: "Binary Heap: The Obvious Choice"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
            "div",
            {
              style: {
                fontSize: TYPOGRAPHY.caption,
                color: COLORS.white,
                opacity: 0.7
              },
              children: [
                "Always returns the most immediate task...",
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("br", {}),
                "but at what cost?"
              ]
            }
          )
        ]
      }
    )
  ] });
};

// src/proj_52679ede_22c5_4f0a_a231_c91da8c72538/scenes/Scene3.tsx
var import_remotion4 = require("remotion");
var import_jsx_runtime4 = require("react/jsx-runtime");
var CrackedNode = ({ x, y, targetX, targetY, value, morphProgress, crackIntensity }) => {
  const currentX = (0, import_remotion4.interpolate)(morphProgress, [0, 1], [x, targetX], { extrapolateRight: "clamp" });
  const currentY = (0, import_remotion4.interpolate)(morphProgress, [0, 1], [y, targetY], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${currentX}%`,
        top: `${currentY}%`,
        transform: "translate(-50%, -50%)",
        width: 60,
        height: 60,
        borderRadius: "50%",
        background: `radial-gradient(circle at 30% 30%, ${COLORS.warning}, #991B1B)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 22,
        fontWeight: 700,
        color: COLORS.white,
        boxShadow: `0 0 ${20 + crackIntensity * 30}px ${COLORS.warning}`,
        border: `3px solid ${COLORS.warning}`
      },
      children: [
        value,
        crackIntensity > 0.3 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
          "svg",
          {
            style: {
              position: "absolute",
              width: "120%",
              height: "120%",
              left: "-10%",
              top: "-10%",
              pointerEvents: "none"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                "line",
                {
                  x1: "20%",
                  y1: "20%",
                  x2: "80%",
                  y2: "80%",
                  stroke: COLORS.warning,
                  strokeWidth: 2,
                  opacity: crackIntensity
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                "line",
                {
                  x1: "80%",
                  y1: "30%",
                  x2: "30%",
                  y2: "70%",
                  stroke: COLORS.warning,
                  strokeWidth: 2,
                  opacity: crackIntensity * 0.8
                }
              )
            ]
          }
        )
      ]
    }
  );
};
var CrackLine = ({ angle, length, opacity, delay, frame }) => {
  const progress = (0, import_remotion4.interpolate)(
    frame - delay,
    [0, 15],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const x2 = 50 + Math.cos(angle * Math.PI / 180) * length * progress;
  const y2 = 50 + Math.sin(angle * Math.PI / 180) * length * progress;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "line",
    {
      x1: "50%",
      y1: "50%",
      x2: `${x2}%`,
      y2: `${y2}%`,
      stroke: COLORS.warning,
      strokeWidth: 3,
      opacity: opacity * progress,
      strokeLinecap: "round"
    }
  );
};
var Scene3 = ({ startFrame }) => {
  const frame = (0, import_remotion4.useCurrentFrame)();
  const { fps } = (0, import_remotion4.useVideoConfig)();
  const localFrame = frame - startFrame;
  const keySyncFrame = 27;
  const crackIntensity = (0, import_remotion4.interpolate)(
    localFrame,
    [0, keySyncFrame - 5, keySyncFrame, 120],
    [0.2, 0.6, 1, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const morphProgress = (0, import_remotion4.interpolate)(
    localFrame,
    [keySyncFrame, 120],
    [0, 0.6],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const shakeIntensity = (0, import_remotion4.interpolate)(
    localFrame,
    [0, keySyncFrame, keySyncFrame + 10, 120],
    [5, 15, 8, 3],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const shakeX = Math.sin(localFrame * 2.5) * shakeIntensity;
  const shakeY = Math.cos(localFrame * 3) * shakeIntensity * 0.7;
  const warningProgress = (0, import_remotion4.spring)({
    frame: localFrame - 5,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 150 }
  });
  const scaleProgress = (0, import_remotion4.spring)({
    frame: localFrame - 15,
    fps,
    config: SPRING_CONFIG
  });
  const treeNodes = [
    { id: 0, x: 50, y: 30, targetX: 50, targetY: 15, value: 1 },
    { id: 1, x: 30, y: 45, targetX: 25, targetY: 35, value: 3 },
    { id: 2, x: 70, y: 45, targetX: 75, targetY: 35, value: 5 },
    { id: 3, x: 20, y: 60, targetX: 15, targetY: 55, value: 7 },
    { id: 4, x: 40, y: 60, targetX: 35, targetY: 70, value: 9 },
    { id: 5, x: 60, y: 60, targetX: 65, targetY: 70, value: 11 },
    { id: 6, x: 80, y: 60, targetX: 85, targetY: 55, value: 13 }
  ];
  const crackAngles = [0, 45, 90, 135, 180, 225, 270, 315];
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_remotion4.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "8%",
          left: "10%",
          right: "10%",
          textAlign: "center",
          transform: `scale(${0.5 + warningProgress * 0.5})`,
          opacity: warningProgress
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "div",
          {
            style: {
              fontSize: TYPOGRAPHY.section,
              fontWeight: 800,
              color: COLORS.warning,
              textTransform: "uppercase",
              letterSpacing: 3,
              textShadow: `0 0 30px ${COLORS.warning}`
            },
            children: "The Problem"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: "20%",
          left: "10%",
          right: "10%",
          textAlign: "center",
          transform: `scale(${scaleProgress}) translateY(${(1 - scaleProgress) * 30}px)`,
          opacity: scaleProgress
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "div",
            {
              style: {
                fontSize: TYPOGRAPHY.hero * 0.9,
                fontWeight: 900,
                color: COLORS.white,
                letterSpacing: 2,
                textShadow: `0 0 40px ${COLORS.warning}80`
              },
              children: "10 MILLION"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "div",
            {
              style: {
                fontSize: TYPOGRAPHY.body,
                fontWeight: 600,
                color: COLORS.accent,
                marginTop: 8
              },
              children: "CONNECTIONS"
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: "35%",
          left: "15%",
          right: "15%",
          height: "45%",
          transform: `translate(${shakeX}px, ${shakeY}px)`
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "svg",
            {
              style: {
                position: "absolute",
                width: "100%",
                height: "100%",
                pointerEvents: "none"
              },
              children: crackAngles.map((angle, i) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                CrackLine,
                {
                  angle,
                  length: 30 + i % 3 * 10,
                  opacity: crackIntensity,
                  delay: i * 3,
                  frame: localFrame
                },
                angle
              ))
            }
          ),
          treeNodes.map((node) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            CrackedNode,
            {
              x: node.x,
              y: node.y,
              targetX: node.targetX,
              targetY: node.targetY,
              value: node.value,
              morphProgress,
              crackIntensity
            },
            node.id
          )),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: 120,
                height: 120,
                borderRadius: "50%",
                border: `4px solid ${COLORS.warning}`,
                opacity: crackIntensity * 0.6,
                animation: "none",
                boxShadow: `0 0 ${50 * crackIntensity}px ${COLORS.warning}`
              }
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
          bottom: "8%",
          left: "10%",
          right: "10%",
          textAlign: "center"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
          "div",
          {
            style: {
              fontSize: TYPOGRAPHY.body,
              fontWeight: 600,
              color: COLORS.white,
              opacity: (0, import_remotion4.interpolate)(localFrame, [40, 60], [0, 1], { extrapolateRight: "clamp" })
            },
            children: [
              "Logarithmic time becomes a",
              " ",
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { color: COLORS.warning }, children: "bottleneck" })
            ]
          }
        )
      }
    )
  ] });
};

// src/proj_52679ede_22c5_4f0a_a231_c91da8c72538/scenes/Scene4.tsx
var import_remotion5 = require("remotion");
var import_jsx_runtime5 = require("react/jsx-runtime");
var ClockSlot = ({ index, angle, radius, isActive, progress, hasTask }) => {
  const radians = (angle - 90) * (Math.PI / 180);
  const x = 50 + Math.cos(radians) * radius;
  const y = 50 + Math.sin(radians) * radius;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) scale(${progress})`,
        width: index % 5 === 0 ? 28 : 18,
        height: index % 5 === 0 ? 28 : 18,
        borderRadius: "50%",
        background: hasTask ? COLORS.accent : isActive ? COLORS.success : `${COLORS.primary}40`,
        border: `2px solid ${isActive ? COLORS.success : COLORS.primary}`,
        boxShadow: isActive ? `0 0 15px ${COLORS.success}` : hasTask ? `0 0 10px ${COLORS.accent}` : "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        fontWeight: 600,
        color: COLORS.white
      },
      children: index % 5 === 0 && index
    }
  );
};
var DroppingTask = ({ targetSlot, delay, frame, fps }) => {
  const localFrame = frame - delay;
  if (localFrame < 0) return null;
  const dropProgress = (0, import_remotion5.spring)({
    frame: localFrame,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 200 }
  });
  const radians = (targetSlot * 6 - 90) * (Math.PI / 180);
  const targetX = 50 + Math.cos(radians) * 32;
  const targetY = 50 + Math.sin(radians) * 32;
  const currentY = (0, import_remotion5.interpolate)(dropProgress, [0, 1], [0, targetY], {
    extrapolateRight: "clamp"
  });
  const currentX = (0, import_remotion5.interpolate)(dropProgress, [0, 1], [50, targetX], {
    extrapolateRight: "clamp"
  });
  const opacity = (0, import_remotion5.interpolate)(dropProgress, [0, 0.2, 0.9, 1], [0, 1, 1, 0], {
    extrapolateRight: "clamp"
  });
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${currentX}%`,
        top: `${currentY}%`,
        transform: "translate(-50%, -50%)",
        width: 24,
        height: 24,
        borderRadius: 6,
        background: COLORS.accent,
        opacity,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 700,
        color: COLORS.white,
        boxShadow: `0 0 15px ${COLORS.accent}`
      },
      children: "T"
    }
  );
};
var Scene4 = ({ startFrame }) => {
  const frame = (0, import_remotion5.useCurrentFrame)();
  const { fps } = (0, import_remotion5.useVideoConfig)();
  const localFrame = frame - startFrame;
  const keySyncFrame = 77;
  const rotation = (0, import_remotion5.interpolate)(localFrame, [0, 270], [0, 60], {
    extrapolateRight: "clamp"
  });
  const activeSlot = Math.floor(rotation) % 60;
  const getSlotProgress = (index) => {
    const buildDelay = index * 1.2 % 60;
    return (0, import_remotion5.spring)({
      frame: localFrame - buildDelay,
      fps,
      config: SPRING_CONFIG
    });
  };
  const keySyncGlow = (0, import_remotion5.interpolate)(
    localFrame,
    [keySyncFrame - 5, keySyncFrame, keySyncFrame + 20],
    [0, 1, 0.3],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const complexityProgress = (0, import_remotion5.spring)({
    frame: localFrame - 20,
    fps,
    config: SPRING_CONFIG
  });
  const explanationProgress = (0, import_remotion5.spring)({
    frame: localFrame - 100,
    fps,
    config: SPRING_CONFIG
  });
  const slots = Array.from({ length: 60 }, (_, i) => ({
    index: i,
    angle: i * 6,
    // 360/60 = 6 degrees per slot
    hasTask: i === 15 || i === 30 || i === 45 || i === 52
  }));
  const droppingTasks = [
    { targetSlot: 15, delay: 90 },
    { targetSlot: 30, delay: 120 },
    { targetSlot: 45, delay: 150 },
    { targetSlot: 52, delay: 180 },
    { targetSlot: 8, delay: 210 },
    { targetSlot: 23, delay: 240 }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_remotion5.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: "6%",
          left: "50%",
          transform: `translateX(-50%) scale(${complexityProgress})`,
          opacity: complexityProgress,
          textAlign: "center"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "div",
            {
              style: {
                fontSize: TYPOGRAPHY.hero,
                fontWeight: 800,
                color: COLORS.success,
                textShadow: `0 0 ${30 + keySyncGlow * 40}px ${COLORS.success}`
              },
              children: "O(1)"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "div",
            {
              style: {
                fontSize: TYPOGRAPHY.caption,
                color: COLORS.white,
                opacity: 0.8,
                marginTop: 4
              },
              children: "Constant Time!"
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: "22%",
          left: "15%",
          right: "15%",
          height: "55%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                width: "90%",
                height: 0,
                paddingBottom: "90%",
                borderRadius: "50%",
                background: `radial-gradient(circle at 50% 50%, ${COLORS.backgroundEnd}, ${COLORS.background})`,
                border: `4px solid ${COLORS.primary}40`,
                boxShadow: `
              inset 0 0 60px ${COLORS.primary}20,
              0 0 ${30 + keySyncGlow * 50}px ${COLORS.primary}${Math.round(keySyncGlow * 100).toString(16).padStart(2, "0")}
            `
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
            "div",
            {
              style: {
                position: "absolute",
                width: "90%",
                height: 0,
                paddingBottom: "90%"
              },
              children: [
                slots.map((slot) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  ClockSlot,
                  {
                    index: slot.index,
                    angle: slot.angle,
                    radius: 42,
                    isActive: slot.index === activeSlot,
                    progress: getSlotProgress(slot.index),
                    hasTask: slot.hasTask && localFrame > 100
                  },
                  slot.index
                )),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "div",
                  {
                    style: {
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      width: 4,
                      height: "35%",
                      background: `linear-gradient(to top, ${COLORS.primary}, ${COLORS.accent})`,
                      transformOrigin: "center top",
                      transform: `translateX(-50%) rotate(${rotation * 6}deg)`,
                      borderRadius: 2,
                      boxShadow: `0 0 15px ${COLORS.primary}`
                    }
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
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
                      background: `radial-gradient(circle at 30% 30%, ${COLORS.primary}, ${COLORS.secondary})`,
                      border: `3px solid ${COLORS.white}`,
                      boxShadow: `0 0 20px ${COLORS.primary}`
                    }
                  }
                ),
                droppingTasks.map((task, i) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  DroppingTask,
                  {
                    targetSlot: task.targetSlot,
                    delay: task.delay,
                    frame: localFrame,
                    fps
                  },
                  i
                ))
              ]
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "8%",
          left: "10%",
          right: "10%",
          textAlign: "center",
          opacity: explanationProgress,
          transform: `translateY(${(1 - explanationProgress) * 20}px)`
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "div",
            {
              style: {
                fontSize: TYPOGRAPHY.body,
                fontWeight: 600,
                color: COLORS.white
              },
              children: "The Timing Wheel"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "div",
            {
              style: {
                fontSize: TYPOGRAPHY.caption,
                color: COLORS.white,
                opacity: 0.7,
                marginTop: 8
              },
              children: "60 slots \u2022 Direct placement \u2022 No sorting required"
            }
          )
        ]
      }
    )
  ] });
};

// src/proj_52679ede_22c5_4f0a_a231_c91da8c72538/scenes/Scene5.tsx
var import_remotion6 = require("remotion");
var import_three = require("@remotion/three");
var import_jsx_runtime6 = require("react/jsx-runtime");
var TimingWheel = ({ radius, tubeRadius, rotation, color, opacity, yOffset }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("mesh", { rotation: [Math.PI / 2, 0, rotation], position: [0, yOffset, 0], children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("torusGeometry", { args: [radius, tubeRadius, 16, 60] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "meshStandardMaterial",
      {
        color,
        transparent: true,
        opacity,
        metalness: 0.3,
        roughness: 0.4
      }
    )
  ] });
};
var WheelSlots = ({ radius, count, rotation, color, yOffset }) => {
  const slots = [];
  for (let i = 0; i < count; i++) {
    const angle = i / count * Math.PI * 2 + rotation;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    slots.push(
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("mesh", { position: [x, yOffset, z], children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("sphereGeometry", { args: [0.08, 8, 8] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "meshStandardMaterial",
          {
            color: i % 5 === 0 ? COLORS.accent : color,
            emissive: i % 5 === 0 ? COLORS.accent : color,
            emissiveIntensity: 0.3
          }
        )
      ] }, i)
    );
  }
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_jsx_runtime6.Fragment, { children: slots });
};
var GearConnector = ({ innerRadius, outerRadius, rotation, opacity }) => {
  const connectors = [];
  for (let i = 0; i < 4; i++) {
    const angle = i / 4 * Math.PI * 2 + rotation * 0.5;
    const midRadius = (innerRadius + outerRadius) / 2;
    const x = Math.cos(angle) * midRadius;
    const z = Math.sin(angle) * midRadius;
    connectors.push(
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("mesh", { position: [x, 0, z], rotation: [0, angle, 0], children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("boxGeometry", { args: [0.1, 0.15, outerRadius - innerRadius - 0.3] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "meshStandardMaterial",
          {
            color: COLORS.secondary,
            transparent: true,
            opacity: opacity * 0.8,
            metalness: 0.5,
            roughness: 0.3
          }
        )
      ] }, i)
    );
  }
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_jsx_runtime6.Fragment, { children: connectors });
};
var CascadingTask = ({ startAngle, progress, innerRadius, outerRadius }) => {
  const currentRadius = (0, import_remotion6.interpolate)(progress, [0, 1], [outerRadius, innerRadius], {
    extrapolateRight: "clamp"
  });
  const spiralAngle = startAngle + progress * Math.PI * 0.5;
  const x = Math.cos(spiralAngle) * currentRadius;
  const z = Math.sin(spiralAngle) * currentRadius;
  const y = (0, import_remotion6.interpolate)(progress, [0, 0.5, 1], [0.3, 0.15, 0], {
    extrapolateRight: "clamp"
  });
  const scale = (0, import_remotion6.interpolate)(progress, [0, 0.1, 0.9, 1], [0, 1, 1, 0.5], {
    extrapolateRight: "clamp"
  });
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("mesh", { position: [x, y, z], scale: [scale, scale, scale], children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("boxGeometry", { args: [0.15, 0.15, 0.15] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "meshStandardMaterial",
      {
        color: COLORS.accent,
        emissive: COLORS.accent,
        emissiveIntensity: 0.5
      }
    )
  ] });
};
var Scene5Content = ({
  localFrame,
  fps
}) => {
  const keySyncFrame = 643;
  const entranceProgress = (0, import_remotion6.spring)({
    frame: localFrame,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 60 },
    durationInFrames: 90
  });
  const outerRotation = localFrame * 5e-3 * entranceProgress;
  const innerRotation = localFrame * 0.025 * entranceProgress;
  const cascadeActive = localFrame > keySyncFrame - 60;
  const cascadeProgress = (0, import_remotion6.interpolate)(
    localFrame,
    [keySyncFrame - 60, keySyncFrame, keySyncFrame + 60],
    [0, 0.5, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const cameraY = 2.5 + Math.sin(localFrame * 0.01) * 0.1;
  const cameraZ = 4 + (0, import_remotion6.interpolate)(localFrame, [0, 200], [1, 0], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("perspectiveCamera", { position: [0, cameraY, cameraZ], fov: 50 }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("ambientLight", { intensity: 0.4 }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("directionalLight", { position: [5, 8, 5], intensity: 0.8, color: "#ffffff" }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("pointLight", { position: [0, 2, 0], intensity: 0.5, color: COLORS.primary }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      TimingWheel,
      {
        radius: 2,
        tubeRadius: 0.12,
        rotation: outerRotation,
        color: COLORS.secondary,
        opacity: entranceProgress * 0.9,
        yOffset: 0.3
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      WheelSlots,
      {
        radius: 2,
        count: 12,
        rotation: outerRotation,
        color: COLORS.primary,
        yOffset: 0.3
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      TimingWheel,
      {
        radius: 1.2,
        tubeRadius: 0.1,
        rotation: innerRotation,
        color: COLORS.primary,
        opacity: entranceProgress * 0.9,
        yOffset: 0
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      WheelSlots,
      {
        radius: 1.2,
        count: 60,
        rotation: innerRotation,
        color: COLORS.secondary,
        yOffset: 0
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      GearConnector,
      {
        innerRadius: 1.2,
        outerRadius: 2,
        rotation: outerRotation,
        opacity: entranceProgress
      }
    ),
    cascadeActive && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        CascadingTask,
        {
          startAngle: 0,
          progress: cascadeProgress,
          innerRadius: 1.2,
          outerRadius: 2
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        CascadingTask,
        {
          startAngle: Math.PI * 0.5,
          progress: Math.max(0, cascadeProgress - 0.15),
          innerRadius: 1.2,
          outerRadius: 2
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        CascadingTask,
        {
          startAngle: Math.PI,
          progress: Math.max(0, cascadeProgress - 0.3),
          innerRadius: 1.2,
          outerRadius: 2
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        CascadingTask,
        {
          startAngle: Math.PI * 1.5,
          progress: Math.max(0, cascadeProgress - 0.45),
          innerRadius: 1.2,
          outerRadius: 2
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("mesh", { position: [0, 0.15, 0], children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("cylinderGeometry", { args: [0.25, 0.25, 0.5, 32] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "meshStandardMaterial",
        {
          color: COLORS.primary,
          metalness: 0.6,
          roughness: 0.2
        }
      )
    ] })
  ] });
};
var Scene5 = ({ startFrame }) => {
  const frame = (0, import_remotion6.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion6.useVideoConfig)();
  const localFrame = frame - startFrame;
  const keySyncFrame = 643;
  const titleProgress = (0, import_remotion6.spring)({
    frame: localFrame - 30,
    fps,
    config: SPRING_CONFIG
  });
  const cascadeLabel = (0, import_remotion6.interpolate)(
    localFrame,
    [keySyncFrame - 10, keySyncFrame, keySyncFrame + 60],
    [0, 1, 0.8],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const explanationProgress = (0, import_remotion6.spring)({
    frame: localFrame - 120,
    fps,
    config: SPRING_CONFIG
  });
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_remotion6.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "5%",
          left: "10%",
          right: "10%",
          textAlign: "center",
          opacity: titleProgress,
          transform: `translateY(${(1 - titleProgress) * -20}px)`
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "div",
          {
            style: {
              fontSize: TYPOGRAPHY.section,
              fontWeight: 700,
              color: COLORS.white,
              textShadow: `0 0 20px ${COLORS.primary}80`
            },
            children: "Hierarchical Timing Wheels"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "12%",
          left: "5%",
          right: "5%",
          height: "60%"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          import_three.ThreeCanvas,
          {
            width: width * 0.9,
            height: height * 0.6,
            camera: { position: [0, 2.5, 5], fov: 50 },
            children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Scene5Content, { localFrame, fps })
          }
        )
      }
    ),
    cascadeLabel > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "45%",
          left: "50%",
          transform: "translateX(-50%)",
          opacity: cascadeLabel
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "div",
          {
            style: {
              fontSize: TYPOGRAPHY.body,
              fontWeight: 700,
              color: COLORS.accent,
              textShadow: `0 0 20px ${COLORS.accent}`,
              textAlign: "center"
            },
            children: "CASCADE!"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: "72%",
          left: "10%",
          right: "10%",
          display: "flex",
          justifyContent: "space-around",
          opacity: explanationProgress
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { textAlign: "center" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              "div",
              {
                style: {
                  fontSize: TYPOGRAPHY.caption,
                  fontWeight: 600,
                  color: COLORS.secondary
                },
                children: "Outer Wheel"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              "div",
              {
                style: {
                  fontSize: TYPOGRAPHY.caption * 0.8,
                  color: COLORS.white,
                  opacity: 0.7
                },
                children: "Hour Scale"
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { textAlign: "center" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              "div",
              {
                style: {
                  fontSize: TYPOGRAPHY.caption,
                  fontWeight: 600,
                  color: COLORS.primary
                },
                children: "Inner Wheel"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              "div",
              {
                style: {
                  fontSize: TYPOGRAPHY.caption * 0.8,
                  color: COLORS.white,
                  opacity: 0.7
                },
                children: "Second Scale"
              }
            )
          ] })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "6%",
          left: "10%",
          right: "10%",
          textAlign: "center",
          opacity: explanationProgress,
          transform: `translateY(${(1 - explanationProgress) * 20}px)`
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "div",
            {
              style: {
                fontSize: TYPOGRAPHY.body,
                fontWeight: 600,
                color: COLORS.white
              },
              children: "Tasks cascade from outer to inner wheel"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "div",
            {
              style: {
                fontSize: TYPOGRAPHY.caption,
                color: COLORS.white,
                opacity: 0.7,
                marginTop: 8
              },
              children: "Each wheel handles a different time scale"
            }
          )
        ]
      }
    )
  ] });
};

// src/proj_52679ede_22c5_4f0a_a231_c91da8c72538/scenes/Scene6.tsx
var import_remotion7 = require("remotion");
var import_jsx_runtime7 = require("react/jsx-runtime");
var IndustrialWheel = ({
  rotation,
  opacity
}) => {
  const slots = 24;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "40%",
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        width: "70%",
        height: 0,
        paddingBottom: "70%",
        opacity
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
              border: `6px solid ${COLORS.secondary}30`,
              boxShadow: `inset 0 0 80px ${COLORS.primary}10`
            }
          }
        ),
        Array.from({ length: slots }, (_, i) => {
          const angle = i / slots * 360;
          const radians = (angle - 90) * Math.PI / 180;
          const x = 50 + Math.cos(radians) * 46;
          const y = 50 + Math.sin(radians) * 46;
          return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: `${x}%`,
                top: `${y}%`,
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: COLORS.primary,
                opacity: 0.4,
                transform: "translate(-50%, -50%)"
              }
            },
            i
          );
        }),
        Array.from({ length: 12 }, (_, i) => {
          const angle = i / 12 * 360;
          const radians = (angle - 90) * Math.PI / 180;
          const x = 50 + Math.cos(radians) * 30;
          const y = 50 + Math.sin(radians) * 30;
          return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: `${x}%`,
                top: `${y}%`,
                width: 20,
                height: 8,
                background: COLORS.secondary,
                opacity: 0.3,
                transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                borderRadius: 2
              }
            },
            `gear-${i}`
          );
        })
      ]
    }
  );
};
var LogoBadge = ({ name, color, x, progress, fromLeft }) => {
  const slideOffset = fromLeft ? -100 : 100;
  const currentX = (0, import_remotion7.interpolate)(progress, [0, 1], [slideOffset, 0], {
    extrapolateRight: "clamp"
  });
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: `${x}%`,
        transform: `translateX(${currentX}px)`,
        opacity: progress
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
        "div",
        {
          style: {
            background: `linear-gradient(135deg, ${color}20, ${color}40)`,
            border: `2px solid ${color}`,
            borderRadius: 16,
            padding: "16px 28px",
            textAlign: "center",
            boxShadow: `0 0 30px ${color}30`
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
              "div",
              {
                style: {
                  fontSize: TYPOGRAPHY.body * 0.8,
                  fontWeight: 700,
                  color: COLORS.white,
                  letterSpacing: 1
                },
                children: name
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
              "div",
              {
                style: {
                  fontSize: TYPOGRAPHY.caption * 0.8,
                  color: COLORS.white,
                  opacity: 0.7,
                  marginTop: 4
                },
                children: "Uses Timing Wheels"
              }
            )
          ]
        }
      )
    }
  );
};
var MetricDisplay = ({ label, value, color, progress, delay }) => {
  const adjustedProgress = Math.max(0, progress - delay);
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
    "div",
    {
      style: {
        textAlign: "center",
        opacity: adjustedProgress,
        transform: `scale(${0.8 + adjustedProgress * 0.2})`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            style: {
              fontSize: TYPOGRAPHY.section,
              fontWeight: 800,
              color,
              textShadow: `0 0 20px ${color}80`
            },
            children: value
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            style: {
              fontSize: TYPOGRAPHY.caption,
              color: COLORS.white,
              opacity: 0.8,
              marginTop: 4
            },
            children: label
          }
        )
      ]
    }
  );
};
var Scene6 = ({ startFrame }) => {
  const frame = (0, import_remotion7.useCurrentFrame)();
  const { fps } = (0, import_remotion7.useVideoConfig)();
  const localFrame = frame - startFrame;
  const keySyncFrame = 178;
  const wheelRotation = localFrame * 0.15;
  const wheelOpacity = (0, import_remotion7.interpolate)(localFrame, [0, 60], [0, 0.3], {
    extrapolateRight: "clamp"
  });
  const titleProgress = (0, import_remotion7.spring)({
    frame: localFrame - 20,
    fps,
    config: SPRING_CONFIG
  });
  const metricsProgress = (0, import_remotion7.spring)({
    frame: localFrame - 60,
    fps,
    config: SPRING_CONFIG
  });
  const logoProgress = (0, import_remotion7.spring)({
    frame: localFrame - (keySyncFrame - 30),
    fps,
    config: { ...SPRING_CONFIG, stiffness: 80 }
  });
  const architectureGlow = (0, import_remotion7.interpolate)(
    localFrame,
    [keySyncFrame - 5, keySyncFrame, keySyncFrame + 30],
    [0, 1, 0.6],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const bottomProgress = (0, import_remotion7.spring)({
    frame: localFrame - 250,
    fps,
    config: SPRING_CONFIG
  });
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_remotion7.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IndustrialWheel, { rotation: wheelRotation, opacity: wheelOpacity }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "6%",
          left: "10%",
          right: "10%",
          textAlign: "center",
          opacity: titleProgress,
          transform: `translateY(${(1 - titleProgress) * -20}px)`
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            style: {
              fontSize: TYPOGRAPHY.section,
              fontWeight: 700,
              color: COLORS.white,
              textShadow: `0 0 20px ${COLORS.primary}60`
            },
            children: "Real-World Implementation"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: "16%",
          left: "10%",
          right: "10%",
          display: "flex",
          justifyContent: "space-around"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            MetricDisplay,
            {
              label: "Throughput",
              value: "MASSIVE",
              color: COLORS.success,
              progress: metricsProgress,
              delay: 0
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            MetricDisplay,
            {
              label: "Latency",
              value: "NO LAG",
              color: COLORS.primary,
              progress: metricsProgress,
              delay: 0.1
            }
          )
        ]
      }
    ),
    architectureGlow > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "38%",
          left: "50%",
          transform: "translateX(-50%)",
          opacity: architectureGlow
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            style: {
              fontSize: TYPOGRAPHY.body,
              fontWeight: 700,
              color: COLORS.accent,
              textShadow: `0 0 ${20 + architectureGlow * 30}px ${COLORS.accent}`,
              letterSpacing: 3
            },
            children: "PRODUCTION ARCHITECTURE"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: "55%",
          left: "10%",
          right: "10%",
          display: "flex",
          justifyContent: "space-around"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            LogoBadge,
            {
              name: "Apache Kafka",
              color: "#FF6B35",
              x: 20,
              progress: logoProgress,
              fromLeft: true
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            LogoBadge,
            {
              name: "Netty",
              color: "#00D4FF",
              x: 65,
              progress: logoProgress,
              fromLeft: false
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
      "svg",
      {
        style: {
          position: "absolute",
          width: "100%",
          height: "100%",
          pointerEvents: "none"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("linearGradient", { id: "lineGradient", x1: "0%", y1: "0%", x2: "100%", y2: "0%", children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("stop", { offset: "0%", stopColor: COLORS.accent, stopOpacity: logoProgress * 0.5 }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("stop", { offset: "50%", stopColor: COLORS.primary, stopOpacity: logoProgress * 0.8 }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("stop", { offset: "100%", stopColor: COLORS.accent, stopOpacity: logoProgress * 0.5 })
          ] }) }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            "line",
            {
              x1: "25%",
              y1: "62%",
              x2: "50%",
              y2: "45%",
              stroke: "url(#lineGradient)",
              strokeWidth: 2,
              strokeDasharray: "8 4"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            "line",
            {
              x1: "75%",
              y1: "62%",
              x2: "50%",
              y2: "45%",
              stroke: "url(#lineGradient)",
              strokeWidth: 2,
              strokeDasharray: "8 4"
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
          left: "10%",
          right: "10%",
          textAlign: "center",
          opacity: bottomProgress,
          transform: `translateY(${(1 - bottomProgress) * 20}px)`
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            "div",
            {
              style: {
                fontSize: TYPOGRAPHY.body,
                fontWeight: 600,
                color: COLORS.white
              },
              children: "Powering Enterprise Scale"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            "div",
            {
              style: {
                fontSize: TYPOGRAPHY.caption,
                color: COLORS.white,
                opacity: 0.7,
                marginTop: 8
              },
              children: "Proven at millions of operations per second"
            }
          )
        ]
      }
    )
  ] });
};

// src/proj_52679ede_22c5_4f0a_a231_c91da8c72538/scenes/Scene7.tsx
var import_remotion8 = require("remotion");
var import_jsx_runtime8 = require("react/jsx-runtime");
var PulsingArrow = ({ pulse }) => {
  const scale = 1 + pulse * 0.15;
  const glow = pulse * 30;
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
    "div",
    {
      style: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${scale}) translateX(${pulse * 10}px)`
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        "svg",
        {
          width: "48",
          height: "48",
          viewBox: "0 0 24 24",
          fill: "none",
          style: {
            filter: `drop-shadow(0 0 ${glow}px ${COLORS.primary})`
          },
          children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "path",
            {
              d: "M5 12h14m-7-7l7 7-7 7",
              stroke: COLORS.primary,
              strokeWidth: "2.5",
              strokeLinecap: "round",
              strokeLinejoin: "round"
            }
          )
        }
      )
    }
  );
};
var BackgroundWheel = ({
  rotation,
  opacity
}) => {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        width: "120%",
        height: 0,
        paddingBottom: "120%",
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
              border: `2px solid ${COLORS.secondary}15`
            }
          }
        ),
        Array.from({ length: 12 }, (_, i) => {
          const angle = i / 12 * 360;
          const radians = (angle - 90) * Math.PI / 180;
          const x = 50 + Math.cos(radians) * 48;
          const y = 50 + Math.sin(radians) * 48;
          return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: `${x}%`,
                top: `${y}%`,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: COLORS.primary,
                opacity: 0.15,
                transform: "translate(-50%, -50%)"
              }
            },
            i
          );
        })
      ]
    }
  );
};
var Scene7 = ({ startFrame }) => {
  const frame = (0, import_remotion8.useCurrentFrame)();
  const { fps } = (0, import_remotion8.useVideoConfig)();
  const localFrame = frame - startFrame;
  const keySyncFrame = 10;
  const wheelRotation = localFrame * 0.1;
  const wheelOpacity = 0.15;
  const speakerProgress = (0, import_remotion8.spring)({
    frame: localFrame - 5,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 120 }
  });
  const followProgress = (0, import_remotion8.spring)({
    frame: localFrame - keySyncFrame,
    fps,
    config: SPRING_CONFIG
  });
  const arrowPulse = (0, import_remotion8.interpolate)(
    (localFrame - keySyncFrame) % 30,
    [0, 15, 30],
    [0, 1, 0],
    { extrapolateRight: "clamp" }
  );
  const pinnedProgress = (0, import_remotion8.spring)({
    frame: localFrame - 60,
    fps,
    config: SPRING_CONFIG
  });
  const fadeOut = (0, import_remotion8.interpolate)(
    localFrame,
    [180, 207],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_remotion8.AbsoluteFill, { style: { opacity: fadeOut }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(BackgroundWheel, { rotation: wheelRotation, opacity: wheelOpacity }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: "20%",
          left: "10%",
          right: "10%",
          textAlign: "center",
          opacity: speakerProgress,
          transform: `translateY(${(1 - speakerProgress) * -30}px)`
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "div",
            {
              style: {
                fontSize: TYPOGRAPHY.section,
                fontWeight: 700,
                color: COLORS.white
              },
              children: "Prasanna"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "div",
            {
              style: {
                fontSize: TYPOGRAPHY.caption,
                color: COLORS.primary,
                marginTop: 8,
                fontWeight: 600
              },
              children: "@ Zoho"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "div",
            {
              style: {
                fontSize: TYPOGRAPHY.caption * 0.9,
                color: COLORS.white,
                opacity: 0.7,
                marginTop: 12
              },
              children: "System Design Engineer"
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
          top: "48%",
          left: "10%",
          right: "10%",
          textAlign: "center",
          opacity: followProgress,
          transform: `scale(${0.8 + followProgress * 0.2})`
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 16
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                  "span",
                  {
                    style: {
                      fontSize: TYPOGRAPHY.body,
                      fontWeight: 700,
                      color: COLORS.white,
                      textShadow: `0 0 20px ${COLORS.primary}50`
                    },
                    children: "Follow for more"
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(PulsingArrow, { pulse: arrowPulse })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "div",
            {
              style: {
                fontSize: TYPOGRAPHY.section,
                fontWeight: 800,
                color: COLORS.primary,
                marginTop: 16,
                textShadow: `0 0 30px ${COLORS.primary}60`,
                letterSpacing: 2
              },
              children: "ENGINEERING INSIGHTS"
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
          top: "68%",
          left: "10%",
          right: "10%",
          opacity: pinnedProgress,
          transform: `translateY(${(1 - pinnedProgress) * 20}px)`
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
          "div",
          {
            style: {
              background: `linear-gradient(135deg, ${COLORS.backgroundEnd}, ${COLORS.background})`,
              border: `2px solid ${COLORS.secondary}40`,
              borderRadius: 16,
              padding: "20px 24px",
              textAlign: "center"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                "div",
                {
                  style: {
                    fontSize: TYPOGRAPHY.caption,
                    fontWeight: 600,
                    color: COLORS.accent,
                    marginBottom: 8
                  },
                  children: "\u{1F4CC} PINNED COMMENT"
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
                "div",
                {
                  style: {
                    fontSize: TYPOGRAPHY.caption,
                    color: COLORS.white,
                    opacity: 0.9
                  },
                  children: [
                    "Check the pinned comment for",
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("br", {}),
                    "deep-dive resources & code examples"
                  ]
                }
              )
            ]
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: "8%",
          left: "10%",
          right: "10%",
          textAlign: "center",
          opacity: pinnedProgress * 0.8
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "div",
          {
            style: {
              fontSize: TYPOGRAPHY.caption * 0.9,
              color: COLORS.white,
              opacity: 0.5
            },
            children: "System Design \u2022 Algorithms \u2022 Engineering"
          }
        )
      }
    )
  ] });
};

// src/proj_52679ede_22c5_4f0a_a231_c91da8c72538/index.tsx
var import_jsx_runtime9 = require("react/jsx-runtime");
var MainComposition = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_remotion9.AbsoluteFill, { style: { backgroundColor: COLORS.background }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Background, {}, "bg"),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      import_remotion9.Sequence,
      {
        from: TIMING.scene1Start,
        durationInFrames: TIMING.scene1End - TIMING.scene1Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Scene1, { startFrame: 0 })
      },
      "scene1"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      import_remotion9.Sequence,
      {
        from: TIMING.scene2Start,
        durationInFrames: TIMING.scene2End - TIMING.scene2Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Scene2, { startFrame: 0 })
      },
      "scene2"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      import_remotion9.Sequence,
      {
        from: TIMING.scene3Start,
        durationInFrames: TIMING.scene3End - TIMING.scene3Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Scene3, { startFrame: 0 })
      },
      "scene3"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      import_remotion9.Sequence,
      {
        from: TIMING.scene4Start,
        durationInFrames: TIMING.scene4End - TIMING.scene4Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Scene4, { startFrame: 0 })
      },
      "scene4"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      import_remotion9.Sequence,
      {
        from: TIMING.scene5Start,
        durationInFrames: TIMING.scene5End - TIMING.scene5Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Scene5, { startFrame: 0 })
      },
      "scene5"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      import_remotion9.Sequence,
      {
        from: TIMING.scene6Start,
        durationInFrames: TIMING.scene6End - TIMING.scene6Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Scene6, { startFrame: 0 })
      },
      "scene6"
    ),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      import_remotion9.Sequence,
      {
        from: TIMING.scene7Start,
        durationInFrames: TIMING.scene7End - TIMING.scene7Start,
        children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Scene7, { startFrame: 0 })
      },
      "scene7"
    )
  ] });
};
var RemotionRoot = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
    import_remotion9.Composition,
    {
      id: "proj_52679ede_22c5_4f0a_a231_c91da8c72538",
      component: MainComposition,
      durationInFrames: TIMING.totalFrames,
      fps: TIMING.fps,
      width: TIMING.width,
      height: TIMING.height
    }
  );
};
var index_default = MainComposition;
(0, import_remotion9.registerRoot)(RemotionRoot);
