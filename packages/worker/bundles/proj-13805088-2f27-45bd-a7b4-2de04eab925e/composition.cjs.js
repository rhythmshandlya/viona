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

// src/proj_13805088_2f27_45bd_a7b4_2de04eab925e/Main.tsx
var Main_exports = {};
__export(Main_exports, {
  default: () => Main
});
module.exports = __toCommonJS(Main_exports);
var import_remotion8 = require("remotion");

// src/proj_13805088_2f27_45bd_a7b4_2de04eab925e/scenes/scene_1.tsx
var import_remotion = require("remotion");
var import_jsx_runtime = require("react/jsx-runtime");
var ReservoirSamplingScene = () => {
  const { width, height, fps } = (0, import_remotion.useVideoConfig)();
  const frame = (0, import_remotion.useCurrentFrame)();
  const slotSize = width * 0.15;
  const tokenSize = width * 0.05;
  const tokenFlowStartX = -tokenSize;
  const tokenFlowEndX = width * 0.5 - slotSize / 2;
  const tokenFlowY = height * 0.5;
  const slotScale = (0, import_remotion.spring)({
    frame,
    fps,
    config: { damping: 10, stiffness: 100 }
  });
  const tokenFlowPosition = (0, import_remotion.interpolate)(
    frame,
    [0, 240],
    [tokenFlowStartX, tokenFlowEndX],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: { backgroundColor: "#ecf0f1" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "svg",
      {
        style: {
          position: "absolute",
          top: height * 0.3,
          left: width * 0.5 - slotSize / 2,
          width: slotSize,
          height: slotSize,
          transform: `scale(${slotScale})`,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "50%", cy: "50%", r: "45%", fill: "#3498db" })
      }
    ),
    Array.from({ length: 5 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "svg",
      {
        style: {
          position: "absolute",
          top: tokenFlowY,
          left: tokenFlowPosition + i * tokenSize * 2,
          width: tokenSize,
          height: tokenSize,
          transform: `scale(${slotScale})`
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "50%", cy: "50%", r: "45%", fill: "#2ecc71" })
      },
      i
    )),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "svg",
      {
        style: {
          position: "absolute",
          top: height * 0.7,
          left: width * 0.75,
          width: tokenSize * 1.5,
          height: tokenSize * 1.5
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "50%", cy: "50%", r: "45%", fill: "#e74c3c" })
      }
    )
  ] });
};
var scene_1_default = ReservoirSamplingScene;

// src/proj_13805088_2f27_45bd_a7b4_2de04eab925e/scenes/scene_2.tsx
var import_remotion2 = require("remotion");
var import_jsx_runtime2 = require("react/jsx-runtime");
var ReservoirSamplingScene2 = () => {
  const { width, height, fps } = (0, import_remotion2.useVideoConfig)();
  const frame = (0, import_remotion2.useCurrentFrame)();
  const primaryColor = "#3498db";
  const secondaryColor = "#2ecc71";
  const accentColor = "#e74c3c";
  const winnerSlotSize = width * 0.1;
  const winnerSlotX = width * 0.75;
  const winnerSlotY = height * 0.4;
  const tokenSize = width * 0.05;
  const tokenInitialX = -tokenSize;
  const tokenY = height * 0.5;
  const numberOfTokens = Math.floor(frame / 30);
  const diceSize = width * 0.05;
  const diceX = winnerSlotX + winnerSlotSize / 2 - diceSize / 2;
  const diceY = winnerSlotY - diceSize * 1.5;
  const diceRoll = Math.floor(frame / 30) % 6 + 1;
  const diceOpacity = (0, import_remotion2.interpolate)(frame % 30, [0, 15, 30], [0, 1, 0]);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_remotion2.AbsoluteFill, { style: { backgroundColor: "#ecf0f1" }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { style: { position: "absolute", width: "100%", height: "100%" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "rect",
      {
        x: winnerSlotX,
        y: winnerSlotY,
        width: winnerSlotSize,
        height: winnerSlotSize,
        fill: secondaryColor,
        stroke: "white",
        strokeWidth: "3"
      }
    ),
    Array.from({ length: numberOfTokens }).map((_, i) => {
      const tokenX = (0, import_remotion2.interpolate)(
        frame - i * 30,
        [0, 90],
        [tokenInitialX, winnerSlotX],
        { extrapolateRight: "clamp" }
      );
      const tokenColor = (i + diceRoll) % 2 === 0 ? primaryColor : accentColor;
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "circle",
        {
          cx: tokenX,
          cy: tokenY,
          r: tokenSize / 2,
          fill: tokenColor,
          stroke: "white",
          strokeWidth: "2"
        },
        i
      );
    }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "rect",
      {
        x: diceX,
        y: diceY,
        width: diceSize,
        height: diceSize,
        fill: accentColor,
        opacity: diceOpacity,
        rx: 5
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "text",
      {
        x: diceX + diceSize / 2,
        y: diceY + diceSize / 2,
        fill: "white",
        fontSize: diceSize * 0.5,
        textAnchor: "middle",
        dominantBaseline: "central",
        fontWeight: "bold",
        opacity: diceOpacity,
        children: diceRoll
      }
    )
  ] }) });
};
var scene_2_default = ReservoirSamplingScene2;

// src/proj_13805088_2f27_45bd_a7b4_2de04eab925e/scenes/scene_3.tsx
var import_remotion3 = require("remotion");
var import_jsx_runtime3 = require("react/jsx-runtime");
var ReservoirSamplingScene3 = () => {
  const { width, height, fps } = (0, import_remotion3.useVideoConfig)();
  const frame = (0, import_remotion3.useCurrentFrame)();
  const slotSize = width * 0.15;
  const tokenSize = width * 0.05;
  const diceSize = width * 0.1;
  const slotX = width * 0.5 - slotSize / 2;
  const slotY = height * 0.4;
  const tokenStartX = -tokenSize;
  const tokenEndX = width + tokenSize;
  const diceX = width * 0.7;
  const diceY = height * 0.6;
  const tokenProgress = (0, import_remotion3.interpolate)(frame, [0, 120], [0, 1], { extrapolateRight: "clamp" });
  const tokenX = (0, import_remotion3.interpolate)(tokenProgress, [0, 1], [tokenStartX, slotX + slotSize / 2 - tokenSize / 2]);
  const diceRotation = (0, import_remotion3.spring)({
    frame: frame - 60,
    fps,
    config: { damping: 10, stiffness: 100 }
  }) * 360;
  const tokenVisible = frame >= 60 && frame < 180;
  const diceVisible = frame >= 120;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_remotion3.AbsoluteFill, { style: { backgroundColor: "#ecf0f1", justifyContent: "center", alignItems: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("svg", { style: { position: "absolute", width: "100%", height: "100%" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "rect",
      {
        x: slotX,
        y: slotY,
        width: slotSize,
        height: slotSize,
        fill: "#3498db",
        rx: 10,
        ry: 10,
        style: { boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }
      }
    ),
    tokenVisible && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "circle",
      {
        cx: tokenX,
        cy: slotY + slotSize / 2,
        r: tokenSize / 2,
        fill: "#2ecc71",
        style: { boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }
      }
    ),
    diceVisible && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("g", { transform: `translate(${diceX}, ${diceY}) rotate(${diceRotation})`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "rect",
        {
          x: -diceSize / 2,
          y: -diceSize / 2,
          width: diceSize,
          height: diceSize,
          fill: "#e74c3c",
          rx: 8,
          ry: 8,
          style: { boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("circle", { cx: 0, cy: 0, r: tokenSize * 0.2, fill: "#ecf0f1" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("circle", { cx: -tokenSize * 0.3, cy: -tokenSize * 0.3, r: tokenSize * 0.2, fill: "#ecf0f1" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("circle", { cx: tokenSize * 0.3, cy: tokenSize * 0.3, r: tokenSize * 0.2, fill: "#ecf0f1" })
    ] })
  ] }) });
};
var scene_3_default = ReservoirSamplingScene3;

// src/proj_13805088_2f27_45bd_a7b4_2de04eab925e/scenes/scene_4.tsx
var import_remotion4 = require("remotion");
var import_jsx_runtime4 = require("react/jsx-runtime");
var ReservoirSamplingScene4 = () => {
  const { width, height, fps } = (0, import_remotion4.useVideoConfig)();
  const frame = (0, import_remotion4.useCurrentFrame)();
  const slotSize = width * 0.15;
  const tokenSize = width * 0.05;
  const diceSize = width * 0.1;
  const currentWinnerX = width * 0.5 - slotSize / 2;
  const currentWinnerY = height * 0.3;
  const streamStartX = -tokenSize;
  const streamEndX = width + tokenSize;
  const streamY = height * 0.7;
  const diceX = width * 0.75;
  const diceY = currentWinnerY + slotSize / 2;
  const tokenProgress = frame % 120 / 120;
  const tokenX = (0, import_remotion4.interpolate)(tokenProgress, [0, 1], [streamStartX, streamEndX]);
  const diceRoll = (0, import_remotion4.spring)({
    frame: frame % 60,
    fps,
    config: { damping: 10, stiffness: 100 }
  });
  const diceRotation = (0, import_remotion4.interpolate)(diceRoll, [0, 1], [0, 360 * 2]);
  const winnerReplacementFrame = 240;
  const winningTokenProgress = (0, import_remotion4.interpolate)(
    frame,
    [winnerReplacementFrame, winnerReplacementFrame + 30],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  const winningTokenY = (0, import_remotion4.interpolate)(winningTokenProgress, [0, 1], [streamY, currentWinnerY]);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_remotion4.AbsoluteFill, { style: { backgroundColor: "#ecf0f1", justifyContent: "center", alignItems: "center" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: currentWinnerY,
          left: currentWinnerX,
          width: slotSize,
          height: slotSize,
          backgroundColor: "#3498db",
          borderRadius: "10%",
          boxShadow: "0 4px 8px rgba(0,0,0,0.2)"
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("svg", { style: { position: "absolute", top: streamY, left: tokenX }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("circle", { cx: tokenSize / 2, cy: tokenSize / 2, r: tokenSize / 2, fill: "#2ecc71" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      "svg",
      {
        style: {
          position: "absolute",
          top: diceY,
          left: diceX,
          width: diceSize,
          height: diceSize,
          transform: `rotate(${diceRotation}deg)`
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("rect", { width: diceSize, height: diceSize, fill: "#e74c3c", rx: "15%" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("circle", { cx: diceSize * 0.25, cy: diceSize * 0.25, r: diceSize * 0.05, fill: "#ffffff" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("circle", { cx: diceSize * 0.75, cy: diceSize * 0.25, r: diceSize * 0.05, fill: "#ffffff" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("circle", { cx: diceSize * 0.5, cy: diceSize * 0.5, r: diceSize * 0.05, fill: "#ffffff" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("circle", { cx: diceSize * 0.25, cy: diceSize * 0.75, r: diceSize * 0.05, fill: "#ffffff" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("circle", { cx: diceSize * 0.75, cy: diceSize * 0.75, r: diceSize * 0.05, fill: "#ffffff" })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "svg",
      {
        style: {
          position: "absolute",
          top: winningTokenY,
          left: currentWinnerX + slotSize / 2 - tokenSize / 2,
          opacity: winningTokenProgress
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("circle", { cx: tokenSize / 2, cy: tokenSize / 2, r: tokenSize / 2, fill: "#2ecc71" })
      }
    )
  ] });
};
var scene_4_default = ReservoirSamplingScene4;

// src/proj_13805088_2f27_45bd_a7b4_2de04eab925e/scenes/scene_5.tsx
var import_remotion5 = require("remotion");
var import_jsx_runtime5 = require("react/jsx-runtime");
var ReservoirSamplingScene5 = () => {
  const { width, height, fps } = (0, import_remotion5.useVideoConfig)();
  const frame = (0, import_remotion5.useCurrentFrame)();
  const tokenSize = width * 0.05;
  const slotSize = width * 0.1;
  const diceSize = width * 0.08;
  const slotX = width * 0.7;
  const slotY = height * 0.4;
  const diceX = width * 0.5;
  const diceY = height * 0.7;
  const tokenFlowX = (0, import_remotion5.interpolate)(frame, [0, 299], [0, width * 0.6], { extrapolateRight: "clamp" });
  const tokenFlowY = height * 0.4;
  const diceHighlight = (0, import_remotion5.interpolate)(frame % 60, [0, 30, 59], [0, 1, 0]);
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_remotion5.AbsoluteFill, { style: { backgroundColor: "#ecf0f1" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("svg", { style: { position: "absolute", left: slotX, top: slotY }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "rect",
      {
        x: 0,
        y: 0,
        width: slotSize,
        height: slotSize,
        fill: "#3498db",
        rx: 12
      }
    ) }),
    [...Array(10)].map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("svg", { style: { position: "absolute", left: tokenFlowX - i * tokenSize, top: tokenFlowY }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "circle",
      {
        cx: tokenSize / 2,
        cy: tokenSize / 2,
        r: tokenSize / 2 - 3,
        fill: i % 2 === 0 ? "#2ecc71" : "#e74c3c"
      }
    ) }, i)),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("svg", { style: { position: "absolute", left: diceX, top: diceY }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "rect",
        {
          x: 0,
          y: 0,
          width: diceSize,
          height: diceSize,
          fill: "#2ecc71",
          rx: 8,
          style: {
            boxShadow: `0 0 ${diceHighlight * 20}px ${diceHighlight * 10}px rgba(231, 76, 60, 0.6)`
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "circle",
        {
          cx: diceSize / 2,
          cy: diceSize / 2,
          r: diceSize / 8,
          fill: "#ecf0f1"
        }
      )
    ] })
  ] });
};
var scene_5_default = ReservoirSamplingScene5;

// src/proj_13805088_2f27_45bd_a7b4_2de04eab925e/scenes/scene_6.tsx
var import_remotion6 = require("remotion");
var import_jsx_runtime6 = require("react/jsx-runtime");
var ReservoirSamplingScene6 = () => {
  const { width, height, fps } = (0, import_remotion6.useVideoConfig)();
  const frame = (0, import_remotion6.useCurrentFrame)();
  const tokenSize = width * 0.05;
  const slotSize = width * 0.1;
  const numSlots = 5;
  const tokenFlow = (0, import_remotion6.interpolate)(frame, [0, 100, 570], [-tokenSize, width * 0.5, width * 1.2]);
  const diceRoll = Math.floor((0, import_remotion6.interpolate)(frame % 50, [0, 25, 50], [1, 6, 1]));
  const filledSlotIndex = Math.floor((0, import_remotion6.interpolate)(frame, [100, 570], [0, numSlots]));
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_remotion6.AbsoluteFill, { style: { backgroundColor: "#ecf0f1", justifyContent: "center", alignItems: "center" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("svg", { style: { position: "absolute", width: "100%", height: "100%" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "circle",
        {
          cx: tokenFlow,
          cy: height * 0.4,
          r: tokenSize,
          fill: "#3498db",
          stroke: "#2980b9",
          strokeWidth: "2"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "text",
        {
          x: tokenFlow,
          y: height * 0.4,
          textAnchor: "middle",
          dy: ".3em",
          fontSize: tokenSize * 0.8,
          fill: "white",
          children: Math.floor(frame / 30)
        }
      )
    ] }),
    Array.from({ length: numSlots }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          width: slotSize,
          height: slotSize,
          borderRadius: "50%",
          backgroundColor: i === filledSlotIndex ? "#2ecc71" : "transparent",
          border: "3px solid #27ae60",
          top: height * 0.7,
          left: width * 0.2 + i * (slotSize + width * 0.02),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: i === filledSlotIndex ? "0 0 15px 7px rgba(39, 174, 96, 0.7)" : "none"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("svg", { children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "text",
          {
            x: "50%",
            y: "50%",
            textAnchor: "middle",
            dy: ".3em",
            fontSize: slotSize * 0.5,
            fill: "#ecf0f1",
            children: i === filledSlotIndex ? Math.floor(frame / 30) : ""
          }
        ) })
      },
      i
    )),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
      position: "absolute",
      top: height * 0.5,
      left: width * 0.8,
      width: slotSize,
      height: slotSize,
      backgroundColor: "#e74c3c",
      borderRadius: "10%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 4px 12px rgba(231, 76, 60, 0.6)"
    }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("svg", { children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "text",
      {
        x: "50%",
        y: "50%",
        textAnchor: "middle",
        dy: ".3em",
        fontSize: slotSize * 0.5,
        fill: "#ecf0f1",
        children: diceRoll
      }
    ) }) })
  ] });
};
var scene_6_default = ReservoirSamplingScene6;

// src/proj_13805088_2f27_45bd_a7b4_2de04eab925e/scenes/scene_7.tsx
var import_remotion7 = require("remotion");
var import_jsx_runtime7 = require("react/jsx-runtime");
var ReservoirSamplingScene7 = () => {
  const { width, height, fps } = (0, import_remotion7.useVideoConfig)();
  const frame = (0, import_remotion7.useCurrentFrame)();
  const tokenSize = width * 0.05;
  const slotSize = width * 0.1;
  const diceSize = width * 0.05;
  const streamHeight = height * 0.6;
  const zoomOutProgress = (0, import_remotion7.spring)({
    frame,
    fps,
    config: {
      damping: 20,
      stiffness: 100
    }
  });
  const tokenX = (0, import_remotion7.interpolate)(frame, [0, 60], [width, -tokenSize * 2], { extrapolateRight: "clamp" });
  const diceRoll = Math.floor(frame / 20 % 6) + 1;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_remotion7.AbsoluteFill, { style: { backgroundColor: "#ecf0f1", overflow: "hidden" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("svg", { style: { position: "absolute", width: "100%", height: "100%" }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "rect",
      {
        x: (width - slotSize) / 2,
        y: (height - slotSize) / 2,
        width: slotSize,
        height: slotSize,
        rx: 10,
        fill: "#3498db",
        style: {
          transform: `scale(${1 - zoomOutProgress * 0.5})`,
          transformOrigin: "center center"
        }
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("svg", { style: { position: "absolute", width: "100%", height: "100%" }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "circle",
      {
        cx: tokenX,
        cy: streamHeight,
        r: tokenSize / 2,
        fill: "#2ecc71",
        style: {
          transform: `scale(${1 - zoomOutProgress * 0.5})`,
          transformOrigin: "center center"
        }
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("svg", { style: { position: "absolute", width: "100%", height: "100%" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "rect",
        {
          x: width * 0.8,
          y: height * 0.2,
          width: diceSize,
          height: diceSize,
          rx: 5,
          fill: "#e74c3c",
          style: {
            transform: `scale(${1 - zoomOutProgress * 0.5})`,
            transformOrigin: "center center"
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "text",
        {
          x: width * 0.8 + diceSize / 2,
          y: height * 0.2 + diceSize / 2,
          textAnchor: "middle",
          fontSize: diceSize * 0.5,
          fill: "#fff",
          dominantBaseline: "middle",
          children: diceRoll
        }
      )
    ] })
  ] });
};
var scene_7_default = ReservoirSamplingScene7;

// src/proj_13805088_2f27_45bd_a7b4_2de04eab925e/Main.tsx
var import_jsx_runtime8 = require("react/jsx-runtime");
function Main() {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_remotion8.AbsoluteFill, { style: { background: "#ecf0f1" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_remotion8.Sequence, { from: 0, durationInFrames: 240, name: "scene_1", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(scene_1_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_remotion8.Sequence, { from: 240, durationInFrames: 210, name: "scene_2", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(scene_2_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_remotion8.Sequence, { from: 450, durationInFrames: 360, name: "scene_3", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(scene_3_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_remotion8.Sequence, { from: 810, durationInFrames: 480, name: "scene_4", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(scene_4_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_remotion8.Sequence, { from: 1290, durationInFrames: 300, name: "scene_5", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(scene_5_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_remotion8.Sequence, { from: 1590, durationInFrames: 570, name: "scene_6", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(scene_6_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_remotion8.Sequence, { from: 2160, durationInFrames: 172, name: "scene_7", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(scene_7_default, {}) })
  ] });
}
