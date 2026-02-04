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

// src/proj_c46f2059_51b9_4973_951b_0dd50f0408a0/Main.tsx
var Main_exports = {};
__export(Main_exports, {
  default: () => Main
});
module.exports = __toCommonJS(Main_exports);
var import_remotion8 = require("remotion");

// src/proj_c46f2059_51b9_4973_951b_0dd50f0408a0/scenes/scene_1.tsx
var import_remotion = require("remotion");
var import_jsx_runtime = require("react/jsx-runtime");
var ReservoirSamplingVisualization = () => {
  const { width, height, fps } = (0, import_remotion.useVideoConfig)();
  const frame = (0, import_remotion.useCurrentFrame)();
  const riverHeight = height * 0.5;
  const fishWidth = width * 0.1;
  const fishHeight = riverHeight * 0.2;
  const numFish = 5;
  const fishPositions = Array.from({ length: numFish }).map((_, i) => ({
    x: (0, import_remotion.interpolate)(frame + i * 30, [0, 240], [-fishWidth, width + fishWidth]),
    y: riverHeight * 0.6
  }));
  const fishColors = ["#007acc", "#ffcc00", "#ff5733", "#50c878", "#de3163"];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.AbsoluteFill, { style: { backgroundColor: "#f0f0f0" }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { style: { position: "absolute", width: "100%", height: "100%" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "rect",
      {
        x: "0",
        y: riverHeight * 0.5,
        width,
        height: riverHeight,
        fill: "#e0f7fa"
      }
    ),
    fishPositions.map((pos, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { style: { transform: `translate(${pos.x}px, ${pos.y}px)` }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "ellipse",
        {
          cx: fishWidth * 0.5,
          cy: fishHeight * 0.5,
          rx: fishWidth * 0.5,
          ry: fishHeight * 0.5,
          fill: fishColors[index % fishColors.length]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "circle",
        {
          cx: fishWidth * 0.75,
          cy: fishHeight * 0.5,
          r: fishWidth * 0.1,
          fill: "#fff"
        }
      )
    ] }, index)),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "rect",
      {
        x: width * 0.75,
        y: riverHeight * 0.4,
        width: fishWidth * 1.2,
        height: fishHeight * 1.5,
        stroke: "#ff5733",
        strokeWidth: "3",
        fill: "none"
      }
    )
  ] }) });
};
var scene_1_default = ReservoirSamplingVisualization;

// src/proj_c46f2059_51b9_4973_951b_0dd50f0408a0/scenes/scene_2.tsx
var import_remotion2 = require("remotion");
var import_jsx_runtime2 = require("react/jsx-runtime");
var ReservoirSamplingScene = () => {
  const { width, height, fps } = (0, import_remotion2.useVideoConfig)();
  const frame = (0, import_remotion2.useCurrentFrame)();
  const numFish = 20;
  const riverHeight = height * 0.6;
  const fishSize = width * 0.05;
  const fishPositions = Array.from({ length: numFish }).map((_, i) => {
    const initialX = (i + 1) * (width / numFish) + frame % 30 * (width / 30);
    const y = riverHeight / 2 + Math.sin((frame + i * 10) * 0.1) * (riverHeight / 5);
    const x = initialX % width;
    return { x, y };
  });
  const netPosition = (0, import_remotion2.interpolate)(frame, [0, 209], [0, width]);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_remotion2.AbsoluteFill, { style: { background: "#f0f0f0" }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { style: { position: "absolute", width: "100%", height: "100%" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { x: 0, y: height * 0.2, width, height: riverHeight, fill: "#007acc" }),
    fishPositions.map(({ x, y }, index) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "circle",
      {
        cx: x,
        cy: height * 0.2 + y,
        r: fishSize / 2,
        fill: index % 2 === 0 ? "#ffcc00" : "#ff5733",
        style: {
          transition: "all 0.1s ease-out"
        }
      },
      index
    )),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "rect",
      {
        x: netPosition,
        y: height * 0.2,
        width: fishSize,
        height: riverHeight,
        fill: "none",
        stroke: "#ff5733",
        strokeWidth: "2",
        style: {
          transition: "all 0.1s ease-out"
        }
      }
    )
  ] }) });
};
var scene_2_default = ReservoirSamplingScene;

// src/proj_c46f2059_51b9_4973_951b_0dd50f0408a0/scenes/scene_3.tsx
var import_remotion3 = require("remotion");
var import_jsx_runtime3 = require("react/jsx-runtime");
var ReservoirSamplingScene2 = () => {
  const { fps, width, height } = (0, import_remotion3.useVideoConfig)();
  const frame = (0, import_remotion3.useCurrentFrame)();
  const riverWidth = width * 0.8;
  const fishSize = width * 0.05;
  const netSize = width * 0.1;
  const fishPositions = Array.from({ length: 10 }, (_, i) => ({
    x: (0, import_remotion3.interpolate)(frame, [0, 359], [0, riverWidth - fishSize], { extrapolateRight: "clamp" }) - i * (fishSize * 1.5),
    y: height * 0.5 + Math.sin(frame / 30 + i) * 10,
    color: `hsl(${i * 36 % 360}, 70%, 60%)`
  }));
  const netProgress = (0, import_remotion3.spring)({ frame: frame - 60, fps, config: { damping: 8, stiffness: 200 } });
  const netY = (0, import_remotion3.interpolate)(netProgress, [0, 1], [height, height * 0.5]);
  const caughtFishIndex = Math.floor((0, import_remotion3.interpolate)(frame, [0, 359], [0, 10]) % 10);
  const caughtFish = fishPositions[caughtFishIndex];
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_remotion3.AbsoluteFill, { style: { background: "#f0f0f0", justifyContent: "center", alignItems: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("svg", { style: { position: "absolute", width: "100%", height: "100%" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("rect", { x: width * 0.1, y: height * 0.45, width: riverWidth, height: height * 0.1, fill: "#007acc" }),
    fishPositions.map((fish, index) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "circle",
      {
        cx: fish.x,
        cy: fish.y,
        r: fishSize / 2,
        fill: fish.color,
        style: {
          filter: index === caughtFishIndex ? "brightness(1.2)" : "none",
          transition: "filter 0.3s"
        }
      },
      index
    )),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "rect",
      {
        x: caughtFish.x - netSize / 2,
        y: netY - netSize / 2,
        width: netSize,
        height: netSize,
        fill: "rgba(255, 204, 0, 0.5)",
        stroke: "#ffcc00",
        strokeWidth: "2",
        style: {
          transition: "y 0.3s"
        }
      }
    )
  ] }) });
};
var scene_3_default = ReservoirSamplingScene2;

// src/proj_c46f2059_51b9_4973_951b_0dd50f0408a0/scenes/scene_4.tsx
var import_remotion4 = require("remotion");
var import_jsx_runtime4 = require("react/jsx-runtime");
var ReservoirSamplingScene3 = () => {
  const { width, height, fps } = (0, import_remotion4.useVideoConfig)();
  const frame = (0, import_remotion4.useCurrentFrame)();
  const riverY = height * 0.7;
  const fishSize = width * 0.05;
  const netSize = width * 0.1;
  const diceSize = width * 0.05;
  const fishX = (0, import_remotion4.spring)({
    frame,
    fps,
    config: {
      damping: 10,
      stiffness: 100
    }
  }) * width;
  const netCatchProgress = (0, import_remotion4.interpolate)(frame, [0, 60, 119], [0, 1, 0], {
    extrapolateRight: "clamp"
  });
  const diceRoll = Math.round(
    (0, import_remotion4.interpolate)(frame, [0, 60], [1, 6], {
      extrapolateLeft: "clamp"
    })
  );
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_remotion4.AbsoluteFill, { style: { backgroundColor: "#f0f0f0" }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("svg", { style: { position: "absolute", width: "100%", height: "100%" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("rect", { x: 0, y: riverY, width, height: height * 0.1, fill: "#007acc" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "circle",
      {
        cx: fishX,
        cy: riverY + height * 0.05,
        r: fishSize,
        fill: "#ff5733",
        style: {
          transformOrigin: "center",
          transform: `scale(${1 + netCatchProgress * 0.2})`
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "rect",
      {
        x: fishX - netSize / 2,
        y: riverY - netSize * 0.5 * netCatchProgress,
        width: netSize,
        height: netSize,
        fill: "none",
        stroke: "#ffcc00",
        strokeWidth: 3,
        style: {
          transformOrigin: "center",
          transform: `rotate(${netCatchProgress * 45}deg)`
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "rect",
      {
        x: fishX - diceSize / 2,
        y: riverY - netSize - diceSize,
        width: diceSize,
        height: diceSize,
        fill: "#ffcc00"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "text",
      {
        x: fishX,
        y: riverY - netSize - diceSize / 3,
        fontSize: diceSize * 0.5,
        textAnchor: "middle",
        fill: "#007acc",
        children: diceRoll
      }
    )
  ] }) });
};
var scene_4_default = ReservoirSamplingScene3;

// src/proj_c46f2059_51b9_4973_951b_0dd50f0408a0/scenes/scene_5.tsx
var import_remotion5 = require("remotion");
var import_jsx_runtime5 = require("react/jsx-runtime");
var ReservoirSamplingScene4 = () => {
  const { width, height, fps } = (0, import_remotion5.useVideoConfig)();
  const frame = (0, import_remotion5.useCurrentFrame)();
  const riverHeight = height * 0.15;
  const fishSize = width * 0.05;
  const netSize = width * 0.1;
  const dieSize = width * 0.05;
  const netX = (0, import_remotion5.interpolate)(frame, [0, 660], [width * 0.2, width * 0.8], {
    extrapolateRight: "clamp"
  });
  const fishPositions = Array.from({ length: 10 }, (_, i) => ({
    x: (0, import_remotion5.interpolate)(frame, [0, 660], [width + fishSize, -fishSize], {
      extrapolateRight: "clamp"
    }) - i * width * 0.1,
    y: height * 0.5 + Math.sin((frame + i * 10) * 0.05) * riverHeight * 0.3,
    color: `hsl(${i * 36 % 360}, 70%, 60%)`
  }));
  const dieRoll = Math.floor(frame % 60 / 10);
  const dieValue = dieRoll % 6 + 1;
  const isNewWinner = dieValue === 1;
  const netY = (0, import_remotion5.interpolate)(frame, [0, 660], [height * 0.5 - netSize, height * 0.5 + (isNewWinner ? fishSize : 0)], {
    extrapolateRight: "clamp"
  });
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_remotion5.AbsoluteFill, { style: { backgroundColor: "#f0f0f0" }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("svg", { style: { position: "absolute", width: "100%", height: "100%" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("rect", { x: "0", y: height * 0.5, width: "100%", height: riverHeight, fill: "#007acc" }),
    fishPositions.map((fish, index) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "circle",
      {
        cx: fish.x,
        cy: fish.y,
        r: fishSize / 2,
        fill: fish.color,
        style: {
          transition: "all 0.5s ease"
        }
      },
      index
    )),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "circle",
      {
        cx: netX,
        cy: netY,
        r: netSize / 2,
        fill: "#ffcc00",
        stroke: "#ff5733",
        strokeWidth: "3",
        style: {
          transition: "all 0.5s ease",
          boxShadow: isNewWinner ? "0 0 15px 5px rgba(255, 87, 51, 0.6)" : "none"
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "rect",
      {
        x: width * 0.45,
        y: height * 0.1,
        width: dieSize,
        height: dieSize,
        fill: "#ff5733",
        stroke: "black",
        strokeWidth: "2"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "text",
      {
        x: width * 0.45 + dieSize / 2,
        y: height * 0.1 + dieSize / 1.5,
        fontSize: dieSize / 2,
        fill: "#ffffff",
        textAnchor: "middle",
        children: dieValue
      }
    )
  ] }) });
};
var scene_5_default = ReservoirSamplingScene4;

// src/proj_c46f2059_51b9_4973_951b_0dd50f0408a0/scenes/scene_6.tsx
var import_remotion6 = require("remotion");
var import_jsx_runtime6 = require("react/jsx-runtime");
var ReservoirSamplingScene5 = () => {
  const { width, height, fps } = (0, import_remotion6.useVideoConfig)();
  const frame = (0, import_remotion6.useCurrentFrame)();
  const riverHeight = height * 0.6;
  const fishSize = width * 0.05;
  const netSize = width * 0.1;
  const fishColors = ["#ff5733", "#007acc", "#ffcc00"];
  const netPositionX = width * 0.8;
  const riverY = height * 0.2;
  const fishCount = 10;
  const fishPositions = Array.from({ length: fishCount }, (_, i) => ({
    x: (0, import_remotion6.interpolate)(frame, [0, 29], [width + i * fishSize * 2, -fishSize]),
    color: fishColors[i % fishColors.length]
  }));
  const currentFishIndex = Math.floor((0, import_remotion6.interpolate)(frame, [0, 29], [0, fishCount - 1], { extrapolateRight: "clamp" }));
  const currentFishColor = fishPositions[currentFishIndex].color;
  const netCatchProgress = (0, import_remotion6.spring)({
    frame,
    fps,
    config: { damping: 10, stiffness: 100 }
  });
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_remotion6.AbsoluteFill, { style: { backgroundColor: "#f0f0f0" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("svg", { style: { position: "absolute", width: "100%", height: riverHeight, top: riverY }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("rect", { x: 0, y: 0, width, height: riverHeight, fill: "#e0f7fa" }) }),
    fishPositions.map((fish, index) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("svg", { style: { position: "absolute", width: fishSize, height: fishSize, top: riverY + riverHeight / 2 }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "circle",
      {
        cx: fish.x,
        cy: 0,
        r: fishSize / 2,
        fill: fish.color,
        style: { transition: "fill 0.5s linear" }
      }
    ) }, index)),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("svg", { style: { position: "absolute", width: netSize, height: netSize, top: riverY + riverHeight / 2, left: netPositionX }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "circle",
      {
        cx: 0,
        cy: 0,
        r: netSize / 2,
        fill: currentFishColor,
        style: {
          boxShadow: `0 0 ${netCatchProgress * 15}px ${netCatchProgress * 7}px rgba(0, 0, 0, 0.3)`,
          transition: "fill 0.5s ease-in-out"
        }
      }
    ) })
  ] });
};
var scene_6_default = ReservoirSamplingScene5;

// src/proj_c46f2059_51b9_4973_951b_0dd50f0408a0/scenes/scene_7.tsx
var import_remotion7 = require("remotion");
var import_jsx_runtime7 = require("react/jsx-runtime");
var ReservoirSamplingScene6 = () => {
  const { width, height, fps } = (0, import_remotion7.useVideoConfig)();
  const frame = (0, import_remotion7.useCurrentFrame)();
  const riverY = height * 0.5;
  const fishCount = 10;
  const fishSize = width * 0.05;
  const netSize = width * 0.1;
  const fishPositions = Array.from({ length: fishCount }).map((_, i) => {
    const x = (0, import_remotion7.interpolate)(frame + i * 20, [0, 300], [width, -fishSize], {
      extrapolateRight: "wrap"
    });
    const y = riverY + Math.sin((frame + i * 10) * 0.05) * (height * 0.1);
    return { x, y };
  });
  const netPositions = [0, 1, 2, 3, 4].map((netIndex) => {
    const swing = Math.sin((frame + netIndex * 30) * 0.05) * (width * 0.02);
    const x = width * 0.8 + swing;
    const y = riverY + Math.sin((frame + netIndex * 20) * 0.05) * (height * 0.1);
    return { x, y };
  });
  const diceRoll = Math.floor(frame / 30 % 6) + 1;
  const diceGlow = (0, import_remotion7.interpolate)(frame % 30, [0, 15, 30], [0, 1, 0]);
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_remotion7.AbsoluteFill, { style: { backgroundColor: "#f0f0f0" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("svg", { style: { position: "absolute", width: "100%", height: "100%" }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("rect", { x: 0, y: riverY - height * 0.15, width, height: height * 0.3, fill: "#007acc" }) }),
    fishPositions.map((pos, i) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("svg", { style: { position: "absolute", left: pos.x, top: pos.y }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("circle", { cx: 0, cy: 0, r: fishSize / 2, fill: i % 2 === 0 ? "#ffcc00" : "#ff5733" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("circle", { cx: fishSize / 4, cy: 0, r: fishSize / 8, fill: "#fff" })
    ] }, i)),
    netPositions.map((pos, i) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("svg", { style: { position: "absolute", left: pos.x, top: pos.y }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "rect",
      {
        x: -netSize / 2,
        y: -netSize / 2,
        width: netSize,
        height: netSize,
        fill: "none",
        stroke: "#ff5733",
        strokeWidth: 3,
        style: {
          boxShadow: `0 0 ${diceGlow * 30}px ${diceGlow * 15}px rgba(59, 130, 246, 0.6)`
        }
      }
    ) }, i)),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("svg", { style: { position: "absolute", left: width * 0.9, top: height * 0.1 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("rect", { x: -fishSize, y: -fishSize, width: fishSize * 2, height: fishSize * 2, fill: "#fff" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "text",
        {
          x: 0,
          y: 0,
          textAnchor: "middle",
          dominantBaseline: "middle",
          fill: "#007acc",
          fontSize: fishSize * 0.8,
          children: diceRoll
        }
      )
    ] })
  ] });
};
var scene_7_default = ReservoirSamplingScene6;

// src/proj_c46f2059_51b9_4973_951b_0dd50f0408a0/Main.tsx
var import_jsx_runtime8 = require("react/jsx-runtime");
function Main() {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_remotion8.AbsoluteFill, { style: { background: "#f0f0f0" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_remotion8.Sequence, { from: 0, durationInFrames: 240, name: "scene_1", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(scene_1_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_remotion8.Sequence, { from: 240, durationInFrames: 210, name: "scene_2", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(scene_2_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_remotion8.Sequence, { from: 450, durationInFrames: 360, name: "scene_3", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(scene_3_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_remotion8.Sequence, { from: 810, durationInFrames: 120, name: "scene_4", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(scene_4_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_remotion8.Sequence, { from: 930, durationInFrames: 660, name: "scene_5", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(scene_5_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_remotion8.Sequence, { from: 1590, durationInFrames: 30, name: "scene_6", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(scene_6_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_remotion8.Sequence, { from: 1620, durationInFrames: 690, name: "scene_7", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(scene_7_default, {}) })
  ] });
}
