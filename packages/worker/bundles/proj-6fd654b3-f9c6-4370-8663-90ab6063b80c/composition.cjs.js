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

// src/proj_6fd654b3_f9c6_4370_8663_90ab6063b80c/Main.tsx
var Main_exports = {};
__export(Main_exports, {
  default: () => Main
});
module.exports = __toCommonJS(Main_exports);
var import_remotion9 = require("remotion");

// src/proj_6fd654b3_f9c6_4370_8663_90ab6063b80c/scenes/scene_1.tsx
var import_react2 = require("react");
var import_three = require("@remotion/three");
var import_remotion2 = require("remotion");

// src/proj_6fd654b3_f9c6_4370_8663_90ab6063b80c/constants.ts
var COLORS = {
  background: "#0F172A",
  primary: "#3B82F6",
  secondary: "#10B981",
  accent: "#F59E0B",
  danger: "#EF4444",
  white: "#FFFFFF",
  text: "#E2E8F0",
  // Three.js hex format
  primaryHex: 3900150,
  secondaryHex: 1096065,
  accentHex: 16096779,
  dangerHex: 15680580,
  whiteHex: 16777215,
  backgroundHex: 988970
};
var WHEEL = {
  innerRadius: 2,
  outerRadius: 3.5,
  tubeRadius: 0.06,
  innerBuckets: 12,
  outerBuckets: 24,
  fullBuckets: 60
};
var CAMERA = {
  default: [0, 0, 8],
  zoomedIn: [0, 0, 6],
  zoomedOut: [0, 0, 11],
  fov: 75
};
var NODE_SIZE = 0.18;

// src/animations.tsx
var import_react = __toESM(require("react"));
var import_remotion = require("remotion");
var import_jsx_runtime = require("react/jsx-runtime");
var SPRING_CONFIGS = {
  minimal: { damping: 20, stiffness: 60, mass: 1 },
  modern: { damping: 12, stiffness: 80, mass: 1 },
  playful: { damping: 8, stiffness: 200, mass: 1 },
  bold: { damping: 15, stiffness: 150, mass: 1 },
  classic: { damping: 25, stiffness: 50, mass: 1 }
};
var FadeIn = ({
  children,
  delay = 0,
  duration = 20
}) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const opacity = (0, import_remotion.interpolate)(
    frame - delay,
    [0, duration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { opacity }, children });
};
var ScaleIn = ({
  children,
  delay = 0,
  from = 0.8,
  style = "modern"
}) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const config = SPRING_CONFIGS[style];
  const progress = (0, import_remotion.spring)({
    frame: frame - delay,
    fps,
    config
  });
  const scale = (0, import_remotion.interpolate)(progress, [0, 1], [from, 1]);
  const opacity = (0, import_remotion.interpolate)(progress, [0, 1], [0, 1]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
    transform: `scale(${scale})`,
    opacity
  }, children });
};
var PREMIUM_DURATIONS = {
  minimal: { fast: 20, normal: 30, slow: 45 },
  modern: { fast: 15, normal: 24, slow: 36 },
  playful: { fast: 12, normal: 20, slow: 30 },
  bold: { fast: 10, normal: 18, slow: 28 },
  classic: { fast: 24, normal: 36, slow: 48 }
};
var BounceIn = ({
  children,
  delay = 0,
  duration,
  style = "modern",
  speed = "normal"
}) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const dur = duration || PREMIUM_DURATIONS[style][speed];
  const t = Math.max(0, Math.min(1, (frame - delay) / dur));
  if (frame < delay) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { opacity: 0 }, children });
  let scale;
  let opacity;
  if (t < 0.2) {
    scale = (0, import_remotion.interpolate)(t, [0, 0.2], [0.3, 1.1]);
    opacity = (0, import_remotion.interpolate)(t, [0, 0.2], [0, 1]);
  } else if (t < 0.4) {
    scale = (0, import_remotion.interpolate)(t, [0.2, 0.4], [1.1, 0.9]);
    opacity = 1;
  } else if (t < 0.6) {
    scale = (0, import_remotion.interpolate)(t, [0.4, 0.6], [0.9, 1.03]);
    opacity = 1;
  } else if (t < 0.8) {
    scale = (0, import_remotion.interpolate)(t, [0.6, 0.8], [1.03, 0.97]);
    opacity = 1;
  } else {
    scale = (0, import_remotion.interpolate)(t, [0.8, 1], [0.97, 1]);
    opacity = 1;
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { transform: `scale(${scale})`, opacity, transformOrigin: "center" }, children });
};
var FadeInUp = ({
  children,
  delay = 0,
  duration,
  style = "modern",
  speed = "normal",
  distance = 40
}) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const dur = duration || PREMIUM_DURATIONS[style][speed];
  const config = SPRING_CONFIGS[style];
  if (frame < delay) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { opacity: 0 }, children });
  const progress = (0, import_remotion.spring)({ frame: frame - delay, fps, config, durationInFrames: dur });
  const translateY = (0, import_remotion.interpolate)(progress, [0, 1], [distance, 0]);
  const opacity = (0, import_remotion.interpolate)(progress, [0, 0.6], [0, 1], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { transform: `translateY(${translateY}px)`, opacity }, children });
};
var GlowPulse = ({
  children,
  delay = 0,
  duration = 40,
  color = "#3b82f6",
  intensity = 30
}) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  if (frame < delay) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children });
  const t = (frame - delay) % duration / duration;
  const glowSize = (0, import_remotion.interpolate)(
    Math.sin(t * Math.PI * 2),
    [-1, 1],
    [intensity * 0.3, intensity]
  );
  const glowOpacity = (0, import_remotion.interpolate)(
    Math.sin(t * Math.PI * 2),
    [-1, 1],
    [0.3, 0.8]
  );
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
    filter: `drop-shadow(0 0 ${glowSize}px ${color})`,
    opacity: (0, import_remotion.interpolate)(glowOpacity, [0.3, 0.8], [0.85, 1])
  }, children });
};

// src/proj_6fd654b3_f9c6_4370_8663_90ab6063b80c/scenes/scene_1.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function Scene() {
  const { width, height, fps } = (0, import_remotion2.useVideoConfig)();
  const frame = (0, import_remotion2.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const taskCount = 50;
  const tasks = (0, import_react2.useMemo)(() => {
    return Array.from({ length: taskCount }).map((_, i) => {
      const angle = i / taskCount * Math.PI * 2 + i * 0.3;
      const dist = 0.5 + (i * 7 + 3) % 13 / 13 * 1.5;
      return {
        id: i,
        angle,
        distance: dist,
        delay: i * 3,
        speed: 0.5 + (i * 11 + 5) % 17 / 17,
        size: 0.1 + (i * 3 + 7) % 11 / 110
      };
    });
  }, [taskCount]);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_remotion2.AbsoluteFill, { style: { backgroundColor: COLORS.background }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      import_three.ThreeCanvas,
      {
        width,
        height,
        camera: { position: CAMERA.default, fov: CAMERA.fov },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ambientLight", { intensity: 0.5 }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("directionalLight", { position: [10, 10, 5], intensity: 1 }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("pointLight", { position: [0, 0, 2], intensity: 0.8, color: COLORS.primaryHex }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("mesh", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("torusGeometry", { args: [2.2, 0.02, 8, 64] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "meshStandardMaterial",
              {
                color: COLORS.primaryHex,
                transparent: true,
                opacity: (0, import_remotion2.interpolate)(
                  (0, import_remotion2.spring)({ frame, fps, config: { damping: 12, stiffness: 80 } }),
                  [0, 1],
                  [0, 0.3]
                )
              }
            )
          ] }),
          tasks.map((task) => {
            const entry = (0, import_remotion2.spring)({
              frame: frame - task.delay,
              fps,
              config: { damping: 15, stiffness: 60 }
            });
            if (entry <= 0.01) return null;
            const startX = -6;
            const targetX = Math.cos(task.angle) * task.distance;
            const targetY = Math.sin(task.angle) * task.distance;
            const x = (0, import_remotion2.interpolate)(entry, [0, 1], [startX, targetX]);
            const y = (0, import_remotion2.interpolate)(entry, [0, 1], [0, targetY]);
            const floatX = Math.sin(frame * 0.03 * task.speed) * 0.05;
            const floatY = Math.cos(frame * 0.03 * task.speed) * 0.05;
            return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "mesh",
              {
                position: [x + floatX, y + floatY, 0],
                scale: [entry, entry, entry],
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("sphereGeometry", { args: [task.size, 16, 16] }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                    "meshStandardMaterial",
                    {
                      color: COLORS.primaryHex,
                      emissive: COLORS.secondaryHex,
                      emissiveIntensity: 0.3
                    }
                  )
                ]
              },
              task.id
            );
          })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.05,
          width: "100%",
          textAlign: "center",
          zIndex: 10
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(FadeInUp, { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "h1",
          {
            style: {
              color: COLORS.white,
              fontSize: height * 0.045,
              fontWeight: 800,
              margin: 0,
              fontFamily: "system-ui, sans-serif"
            },
            children: "High-Throughput Scheduling"
          }
        ) })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: height * 0.22,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          zIndex: 10
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(BounceIn, { delay: 60, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "div",
          {
            style: {
              background: "rgba(59, 130, 246, 0.1)",
              backdropFilter: "blur(8px)",
              border: `1px solid ${COLORS.primary}44`,
              padding: `${minDim * 0.01}px ${minDim * 0.03}px`,
              borderRadius: minDim * 0.01,
              color: COLORS.primary,
              fontSize: height * 0.02,
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "2px"
            },
            children: "Delayed Tasks"
          }
        ) })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: height * 0.05,
          width: "100%",
          padding: `0 ${width * 0.1}px`,
          zIndex: 10
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(FadeIn, { delay: 45, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "div",
          {
            style: {
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              borderRadius: minDim * 0.02,
              padding: minDim * 0.03,
              border: "1px solid rgba(255, 255, 255, 0.1)",
              textAlign: "center"
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "p",
              {
                style: {
                  color: COLORS.white,
                  fontSize: height * 0.022,
                  lineHeight: 1.5,
                  margin: 0,
                  fontFamily: "system-ui, sans-serif"
                },
                children: [
                  "Managing millions of delayed tasks requires efficient data structures to minimize",
                  " ",
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: COLORS.accent, fontWeight: "bold" }, children: "sorting overhead" }),
                  "."
                ]
              }
            )
          }
        ) })
      }
    )
  ] });
}

// src/proj_6fd654b3_f9c6_4370_8663_90ab6063b80c/scenes/scene_2.tsx
var import_react4 = require("react");
var import_three2 = require("@remotion/three");
var import_remotion3 = require("remotion");

// src/proj_6fd654b3_f9c6_4370_8663_90ab6063b80c/components/EdgeCylinder.tsx
var import_react3 = require("react");
var THREE = __toESM(require("three"));
var import_jsx_runtime3 = require("react/jsx-runtime");
var EdgeCylinder = ({
  start,
  end,
  thickness = 0.03,
  color,
  opacity = 1
}) => {
  const { position, rotation, length } = (0, import_react3.useMemo)(() => {
    const s = new THREE.Vector3(...start);
    const e = new THREE.Vector3(...end);
    const mid = new THREE.Vector3().addVectors(s, e).multiplyScalar(0.5);
    const len = s.distanceTo(e);
    const dir = new THREE.Vector3().subVectors(e, s).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir
    );
    const euler = new THREE.Euler().setFromQuaternion(quat);
    return {
      position: [mid.x, mid.y, mid.z],
      rotation: [euler.x, euler.y, euler.z],
      length: len
    };
  }, [start, end]);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("mesh", { position, rotation, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("cylinderGeometry", { args: [thickness, thickness, length, 8] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "meshStandardMaterial",
      {
        color,
        transparent: opacity < 1,
        opacity
      }
    )
  ] });
};
var EdgeCylinder_default = EdgeCylinder;

// src/proj_6fd654b3_f9c6_4370_8663_90ab6063b80c/scenes/scene_2.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
var getHeapNodePosition = (index, spreadX) => {
  const level = Math.floor(Math.log2(index + 1));
  const posInLevel = index - (Math.pow(2, level) - 1);
  const nodesInLevel = Math.pow(2, level);
  const hGap = spreadX / nodesInLevel;
  const x = -spreadX / 2 + hGap * (posInLevel + 0.5);
  const y = 2.5 - level * 1.2;
  return [x, y, 0];
};
function BinaryHeapScene() {
  const { width, height, fps } = (0, import_remotion3.useVideoConfig)();
  const frame = (0, import_remotion3.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const nodeCount = 15;
  const cloudCount = 50;
  const spreadX = 6;
  const initialCloud = (0, import_react4.useMemo)(() => {
    return Array.from({ length: cloudCount }).map((_, i) => {
      const angle = i / cloudCount * Math.PI * 2;
      const dist = 1.5 + (i * 7 + 3) % 13 / 13 * 1.5;
      return {
        id: i,
        x: Math.cos(angle * 1.5) * dist,
        y: Math.sin(angle * 1.5) * dist
      };
    });
  }, [cloudCount]);
  const formHeapProgress = (0, import_remotion3.spring)({
    frame: frame - 30,
    fps,
    config: { damping: 12, stiffness: 80 }
  });
  const sortPulse = (0, import_remotion3.spring)({
    frame: frame % 60,
    fps,
    config: { damping: 20, stiffness: 80 }
  });
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_remotion3.AbsoluteFill, { style: { backgroundColor: COLORS.background }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      import_three2.ThreeCanvas,
      {
        width,
        height,
        camera: { position: CAMERA.default, fov: CAMERA.fov },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("ambientLight", { intensity: 0.5 }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("directionalLight", { position: [10, 10, 5], intensity: 1 }),
          Array.from({ length: nodeCount }).map((_, i) => {
            if (i === 0) return null;
            const parentIndex = Math.floor((i - 1) / 2);
            const startPos = getHeapNodePosition(parentIndex, spreadX);
            const endPos = getHeapNodePosition(i, spreadX);
            const lineProgress = (0, import_remotion3.spring)({
              frame: frame - 60 - i * 2,
              fps,
              config: { damping: 12, stiffness: 80 }
            });
            if (lineProgress <= 0.01) return null;
            const currentEnd = [
              (0, import_remotion3.interpolate)(lineProgress, [0, 1], [startPos[0], endPos[0]]),
              (0, import_remotion3.interpolate)(lineProgress, [0, 1], [startPos[1], endPos[1]]),
              0
            ];
            return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              EdgeCylinder_default,
              {
                start: startPos,
                end: currentEnd,
                thickness: 0.025,
                color: COLORS.primaryHex,
                opacity: 0.4 * lineProgress
              },
              `line-${i}`
            );
          }),
          initialCloud.map((cloudNode, i) => {
            const isHeapNode = i < nodeCount;
            const heapPos = isHeapNode ? getHeapNodePosition(i, spreadX) : [cloudNode.x * 2, cloudNode.y * 2, 0];
            const currentX = (0, import_remotion3.interpolate)(formHeapProgress, [0, 1], [cloudNode.x, heapPos[0]]);
            const currentY = (0, import_remotion3.interpolate)(formHeapProgress, [0, 1], [cloudNode.y, heapPos[1]]);
            const opacity = isHeapNode ? 1 : (0, import_remotion3.interpolate)(formHeapProgress, [0.5, 1], [1, 0]);
            const isRoot = i === 0;
            const nodeScale = isRoot ? 1 + 0.1 * sortPulse : 1;
            return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
              "mesh",
              {
                position: [currentX, currentY, 0],
                scale: [nodeScale, nodeScale, nodeScale],
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("sphereGeometry", { args: [NODE_SIZE, 16, 16] }),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                    "meshStandardMaterial",
                    {
                      color: isRoot ? COLORS.accentHex : COLORS.primaryHex,
                      emissive: isRoot ? COLORS.accentHex : COLORS.primaryHex,
                      emissiveIntensity: isRoot ? 0.4 + sortPulse * 0.3 : 0.2,
                      transparent: opacity < 1,
                      opacity
                    }
                  )
                ]
              },
              `node-${i}`
            );
          }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "pointLight",
            {
              position: getHeapNodePosition(0, spreadX),
              intensity: sortPulse * 0.5,
              color: COLORS.accentHex,
              distance: 3
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
          top: height * 0.03,
          width: "100%",
          textAlign: "center",
          zIndex: 10
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(FadeIn, { delay: 20, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "h1",
            {
              style: {
                color: COLORS.white,
                fontSize: height * 0.04,
                fontWeight: 700,
                margin: 0,
                fontFamily: "sans-serif"
              },
              children: "Priority Queue (Binary Heap)"
            }
          ) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(FadeIn, { delay: 40, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "p",
            {
              style: {
                color: COLORS.primary,
                fontSize: height * 0.018,
                marginTop: 8,
                textTransform: "uppercase",
                letterSpacing: 2,
                fontFamily: "sans-serif"
              },
              children: "O(log n) Insertion & Removal"
            }
          ) })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: height * 0.06,
          width: "100%",
          padding: `0 ${width * 0.08}px`,
          zIndex: 10
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
          "div",
          {
            style: {
              padding: `${height * 0.015}px ${width * 0.04}px`,
              backgroundColor: "rgba(59, 130, 246, 0.1)",
              borderRadius: minDim * 0.02,
              border: `1px solid ${COLORS.primary}44`
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ScaleIn, { delay: 120, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 12 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                  "div",
                  {
                    style: {
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: COLORS.accent
                    }
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
                  "p",
                  {
                    style: {
                      color: COLORS.text,
                      fontSize: height * 0.016,
                      fontFamily: "sans-serif",
                      margin: 0
                    },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: "Root Node:" }),
                      " Most immediate task, always at the top."
                    ]
                  }
                )
              ] }) }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ScaleIn, { delay: 240, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 12, marginTop: 12 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                  "div",
                  {
                    style: {
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: COLORS.primary
                    }
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
                  "p",
                  {
                    style: {
                      color: COLORS.text,
                      fontSize: height * 0.016,
                      fontFamily: "sans-serif",
                      margin: 0
                    },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: "Re-sorting:" }),
                      " Every insertion requires logarithmic shifting."
                    ]
                  }
                )
              ] }) })
            ]
          }
        )
      }
    )
  ] });
}

// src/proj_6fd654b3_f9c6_4370_8663_90ab6063b80c/scenes/scene_3.tsx
var import_react6 = require("react");
var import_three3 = require("@remotion/three");
var import_remotion4 = require("remotion");

// src/proj_6fd654b3_f9c6_4370_8663_90ab6063b80c/components/BinaryTree3D.tsx
var import_react5 = require("react");
var THREE2 = __toESM(require("three"));
var import_jsx_runtime5 = require("react/jsx-runtime");
var BinaryTree3D = ({
  levels = 4,
  nodeSize = 0.18,
  stressProgress = 0,
  jitter = 0,
  treeScale = 1,
  collapseProgress = 0,
  primaryColor = 3900150,
  dangerColor = 15680580
}) => {
  const nodes = (0, import_react5.useMemo)(() => {
    const n = [];
    const spreadX = 5;
    const spreadY = 1.2;
    const topY = 2;
    for (let l = 0; l < levels; l++) {
      const nodesInLevel = Math.pow(2, l);
      const levelWidth = spreadX * (nodesInLevel / Math.pow(2, levels - 1));
      for (let i = 0; i < nodesInLevel; i++) {
        const x = nodesInLevel === 1 ? 0 : -levelWidth / 2 + levelWidth / (nodesInLevel - 1) * i;
        n.push({
          level: l,
          index: i,
          x: levelWidth === 0 ? 0 : x,
          y: topY - l * spreadY,
          z: 0,
          id: `node-${l}-${i}`
        });
      }
    }
    return n;
  }, [levels]);
  const colorPrimary = (0, import_react5.useMemo)(() => new THREE2.Color(primaryColor), [primaryColor]);
  const colorDanger = (0, import_react5.useMemo)(() => new THREE2.Color(dangerColor), [dangerColor]);
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("group", { scale: [treeScale, treeScale, treeScale], children: [
    nodes.map((node) => {
      if (node.level === 0) return null;
      const parentGlobalIndex = Math.floor(
        (Math.pow(2, node.level) - 1 + node.index - 1) / 2
      );
      const parent = nodes[parentGlobalIndex];
      if (!parent) return null;
      const edgeColor = new THREE2.Color().lerpColors(
        colorPrimary,
        colorDanger,
        stressProgress
      );
      const cx = collapseProgress;
      const sx = (v) => v * (1 - cx);
      const sy = (v) => v * (1 - cx);
      const j = jitter;
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        EdgeCylinder_default,
        {
          start: [sx(parent.x) + j, sy(parent.y) + j, 0],
          end: [sx(node.x) + j, sy(node.y) + j, 0],
          thickness: 0.025 + stressProgress * 0.02,
          color: `#${edgeColor.getHexString()}`,
          opacity: 1 - collapseProgress
        },
        `edge-${node.id}`
      );
    }),
    nodes.map((node, i) => {
      const nodeStress = Math.min(1, Math.max(0, stressProgress * 1.5 - i * 0.03));
      const nodeColor = new THREE2.Color().lerpColors(
        colorPrimary,
        colorDanger,
        nodeStress
      );
      const cx = collapseProgress;
      const nx = node.x * (1 - cx) + jitter;
      const ny = node.y * (1 - cx) + jitter;
      const nScale = 1 - collapseProgress * 0.8;
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
        "mesh",
        {
          position: [nx, ny, 0],
          scale: [nScale, nScale, nScale],
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("sphereGeometry", { args: [nodeSize, 16, 16] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "meshStandardMaterial",
              {
                color: `#${nodeColor.getHexString()}`,
                emissive: `#${nodeColor.getHexString()}`,
                emissiveIntensity: 0.2 + nodeStress * 0.6,
                transparent: collapseProgress > 0,
                opacity: 1 - collapseProgress
              }
            )
          ]
        },
        node.id
      );
    })
  ] });
};
var BinaryTree3D_default = BinaryTree3D;

// src/proj_6fd654b3_f9c6_4370_8663_90ab6063b80c/components/TaskNode3D.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
var TaskNode3D = ({
  position,
  color,
  size = 0.18,
  emissiveIntensity = 0.3,
  opacity = 1
}) => {
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("mesh", { position, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("sphereGeometry", { args: [size, 16, 16] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "meshStandardMaterial",
      {
        color,
        emissive: color,
        emissiveIntensity,
        transparent: opacity < 1,
        opacity
      }
    )
  ] });
};
var TaskNode3D_default = TaskNode3D;

// src/proj_6fd654b3_f9c6_4370_8663_90ab6063b80c/scenes/scene_3.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
function HeapBottleneckScene() {
  const { width, height, fps } = (0, import_remotion4.useVideoConfig)();
  const frame = (0, import_remotion4.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const START_STRESS = 60;
  const PEAK_STRESS = 300;
  const stressProgress = (0, import_remotion4.interpolate)(
    frame,
    [START_STRESS, PEAK_STRESS],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const jitter = (0, import_remotion4.interpolate)(
    Math.sin(frame * 0.5),
    [-1, 1],
    [-0.05 * stressProgress, 0.05 * stressProgress]
  );
  const labelOpacity = (0, import_remotion4.interpolate)(frame, [START_STRESS, START_STRESS + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const labelScale = (0, import_remotion4.spring)({
    frame: frame - START_STRESS,
    fps,
    config: { damping: 12, stiffness: 80 }
  });
  const cameraZ = (0, import_remotion4.interpolate)(stressProgress, [0, 1], [8, 9]);
  const particles = (0, import_react6.useMemo)(() => {
    return Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      xBase: i * 47 % 100 / 100 * 8 - 4,
      delay: i * 8
    }));
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_remotion4.AbsoluteFill, { style: { backgroundColor: COLORS.background }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
      import_three3.ThreeCanvas,
      {
        width,
        height,
        camera: { position: [0, 0, cameraZ], fov: CAMERA.fov },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("ambientLight", { intensity: 0.4 }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("directionalLight", { position: [10, 10, 5], intensity: 0.8 }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            "pointLight",
            {
              position: [0, 2, 1],
              intensity: stressProgress * 1.5,
              color: COLORS.dangerHex,
              distance: 8
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            BinaryTree3D_default,
            {
              levels: 4,
              nodeSize: 0.18,
              stressProgress,
              jitter
            }
          ),
          particles.map((p) => {
            const opacity = (0, import_remotion4.interpolate)(frame, [START_STRESS, PEAK_STRESS], [0, 0.8], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp"
            });
            if (frame < p.delay || opacity <= 0) return null;
            const taskProgress = (frame - p.delay) % 60 / 60;
            return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
              TaskNode3D_default,
              {
                position: [p.xBase, 4 - taskProgress * 8, -0.5],
                color: COLORS.dangerHex,
                size: 0.06,
                emissiveIntensity: 0.5,
                opacity: (1 - taskProgress) * opacity
              },
              p.id
            );
          })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.03,
          width: "100%",
          textAlign: "center",
          zIndex: 10
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "h1",
          {
            style: {
              color: COLORS.white,
              fontSize: height * 0.04,
              margin: 0,
              fontFamily: "sans-serif",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.1em"
            },
            children: "Heap Sorting Overhead"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: height * 0.1,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: height * 0.02,
          opacity: labelOpacity,
          transform: `scale(${labelScale})`,
          zIndex: 10
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            "div",
            {
              style: {
                padding: `${height * 0.01}px ${width * 0.05}px`,
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                borderRadius: minDim * 0.02,
                border: `2px solid ${COLORS.danger}`,
                backdropFilter: "blur(10px)"
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(GlowPulse, { color: COLORS.danger, speed: "fast", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                "span",
                {
                  style: {
                    fontSize: height * 0.05,
                    fontWeight: 900,
                    color: COLORS.danger,
                    fontFamily: "monospace"
                  },
                  children: "O(log N)"
                }
              ) })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
            "div",
            {
              style: {
                textAlign: "center",
                color: COLORS.white,
                fontSize: height * 0.02,
                maxWidth: "70%",
                lineHeight: 1.4,
                fontWeight: 500,
                textShadow: "0 2px 4px rgba(0,0,0,0.5)"
              },
              children: [
                "Sorting overhead grows with Every Task",
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("br", {}),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { style: { color: COLORS.danger, fontWeight: "bold" }, children: [
                  Math.round(stressProgress * 100),
                  "% Performance Bottleneck"
                ] })
              ]
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
          inset: 0,
          pointerEvents: "none",
          border: `${minDim * 0.01}px solid ${COLORS.danger}`,
          opacity: (0, import_remotion4.interpolate)(
            Math.sin(frame * 0.2),
            [-1, 1],
            [0, 0.3 * stressProgress]
          ),
          zIndex: 10
        }
      }
    )
  ] });
}

// src/proj_6fd654b3_f9c6_4370_8663_90ab6063b80c/scenes/scene_4.tsx
var import_react8 = require("react");
var import_three4 = require("@remotion/three");
var import_remotion5 = require("remotion");

// src/proj_6fd654b3_f9c6_4370_8663_90ab6063b80c/components/TimingWheel3D.tsx
var import_react7 = require("react");
var import_jsx_runtime8 = require("react/jsx-runtime");
var TimingWheel3D = ({
  radius,
  bucketCount,
  rotation = 0,
  color,
  tubeRadius = 0.06,
  opacity = 1,
  scale = 1,
  positionZ = 0
}) => {
  const spokes = (0, import_react7.useMemo)(() => {
    const arr = [];
    for (let i = 0; i < bucketCount; i++) {
      const angle = i / bucketCount * Math.PI * 2;
      const innerR = radius * 0.15;
      arr.push({
        angle,
        x1: Math.cos(angle) * innerR,
        y1: Math.sin(angle) * innerR,
        x2: Math.cos(angle) * radius,
        y2: Math.sin(angle) * radius
      });
    }
    return arr;
  }, [radius, bucketCount]);
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("group", { rotation: [0, 0, rotation], scale: [scale, scale, scale], position: [0, 0, positionZ], children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("mesh", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("torusGeometry", { args: [radius, tubeRadius, 16, 64] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        "meshStandardMaterial",
        {
          color,
          emissive: color,
          emissiveIntensity: 0.2,
          transparent: opacity < 1,
          opacity
        }
      )
    ] }),
    spokes.map((spoke, i) => {
      const dx = spoke.x2 - spoke.x1;
      const dy = spoke.y2 - spoke.y1;
      const length = Math.sqrt(dx * dx + dy * dy);
      const cx = (spoke.x1 + spoke.x2) / 2;
      const cy = (spoke.y1 + spoke.y2) / 2;
      return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
        "mesh",
        {
          position: [cx, cy, 0],
          rotation: [0, 0, spoke.angle + Math.PI / 2],
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("cylinderGeometry", { args: [0.01, 0.01, length, 4] }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              "meshStandardMaterial",
              {
                color,
                transparent: true,
                opacity: opacity * 0.3
              }
            )
          ]
        },
        `spoke-${i}`
      );
    })
  ] });
};
var TimingWheel3D_default = TimingWheel3D;

// src/proj_6fd654b3_f9c6_4370_8663_90ab6063b80c/scenes/scene_4.tsx
var import_jsx_runtime9 = require("react/jsx-runtime");
function TimingWheelIntroduction() {
  const { width, height, fps } = (0, import_remotion5.useVideoConfig)();
  const frame = (0, import_remotion5.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const START_MORPH = 60;
  const END_MORPH = 150;
  const TASK_INSERTIONS = 240;
  const morphProgress = (0, import_remotion5.spring)({
    frame: frame - START_MORPH,
    fps,
    config: { damping: 20, stiffness: 60 }
  });
  const collapseProgress = (0, import_remotion5.interpolate)(morphProgress, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const wheelScale = (0, import_remotion5.spring)({
    frame: frame - (START_MORPH + 20),
    fps,
    config: { damping: 12, stiffness: 60 }
  });
  const wheelOpacity = (0, import_remotion5.interpolate)(frame, [START_MORPH + 30, END_MORPH], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const complexityOpacity = (0, import_remotion5.interpolate)(frame, [0, 60], [1, 0], {
    extrapolateRight: "clamp"
  });
  const o1Opacity = (0, import_remotion5.interpolate)(frame, [END_MORPH, END_MORPH + 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const tasks = (0, import_react8.useMemo)(
    () => [
      { targetBucket: 5, startFrame: TASK_INSERTIONS },
      { targetBucket: 18, startFrame: TASK_INSERTIONS + 30 },
      { targetBucket: 42, startFrame: TASK_INSERTIONS + 60 },
      { targetBucket: 55, startFrame: TASK_INSERTIONS + 90 }
    ],
    [TASK_INSERTIONS]
  );
  const numBuckets = WHEEL.fullBuckets;
  const wheelRadius = 2.5;
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_remotion5.AbsoluteFill, { style: { backgroundColor: COLORS.background }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
      import_three4.ThreeCanvas,
      {
        width,
        height,
        camera: { position: CAMERA.default, fov: CAMERA.fov },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("ambientLight", { intensity: 0.5 }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("directionalLight", { position: [10, 10, 5], intensity: 1 }),
          collapseProgress < 1 && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            BinaryTree3D_default,
            {
              levels: 4,
              nodeSize: 0.15,
              stressProgress: 0.8,
              collapseProgress,
              dangerColor: 15680580
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("group", { scale: [wheelScale, wheelScale, wheelScale], children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            TimingWheel3D_default,
            {
              radius: wheelRadius,
              bucketCount: numBuckets,
              rotation: 0,
              color: COLORS.primaryHex,
              opacity: wheelOpacity
            }
          ) }),
          wheelOpacity > 0.1 && /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_jsx_runtime9.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("mesh", { position: [0, wheelRadius + 0.35, 0.1], children: [
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("coneGeometry", { args: [0.1, 0.25, 8] }),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                "meshStandardMaterial",
                {
                  color: COLORS.accentHex,
                  emissive: COLORS.accentHex,
                  emissiveIntensity: 0.5,
                  transparent: true,
                  opacity: wheelOpacity
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("mesh", { position: [0, wheelRadius + 0.1, 0.1], children: [
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("cylinderGeometry", { args: [0.015, 0.015, 0.3, 4] }),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                "meshStandardMaterial",
                {
                  color: COLORS.accentHex,
                  transparent: true,
                  opacity: wheelOpacity
                }
              )
            ] })
          ] }),
          tasks.map((task, idx) => {
            const insertProgress = (0, import_remotion5.spring)({
              frame: frame - task.startFrame,
              fps,
              config: { damping: 15, stiffness: 100 }
            });
            if (frame < task.startFrame || insertProgress <= 0.01) return null;
            const angle = task.targetBucket / numBuckets * Math.PI * 2 + Math.PI / 2;
            const startX = 4;
            const startY = 3;
            const endX = Math.cos(angle) * (wheelRadius * 0.85);
            const endY = Math.sin(angle) * (wheelRadius * 0.85);
            const curX = (0, import_remotion5.interpolate)(insertProgress, [0, 1], [startX, endX]);
            const curY = (0, import_remotion5.interpolate)(insertProgress, [0, 1], [startY, endY]);
            const curScale = (0, import_remotion5.interpolate)(insertProgress, [0, 0.2, 1], [0, 1.2, 1]);
            return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("group", { scale: [curScale, curScale, curScale], children: [
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                TaskNode3D_default,
                {
                  position: [curX, curY, 0.2],
                  color: COLORS.secondaryHex,
                  size: 0.12,
                  emissiveIntensity: insertProgress > 0.9 ? 0.8 : 0.3
                }
              ),
              insertProgress > 0.9 && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                "pointLight",
                {
                  position: [endX, endY, 0.5],
                  intensity: 0.5,
                  color: COLORS.secondaryHex,
                  distance: 2
                }
              )
            ] }, `task-${idx}`);
          })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.03,
          width: "100%",
          textAlign: "center",
          padding: `0 ${minDim * 0.05}px`,
          zIndex: 10
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(FadeIn, { children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            "h1",
            {
              style: {
                fontSize: height * 0.04,
                fontWeight: 800,
                margin: 0,
                color: COLORS.white,
                fontFamily: "sans-serif"
              },
              children: "Scaling Task Scheduling"
            }
          ) }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: { opacity: complexityOpacity, marginTop: minDim * 0.015 }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            "div",
            {
              style: {
                display: "inline-block",
                padding: `${minDim * 8e-3}px ${minDim * 0.025}px`,
                background: "rgba(239, 68, 68, 0.2)",
                border: `2px solid ${COLORS.danger}`,
                borderRadius: minDim * 0.05,
                color: COLORS.danger,
                fontWeight: "bold",
                fontSize: height * 0.022
              },
              children: "O(log N) Complexity"
            }
          ) }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            "div",
            {
              style: {
                opacity: o1Opacity,
                marginTop: complexityOpacity > 0.5 ? -minDim * 0.05 : minDim * 0.01
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(BounceIn, { delay: END_MORPH, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                "div",
                {
                  style: {
                    display: "inline-block",
                    padding: `${minDim * 0.01}px ${minDim * 0.03}px`,
                    background: "rgba(16, 185, 129, 0.2)",
                    border: `2px solid ${COLORS.secondary}`,
                    borderRadius: minDim * 0.05,
                    color: COLORS.secondary,
                    fontWeight: "bold",
                    fontSize: height * 0.025
                  },
                  children: "O(1) Constant Time"
                }
              ) })
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: height * 0.06,
          width: "100%",
          padding: `0 ${minDim * 0.06}px`,
          zIndex: 10
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: minDim * 0.02,
              backgroundColor: "rgba(255,255,255,0.05)",
              padding: minDim * 0.03,
              borderRadius: minDim * 0.02,
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(10px)"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(ScaleIn, { delay: END_MORPH + 20, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 10 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                  "div",
                  {
                    style: {
                      width: minDim * 0.03,
                      height: minDim * 0.03,
                      borderRadius: "50%",
                      background: COLORS.primary
                    }
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                  "span",
                  {
                    style: {
                      fontSize: height * 0.018,
                      fontWeight: 500,
                      color: COLORS.white
                    },
                    children: "Pre-allocated time slots (Buckets)"
                  }
                )
              ] }) }),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(ScaleIn, { delay: END_MORPH + 40, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 10 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                  "div",
                  {
                    style: {
                      width: minDim * 0.03,
                      height: minDim * 0.03,
                      borderRadius: "50%",
                      background: COLORS.secondary
                    }
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                  "span",
                  {
                    style: {
                      fontSize: height * 0.018,
                      fontWeight: 500,
                      color: COLORS.white
                    },
                    children: "Direct addressing - no sorting required"
                  }
                )
              ] }) }),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(ScaleIn, { delay: END_MORPH + 60, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 10 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                  "svg",
                  {
                    width: minDim * 0.03,
                    height: minDim * 0.03,
                    viewBox: "0 0 24 24",
                    fill: "none",
                    stroke: COLORS.accent,
                    strokeWidth: "3",
                    children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("path", { d: "M5 12l5 5L20 7" })
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                  "span",
                  {
                    style: {
                      fontSize: height * 0.018,
                      color: COLORS.accent,
                      fontWeight: 700
                    },
                    children: "True O(1) scheduling overhead"
                  }
                )
              ] }) })
            ]
          }
        )
      }
    )
  ] });
}

// src/proj_6fd654b3_f9c6_4370_8663_90ab6063b80c/scenes/scene_5.tsx
var import_react9 = require("react");
var import_three5 = require("@remotion/three");
var import_remotion6 = require("remotion");
var import_jsx_runtime10 = require("react/jsx-runtime");
function HierarchicalTimingWheel() {
  const { width, height, fps } = (0, import_remotion6.useVideoConfig)();
  const frame = (0, import_remotion6.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const zoomProgress = (0, import_remotion6.spring)({
    frame: frame - 60,
    fps,
    config: { damping: 12, stiffness: 60 }
  });
  const outerWheelReveal = (0, import_remotion6.spring)({
    frame: frame - 90,
    fps,
    config: { damping: 15, stiffness: 40 }
  });
  const taskFlyProgress = (0, import_remotion6.spring)({
    frame: frame - 200,
    fps,
    config: { damping: 10, stiffness: 30 }
  });
  const cameraZ = (0, import_remotion6.interpolate)(zoomProgress, [0, 1], [8, 11]);
  const innerRotation = (0, import_remotion6.interpolate)(frame, [0, 630], [0, Math.PI * 0.5]);
  const outerRotation = innerRotation / 8;
  const tasks = (0, import_react9.useMemo)(
    () => [
      { angle: -1.2, delay: 20 },
      { angle: -0.5, delay: 40 },
      { angle: 0.8, delay: 60 },
      { angle: 1.5, delay: 80 }
    ],
    []
  );
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_remotion6.AbsoluteFill, { style: { backgroundColor: COLORS.background }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
      import_three5.ThreeCanvas,
      {
        width,
        height,
        camera: { position: [0, 0, cameraZ], fov: CAMERA.fov },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("ambientLight", { intensity: 0.5 }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("directionalLight", { position: [10, 10, 5], intensity: 1 }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            TimingWheel3D_default,
            {
              radius: WHEEL.innerRadius,
              bucketCount: WHEEL.innerBuckets,
              rotation: innerRotation,
              color: COLORS.primaryHex
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            TimingWheel3D_default,
            {
              radius: WHEEL.outerRadius,
              bucketCount: WHEEL.outerBuckets,
              rotation: outerRotation,
              color: COLORS.secondaryHex,
              opacity: 0.5 * outerWheelReveal,
              scale: outerWheelReveal,
              positionZ: -0.5
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("mesh", { position: [0, (WHEEL.innerRadius + WHEEL.outerRadius) / 2 + 0.3, 0.2], children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("cylinderGeometry", { args: [0.02, 0.02, WHEEL.outerRadius - WHEEL.innerRadius + 1, 4] }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
              "meshStandardMaterial",
              {
                color: COLORS.accentHex,
                emissive: COLORS.accentHex,
                emissiveIntensity: 0.4,
                transparent: true,
                opacity: outerWheelReveal
              }
            )
          ] }),
          tasks.map((task, i) => {
            const flyDist = (0, import_remotion6.interpolate)(
              taskFlyProgress,
              [0, 1],
              [0, WHEEL.outerRadius - WHEEL.innerRadius]
            );
            const r = WHEEL.outerRadius - 0.2 - flyDist;
            const x = r * Math.cos(task.angle);
            const y = r * Math.sin(task.angle);
            return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
              TaskNode3D_default,
              {
                position: [x, y, 0.1],
                color: COLORS.accentHex,
                size: 0.12,
                emissiveIntensity: 0.4,
                opacity: outerWheelReveal
              },
              `task-${i}`
            );
          }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("pointLight", { position: [0, 0, 1], intensity: 0.3, color: COLORS.primaryHex, distance: 4 })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.03,
          width: "100%",
          textAlign: "center",
          zIndex: 10
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(FadeIn, { children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
          "h1",
          {
            style: {
              fontSize: height * 0.04,
              margin: 0,
              background: `linear-gradient(to right, ${COLORS.primary}, ${COLORS.secondary})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontWeight: 800,
              textAlign: "center",
              fontFamily: "system-ui, sans-serif"
            },
            children: "HIERARCHICAL SCALING"
          }
        ) })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
          zIndex: 10,
          pointerEvents: "none"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            "div",
            {
              style: {
                color: COLORS.primary,
                fontSize: height * 0.025,
                fontWeight: "bold"
              },
              children: "SECONDS"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            "div",
            {
              style: {
                color: COLORS.text,
                fontSize: height * 0.014,
                opacity: 0.7
              },
              children: "Granular Wheel"
            }
          )
        ]
      }
    ),
    outerWheelReveal > 0.1 && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.15,
          right: width * 0.08,
          transform: `scale(${outerWheelReveal})`,
          zIndex: 10
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(ScaleIn, { children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
          "div",
          {
            style: {
              padding: `${minDim * 0.015}px ${minDim * 0.03}px`,
              backgroundColor: "rgba(16, 185, 129, 0.15)",
              border: `2px solid ${COLORS.secondary}`,
              borderRadius: minDim * 0.02,
              backdropFilter: "blur(5px)"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                "div",
                {
                  style: {
                    fontSize: height * 0.02,
                    fontWeight: 800,
                    color: COLORS.secondary
                  },
                  children: "MINUTES WHEEL"
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { fontSize: height * 0.014, color: COLORS.text }, children: "Buffer for long-term tasks" })
            ]
          }
        ) })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: height * 0.06,
          width: "100%",
          padding: `0 ${minDim * 0.06}px`,
          zIndex: 10
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(FadeIn, { delay: 120, children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: minDim * 0.02
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
                "div",
                {
                  style: {
                    padding: minDim * 0.025,
                    borderRadius: minDim * 0.02,
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    display: "flex",
                    alignItems: "center",
                    gap: minDim * 0.03
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                      "div",
                      {
                        style: {
                          width: minDim * 0.06,
                          height: minDim * 0.06,
                          borderRadius: "50%",
                          border: `2px solid ${COLORS.secondary}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: COLORS.secondary,
                          fontWeight: 800,
                          fontSize: minDim * 0.03,
                          flexShrink: 0
                        },
                        children: "2"
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
                      "div",
                      {
                        style: {
                          fontSize: height * 0.016,
                          lineHeight: 1.4,
                          color: COLORS.text
                        },
                        children: [
                          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { style: { color: COLORS.secondary, fontWeight: "bold" }, children: "Hierarchical Buffering:" }),
                          " ",
                          "Tasks only migrate to inner wheels as they approach expiration."
                        ]
                      }
                    )
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
                "div",
                {
                  style: {
                    padding: minDim * 0.025,
                    borderRadius: minDim * 0.02,
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    display: "flex",
                    alignItems: "center",
                    gap: minDim * 0.03
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                      "div",
                      {
                        style: {
                          width: minDim * 0.06,
                          height: minDim * 0.06,
                          borderRadius: "50%",
                          border: `2px solid ${COLORS.accent}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: COLORS.accent,
                          fontWeight: 800,
                          fontSize: minDim * 0.03,
                          flexShrink: 0
                        },
                        children: "\u221E"
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
                      "div",
                      {
                        style: {
                          fontSize: height * 0.016,
                          lineHeight: 1.4,
                          color: COLORS.text
                        },
                        children: [
                          "Scales to years without overhead using",
                          " ",
                          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { style: { color: COLORS.accent }, children: "nested buckets" }),
                          "."
                        ]
                      }
                    )
                  ]
                }
              )
            ]
          }
        ) })
      }
    )
  ] });
}

// src/proj_6fd654b3_f9c6_4370_8663_90ab6063b80c/scenes/scene_6.tsx
var import_three6 = require("@remotion/three");
var import_remotion7 = require("remotion");
var import_jsx_runtime11 = require("react/jsx-runtime");
function TimingWheelCascade() {
  const { width, height, fps } = (0, import_remotion7.useVideoConfig)();
  const frame = (0, import_remotion7.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const outerRotation = (0, import_remotion7.spring)({
    frame: frame - 20,
    fps,
    config: { damping: 20, stiffness: 40 }
  }) * (Math.PI / 6);
  const cascadeProgress = (0, import_remotion7.spring)({
    frame: frame - 60,
    fps,
    config: { damping: 12, stiffness: 60 }
  });
  const cascadeTasks = [
    { id: 0, angleOffset: -0.3 },
    { id: 1, angleOffset: 0 },
    { id: 2, angleOffset: 0.3 }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(import_remotion7.AbsoluteFill, { style: { backgroundColor: COLORS.background }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
      import_three6.ThreeCanvas,
      {
        width,
        height,
        camera: { position: CAMERA.default, fov: CAMERA.fov },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("ambientLight", { intensity: 0.5 }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("directionalLight", { position: [10, 10, 5], intensity: 1 }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
            TimingWheel3D_default,
            {
              radius: WHEEL.outerRadius,
              bucketCount: WHEEL.innerBuckets,
              rotation: outerRotation,
              color: COLORS.secondaryHex,
              opacity: 0.7,
              positionZ: -0.3
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
            TimingWheel3D_default,
            {
              radius: WHEEL.innerRadius,
              bucketCount: WHEEL.innerBuckets,
              rotation: frame * 0.02,
              color: COLORS.primaryHex
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("mesh", { position: [0, WHEEL.outerRadius + 0.3, 0.1], children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("coneGeometry", { args: [0.12, 0.3, 8] }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
              "meshStandardMaterial",
              {
                color: COLORS.accentHex,
                emissive: COLORS.accentHex,
                emissiveIntensity: 0.5
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("mesh", { position: [0, (WHEEL.outerRadius + WHEEL.innerRadius) / 2, 0.1], children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("cylinderGeometry", { args: [0.02, 0.02, WHEEL.outerRadius - WHEEL.innerRadius + 0.6, 4] }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
              "meshStandardMaterial",
              {
                color: COLORS.accentHex,
                emissive: COLORS.accentHex,
                emissiveIntensity: 0.3
              }
            )
          ] }),
          cascadeTasks.map((task) => {
            const outerY = WHEEL.outerRadius * 0.85;
            const innerY = WHEEL.innerRadius * 0.85;
            const y = (0, import_remotion7.interpolate)(cascadeProgress, [0, 1], [outerY, innerY]);
            const x = task.angleOffset * (1 - cascadeProgress * 0.5);
            const scaleBoost = cascadeProgress > 0.85 ? (0, import_remotion7.interpolate)(cascadeProgress, [0.85, 0.95, 1], [1, 1.3, 1]) : 1;
            const emissive = cascadeProgress > 0.85 ? (0, import_remotion7.interpolate)(cascadeProgress, [0.85, 1], [0.3, 0.8]) : 0.3;
            return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("group", { scale: [scaleBoost, scaleBoost, scaleBoost], children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
              TaskNode3D_default,
              {
                position: [x, y, 0.2],
                color: COLORS.accentHex,
                size: 0.15,
                emissiveIntensity: emissive
              }
            ) }, task.id);
          })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.05,
          width: "100%",
          textAlign: "center",
          zIndex: 10
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(FadeIn, { children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          "h1",
          {
            style: {
              color: COLORS.white,
              fontSize: height * 0.04,
              fontWeight: 700,
              margin: 0,
              fontFamily: "sans-serif"
            },
            children: "The Cascade Mechanism"
          }
        ) })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: height * 0.08,
          width: "100%",
          padding: `0 ${width * 0.08}px`,
          zIndex: 10
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(FadeIn, { delay: 30, children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
            "div",
            {
              style: {
                display: "flex",
                justifyContent: "space-around",
                gap: minDim * 0.02,
                marginBottom: minDim * 0.03
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
                  "div",
                  {
                    style: {
                      textAlign: "center",
                      color: COLORS.secondary,
                      fontSize: height * 0.018,
                      fontWeight: 600
                    },
                    children: [
                      "Minutes Wheel",
                      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("br", {}),
                      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { style: { opacity: 0.7, fontSize: height * 0.014 }, children: "Tick \u2192 Re-insertion" })
                    ]
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
                  "div",
                  {
                    style: {
                      textAlign: "center",
                      color: COLORS.primary,
                      fontSize: height * 0.018,
                      fontWeight: 600
                    },
                    children: [
                      "Seconds Wheel",
                      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("br", {}),
                      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { style: { opacity: 0.7, fontSize: height * 0.014 }, children: "Immediate Execution" })
                    ]
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
            "p",
            {
              style: {
                color: COLORS.text,
                fontSize: height * 0.018,
                textAlign: "center",
                margin: 0,
                lineHeight: 1.4,
                fontFamily: "sans-serif"
              },
              children: [
                "Tasks",
                " ",
                /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { style: { color: COLORS.accent, fontWeight: "bold" }, children: "cascade" }),
                " ",
                "to the next high-resolution wheel once their coarse bucket expires."
              ]
            }
          )
        ] })
      }
    )
  ] });
}

// src/proj_6fd654b3_f9c6_4370_8663_90ab6063b80c/scenes/scene_7.tsx
var import_three7 = require("@remotion/three");
var import_remotion8 = require("remotion");
var import_jsx_runtime12 = require("react/jsx-runtime");
var KafkaLogo = ({ size, color }) => /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: color, strokeWidth: "2", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("path", { d: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" }) });
var NettyLogo = ({ size, color }) => /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: color, strokeWidth: "2", children: [
  /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("circle", { cx: "12", cy: "12", r: "10" }),
  /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("path", { d: "M8 12h8M12 8v8" })
] });
function HierarchicalTimingWheelScene() {
  const { width, height, fps } = (0, import_remotion8.useVideoConfig)();
  const frame = (0, import_remotion8.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const rotation = (0, import_remotion8.interpolate)(frame, [0, 540], [0, Math.PI * 4]);
  const outerRotation = rotation / 8;
  const systemScale = (0, import_remotion8.interpolate)(frame, [0, 100], [1.2, 0.85], {
    extrapolateRight: "clamp"
  });
  const cameraZ = (0, import_remotion8.interpolate)(frame, [0, 100], [8, 10], {
    extrapolateRight: "clamp"
  });
  const logoEntrance = (0, import_remotion8.spring)({
    frame: frame - 150,
    fps,
    config: { damping: 12, stiffness: 80 }
  });
  const textEntrance = (0, import_remotion8.spring)({
    frame: frame - 300,
    fps,
    config: { damping: 12, stiffness: 80 }
  });
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_remotion8.AbsoluteFill, { style: { backgroundColor: "#0f0f23", overflow: "hidden" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
      import_three7.ThreeCanvas,
      {
        width,
        height,
        camera: { position: [0, 0, cameraZ], fov: CAMERA.fov },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("ambientLight", { intensity: 0.4 }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("directionalLight", { position: [10, 10, 5], intensity: 0.8 }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("group", { scale: [systemScale, systemScale, systemScale], children: [
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
              TimingWheel3D_default,
              {
                radius: WHEEL.innerRadius,
                bucketCount: WHEEL.innerBuckets,
                rotation,
                color: COLORS.primaryHex
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
              TimingWheel3D_default,
              {
                radius: WHEEL.outerRadius,
                bucketCount: WHEEL.outerBuckets,
                rotation: outerRotation,
                color: COLORS.secondaryHex,
                opacity: 0.6,
                positionZ: -0.3
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("mesh", { position: [0, WHEEL.outerRadius + 0.3, 0.2], children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("cylinderGeometry", { args: [0.02, 0.02, WHEEL.outerRadius * 2 + 0.6, 4] }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                "meshStandardMaterial",
                {
                  color: COLORS.accentHex,
                  emissive: COLORS.accentHex,
                  emissiveIntensity: 0.3
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("mesh", { position: [0, WHEEL.outerRadius + 0.5, 0.2], children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("sphereGeometry", { args: [0.08, 8, 8] }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                "meshStandardMaterial",
                {
                  color: COLORS.accentHex,
                  emissive: COLORS.accentHex,
                  emissiveIntensity: 0.6
                }
              )
            ] })
          ] }),
          [0, 1, 2, 3].map((i) => {
            const orbit = 1.8 + i * 0.6;
            const speed = 0.5 + i * 0.2;
            const x = Math.cos(frame * speed * 0.02) * orbit;
            const y = Math.sin(frame * speed * 0.02) * orbit;
            return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
              TaskNode3D_default,
              {
                position: [x, y, 0.3],
                color: i % 2 === 0 ? COLORS.primaryHex : COLORS.secondaryHex,
                size: 0.06,
                emissiveIntensity: 0.4,
                opacity: 0.5
              },
              `orbit-${i}`
            );
          })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.04,
          width: "100%",
          textAlign: "center",
          zIndex: 10
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(FadeIn, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
            "h1",
            {
              style: {
                color: "white",
                fontSize: height * 0.04,
                fontWeight: 800,
                margin: 0,
                fontFamily: "Inter, system-ui, sans-serif"
              },
              children: "SCALABLE SCHEDULING"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
            "p",
            {
              style: {
                color: COLORS.primary,
                fontSize: height * 0.018,
                marginTop: height * 8e-3,
                letterSpacing: 2
              },
              children: "O(1) CONSTANT TIME EXECUTION"
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.65,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: minDim * 0.04,
          zIndex: 10,
          opacity: logoEntrance,
          transform: `translateY(${(1 - logoEntrance) * 20}px)`
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { style: { display: "flex", gap: minDim * 0.08 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(ScaleIn, { delay: 160, children: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
              "div",
              {
                style: {
                  padding: minDim * 0.025,
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: minDim * 0.02,
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center"
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(KafkaLogo, { size: minDim * 0.08, color: COLORS.primary }),
                  /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { style: { color: "white", marginTop: 8, fontSize: height * 0.014 }, children: "KAFKA" })
                ]
              }
            ) }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(ScaleIn, { delay: 180, children: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
              "div",
              {
                style: {
                  padding: minDim * 0.025,
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: minDim * 0.02,
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center"
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(NettyLogo, { size: minDim * 0.08, color: COLORS.secondary }),
                  /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { style: { color: "white", marginTop: 8, fontSize: height * 0.014 }, children: "NETTY" })
                ]
              }
            ) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
            "div",
            {
              style: {
                opacity: textEntrance,
                transform: `scale(${textEntrance})`,
                textAlign: "center",
                width: "80%"
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(BounceIn, { delay: 320, children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                  "div",
                  {
                    style: {
                      background: "linear-gradient(135deg, #3B82F6, #8b5cf6)",
                      padding: `${minDim * 0.015}px ${minDim * 0.05}px`,
                      borderRadius: 100,
                      color: "white",
                      fontSize: height * 0.022,
                      fontWeight: "bold",
                      boxShadow: "0 10px 30px rgba(59, 130, 246, 0.4)",
                      marginBottom: minDim * 0.04
                    },
                    children: "Follow for more Engineering"
                  }
                ) }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                  "div",
                  {
                    style: {
                      color: "rgba(255,255,255,0.6)",
                      fontSize: height * 0.018
                    },
                    children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { style: { color: COLORS.accent, fontWeight: "bold" }, children: "@Prasanna" })
                  }
                )
              ]
            }
          )
        ]
      }
    )
  ] });
}

// src/proj_6fd654b3_f9c6_4370_8663_90ab6063b80c/Main.tsx
var import_jsx_runtime13 = require("react/jsx-runtime");
function Main() {
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(import_remotion9.AbsoluteFill, { style: { background: "#0F172A" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_remotion9.Sequence, { from: 0, durationInFrames: 270, name: "scene_1", children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Scene, {}) }, "scene_1"),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_remotion9.Sequence, { from: 270, durationInFrames: 420, name: "scene_2", children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(BinaryHeapScene, {}) }, "scene_2"),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_remotion9.Sequence, { from: 690, durationInFrames: 360, name: "scene_3", children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(HeapBottleneckScene, {}) }, "scene_3"),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_remotion9.Sequence, { from: 1050, durationInFrames: 540, name: "scene_4", children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(TimingWheelIntroduction, {}) }, "scene_4"),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_remotion9.Sequence, { from: 1590, durationInFrames: 630, name: "scene_5", children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(HierarchicalTimingWheel, {}) }, "scene_5"),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_remotion9.Sequence, { from: 2220, durationInFrames: 180, name: "scene_6", children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(TimingWheelCascade, {}) }, "scene_6"),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_remotion9.Sequence, { from: 2400, durationInFrames: 541, name: "scene_7", children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(HierarchicalTimingWheelScene, {}) }, "scene_7")
  ] });
}
