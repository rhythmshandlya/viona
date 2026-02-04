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

// src/proj_883cf07f_8fb8_47dd_9c3b_04a63ce60a67/Main.tsx
var Main_exports = {};
__export(Main_exports, {
  default: () => Main
});
module.exports = __toCommonJS(Main_exports);
var import_remotion29 = require("remotion");

// src/proj_883cf07f_8fb8_47dd_9c3b_04a63ce60a67/scenes/scene_1.tsx
var import_remotion = require("remotion");
var import_jsx_runtime = require("react/jsx-runtime");
var SystemDesignChallenge = () => {
  const { width, height, fps } = (0, import_remotion.useVideoConfig)();
  const frame = (0, import_remotion.useCurrentFrame)();
  const circleScale = (0, import_remotion.spring)({ frame, fps, config: { damping: 8, stiffness: 200 } });
  const arrows = Array.from({ length: 5 }).map((_, i) => {
    const progress = (0, import_remotion.interpolate)(frame - i * 10, [0, 60], [0, 1], { extrapolateRight: "clamp" });
    const x = width * 0.5 + Math.cos(progress * Math.PI * 2) * (width * 0.3);
    const y = height * 0.5 + Math.sin(progress * Math.PI * 2) * (height * 0.3);
    const rotation = progress * 360;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          width: width * 0.05,
          height: height * 0.05,
          backgroundColor: "#f59e0b",
          borderRadius: "50%",
          transform: `translate(${x}px, ${y}px) rotate(${rotation}deg)`
        }
      },
      i
    );
  });
  const response = (0, import_remotion.spring)({ frame: frame - 40, fps, config: { damping: 8, stiffness: 100 } });
  const responseScale = (0, import_remotion.interpolate)(response, [0, 1], [1, 1.1]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: { backgroundColor: "#f3f4f6" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: "50%",
          left: "50%",
          width: width * 0.2,
          height: width * 0.2,
          backgroundColor: "#3b82f6",
          borderRadius: "50%",
          transform: `translate(-50%, -50%) scale(${circleScale * responseScale})`
        }
      }
    ),
    arrows
  ] });
};
var scene_1_default = SystemDesignChallenge;

// src/proj_883cf07f_8fb8_47dd_9c3b_04a63ce60a67/scenes/scene_2.tsx
var import_remotion2 = require("remotion");
var import_jsx_runtime2 = require("react/jsx-runtime");
var SchedulerScene = () => {
  const { width, height, fps } = (0, import_remotion2.useVideoConfig)();
  const frame = (0, import_remotion2.useCurrentFrame)();
  const taskScale = (0, import_remotion2.spring)({ frame, fps, config: { damping: 8, stiffness: 200 } });
  const conveyorProgress = (0, import_remotion2.interpolate)(frame, [0, 199], [0, width * 0.8]);
  const particleTriggerFrame = 150;
  const showParticles = frame > particleTriggerFrame;
  const particleOpacity = showParticles ? (0, import_remotion2.interpolate)(frame - particleTriggerFrame, [0, 20], [0, 1]) : 0;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_remotion2.AbsoluteFill, { style: { backgroundColor: "#f0f4c3" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
      position: "absolute",
      bottom: height * 0.1,
      left: 0,
      width,
      height: height * 0.05,
      backgroundColor: "#8b5cf6",
      overflow: "hidden"
    }, children: Array.from({ length: 10 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
      position: "absolute",
      left: i * (width * 0.1) + conveyorProgress,
      bottom: 0,
      width: width * 0.05,
      height: width * 0.05,
      borderRadius: "50%",
      backgroundColor: "#ffab00",
      transform: `scale(${taskScale})`
    } }, i)) }),
    showParticles && Array.from({ length: 20 }).map((_, i) => {
      const angle = i / 20 * Math.PI * 2;
      const radius = (0, import_remotion2.interpolate)(frame - particleTriggerFrame, [0, 20], [0, width * 0.15]);
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
        position: "absolute",
        left: width * 0.9,
        bottom: height * 0.15,
        transform: `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)`,
        width: width * 0.02,
        height: width * 0.02,
        borderRadius: "50%",
        backgroundColor: "#8b5cf6",
        opacity: particleOpacity
      } }, i);
    })
  ] });
};
var scene_2_default = SchedulerScene;

// src/proj_883cf07f_8fb8_47dd_9c3b_04a63ce60a67/scenes/scene_3.tsx
var import_remotion3 = require("remotion");
var import_jsx_runtime3 = require("react/jsx-runtime");
var PriorityQueueScene = () => {
  const { width, height, fps } = (0, import_remotion3.useVideoConfig)();
  const frame = (0, import_remotion3.useCurrentFrame)();
  const ballSpring = (0, import_remotion3.spring)({
    frame: frame - 10,
    fps,
    config: { damping: 8, stiffness: 200 }
  });
  const balls = Array.from({ length: 5 }).map((_, i) => {
    const delay = i * 10;
    const progress = Math.min(frame - delay, 60) / 60;
    const x = (0, import_remotion3.interpolate)(progress, [0, 1], [width * 0.2, width * 0.8]);
    const y = (0, import_remotion3.interpolate)(progress, [0, 1], [height * 0.8, height * 0.2]);
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: x,
          top: y,
          width: width * 0.1,
          height: width * 0.1,
          borderRadius: "50%",
          backgroundColor: `hsl(${i * 60}, 80%, 60%)`,
          transform: `scale(${ballSpring})`,
          boxShadow: "0 4px 8px rgba(0,0,0,0.2)"
        }
      },
      i
    );
  });
  const trailingCircles = balls.map((_, i) => {
    const delay = i * 10;
    const progress = Math.min(frame - delay, 60) / 60;
    const x = (0, import_remotion3.interpolate)(progress, [0, 1], [width * 0.2, width * 0.8]);
    const y = (0, import_remotion3.interpolate)(progress, [0, 1], [height * 0.8, height * 0.2]);
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: x,
          top: y + height * 0.05,
          width: width * 0.05,
          height: width * 0.05,
          borderRadius: "50%",
          backgroundColor: `hsl(${i * 60}, 80%, 40%)`,
          opacity: (0, import_remotion3.interpolate)(frame, [delay, delay + 20, delay + 60], [0, 1, 0]),
          transform: `scale(${ballSpring})`
        }
      },
      `trailing-${i}`
    );
  });
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_remotion3.AbsoluteFill, { style: { backgroundColor: "#a7f3d0" }, children: [
    balls,
    trailingCircles
  ] });
};
var scene_3_default = PriorityQueueScene;

// src/proj_883cf07f_8fb8_47dd_9c3b_04a63ce60a67/scenes/scene_4.tsx
var import_remotion4 = require("remotion");
var import_jsx_runtime4 = require("react/jsx-runtime");
var BinaryHeapScene = () => {
  const { width, height, fps } = (0, import_remotion4.useVideoConfig)();
  const frame = (0, import_remotion4.useCurrentFrame)();
  const bounce = (0, import_remotion4.spring)({ frame, fps, config: { damping: 8, stiffness: 200 } });
  const progress = (0, import_remotion4.interpolate)(frame, [0, 37], [0, 1]);
  const nodeX = progress * width * 0.4;
  const nodeY = Math.sin(progress * Math.PI) * height * -0.1;
  const colors = ["#f59e0b", "#84cc16", "#ec4899", "#6366f1"];
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_remotion4.AbsoluteFill, { style: { backgroundColor: "#f3f4f6", justifyContent: "center", alignItems: "center" }, children: [
    Array.from({ length: 4 }).map((_, i) => {
      const scale = (0, import_remotion4.spring)({ frame: frame - i * 2, fps, config: { damping: 8, stiffness: 200 } });
      const size = height * 0.1;
      const xPos = (i % 2 === 0 ? -1 : 1) * bounce * size * 1.5;
      const yPos = Math.floor(i / 2) * size * 1.5;
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
        position: "absolute",
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: colors[i],
        transform: `translate(${xPos}px, ${yPos}px) scale(${scale})`,
        boxShadow: `0 0 20px rgba(0, 0, 0, 0.1)`
      } }, i);
    }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
      position: "absolute",
      width: height * 0.1,
      height: height * 0.1,
      borderRadius: "50%",
      backgroundColor: "#10b981",
      transform: `translate(${nodeX}px, ${nodeY}px)`,
      boxShadow: "0 0 20px rgba(0, 0, 0, 0.1)",
      opacity: (0, import_remotion4.interpolate)(frame, [0, 5, 37], [0, 1, 0])
    } })
  ] });
};
var scene_4_default = BinaryHeapScene;

// src/proj_883cf07f_8fb8_47dd_9c3b_04a63ce60a67/scenes/scene_5.tsx
var import_remotion5 = require("remotion");
var import_jsx_runtime5 = require("react/jsx-runtime");
var TaskManagerScene = () => {
  const { width, height, fps } = (0, import_remotion5.useVideoConfig)();
  const frame = (0, import_remotion5.useCurrentFrame)();
  const taskItems = Array.from({ length: 5 }).map((_, i) => {
    const startDelay = i * 30;
    const scale = (0, import_remotion5.spring)({
      frame: frame - startDelay,
      fps,
      config: { damping: 10, stiffness: 100 }
    });
    const yPosition = (0, import_remotion5.interpolate)(
      frame - startDelay,
      [0, 60, 120],
      [height * 0.8, height * 0.5, height * 0.2],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp"
      }
    );
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: width * 0.5 - width * 0.05 / 2,
          top: yPosition,
          transform: `scale(${scale})`,
          width: width * 0.05,
          height: width * 0.05,
          backgroundColor: "#FF6347",
          borderRadius: "50%"
        }
      },
      i
    );
  });
  const particles = Array.from({ length: 20 }).map((_, i) => {
    const angle = i / 20 * Math.PI * 2;
    const radius = (0, import_remotion5.interpolate)(frame - 120, [0, 30], [0, 150]);
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)`,
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#8b5cf6",
          opacity: (0, import_remotion5.interpolate)(frame - 120, [0, 15, 30], [0, 1, 0])
        }
      },
      i
    );
  });
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_remotion5.AbsoluteFill, { style: { backgroundColor: "#f0f8ff" }, children: [
    taskItems,
    particles
  ] });
};
var scene_5_default = TaskManagerScene;

// src/proj_883cf07f_8fb8_47dd_9c3b_04a63ce60a67/scenes/scene_6.tsx
var import_remotion6 = require("remotion");
var import_jsx_runtime6 = require("react/jsx-runtime");
var LogarithmicTrapScene = () => {
  const { width, height, fps } = (0, import_remotion6.useVideoConfig)();
  const frame = (0, import_remotion6.useCurrentFrame)();
  const scale = (0, import_remotion6.spring)({ frame, fps, config: { damping: 10, stiffness: 100 } });
  const progress = (0, import_remotion6.interpolate)(frame, [0, 115], [0, 1]);
  const x = progress * width * 0.8;
  const y = Math.sin(progress * Math.PI * 2) * height * 0.1 + height * 0.5;
  const spiralRadius = (0, import_remotion6.interpolate)(frame, [0, 115], [0, width * 0.4]);
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_remotion6.AbsoluteFill, { style: { backgroundColor: "#f0f4c3" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
      position: "absolute",
      left: "50%",
      top: "50%",
      transform: `translate(-50%, -50%) scale(${scale})`,
      width: spiralRadius,
      height: spiralRadius,
      borderRadius: "50%",
      borderWidth: width * 0.02,
      borderColor: "#d32f2f",
      borderStyle: "solid",
      opacity: 0.5,
      transition: "all 0.5s"
    } }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
      position: "absolute",
      left: x,
      top: y,
      width: width * 0.05,
      height: width * 0.05,
      backgroundColor: "#388e3c",
      borderRadius: "50%",
      transform: `translate(-50%, -50%)`
    } })
  ] });
};
var scene_6_default = LogarithmicTrapScene;

// src/proj_883cf07f_8fb8_47dd_9c3b_04a63ce60a67/scenes/scene_7.tsx
var import_remotion7 = require("remotion");
var import_jsx_runtime7 = require("react/jsx-runtime");
var TreeBalancer = () => {
  const { fps, width, height } = (0, import_remotion7.useVideoConfig)();
  const frame = (0, import_remotion7.useCurrentFrame)();
  const nodes = Array.from({ length: 5 }).map((_, i) => {
    const nodeSpring = (0, import_remotion7.spring)({
      frame: frame - i * 5,
      fps,
      config: { damping: 10, stiffness: 100 }
    });
    const nodeX = (0, import_remotion7.interpolate)(nodeSpring, [0, 1], [width * 0.15, width * 0.85]);
    const nodeY = height * 0.5 + Math.sin(i * Math.PI * 0.5) * height * 0.15;
    return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: nodeX,
          top: nodeY,
          width: width * 0.05,
          height: width * 0.05,
          borderRadius: "50%",
          backgroundColor: "#8b5cf6",
          transform: `translate(-50%, -50%) scale(${nodeSpring})`
        }
      },
      i
    );
  });
  const beamSpring = (0, import_remotion7.spring)({
    frame: frame - 40,
    fps,
    config: { damping: 8, stiffness: 50 }
  });
  const beamRotation = (0, import_remotion7.interpolate)(beamSpring, [0, 1], [-20, 20]);
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_remotion7.AbsoluteFill, { style: { backgroundColor: "#f3f4f6" }, children: [
    nodes,
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: "50%",
          bottom: height * 0.2,
          width: width * 0.8,
          height: height * 0.02,
          backgroundColor: "#34d399",
          transform: `translateX(-50%) rotate(${beamRotation}deg)`,
          transformOrigin: "center"
        }
      }
    )
  ] });
};
var scene_7_default = TreeBalancer;

// src/proj_883cf07f_8fb8_47dd_9c3b_04a63ce60a67/scenes/scene_8.tsx
var import_remotion8 = require("remotion");
var import_jsx_runtime8 = require("react/jsx-runtime");
var SortingBottleneckScene = () => {
  const { fps, width, height } = (0, import_remotion8.useVideoConfig)();
  const frame = (0, import_remotion8.useCurrentFrame)();
  const connectionsScale = (0, import_remotion8.spring)({
    frame: frame - 10,
    fps,
    config: { damping: 8, stiffness: 200 }
  });
  const ballCount = 50;
  const ballPositions = Array.from({ length: ballCount }).map((_, i) => {
    const delay = i * 3;
    const x = (0, import_remotion8.interpolate)(frame - delay, [0, 60], [width * 0.1, width * 0.9]);
    const y = Math.sin((frame + i * 3) * 0.1) * height * 0.2 + height * 0.5;
    return { x, y };
  });
  const bottleneckX = width * 0.75;
  const bottleneckWidth = width * 0.05;
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_remotion8.AbsoluteFill, { style: { backgroundColor: "#f0f4f8", justifyContent: "center", alignItems: "center" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: {
      position: "absolute",
      left: bottleneckX,
      top: height * 0.3,
      width: bottleneckWidth,
      height: height * 0.4,
      backgroundColor: "#ff6b6b",
      borderRadius: "50%"
    } }),
    ballPositions.map((pos, i) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: {
      position: "absolute",
      left: pos.x,
      top: pos.y,
      width: width * 0.05 * connectionsScale,
      height: width * 0.05 * connectionsScale,
      backgroundColor: i % 2 === 0 ? "#4d96f6" : "#f6d365",
      borderRadius: "50%",
      transform: `translate(-50%, -50%) scale(${connectionsScale})`
    } }, i))
  ] });
};
var scene_8_default = SortingBottleneckScene;

// src/proj_883cf07f_8fb8_47dd_9c3b_04a63ce60a67/scenes/scene_9.tsx
var import_remotion9 = require("remotion");
var import_jsx_runtime9 = require("react/jsx-runtime");
var Scene = () => {
  const { width, height, fps } = (0, import_remotion9.useVideoConfig)();
  const frame = (0, import_remotion9.useCurrentFrame)();
  const scale = (0, import_remotion9.spring)({
    frame,
    fps,
    config: { damping: 8, stiffness: 200 }
  });
  const progress = (0, import_remotion9.interpolate)(frame, [0, 35], [0, 1]);
  const x = progress * width * 0.8;
  const y = Math.sin(progress * Math.PI) * -height * 0.3;
  const particles = Array.from({ length: 10 }).map((_, i) => {
    const angle = i / 10 * Math.PI * 2;
    const radius = (0, import_remotion9.interpolate)(frame, [20, 35], [0, width * 0.2]);
    return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)`,
          width: width * 0.02,
          height: width * 0.02,
          borderRadius: "50%",
          background: "#8b5cf6",
          opacity: (0, import_remotion9.interpolate)(frame, [20, 27, 35], [0, 1, 0])
        }
      },
      i
    );
  });
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_remotion9.AbsoluteFill, { style: { backgroundColor: "#f0f4c3" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: "10%",
          top: "50%",
          transform: `translate(${x}px, ${y}px) scale(${scale})`,
          width: width * 0.1,
          height: height * 0.1,
          backgroundColor: "#4caf50",
          borderRadius: "50%"
        }
      }
    ),
    particles
  ] });
};
var scene_9_default = Scene;

// src/proj_883cf07f_8fb8_47dd_9c3b_04a63ce60a67/scenes/scene_10.tsx
var import_remotion10 = require("remotion");
var import_jsx_runtime10 = require("react/jsx-runtime");
var SchedulingScene = () => {
  const { width, height, fps } = (0, import_remotion10.useVideoConfig)();
  const frame = (0, import_remotion10.useCurrentFrame)();
  const gear1Rotation = (0, import_remotion10.interpolate)(frame, [0, 86], [0, 360], { easing: "easeInOut" });
  const gear2Rotation = (0, import_remotion10.interpolate)(frame, [0, 86], [0, -360], { easing: "easeInOut" });
  const gear1Scale = (0, import_remotion10.spring)({ frame, fps, config: { damping: 8, stiffness: 200 } });
  const gear2Scale = (0, import_remotion10.spring)({ frame: frame - 10, fps, config: { damping: 8, stiffness: 200 } });
  const burstVisible = frame > 60 && frame < 86;
  const particleOpacity = (0, import_remotion10.interpolate)(frame, [60, 70, 86], [0, 1, 0]);
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_remotion10.AbsoluteFill, { style: { justifyContent: "center", alignItems: "center", backgroundColor: "#f0f4ff" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: {
      width: width * 0.2,
      height: width * 0.2,
      borderRadius: "50%",
      backgroundColor: "#ff6347",
      transform: `scale(${gear1Scale}) rotate(${gear1Rotation}deg)`,
      position: "absolute",
      top: height * 0.3,
      left: width * 0.3
    } }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: {
      width: width * 0.15,
      height: width * 0.15,
      borderRadius: "50%",
      backgroundColor: "#4682b4",
      transform: `scale(${gear2Scale}) rotate(${gear2Rotation}deg)`,
      position: "absolute",
      top: height * 0.5,
      left: width * 0.6
    } }),
    burstVisible && Array.from({ length: 20 }).map((_, i) => {
      const angle = i / 20 * Math.PI * 2;
      const radius = (0, import_remotion10.interpolate)(frame, [60, 86], [0, width * 0.1]);
      return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: {
        position: "absolute",
        left: width * 0.5,
        top: height * 0.5,
        transform: `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)`,
        width: width * 0.02,
        height: width * 0.02,
        borderRadius: "50%",
        backgroundColor: "#32cd32",
        opacity: particleOpacity
      } }, i);
    })
  ] });
};
var scene_10_default = SchedulingScene;

// src/proj_883cf07f_8fb8_47dd_9c3b_04a63ce60a67/scenes/scene_11.tsx
var import_remotion11 = require("remotion");
var import_jsx_runtime11 = require("react/jsx-runtime");
var HierarchicalTimingWheel = () => {
  const { width, height, fps } = (0, import_remotion11.useVideoConfig)();
  const frame = (0, import_remotion11.useCurrentFrame)();
  const smallGearRotation = (0, import_remotion11.spring)({
    frame,
    fps,
    config: { damping: 10, stiffness: 100 }
  }) * 360;
  const mediumGearRotation = (0, import_remotion11.spring)({
    frame: frame - 10,
    fps,
    config: { damping: 10, stiffness: 80 }
  }) * 360;
  const largeGearRotation = (0, import_remotion11.spring)({
    frame: frame - 20,
    fps,
    config: { damping: 10, stiffness: 60 }
  }) * 360;
  const centerX = width / 2;
  const centerY = height / 2;
  const smallGearColor = "#f59e0b";
  const mediumGearColor = "#84cc16";
  const largeGearColor = "#3b82f6";
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(import_remotion11.AbsoluteFill, { style: { backgroundColor: "#f3f4f6" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: centerX - width * 0.15,
          top: centerY - height * 0.15,
          width: width * 0.3,
          height: width * 0.3,
          borderRadius: "50%",
          border: `solid ${width * 0.015}px ${largeGearColor}`,
          transform: `rotate(${largeGearRotation}deg)`,
          clipPath: "polygon(50% 0%, 60% 20%, 100% 30%, 70% 50%, 100% 70%, 60% 80%, 50% 100%, 40% 80%, 0% 70%, 30% 50%, 0% 30%, 40% 20%)"
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: centerX - width * 0.08,
          top: centerY - height * 0.08,
          width: width * 0.16,
          height: width * 0.16,
          borderRadius: "50%",
          border: `solid ${width * 0.01}px ${mediumGearColor}`,
          transform: `rotate(${mediumGearRotation}deg)`,
          clipPath: "polygon(50% 0%, 60% 20%, 100% 30%, 70% 50%, 100% 70%, 60% 80%, 50% 100%, 40% 80%, 0% 70%, 30% 50%, 0% 30%, 40% 20%)"
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: centerX - width * 0.04,
          top: centerY - height * 0.04,
          width: width * 0.08,
          height: width * 0.08,
          borderRadius: "50%",
          border: `solid ${width * 5e-3}px ${smallGearColor}`,
          transform: `rotate(${smallGearRotation}deg)`,
          clipPath: "polygon(50% 0%, 60% 20%, 100% 30%, 70% 50%, 100% 70%, 60% 80%, 50% 100%, 40% 80%, 0% 70%, 30% 50%, 0% 30%, 40% 20%)"
        }
      }
    )
  ] });
};
var scene_11_default = HierarchicalTimingWheel;

// src/proj_883cf07f_8fb8_47dd_9c3b_04a63ce60a67/scenes/scene_12.tsx
var import_remotion12 = require("remotion");
var import_jsx_runtime12 = require("react/jsx-runtime");
var ClockFaceScene = () => {
  const { fps, width, height } = (0, import_remotion12.useVideoConfig)();
  const frame = (0, import_remotion12.useCurrentFrame)();
  const rotation = (0, import_remotion12.interpolate)(frame, [0, 97], [0, 360], {
    extrapolateRight: "clamp"
  });
  const handSpring = (0, import_remotion12.spring)({
    frame,
    fps,
    config: { damping: 8, stiffness: 200 }
  });
  const handLength = width * 0.3;
  const handWidth = width * 0.02;
  const slotRadius = width * 0.35;
  const slotCount = 60;
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(import_remotion12.AbsoluteFill, { style: { backgroundColor: "#f0f4f8", justifyContent: "center", alignItems: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
    "div",
    {
      style: {
        position: "relative",
        width: slotRadius * 2,
        height: slotRadius * 2,
        borderRadius: "50%",
        border: `${handWidth / 2}px solid #e0e0e0`,
        display: "flex",
        justifyContent: "center",
        alignItems: "center"
      },
      children: [
        Array.from({ length: slotCount }).map((_, i) => {
          const angle = i / slotCount * Math.PI * 2;
          const x = Math.cos(angle) * slotRadius;
          const y = Math.sin(angle) * slotRadius;
          return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: `translate(${x}px, ${y}px)`,
                width: handWidth,
                height: handWidth,
                backgroundColor: "#8b5cf6",
                borderRadius: "50%"
              }
            },
            i
          );
        }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              width: handWidth,
              height: handLength,
              backgroundColor: "#ff6347",
              borderRadius: handWidth / 2,
              transformOrigin: `${handWidth / 2}px ${handLength - handWidth}px`,
              transform: `rotate(${rotation * handSpring}deg) translateY(-${handLength - handWidth}px)`
            }
          }
        )
      ]
    }
  ) });
};
var scene_12_default = ClockFaceScene;

// src/proj_883cf07f_8fb8_47dd_9c3b_04a63ce60a67/scenes/scene_13.tsx
var import_remotion13 = require("remotion");
var import_jsx_runtime13 = require("react/jsx-runtime");
var TaskDueScene = () => {
  const { width, height, fps } = (0, import_remotion13.useVideoConfig)();
  const frame = (0, import_remotion13.useCurrentFrame)();
  const progress = (0, import_remotion13.interpolate)(frame, [0, 85], [0, 1], {
    extrapolateRight: "clamp"
  });
  const tasks = Array.from({ length: 5 }).map((_, i) => {
    const delay = i * 10;
    const x = (0, import_remotion13.interpolate)(frame - delay, [0, 60], [0, width * 0.8], {
      extrapolateRight: "clamp"
    });
    const scale = (0, import_remotion13.spring)({
      frame: frame - delay,
      fps,
      config: { damping: 8, stiffness: 200 }
    });
    return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          width: width * 0.05,
          height: width * 0.05,
          backgroundColor: "#f87171",
          borderRadius: "50%",
          transform: `translate(${x}px, ${height * 0.5}px) scale(${scale})`
        }
      },
      i
    );
  });
  const binY = Math.sin(progress * Math.PI) * -height * 0.1;
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(import_remotion13.AbsoluteFill, { style: { backgroundColor: "#f0f4c3" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: height * 0.1,
          left: width * 0.8,
          width: width * 0.1,
          height: height * 0.1,
          backgroundColor: "#4caf50",
          borderRadius: "10%",
          transform: `translateY(${binY}px)`
        }
      }
    ),
    tasks
  ] });
};
var scene_13_default = TaskDueScene;

// src/proj_883cf07f_8fb8_47dd_9c3b_04a63ce60a67/scenes/scene_14.tsx
var import_remotion14 = require("remotion");
var import_jsx_runtime14 = require("react/jsx-runtime");
var DropInBucketScene = () => {
  const { fps, width, height } = (0, import_remotion14.useVideoConfig)();
  const frame = (0, import_remotion14.useCurrentFrame)();
  const dropScale = (0, import_remotion14.spring)({
    frame: frame - 20,
    fps,
    config: { damping: 8, stiffness: 200 }
  });
  const impactParticles = Array.from({ length: 20 }).map((_, i) => {
    const angle = i / 20 * Math.PI * 2;
    const radius = (0, import_remotion14.interpolate)(frame, [40, 60], [0, width * 0.1]);
    return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: "50%",
          top: "70%",
          transform: `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)`,
          width: width * 0.02,
          height: width * 0.02,
          borderRadius: "50%",
          background: "#fbbf24",
          opacity: (0, import_remotion14.interpolate)(frame, [40, 50, 60], [0, 1, 0])
        }
      },
      i
    );
  });
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)(import_remotion14.AbsoluteFill, { style: { backgroundColor: "#34d399" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: width * 0.5 - width * 0.05,
          top: (0, import_remotion14.interpolate)(frame, [0, 30], [height * 0.1, height * 0.7]),
          width: width * 0.1,
          height: width * 0.1,
          backgroundColor: "#60a5fa",
          borderRadius: "50%",
          transform: `scale(${dropScale})`
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: width * 0.4,
          top: height * 0.75,
          width: width * 0.2,
          height: height * 0.1,
          backgroundColor: "#f87171",
          borderBottomLeftRadius: width * 0.1,
          borderBottomRightRadius: width * 0.1,
          transform: `scaleY(${(0, import_remotion14.interpolate)(frame, [60, 65, 73], [1, 1.1, 1])})`
        }
      }
    ),
    impactParticles
  ] });
};
var scene_14_default = DropInBucketScene;

// src/proj_883cf07f_8fb8_47dd_9c3b_04a63ce60a67/scenes/scene_15.tsx
var import_remotion15 = require("remotion");
var import_jsx_runtime15 = require("react/jsx-runtime");
var HierarchyScene = () => {
  const { width, height, fps } = (0, import_remotion15.useVideoConfig)();
  const frame = (0, import_remotion15.useCurrentFrame)();
  const baseColor = "#8b5cf6";
  const subColor = "#34d399";
  const mainScale = (0, import_remotion15.spring)({ frame, fps, config: { damping: 8, stiffness: 200 } });
  const secondaryProgress = (0, import_remotion15.interpolate)(frame, [0, 50], [0, 1]);
  const secondaryX = secondaryProgress * width * 0.3;
  const secondaryY = Math.sin(secondaryProgress * Math.PI) * height * 0.1;
  const showParticles = frame > 30;
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_remotion15.AbsoluteFill, { style: { backgroundColor: "#f3f4f6" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { style: {
      position: "absolute",
      left: "50%",
      top: "30%",
      width: width * 0.1,
      height: width * 0.1,
      backgroundColor: baseColor,
      borderRadius: "50%",
      transform: `translate(-50%, -50%) scale(${mainScale})`
    } }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { style: {
      position: "absolute",
      left: "30%",
      top: "60%",
      width: width * 0.05,
      height: width * 0.05,
      backgroundColor: subColor,
      borderRadius: "50%",
      transform: `translate(${secondaryX}px, ${secondaryY}px)`
    } }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { style: {
      position: "absolute",
      left: "70%",
      top: "60%",
      width: width * 0.05,
      height: width * 0.05,
      backgroundColor: subColor,
      borderRadius: "50%",
      transform: `translate(${-secondaryX}px, ${secondaryY}px)`
    } }),
    showParticles && Array.from({ length: 20 }).map((_, i) => {
      const angle = i / 20 * Math.PI * 2;
      const radius = (0, import_remotion15.interpolate)(frame - 30, [0, 37], [0, 150]);
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { style: {
        position: "absolute",
        left: "50%",
        top: "30%",
        width: width * 0.01,
        height: width * 0.01,
        backgroundColor: "#facc15",
        borderRadius: "50%",
        transform: `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)`,
        opacity: (0, import_remotion15.interpolate)(frame - 30, [0, 10, 37], [0, 1, 0])
      } }, i);
    })
  ] });
};
var scene_15_default = HierarchyScene;

// src/proj_883cf07f_8fb8_47dd_9c3b_04a63ce60a67/scenes/scene_16.tsx
var import_remotion16 = require("remotion");
var import_jsx_runtime16 = require("react/jsx-runtime");
var DeadlineApproaching = () => {
  const { fps, width, height } = (0, import_remotion16.useVideoConfig)();
  const frame = (0, import_remotion16.useCurrentFrame)();
  const clockRadius = width * 0.2;
  const handLength = clockRadius * 0.8;
  const clockCenter = { x: width / 2, y: height / 2 };
  const handProgress = (0, import_remotion16.interpolate)(frame, [0, 55], [0, Math.PI * 2]);
  const bounceScale = (0, import_remotion16.spring)({ frame, fps, config: { damping: 8, stiffness: 200 } });
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(import_remotion16.AbsoluteFill, { style: { backgroundColor: "#fef3c7" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { style: {
      position: "absolute",
      left: clockCenter.x - clockRadius,
      top: clockCenter.y - clockRadius,
      width: clockRadius * 2,
      height: clockRadius * 2,
      borderRadius: "50%",
      border: `${width * 0.01}px solid #f87171`,
      backgroundColor: "#fefce8"
    } }),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { style: {
      position: "absolute",
      left: clockCenter.x,
      top: clockCenter.y,
      width: handLength,
      height: width * 0.01,
      backgroundColor: "#f87171",
      transformOrigin: "left center",
      transform: `rotate(${handProgress}rad) scaleY(${bounceScale})`
    } }),
    frame > 50 && Array.from({ length: 20 }).map((_, i) => {
      const angle = i / 20 * Math.PI * 2;
      const radius = (0, import_remotion16.interpolate)(frame - 50, [0, 5], [0, width * 0.1]);
      return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { style: {
        position: "absolute",
        left: clockCenter.x,
        top: clockCenter.y - width * 0.01,
        transform: `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)`,
        width: width * 0.02,
        height: width * 0.02,
        borderRadius: "50%",
        background: "#f87171",
        opacity: (0, import_remotion16.interpolate)(frame - 50, [0, 2.5, 5], [1, 0.5, 0])
      } }, i);
    })
  ] });
};
var scene_16_default = DeadlineApproaching;

// src/proj_883cf07f_8fb8_47dd_9c3b_04a63ce60a67/scenes/scene_17.tsx
var import_remotion17 = require("remotion");
var import_jsx_runtime17 = require("react/jsx-runtime");
var MassiveWheelScene = () => {
  const { width, height, fps } = (0, import_remotion17.useVideoConfig)();
  const frame = (0, import_remotion17.useCurrentFrame)();
  const smallWheelScale = (0, import_remotion17.spring)({ frame, fps, config: { damping: 8, stiffness: 200 } });
  const largeWheelScale = (0, import_remotion17.spring)({ frame: frame - 10, fps, config: { damping: 8, stiffness: 150 } });
  const smallWheelY = (0, import_remotion17.interpolate)(frame, [0, 20, 40], [height * 0.5, height * 0.3, height * 0.5]);
  const largeWheelY = (0, import_remotion17.interpolate)(frame, [10, 30, 40], [height * 0.6, height * 0.4, height * 0.6]);
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_remotion17.AbsoluteFill, { style: { backgroundColor: "#f0f4f8", justifyContent: "center", alignItems: "center" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { style: {
      position: "absolute",
      width: width * 0.15,
      height: width * 0.15,
      backgroundColor: "#4caf50",
      borderRadius: "50%",
      transform: `scale(${smallWheelScale})`,
      top: smallWheelY,
      left: width * 0.3
    } }),
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { style: {
      position: "absolute",
      width: width * 0.3,
      height: width * 0.3,
      backgroundColor: "#ff9800",
      borderRadius: "50%",
      transform: `scale(${largeWheelScale})`,
      top: largeWheelY,
      left: width * 0.55
    } })
  ] });
};
var scene_17_default = MassiveWheelScene;

// src/proj_883cf07f_8fb8_47dd_9c3b_04a63ce60a67/scenes/scene_18.tsx
var import_remotion18 = require("remotion");
var import_jsx_runtime18 = require("react/jsx-runtime");
var SecondLargerWheelScene = () => {
  const { fps, width, height } = (0, import_remotion18.useVideoConfig)();
  const frame = (0, import_remotion18.useCurrentFrame)();
  const smallWheelScale = (0, import_remotion18.spring)({
    frame: frame - 10,
    fps,
    config: { damping: 8, stiffness: 200 }
  });
  const largeWheelScale = (0, import_remotion18.spring)({
    frame: frame - 35,
    fps,
    config: { damping: 8, stiffness: 200 }
  });
  const smallWheelPosition = (0, import_remotion18.interpolate)(frame, [0, 30], [width * 0.25, width * 0.5], {
    extrapolateRight: "clamp"
  });
  const largeWheelPosition = (0, import_remotion18.interpolate)(frame, [35, 69], [width * 0.5, width * 0.75], {
    extrapolateRight: "clamp"
  });
  const smallWheelColor = (0, import_remotion18.interpolate)(frame, [0, 30], [1, 0]);
  const largeWheelColor = (0, import_remotion18.interpolate)(frame, [35, 69], [0, 1]);
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(import_remotion18.AbsoluteFill, { style: { backgroundColor: "#f0f4f8" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          width: width * 0.2,
          height: width * 0.2,
          borderRadius: "50%",
          backgroundColor: `rgba(255, 99, 71, ${smallWheelColor})`,
          transform: `translate(${smallWheelPosition - width * 0.1}px, ${height * 0.5 - width * 0.1}px) scale(${smallWheelScale})`
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          width: width * 0.4,
          height: width * 0.4,
          borderRadius: "50%",
          backgroundColor: `rgba(60, 179, 113, ${largeWheelColor})`,
          transform: `translate(${largeWheelPosition - width * 0.2}px, ${height * 0.5 - width * 0.2}px) scale(${largeWheelScale})`
        }
      }
    )
  ] });
};
var scene_18_default = SecondLargerWheelScene;

// src/proj_883cf07f_8fb8_47dd_9c3b_04a63ce60a67/scenes/scene_19.tsx
var import_remotion19 = require("remotion");
var import_jsx_runtime19 = require("react/jsx-runtime");
var MinuteHandScene = () => {
  const { width, height, fps } = (0, import_remotion19.useVideoConfig)();
  const frame = (0, import_remotion19.useCurrentFrame)();
  const rotation = (0, import_remotion19.interpolate)(frame, [0, 38], [0, 360], { extrapolateRight: "clamp" });
  const handScale = (0, import_remotion19.spring)({ frame, fps, config: { damping: 8, stiffness: 200 } });
  const particles = Array.from({ length: 12 }).map((_, i) => {
    const angle = i / 12 * Math.PI * 2;
    const radius = (0, import_remotion19.interpolate)(frame, [20, 38], [0, width * 0.15]);
    return /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)`,
          width: width * 0.02,
          height: width * 0.02,
          borderRadius: "50%",
          background: "#FF69B4",
          opacity: (0, import_remotion19.interpolate)(frame, [20, 25, 38], [0, 1, 0])
        }
      },
      i
    );
  });
  return /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(import_remotion19.AbsoluteFill, { style: { background: "#F0F8FF", justifyContent: "center", alignItems: "center" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
      "div",
      {
        style: {
          width: width * 0.02,
          height: height * 0.5,
          background: "#8A2BE2",
          transformOrigin: "bottom center",
          transform: `rotate(${rotation}deg) scale(${handScale})`
        }
      }
    ),
    particles
  ] });
};
var scene_19_default = MinuteHandScene;

// src/proj_883cf07f_8fb8_47dd_9c3b_04a63ce60a67/scenes/scene_20.tsx
var import_remotion20 = require("remotion");
var import_jsx_runtime20 = require("react/jsx-runtime");
var WheelWithTasks = () => {
  const { width, height, fps } = (0, import_remotion20.useVideoConfig)();
  const frame = (0, import_remotion20.useCurrentFrame)();
  const rotation = (0, import_remotion20.interpolate)(frame, [0, 101], [0, 360]);
  const taskProgress = (taskIndex) => (0, import_remotion20.interpolate)(frame, [0, 101], [0, Math.PI * 2]) + taskIndex * Math.PI / 4;
  const wheelColor = "#4f46e5";
  const taskColor = "#fbbf24";
  return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_remotion20.AbsoluteFill, { style: { justifyContent: "center", alignItems: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
    "div",
    {
      style: {
        width: width * 0.5,
        height: width * 0.5,
        borderRadius: "50%",
        border: `5px solid ${wheelColor}`,
        position: "absolute",
        transform: `rotate(${rotation}deg)`
      },
      children: Array.from({ length: 8 }).map((_, i) => {
        const angle = taskProgress(i);
        return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(-50%, -50%) translate(${width * 0.2 * Math.cos(angle)}px, ${width * 0.2 * Math.sin(angle)}px)`,
              width: width * 0.05,
              height: width * 0.05,
              backgroundColor: taskColor,
              borderRadius: "50%"
            }
          },
          i
        );
      })
    }
  ) });
};
var scene_20_default = WheelWithTasks;

// src/proj_883cf07f_8fb8_47dd_9c3b_04a63ce60a67/scenes/scene_21.tsx
var import_remotion21 = require("remotion");
var import_jsx_runtime21 = require("react/jsx-runtime");
var Scene2 = () => {
  const { fps, width, height } = (0, import_remotion21.useVideoConfig)();
  const frame = (0, import_remotion21.useCurrentFrame)();
  const minuteHandSpring = (0, import_remotion21.spring)({
    frame,
    fps,
    config: { damping: 8, stiffness: 200 }
  });
  const minuteHandRotation = (0, import_remotion21.interpolate)(
    minuteHandSpring,
    [0, 1],
    [0, Math.PI / 2]
  );
  const taskDropProgress = (0, import_remotion21.interpolate)(frame, [60, 120], [0, 1]);
  const taskX = width * 0.5;
  const taskY = (0, import_remotion21.interpolate)(
    taskDropProgress,
    [0, 1],
    [height * 0.2, height * 0.6]
  );
  const secondWheelRotation = (0, import_remotion21.interpolate)(frame, [150, 209], [0, Math.PI * 2]);
  return /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(import_remotion21.AbsoluteFill, { style: { background: "#f0f4f8", justifyContent: "center", alignItems: "center" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { style: {
      position: "absolute",
      width: width * 0.01,
      height: height * 0.3,
      background: "#8b5cf6",
      transformOrigin: "bottom",
      transform: `rotate(${minuteHandRotation}rad)`,
      left: width * 0.5,
      top: height * 0.1
    } }),
    /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { style: {
      position: "absolute",
      width: width * 0.2,
      height: height * 0.1,
      background: "#ffcd38",
      borderRadius: "10%",
      left: width * 0.4,
      top: height * 0.05
    } }),
    /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { style: {
      position: "absolute",
      width: width * 0.05,
      height: width * 0.05,
      background: "#34d399",
      borderRadius: "50%",
      left: taskX,
      top: taskY
    } }),
    /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { style: {
      position: "absolute",
      width: width * 0.3,
      height: height * 0.3,
      borderRadius: "50%",
      border: `${width * 0.01}px solid #60a5fa`,
      left: width * 0.35,
      top: height * 0.5,
      transform: `rotate(${secondWheelRotation}rad)`
    } })
  ] });
};
var scene_21_default = Scene2;

// src/proj_883cf07f_8fb8_47dd_9c3b_04a63ce60a67/scenes/scene_22.tsx
var import_remotion22 = require("remotion");
var import_jsx_runtime22 = require("react/jsx-runtime");
var ClockMechanismScene = () => {
  const { fps, width, height } = (0, import_remotion22.useVideoConfig)();
  const frame = (0, import_remotion22.useCurrentFrame)();
  const gearRotation = (0, import_remotion22.spring)({
    frame,
    fps,
    config: { damping: 8, stiffness: 100 }
  }) * 360;
  const pendulumSwing = Math.sin((0, import_remotion22.interpolate)(frame, [0, 94], [0, Math.PI * 2])) * (width * 0.1);
  const gearSize = width * 0.2;
  const pendulumLength = height * 0.4;
  return /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)(import_remotion22.AbsoluteFill, { style: { backgroundColor: "#f3f4f6", justifyContent: "center", alignItems: "center" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { style: {
      position: "absolute",
      width: gearSize,
      height: gearSize,
      borderRadius: "50%",
      background: "#60a5fa",
      transform: `rotate(${gearRotation}deg)`,
      display: "flex",
      justifyContent: "center",
      alignItems: "center"
    }, children: /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { style: {
      width: gearSize * 0.6,
      height: gearSize * 0.6,
      background: "#3b82f6",
      borderRadius: "50%"
    } }) }),
    /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { style: {
      position: "absolute",
      top: "50%",
      transform: `translateY(-50%) translateX(${pendulumSwing}px)`,
      width: width * 0.02,
      height: pendulumLength,
      backgroundColor: "#2563eb",
      borderRadius: width * 0.01,
      transformOrigin: "top center"
    } })
  ] });
};
var scene_22_default = ClockMechanismScene;

// src/proj_883cf07f_8fb8_47dd_9c3b_04a63ce60a67/scenes/scene_23.tsx
var import_remotion23 = require("remotion");
var import_jsx_runtime23 = require("react/jsx-runtime");
var RotationScene = () => {
  const { width, height, fps } = (0, import_remotion23.useVideoConfig)();
  const frame = (0, import_remotion23.useCurrentFrame)();
  const rotation = (0, import_remotion23.interpolate)(frame, [0, 55], [0, Math.PI * 2], { extrapolateRight: "clamp" });
  const scale = (0, import_remotion23.spring)({ frame, fps, config: { damping: 8, stiffness: 200 } });
  return /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(import_remotion23.AbsoluteFill, { style: { background: "#f1f5f9", justifyContent: "center", alignItems: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("div", { style: { position: "relative", width: width * 0.5, height: height * 0.5 }, children: Array.from({ length: 6 }).map((_, i) => {
    const angle = i / 6 * Math.PI * 2;
    const x = Math.cos(angle + rotation) * width * 0.2;
    const y = Math.sin(angle + rotation) * height * 0.2;
    const color = `hsl(${i / 6 * 360}, 70%, 60%)`;
    return /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: "50%",
          top: "50%",
          width: width * 0.05,
          height: width * 0.05,
          background: color,
          borderRadius: "50%",
          transform: `translate(${x}px, ${y}px) scale(${scale})`
        }
      },
      i
    );
  }) }) });
};
var scene_23_default = RotationScene;

// src/proj_883cf07f_8fb8_47dd_9c3b_04a63ce60a67/scenes/scene_24.tsx
var import_remotion24 = require("remotion");
var import_jsx_runtime24 = require("react/jsx-runtime");
var Scene3 = () => {
  const { fps, width, height } = (0, import_remotion24.useVideoConfig)();
  const frame = (0, import_remotion24.useCurrentFrame)();
  const sphereBounce = (0, import_remotion24.spring)({
    frame,
    fps,
    config: { damping: 10, stiffness: 150 }
  });
  const progress = (0, import_remotion24.interpolate)(frame, [0, 45], [0, 1], {
    extrapolateRight: "clamp"
  });
  const theoryColor = "#f59e0b";
  const realityColor = "#10b981";
  const theoryY = (0, import_remotion24.interpolate)(sphereBounce, [0, 1], [height * 0.3, height * 0.5]);
  const realityY = (0, import_remotion24.interpolate)(progress, [0, 1], [height * 0.5, height * 0.7]);
  return /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(import_remotion24.AbsoluteFill, { style: { backgroundColor: "#f3f4f6" }, children: [
    Array.from({ length: 5 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: width * 0.1 + i * (width * 0.15),
          top: theoryY,
          width: width * 0.1,
          height: width * 0.1,
          borderRadius: "50%",
          backgroundColor: theoryColor,
          transform: `translateY(${realityY - theoryY}px)`,
          transition: "transform 0.5s ease-out"
        }
      },
      i
    )),
    Array.from({ length: 5 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: width * 0.1 + i * (width * 0.15),
          top: realityY,
          width: width * 0.1,
          height: width * 0.1,
          borderRadius: "50%",
          backgroundColor: realityColor,
          opacity: progress
        }
      },
      i
    ))
  ] });
};
var scene_24_default = Scene3;

// src/proj_883cf07f_8fb8_47dd_9c3b_04a63ce60a67/scenes/scene_25.tsx
var import_remotion25 = require("remotion");
var import_jsx_runtime25 = require("react/jsx-runtime");
var KafkaNettyMetaphor = () => {
  const { width, height, fps } = (0, import_remotion25.useVideoConfig)();
  const frame = (0, import_remotion25.useCurrentFrame)();
  const conveyorProgress = (0, import_remotion25.interpolate)(frame, [0, 173], [0, width * 0.8], {
    extrapolateRight: "clamp"
  });
  const ballScale = (0, import_remotion25.spring)({
    frame: frame - 20,
    fps,
    config: { damping: 8, stiffness: 200 }
  });
  return /* @__PURE__ */ (0, import_jsx_runtime25.jsxs)(import_remotion25.AbsoluteFill, { style: { backgroundColor: "#f9fafb", justifyContent: "center", alignItems: "center" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          width: width * 0.9,
          height: height * 0.1,
          backgroundColor: "#e5e7eb",
          bottom: height * 0.4,
          borderRadius: height * 0.05,
          overflow: "hidden"
        },
        children: Array.from({ length: 8 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              width: width * 0.05,
              height: width * 0.05,
              borderRadius: "50%",
              backgroundColor: "#8b5cf6",
              transform: `translate(${conveyorProgress + i * width * 0.1}px, ${height * 0.02}px) scale(${ballScale})`
            }
          },
          i
        ))
      }
    ),
    frame > 150 && /* @__PURE__ */ (0, import_jsx_runtime25.jsx)("div", { style: { position: "absolute", left: 0, top: 0 }, children: Array.from({ length: 20 }).map((_, i) => {
      const angle = i / 20 * Math.PI * 2;
      const radius = (0, import_remotion25.interpolate)(frame - 150, [0, 23], [0, 150]);
      return /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)`,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#8b5cf6",
            opacity: (0, import_remotion25.interpolate)(frame - 150, [0, 11.5, 23], [0, 1, 0])
          }
        },
        i
      );
    }) })
  ] });
};
var scene_25_default = KafkaNettyMetaphor;

// src/proj_883cf07f_8fb8_47dd_9c3b_04a63ce60a67/scenes/scene_26.tsx
var import_remotion26 = require("remotion");
var import_jsx_runtime26 = require("react/jsx-runtime");
var Scene4 = () => {
  const { fps, width, height } = (0, import_remotion26.useVideoConfig)();
  const frame = (0, import_remotion26.useCurrentFrame)();
  const progress = (0, import_remotion26.interpolate)(frame, [0, 117], [0, 1], { easing: (t) => t * t * (3 - 2 * t) });
  const blockScale = (0, import_remotion26.spring)({ frame, fps, config: { damping: 8, stiffness: 200 } });
  const colors = ["#ff6f61", "#6b5b95", "#88b04b", "#f7cac9"];
  return /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)(import_remotion26.AbsoluteFill, { style: { backgroundColor: "#f0f4f8", justifyContent: "center", alignItems: "center" }, children: [
    Array.from({ length: 4 }).map((_, i) => {
      const angle = i / 4 * Math.PI * 2;
      const x = Math.cos(angle) * width * 0.2 * progress;
      const y = Math.sin(angle) * height * 0.2 * progress;
      return /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            width: width * 0.1 * blockScale,
            height: height * 0.1 * blockScale,
            backgroundColor: colors[i],
            transform: `translate(${x}px, ${y}px) scale(${blockScale})`,
            borderRadius: "10%"
          }
        },
        i
      );
    }),
    Array.from({ length: 3 }).map((_, i) => {
      const angle1 = i / 4 * Math.PI * 2;
      const angle2 = (i + 1) / 4 * Math.PI * 2;
      const x1 = Math.cos(angle1) * width * 0.2 * progress;
      const y1 = Math.sin(angle1) * height * 0.2 * progress;
      const x2 = Math.cos(angle2) * width * 0.2 * progress;
      const y2 = Math.sin(angle2) * height * 0.2 * progress;
      return /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: "50%",
            top: "50%",
            width: Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2),
            height: height * 0.01,
            backgroundColor: "#333",
            transform: `translate(${x1}px, ${y1}px) rotate(${Math.atan2(y2 - y1, x2 - x1)}rad)`,
            opacity: progress
          }
        },
        i + 4
      );
    })
  ] });
};
var scene_26_default = Scene4;

// src/proj_883cf07f_8fb8_47dd_9c3b_04a63ce60a67/scenes/scene_27.tsx
var import_remotion27 = require("remotion");
var import_jsx_runtime27 = require("react/jsx-runtime");
var EngineeringScene = () => {
  const { width, height, fps } = (0, import_remotion27.useVideoConfig)();
  const frame = (0, import_remotion27.useCurrentFrame)();
  const leadX = (0, import_remotion27.interpolate)(frame, [0, 60], [0, width * 0.5], { easing: "easeInOut" });
  const leadY = Math.sin(frame / 154 * Math.PI * 2) * (height * 0.1);
  const followerX = (0, import_remotion27.interpolate)(frame, [0, 60], [width * 0.2, width * 0.7], { easing: "easeInOut" });
  const followerY = Math.sin(frame / 154 * Math.PI * 2 + Math.PI / 2) * (height * 0.1);
  const leadScale = (0, import_remotion27.spring)({
    frame,
    fps,
    config: { damping: 8, stiffness: 200 }
  });
  const particles = Array.from({ length: 20 }).map((_, i) => {
    const angle = i / 20 * Math.PI * 2;
    const radius = (0, import_remotion27.interpolate)(frame - 30, [0, 30], [0, width * 0.1]);
    return /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: "50%",
          top: "80%",
          transform: `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)`,
          width: width * 0.02,
          height: width * 0.02,
          borderRadius: "50%",
          background: "#8b5cf6",
          opacity: (0, import_remotion27.interpolate)(frame - 30, [0, 15, 30], [0, 1, 0])
        }
      },
      i
    );
  });
  return /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)(import_remotion27.AbsoluteFill, { style: { background: "#f0f4c3" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: `${leadX}px`,
          top: `${height * 0.3 + leadY}px`,
          width: width * 0.1,
          height: width * 0.1,
          backgroundColor: "#ff7043",
          borderRadius: "50%",
          transform: `scale(${leadScale})`
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: `${followerX}px`,
          top: `${height * 0.5 + followerY}px`,
          width: width * 0.08,
          height: width * 0.08,
          backgroundColor: "#29b6f6",
          borderRadius: "50%"
        }
      }
    ),
    particles
  ] });
};
var scene_27_default = EngineeringScene;

// src/proj_883cf07f_8fb8_47dd_9c3b_04a63ce60a67/scenes/scene_28.tsx
var import_remotion28 = require("remotion");
var import_jsx_runtime28 = require("react/jsx-runtime");
var ThankYouScene = () => {
  const { width, height, fps } = (0, import_remotion28.useVideoConfig)();
  const frame = (0, import_remotion28.useCurrentFrame)();
  const heartScale = (0, import_remotion28.spring)({ frame, fps, config: { damping: 8, stiffness: 200 } });
  const heartX = (0, import_remotion28.interpolate)(frame, [0, 18], [width * 0.3, width * 0.5]);
  const heartY = (0, import_remotion28.interpolate)(frame, [0, 18], [height * 0.5, height * 0.3]);
  const burstRadius = (0, import_remotion28.interpolate)(frame, [10, 18], [0, width * 0.2]);
  return /* @__PURE__ */ (0, import_jsx_runtime28.jsxs)(import_remotion28.AbsoluteFill, { style: { backgroundColor: "#fff0f5", justifyContent: "center", alignItems: "center" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime28.jsx)("div", { style: {
      width: width * 0.1,
      height: height * 0.1,
      borderRadius: "50%",
      backgroundColor: "#ff69b4",
      transform: `translate(${heartX}px, ${heartY}px) scale(${heartScale})`,
      position: "absolute"
    } }),
    Array.from({ length: 10 }).map((_, i) => {
      const angle = i / 10 * Math.PI * 2;
      return /* @__PURE__ */ (0, import_jsx_runtime28.jsx)("div", { style: {
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate(${Math.cos(angle) * burstRadius}px, ${Math.sin(angle) * burstRadius}px)`,
        width: width * 0.02,
        height: height * 0.02,
        borderRadius: "50%",
        backgroundColor: "#ff69b4",
        opacity: (0, import_remotion28.interpolate)(frame, [10, 18], [1, 0])
      } }, i);
    })
  ] });
};
var scene_28_default = ThankYouScene;

// src/proj_883cf07f_8fb8_47dd_9c3b_04a63ce60a67/Main.tsx
var import_jsx_runtime29 = require("react/jsx-runtime");
function Main() {
  return /* @__PURE__ */ (0, import_jsx_runtime29.jsxs)(import_remotion29.AbsoluteFill, { style: { background: "#0f0f23" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_remotion29.Sequence, { from: 0, durationInFrames: 64, name: "scene_1", children: /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(scene_1_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_remotion29.Sequence, { from: 73, durationInFrames: 199, name: "scene_2", children: /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(scene_2_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_remotion29.Sequence, { from: 286, durationInFrames: 82, name: "scene_3", children: /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(scene_3_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_remotion29.Sequence, { from: 374, durationInFrames: 37, name: "scene_4", children: /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(scene_4_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_remotion29.Sequence, { from: 422, durationInFrames: 181, name: "scene_5", children: /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(scene_5_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_remotion29.Sequence, { from: 602, durationInFrames: 115, name: "scene_6", children: /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(scene_6_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_remotion29.Sequence, { from: 726, durationInFrames: 131, name: "scene_7", children: /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(scene_7_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_remotion29.Sequence, { from: 867, durationInFrames: 159, name: "scene_8", children: /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(scene_8_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_remotion29.Sequence, { from: 1026, durationInFrames: 35, name: "scene_9", children: /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(scene_9_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_remotion29.Sequence, { from: 1068, durationInFrames: 86, name: "scene_10", children: /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(scene_10_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_remotion29.Sequence, { from: 1167, durationInFrames: 88, name: "scene_11", children: /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(scene_11_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_remotion29.Sequence, { from: 1268, durationInFrames: 97, name: "scene_12", children: /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(scene_12_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_remotion29.Sequence, { from: 1373, durationInFrames: 85, name: "scene_13", children: /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(scene_13_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_remotion29.Sequence, { from: 1467, durationInFrames: 73, name: "scene_14", children: /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(scene_14_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_remotion29.Sequence, { from: 1551, durationInFrames: 67, name: "scene_15", children: /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(scene_15_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_remotion29.Sequence, { from: 1635, durationInFrames: 55, name: "scene_16", children: /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(scene_16_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_remotion29.Sequence, { from: 1726, durationInFrames: 40, name: "scene_17", children: /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(scene_17_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_remotion29.Sequence, { from: 1773, durationInFrames: 69, name: "scene_18", children: /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(scene_18_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_remotion29.Sequence, { from: 1869, durationInFrames: 38, name: "scene_19", children: /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(scene_19_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_remotion29.Sequence, { from: 1924, durationInFrames: 101, name: "scene_20", children: /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(scene_20_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_remotion29.Sequence, { from: 2034, durationInFrames: 209, name: "scene_21", children: /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(scene_21_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_remotion29.Sequence, { from: 2258, durationInFrames: 94, name: "scene_22", children: /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(scene_22_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_remotion29.Sequence, { from: 2361, durationInFrames: 55, name: "scene_23", children: /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(scene_23_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_remotion29.Sequence, { from: 2415, durationInFrames: 45, name: "scene_24", children: /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(scene_24_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_remotion29.Sequence, { from: 2472, durationInFrames: 173, name: "scene_25", children: /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(scene_25_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_remotion29.Sequence, { from: 2645, durationInFrames: 117, name: "scene_26", children: /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(scene_26_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_remotion29.Sequence, { from: 2762, durationInFrames: 154, name: "scene_27", children: /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(scene_27_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_remotion29.Sequence, { from: 2923, durationInFrames: 18, name: "scene_28", children: /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(scene_28_default, {}) })
  ] });
}
