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

// src/proj_d1f513d9_e7f9_4fa8_b907_52671c885c1b/index.tsx
var index_exports = {};
__export(index_exports, {
  RemotionRoot: () => RemotionRoot,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_remotion9 = require("remotion");

// src/proj_d1f513d9_e7f9_4fa8_b907_52671c885c1b/constants.ts
var COLORS = {
  primary: "#1a365d",
  // Deep navy blue
  secondary: "#4a5568",
  // Warm grey
  accent: "#d69e2e",
  // Gold accents
  background: "#f7fafc",
  // Cream background
  white: "#ffffff",
  black: "#000000"
};
var SPRING_CONFIG = { damping: 22, stiffness: 90, mass: 0.9 };
var TIMING = {
  // Video specs from scenes.json
  totalFrames: 627,
  fps: 30,
  width: 1080,
  height: 1920,
  // Scene timing from scenes.json
  scene1Start: 0,
  scene1End: 65,
  scene2Start: 65,
  scene2End: 118,
  scene3Start: 118,
  scene3End: 268,
  scene4Start: 268,
  scene4End: 446,
  scene5Start: 446,
  scene5End: 473,
  scene6Start: 473,
  scene6End: 608,
  scene7Start: 608,
  scene7End: 627
};

// src/proj_d1f513d9_e7f9_4fa8_b907_52671c885c1b/components/Background.tsx
var import_remotion = require("remotion");
var import_jsx_runtime = require("react/jsx-runtime");
var Background = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const gradientProgress = (0, import_remotion.interpolate)(
    frame,
    [0, TIMING.totalFrames],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  const warmShift = (0, import_remotion.interpolate)(
    gradientProgress,
    [0, 0.5, 1],
    [0, 0.02, 0],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    import_remotion.AbsoluteFill,
    {
      style: {
        backgroundColor: COLORS.background
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          import_remotion.AbsoluteFill,
          {
            style: {
              background: `radial-gradient(ellipse at 50% 30%, rgba(214, 158, 46, ${0.03 + warmShift}) 0%, transparent 70%)`
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          import_remotion.AbsoluteFill,
          {
            style: {
              opacity: 0.03,
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)'/%3E%3C/svg%3E")`
            }
          }
        )
      ]
    }
  );
};

// src/proj_d1f513d9_e7f9_4fa8_b907_52671c885c1b/scenes/Scene1.tsx
var import_remotion2 = require("remotion");
var import_jsx_runtime2 = require("react/jsx-runtime");
var QuestionIcon = ({ size, color }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
  "svg",
  {
    xmlns: "http://www.w3.org/2000/svg",
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("g", { fill: "none", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "path",
      {
        fill: color,
        d: "M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12S6.477 2 12 2m0 14a1 1 0 1 0 0 2a1 1 0 0 0 0-2m0-9.5a3.625 3.625 0 0 0-3.625 3.625a1 1 0 1 0 2 0a1.625 1.625 0 1 1 2.23 1.51c-.676.27-1.605.962-1.605 2.115V14a1 1 0 1 0 2 0c0-.244.05-.366.261-.47l.087-.04A3.626 3.626 0 0 0 12 6.5"
      }
    ) })
  }
);
var Folder = ({ label, x, y, width, highlighted = false }) => {
  const height = width * 0.7;
  const tabWidth = width * 0.35;
  const tabHeight = height * 0.12;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("g", { transform: `translate(${x}, ${y})`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "path",
      {
        d: `M ${width * 0.1} ${tabHeight}
            L ${width * 0.1 + tabWidth * 0.15} 0
            L ${width * 0.1 + tabWidth * 0.85} 0
            L ${width * 0.1 + tabWidth} ${tabHeight}`,
        fill: highlighted ? "#e8c36a" : "#d4a853",
        stroke: COLORS.secondary,
        strokeWidth: "1"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "rect",
      {
        x: 0,
        y: tabHeight,
        width,
        height: height - tabHeight,
        rx: 3,
        fill: highlighted ? "#e8c36a" : "#d4a853",
        stroke: COLORS.secondary,
        strokeWidth: "1"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "text",
      {
        x: width / 2,
        y: tabHeight + (height - tabHeight) / 2 + 5,
        textAnchor: "middle",
        fill: COLORS.primary,
        fontSize: width * 0.15,
        fontFamily: "Georgia, serif",
        fontWeight: "bold",
        children: label
      }
    )
  ] });
};
var FilingCabinet = ({ width, skillsHighlight = false }) => {
  const height = width * 1.4;
  const drawerHeight = height * 0.3;
  const folderWidth = width * 0.35;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { width, height, viewBox: `0 0 ${width} ${height}`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "rect",
      {
        x: 0,
        y: 0,
        width,
        height,
        rx: 8,
        fill: COLORS.primary,
        stroke: COLORS.secondary,
        strokeWidth: "3"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "rect",
      {
        x: 0,
        y: 0,
        width,
        height: 15,
        rx: 8,
        fill: COLORS.primary
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "rect",
      {
        x: 0,
        y: 8,
        width,
        height: 7,
        fill: COLORS.primary
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "rect",
      {
        x: 10,
        y: 30,
        width: width - 20,
        height: drawerHeight,
        rx: 4,
        fill: "#2d4a6f",
        stroke: COLORS.secondary,
        strokeWidth: "2"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "rect",
      {
        x: width / 2 - 20,
        y: 30 + drawerHeight - 15,
        width: 40,
        height: 8,
        rx: 2,
        fill: COLORS.accent
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      Folder,
      {
        label: "Skills",
        x: 25,
        y: 45,
        width: folderWidth,
        highlighted: skillsHighlight
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      Folder,
      {
        label: "MCP",
        x: width - folderWidth - 25,
        y: 50,
        width: folderWidth
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "rect",
      {
        x: 10,
        y: 30 + drawerHeight + 20,
        width: width - 20,
        height: drawerHeight * 0.8,
        rx: 4,
        fill: "#2d4a6f",
        stroke: COLORS.secondary,
        strokeWidth: "2"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "rect",
      {
        x: width / 2 - 20,
        y: 30 + drawerHeight + 20 + drawerHeight * 0.8 - 15,
        width: 40,
        height: 8,
        rx: 2,
        fill: COLORS.accent
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "rect",
      {
        x: 10,
        y: 30 + drawerHeight + 20 + drawerHeight * 0.8 + 20,
        width: width - 20,
        height: drawerHeight * 0.8,
        rx: 4,
        fill: "#2d4a6f",
        stroke: COLORS.secondary,
        strokeWidth: "2"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "rect",
      {
        x: width / 2 - 20,
        y: 30 + drawerHeight + 20 + drawerHeight * 0.8 + 20 + drawerHeight * 0.8 - 15,
        width: 40,
        height: 8,
        rx: 2,
        fill: COLORS.accent
      }
    )
  ] });
};
var Scene1 = ({ startFrame }) => {
  const frame = (0, import_remotion2.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion2.useVideoConfig)();
  const relativeFrame = frame - startFrame;
  const cabinetEntrance = (0, import_remotion2.spring)({
    frame: relativeFrame,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 120 },
    durationInFrames: 14
  });
  const questionEntrance = (0, import_remotion2.spring)({
    frame: relativeFrame - 8,
    fps,
    config: SPRING_CONFIG
  });
  const questionFloat = (0, import_remotion2.interpolate)(
    relativeFrame,
    [0, 30, 60],
    [0, -15, 0],
    { extrapolateRight: "clamp" }
  );
  const zoomProgress = (0, import_remotion2.interpolate)(
    relativeFrame,
    [20, 65],
    [1, 1.15],
    { extrapolateRight: "clamp" }
  );
  const panX = (0, import_remotion2.interpolate)(
    relativeFrame,
    [20, 65],
    [0, -30],
    { extrapolateRight: "clamp" }
  );
  const cabinetWidth = width * 0.5;
  const cabinetY = (0, import_remotion2.interpolate)(
    cabinetEntrance,
    [0, 1],
    [height * 0.5, height * 0.25],
    { extrapolateRight: "clamp" }
  );
  const cabinetOpacity = (0, import_remotion2.interpolate)(
    cabinetEntrance,
    [0, 0.5],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_remotion2.AbsoluteFill, { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        transform: `scale(${zoomProgress}) translateX(${panX}px)`,
        transformOrigin: "40% 40%"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: cabinetY,
              left: "50%",
              transform: "translateX(-50%)",
              opacity: cabinetOpacity
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(FilingCabinet, { width: cabinetWidth })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: cabinetY - 120 + questionFloat,
              left: "50%",
              transform: `translateX(-50%) scale(${questionEntrance})`,
              opacity: questionEntrance
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(QuestionIcon, { size: 100, color: COLORS.accent })
          }
        )
      ]
    }
  ) });
};

// src/proj_d1f513d9_e7f9_4fa8_b907_52671c885c1b/scenes/Scene2.tsx
var import_remotion3 = require("remotion");
var import_jsx_runtime3 = require("react/jsx-runtime");
var GlowingFolder = ({ width, glowIntensity }) => {
  const height = width * 0.7;
  const tabWidth = width * 0.35;
  const tabHeight = height * 0.12;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "div",
    {
      style: {
        filter: `drop-shadow(0 0 ${20 * glowIntensity}px ${COLORS.accent}) drop-shadow(0 0 ${40 * glowIntensity}px ${COLORS.accent})`
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("svg", { width, height, viewBox: `0 0 ${width} ${height}`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "path",
          {
            d: `M ${width * 0.1} ${tabHeight}
              L ${width * 0.1 + tabWidth * 0.15} 0
              L ${width * 0.1 + tabWidth * 0.85} 0
              L ${width * 0.1 + tabWidth} ${tabHeight}`,
            fill: "#e8c36a",
            stroke: COLORS.secondary,
            strokeWidth: "2"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "rect",
          {
            x: 0,
            y: tabHeight,
            width,
            height: height - tabHeight,
            rx: 4,
            fill: "#e8c36a",
            stroke: COLORS.secondary,
            strokeWidth: "2"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "text",
          {
            x: width / 2,
            y: tabHeight + (height - tabHeight) / 2 + 8,
            textAnchor: "middle",
            fill: COLORS.primary,
            fontSize: width * 0.12,
            fontFamily: "Georgia, serif",
            fontWeight: "bold",
            children: "Skills"
          }
        )
      ] })
    }
  );
};
var Scene2 = ({ startFrame }) => {
  const frame = (0, import_remotion3.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion3.useVideoConfig)();
  const relativeFrame = frame - startFrame;
  const sceneDuration = 53;
  const keySyncFrame = 34;
  const folderProgress = (0, import_remotion3.spring)({
    frame: relativeFrame,
    fps,
    config: SPRING_CONFIG,
    durationInFrames: 25
  });
  const glowIntensity = (0, import_remotion3.interpolate)(
    relativeFrame,
    [0, keySyncFrame, sceneDuration],
    [0.2, 1, 1],
    { extrapolateRight: "clamp" }
  );
  const folderScale = (0, import_remotion3.interpolate)(
    relativeFrame,
    [0, keySyncFrame - 5, keySyncFrame + 5],
    [1, 1, 1.15],
    { extrapolateRight: "clamp" }
  );
  const backgroundFade = (0, import_remotion3.interpolate)(
    relativeFrame,
    [0, 20],
    [0.4, 0.15],
    { extrapolateRight: "clamp" }
  );
  const textProgress = (0, import_remotion3.spring)({
    frame: relativeFrame - 15,
    fps,
    config: SPRING_CONFIG
  });
  const folderWidth = width * 0.45;
  const folderY = (0, import_remotion3.interpolate)(
    folderProgress,
    [0, 1],
    [height * 0.35, height * 0.2],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_remotion3.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.25,
          left: "50%",
          transform: "translateX(-50%)",
          opacity: backgroundFade
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { width: width * 0.5, height: width * 0.7, viewBox: "0 0 200 280", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "rect",
          {
            x: 0,
            y: 0,
            width: 200,
            height: 280,
            rx: 8,
            fill: COLORS.primary,
            opacity: 0.5
          }
        ) })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: folderY,
          left: "50%",
          transform: `translateX(-50%) scale(${folderScale})`,
          transformOrigin: "center center"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(GlowingFolder, { width: folderWidth, glowIntensity })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.58,
          left: "50%",
          transform: `translateX(-50%) translateY(${(1 - textProgress) * 30}px)`,
          opacity: textProgress,
          textAlign: "center",
          width: "80%"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
          "p",
          {
            style: {
              fontFamily: "Georgia, serif",
              fontSize: height * 0.035,
              color: COLORS.primary,
              margin: 0,
              lineHeight: 1.4
            },
            children: [
              "What a skill",
              " ",
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { fontStyle: "italic", color: COLORS.accent }, children: "actually" }),
              " ",
              "is"
            ]
          }
        )
      }
    )
  ] });
};

// src/proj_d1f513d9_e7f9_4fa8_b907_52671c885c1b/scenes/Scene3.tsx
var import_remotion4 = require("remotion");
var import_jsx_runtime4 = require("react/jsx-runtime");
var Document = ({ type, width, delay, x, y, frame, fps }) => {
  const height = width * 1.3;
  const entrance = (0, import_remotion4.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG
  });
  const floatY = (0, import_remotion4.interpolate)(
    frame,
    [delay, delay + 60, delay + 120],
    [0, -8, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const colors = {
    code: { bg: "#2d3748", accent: "#68d391", label: "</>" },
    instruction: { bg: COLORS.background, accent: COLORS.primary, label: "\xA7" },
    config: { bg: "#f6e05e", accent: COLORS.primary, label: "\u2699" }
  };
  const { bg, accent, label } = colors[type];
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y + floatY,
        transform: `scale(${entrance}) translateY(${(1 - entrance) * 50}px)`,
        opacity: entrance,
        filter: `drop-shadow(0 4px 12px rgba(0,0,0,0.15))`
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("svg", { width, height, viewBox: `0 0 ${width} ${height}`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "rect",
          {
            x: 0,
            y: 0,
            width,
            height,
            rx: 4,
            fill: bg,
            stroke: COLORS.secondary,
            strokeWidth: "1"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "rect",
          {
            x: 0,
            y: 0,
            width,
            height: height * 0.15,
            rx: 4,
            fill: accent
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "rect",
          {
            x: 0,
            y: height * 0.1,
            width,
            height: height * 0.05,
            fill: accent
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "text",
          {
            x: width / 2,
            y: height * 0.11,
            textAnchor: "middle",
            fill: type === "code" ? "#1a202c" : COLORS.background,
            fontSize: width * 0.2,
            fontFamily: "monospace",
            children: label
          }
        ),
        [0.25, 0.35, 0.45, 0.55, 0.65, 0.75].map((yPos, i) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "rect",
          {
            x: width * 0.1,
            y: height * yPos,
            width: width * (0.5 + i % 3 * 0.15),
            height: height * 0.04,
            rx: 2,
            fill: type === "code" ? "#4a5568" : "#cbd5e0"
          },
          i
        ))
      ] })
    }
  );
};
var OpeningFolder = ({ width, openProgress }) => {
  const height = width * 0.5;
  const flapRotation = (0, import_remotion4.interpolate)(
    openProgress,
    [0, 1],
    [0, -160],
    { extrapolateRight: "clamp" }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { perspective: 1e3, width, height }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "svg",
      {
        width,
        height,
        viewBox: `0 0 ${width} ${height}`,
        style: { position: "absolute" },
        children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "rect",
          {
            x: 0,
            y: height * 0.2,
            width,
            height: height * 0.8,
            rx: 4,
            fill: "#c9a227",
            stroke: COLORS.secondary,
            strokeWidth: "2"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transform: `rotateX(${flapRotation}deg)`,
          transformOrigin: "center bottom"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("svg", { width, height, viewBox: `0 0 ${width} ${height}`, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "rect",
            {
              x: 0,
              y: 0,
              width,
              height: height * 0.85,
              rx: 4,
              fill: "#e8c36a",
              stroke: COLORS.secondary,
              strokeWidth: "2"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "text",
            {
              x: width / 2,
              y: height * 0.45,
              textAnchor: "middle",
              fill: COLORS.primary,
              fontSize: width * 0.08,
              fontFamily: "Georgia, serif",
              fontWeight: "bold",
              children: "Skills"
            }
          )
        ] })
      }
    )
  ] });
};
var Scene3 = ({ startFrame }) => {
  const frame = (0, import_remotion4.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion4.useVideoConfig)();
  const relativeFrame = frame - startFrame;
  const keySyncFrame = 17;
  const openProgress = (0, import_remotion4.interpolate)(
    relativeFrame,
    [0, keySyncFrame, keySyncFrame + 20],
    [0, 0.3, 1],
    { extrapolateRight: "clamp" }
  );
  const folderOpacity = (0, import_remotion4.interpolate)(
    relativeFrame,
    [keySyncFrame + 30, keySyncFrame + 50],
    [1, 0],
    { extrapolateRight: "clamp" }
  );
  const textProgress = (0, import_remotion4.spring)({
    frame: relativeFrame - keySyncFrame - 10,
    fps,
    config: SPRING_CONFIG
  });
  const folderWidth = width * 0.5;
  const docWidth = width * 0.18;
  const documents = [
    { type: "code", x: width * 0.12, y: height * 0.12, delay: keySyncFrame + 15 },
    { type: "instruction", x: width * 0.42, y: height * 0.08, delay: keySyncFrame + 21 },
    { type: "config", x: width * 0.68, y: height * 0.14, delay: keySyncFrame + 27 },
    { type: "instruction", x: width * 0.08, y: height * 0.38, delay: keySyncFrame + 33 },
    { type: "code", x: width * 0.38, y: height * 0.34, delay: keySyncFrame + 39 },
    { type: "instruction", x: width * 0.65, y: height * 0.4, delay: keySyncFrame + 45 }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_remotion4.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.15,
          left: "50%",
          transform: "translateX(-50%)",
          opacity: folderOpacity
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(OpeningFolder, { width: folderWidth, openProgress })
      }
    ),
    documents.map((doc, i) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      Document,
      {
        type: doc.type,
        width: docWidth,
        x: doc.x,
        y: doc.y,
        delay: doc.delay,
        frame: relativeFrame,
        fps
      },
      i
    )),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: height * 0.12,
          left: "50%",
          transform: `translateX(-50%) translateY(${(1 - textProgress) * 30}px)`,
          opacity: textProgress,
          textAlign: "center",
          width: "85%"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
          "p",
          {
            style: {
              fontFamily: "Georgia, serif",
              fontSize: height * 0.04,
              color: COLORS.primary,
              margin: 0,
              lineHeight: 1.4
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { fontStyle: "italic" }, children: "Just" }),
              " a folder of instructions"
            ]
          }
        )
      }
    )
  ] });
};

// src/proj_d1f513d9_e7f9_4fa8_b907_52671c885c1b/scenes/Scene4.tsx
var import_remotion5 = require("remotion");
var import_jsx_runtime5 = require("react/jsx-runtime");
var LightDocument = ({ width, label }) => {
  const height = width * 0.6;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("svg", { width, height, viewBox: `0 0 ${width} ${height}`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "rect",
      {
        x: 0,
        y: 0,
        width,
        height,
        rx: 4,
        fill: COLORS.background,
        stroke: COLORS.secondary,
        strokeWidth: "1.5"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "rect",
      {
        x: width * 0.15,
        y: height * 0.25,
        width: width * 0.7,
        height: height * 0.12,
        rx: 2,
        fill: "#cbd5e0"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "rect",
      {
        x: width * 0.15,
        y: height * 0.45,
        width: width * 0.5,
        height: height * 0.12,
        rx: 2,
        fill: "#e2e8f0"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "text",
      {
        x: width / 2,
        y: height * 0.85,
        textAnchor: "middle",
        fill: COLORS.secondary,
        fontSize: width * 0.1,
        fontFamily: "Georgia, serif",
        children: label
      }
    )
  ] });
};
var HeavyDocument = ({ width, color }) => {
  const height = width * 1.2;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("svg", { width, height, viewBox: `0 0 ${width} ${height}`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "rect",
      {
        x: 6,
        y: 6,
        width: width - 6,
        height: height - 6,
        rx: 3,
        fill: "#d1d5db"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "rect",
      {
        x: 3,
        y: 3,
        width: width - 6,
        height: height - 6,
        rx: 3,
        fill: "#e5e7eb"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "rect",
      {
        x: 0,
        y: 0,
        width: width - 6,
        height: height - 6,
        rx: 4,
        fill: color,
        stroke: COLORS.secondary,
        strokeWidth: "1.5"
      }
    ),
    [0.1, 0.18, 0.26, 0.34, 0.42, 0.5, 0.58, 0.66, 0.74, 0.82].map((yPos, i) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "rect",
      {
        x: (width - 6) * 0.1,
        y: (height - 6) * yPos,
        width: (width - 6) * (0.5 + i % 4 * 0.12),
        height: (height - 6) * 0.04,
        rx: 2,
        fill: color === "#2d3748" ? "#4a5568" : "#9ca3af"
      },
      i
    ))
  ] });
};
var NumberBadge = ({ number, x, y, size }) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
  "div",
  {
    style: {
      position: "absolute",
      left: x,
      top: y,
      width: size,
      height: size,
      borderRadius: "50%",
      backgroundColor: COLORS.accent,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
    },
    children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "span",
      {
        style: {
          fontFamily: "Georgia, serif",
          fontSize: size * 0.5,
          fontWeight: "bold",
          color: COLORS.primary
        },
        children: number
      }
    )
  }
);
var Scene4 = ({ startFrame }) => {
  const frame = (0, import_remotion5.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion5.useVideoConfig)();
  const relativeFrame = frame - startFrame;
  const splitProgress = (0, import_remotion5.spring)({
    frame: relativeFrame,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 70 },
    durationInFrames: 30
  });
  const dividerProgress = (0, import_remotion5.spring)({
    frame: relativeFrame - 15,
    fps,
    config: SPRING_CONFIG
  });
  const leftLabelProgress = (0, import_remotion5.spring)({
    frame: relativeFrame - 25,
    fps,
    config: SPRING_CONFIG
  });
  const rightLabelProgress = (0, import_remotion5.spring)({
    frame: relativeFrame - 35,
    fps,
    config: SPRING_CONFIG
  });
  const badge1Progress = (0, import_remotion5.spring)({
    frame: relativeFrame - 40,
    fps,
    config: SPRING_CONFIG
  });
  const badge2Progress = (0, import_remotion5.spring)({
    frame: relativeFrame - 48,
    fps,
    config: SPRING_CONFIG
  });
  const leftX = (0, import_remotion5.interpolate)(splitProgress, [0, 1], [width * 0.35, width * 0.08], {
    extrapolateRight: "clamp"
  });
  const rightX = (0, import_remotion5.interpolate)(splitProgress, [0, 1], [width * 0.45, width * 0.52], {
    extrapolateRight: "clamp"
  });
  const lightDocWidth = width * 0.32;
  const heavyDocWidth = width * 0.2;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_remotion5.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { transform: `scale(${badge1Progress})`, opacity: badge1Progress }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(NumberBadge, { number: 1, x: width * 0.2, y: height * 0.08, size: 60 }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { transform: `scale(${badge2Progress})`, opacity: badge2Progress }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(NumberBadge, { number: 2, x: width * 0.7, y: height * 0.08, size: 60 }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          left: leftX,
          top: height * 0.18
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { position: "relative" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { position: "absolute", top: 0, left: 0 }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(LightDocument, { width: lightDocWidth, label: "name" }) }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { position: "absolute", top: lightDocWidth * 0.35, left: lightDocWidth * 0.08 }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(LightDocument, { width: lightDocWidth, label: "description" }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
            "div",
            {
              style: {
                position: "absolute",
                top: lightDocWidth * 0.6 + lightDocWidth * 0.4 + 30,
                left: 0,
                width: lightDocWidth,
                textAlign: "center",
                opacity: leftLabelProgress,
                transform: `translateY(${(1 - leftLabelProgress) * 20}px)`
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "p",
                  {
                    style: {
                      fontFamily: "Georgia, serif",
                      fontSize: height * 0.028,
                      color: COLORS.primary,
                      fontWeight: "bold",
                      margin: 0
                    },
                    children: "Front Matter"
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "p",
                  {
                    style: {
                      fontFamily: "Georgia, serif",
                      fontSize: height * 0.02,
                      color: COLORS.secondary,
                      margin: "8px 0 0 0",
                      fontStyle: "italic"
                    },
                    children: "lightweight"
                  }
                )
              ]
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
          left: "50%",
          top: height * 0.15,
          width: 3,
          height: height * 0.55 * dividerProgress,
          backgroundColor: COLORS.secondary,
          opacity: 0.4,
          transform: "translateX(-50%)"
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          left: rightX,
          top: height * 0.16
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { position: "relative" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { position: "absolute", top: 0, left: heavyDocWidth * 0.5 }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(HeavyDocument, { width: heavyDocWidth, color: "#2d3748" }) }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { position: "absolute", top: 15, left: heavyDocWidth * 0.25 }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(HeavyDocument, { width: heavyDocWidth, color: COLORS.background }) }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { position: "absolute", top: 30, left: 0 }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(HeavyDocument, { width: heavyDocWidth, color: "#f6e05e" }) }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { position: "absolute", top: 45, left: heavyDocWidth * 0.75 }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(HeavyDocument, { width: heavyDocWidth, color: "#2d3748" }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
            "div",
            {
              style: {
                position: "absolute",
                top: heavyDocWidth * 1.2 + 60 + 30,
                left: 0,
                width: heavyDocWidth * 2,
                textAlign: "center",
                opacity: rightLabelProgress,
                transform: `translateY(${(1 - rightLabelProgress) * 20}px)`
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "p",
                  {
                    style: {
                      fontFamily: "Georgia, serif",
                      fontSize: height * 0.028,
                      color: COLORS.primary,
                      fontWeight: "bold",
                      margin: 0
                    },
                    children: "Body"
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "p",
                  {
                    style: {
                      fontFamily: "Georgia, serif",
                      fontSize: height * 0.02,
                      color: COLORS.secondary,
                      margin: "8px 0 0 0",
                      fontStyle: "italic"
                    },
                    children: "detailed content"
                  }
                )
              ]
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
          bottom: height * 0.1,
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
          width: "85%",
          opacity: rightLabelProgress
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
          "p",
          {
            style: {
              fontFamily: "Georgia, serif",
              fontSize: height * 0.032,
              color: COLORS.primary,
              margin: 0
            },
            children: [
              "Two distinct",
              " ",
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { color: COLORS.accent, fontWeight: "bold" }, children: "parts" })
            ]
          }
        )
      }
    )
  ] });
};

// src/proj_d1f513d9_e7f9_4fa8_b907_52671c885c1b/scenes/Scene5.tsx
var import_remotion6 = require("remotion");
var import_jsx_runtime6 = require("react/jsx-runtime");
var FeatherIcon = ({ size, color }) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
  "svg",
  {
    xmlns: "http://www.w3.org/2000/svg",
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "path",
      {
        fill: "none",
        stroke: color,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: "2",
        d: "M12.67 19a2 2 0 0 0 1.416-.588l6.154-6.172a6 6 0 0 0-8.49-8.49L5.586 9.914A2 2 0 0 0 5 11.328V18a1 1 0 0 0 1 1zM16 8L2 22m15.5-7H9"
      }
    )
  }
);
var FrontMatterCard = ({ width, label, content, delay, frame, fps }) => {
  const height = width * 0.5;
  const entrance = (0, import_remotion6.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG
  });
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    "div",
    {
      style: {
        opacity: entrance,
        transform: `scale(${0.8 + entrance * 0.2}) translateY(${(1 - entrance) * 20}px)`,
        filter: `drop-shadow(0 4px 12px rgba(214, 158, 46, 0.3))`
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("svg", { width, height, viewBox: `0 0 ${width} ${height}`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "rect",
          {
            x: 0,
            y: 0,
            width,
            height,
            rx: 8,
            fill: COLORS.background,
            stroke: COLORS.accent,
            strokeWidth: "3"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "text",
          {
            x: width * 0.08,
            y: height * 0.28,
            fill: COLORS.secondary,
            fontSize: width * 0.08,
            fontFamily: "Georgia, serif",
            fontWeight: "bold",
            children: label
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "text",
          {
            x: width * 0.08,
            y: height * 0.6,
            fill: COLORS.primary,
            fontSize: width * 0.1,
            fontFamily: "Georgia, serif",
            children: content
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "rect",
          {
            x: width * 0.08,
            y: height * 0.68,
            width: width * 0.6,
            height: 2,
            fill: COLORS.accent,
            opacity: 0.5
          }
        )
      ] })
    }
  );
};
var Scene5 = ({ startFrame }) => {
  const frame = (0, import_remotion6.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion6.useVideoConfig)();
  const relativeFrame = frame - startFrame;
  const pulsePhase = (0, import_remotion6.interpolate)(
    relativeFrame,
    [0, 13, 27],
    [0.8, 1, 0.9],
    { extrapolateRight: "clamp" }
  );
  const focusProgress = (0, import_remotion6.spring)({
    frame: relativeFrame,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 100 },
    durationInFrames: 15
  });
  const textProgress = (0, import_remotion6.spring)({
    frame: relativeFrame - 8,
    fps,
    config: SPRING_CONFIG
  });
  const featherFloat = (0, import_remotion6.interpolate)(
    relativeFrame,
    [0, 14, 27],
    [0, -5, 0],
    { extrapolateRight: "clamp" }
  );
  const cardWidth = width * 0.7;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_remotion6.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          right: width * 0.05,
          top: height * 0.2,
          opacity: 0.2
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("svg", { width: width * 0.35, height: height * 0.4, viewBox: "0 0 140 200", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("rect", { x: 10, y: 10, width: 100, height: 140, rx: 4, fill: "#9ca3af" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("rect", { x: 20, y: 20, width: 100, height: 140, rx: 4, fill: "#d1d5db" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("rect", { x: 30, y: 30, width: 100, height: 140, rx: 4, fill: "#e5e7eb" })
        ] })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.15,
          left: "50%",
          transform: "translateX(-50%)",
          width: width * 0.8,
          height: height * 0.5,
          background: `radial-gradient(ellipse at center, rgba(214, 158, 46, ${0.15 * pulsePhase}) 0%, transparent 70%)`,
          borderRadius: 20
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.1 + featherFloat,
          left: "50%",
          transform: `translateX(-50%) scale(${focusProgress})`,
          opacity: focusProgress
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(FeatherIcon, { size: 60, color: COLORS.accent })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.22,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          alignItems: "center"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            FrontMatterCard,
            {
              width: cardWidth,
              label: "name",
              content: "skill_name",
              delay: 0,
              frame: relativeFrame,
              fps
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            FrontMatterCard,
            {
              width: cardWidth,
              label: "description",
              content: "Brief description here",
              delay: 6,
              frame: relativeFrame,
              fps
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: height * 0.15,
          left: "50%",
          transform: `translateX(-50%) translateY(${(1 - textProgress) * 20}px)`,
          opacity: textProgress,
          textAlign: "center",
          width: "85%"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
            "p",
            {
              style: {
                fontFamily: "Georgia, serif",
                fontSize: height * 0.032,
                color: COLORS.primary,
                margin: 0,
                lineHeight: 1.5
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { color: COLORS.accent, fontWeight: "bold" }, children: "Loads" }),
                " ",
                "when agent starts"
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "p",
            {
              style: {
                fontFamily: "Georgia, serif",
                fontSize: height * 0.022,
                color: COLORS.secondary,
                margin: "12px 0 0 0",
                fontStyle: "italic"
              },
              children: "lightweight \u2022 fast \u2022 efficient"
            }
          )
        ]
      }
    )
  ] });
};

// src/proj_d1f513d9_e7f9_4fa8_b907_52671c885c1b/scenes/Scene6.tsx
var import_remotion7 = require("remotion");
var import_jsx_runtime7 = require("react/jsx-runtime");
var DetailedDocument = ({ type, width, delay, x, y, frame, fps, rotation = 0 }) => {
  const height = width * 1.4;
  const entrance = (0, import_remotion7.spring)({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG
  });
  const floatY = (0, import_remotion7.interpolate)(
    frame,
    [delay, delay + 40, delay + 80],
    [0, -6, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const configs = {
    code: {
      bg: "#1a202c",
      header: "#4a5568",
      accent: "#68d391",
      icon: "</>",
      lines: ["#2d3748", "#374151", "#2d3748"]
    },
    resource: {
      bg: "#2c5282",
      header: "#3182ce",
      accent: "#90cdf4",
      icon: "\u{1F4E6}",
      lines: ["#2b6cb0", "#3182ce", "#2b6cb0"]
    },
    script: {
      bg: "#744210",
      header: "#d69e2e",
      accent: "#f6e05e",
      icon: "\u26A1",
      lines: ["#975a16", "#b7791f", "#975a16"]
    },
    manual: {
      bg: COLORS.background,
      header: COLORS.primary,
      accent: COLORS.accent,
      icon: "\u{1F4D6}",
      lines: ["#cbd5e0", "#a0aec0", "#cbd5e0"]
    }
  };
  const config = configs[type];
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y + floatY,
        transform: `scale(${entrance}) translateY(${(1 - entrance) * 40}px) rotate(${rotation}deg)`,
        opacity: entrance,
        filter: `drop-shadow(0 6px 16px rgba(0,0,0,0.2))`
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("svg", { width, height, viewBox: `0 0 ${width} ${height}`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("rect", { x: 6, y: 6, width: width - 6, height: height - 6, rx: 4, fill: "#6b7280" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("rect", { x: 3, y: 3, width: width - 6, height: height - 6, rx: 4, fill: "#9ca3af" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "rect",
          {
            x: 0,
            y: 0,
            width: width - 6,
            height: height - 6,
            rx: 6,
            fill: config.bg,
            stroke: config.header,
            strokeWidth: "2"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "rect",
          {
            x: 0,
            y: 0,
            width: width - 6,
            height: (height - 6) * 0.18,
            rx: 6,
            fill: config.header
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "rect",
          {
            x: 0,
            y: (height - 6) * 0.12,
            width: width - 6,
            height: (height - 6) * 0.06,
            fill: config.header
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "text",
          {
            x: (width - 6) / 2,
            y: (height - 6) * 0.12,
            textAnchor: "middle",
            fontSize: width * 0.18,
            fill: config.accent,
            fontFamily: "monospace",
            children: config.icon
          }
        ),
        [0.24, 0.3, 0.36, 0.42, 0.48, 0.54, 0.6, 0.66, 0.72, 0.78, 0.84].map(
          (yPos, i) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            "rect",
            {
              x: (width - 6) * 0.08,
              y: (height - 6) * yPos,
              width: (width - 6) * (0.4 + i % 5 * 0.1),
              height: (height - 6) * 0.035,
              rx: 2,
              fill: config.lines[i % 3]
            },
            i
          )
        )
      ] })
    }
  );
};
var Scene6 = ({ startFrame }) => {
  const frame = (0, import_remotion7.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion7.useVideoConfig)();
  const relativeFrame = frame - startFrame;
  const keySyncRelative = 106;
  const expansionProgress = (0, import_remotion7.interpolate)(
    relativeFrame,
    [0, 30, keySyncRelative],
    [0.8, 1, 1.1],
    { extrapolateRight: "clamp" }
  );
  const textProgress = (0, import_remotion7.spring)({
    frame: relativeFrame - 50,
    fps,
    config: SPRING_CONFIG
  });
  const emphasisProgress = (0, import_remotion7.spring)({
    frame: relativeFrame - keySyncRelative + 10,
    fps,
    config: SPRING_CONFIG
  });
  const docWidth = width * 0.22;
  const documents = [
    { type: "code", x: width * 0.05, y: height * 0.08, delay: 0, rotation: -3 },
    { type: "resource", x: width * 0.35, y: height * 0.05, delay: 8, rotation: 2 },
    { type: "script", x: width * 0.62, y: height * 0.1, delay: 16, rotation: -1 },
    { type: "manual", x: width * 0.12, y: height * 0.32, delay: 24, rotation: 1 },
    { type: "code", x: width * 0.42, y: height * 0.28, delay: 32, rotation: -2 },
    { type: "resource", x: width * 0.68, y: height * 0.34, delay: 40, rotation: 3 },
    { type: "script", x: width * 0.25, y: height * 0.52, delay: 48, rotation: -1 },
    { type: "manual", x: width * 0.55, y: height * 0.5, delay: 56, rotation: 2 }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_remotion7.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: width * 0.02,
          top: height * 0.02,
          opacity: 0.15
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("svg", { width: width * 0.18, height: height * 0.12, viewBox: "0 0 100 80", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("rect", { x: 0, y: 0, width: 100, height: 40, rx: 4, fill: "#cbd5e0" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("rect", { x: 0, y: 45, width: 100, height: 35, rx: 4, fill: "#e2e8f0" })
        ] })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          transform: `scale(${expansionProgress})`,
          transformOrigin: "center 40%"
        },
        children: documents.map((doc, i) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          DetailedDocument,
          {
            type: doc.type,
            width: docWidth,
            x: doc.x,
            y: doc.y,
            delay: doc.delay,
            frame: relativeFrame,
            fps,
            rotation: doc.rotation
          },
          i
        ))
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: height * 0.12,
          left: "50%",
          transform: `translateX(-50%) translateY(${(1 - textProgress) * 30}px)`,
          opacity: textProgress,
          textAlign: "center",
          width: "90%"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
          "p",
          {
            style: {
              fontFamily: "Georgia, serif",
              fontSize: height * 0.032,
              color: COLORS.primary,
              margin: 0,
              lineHeight: 1.5
            },
            children: [
              "Everything that's",
              " ",
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                "span",
                {
                  style: {
                    color: COLORS.accent,
                    fontWeight: "bold",
                    fontStyle: "italic",
                    transform: `scale(${1 + emphasisProgress * 0.1})`,
                    display: "inline-block"
                  },
                  children: "actually"
                }
              ),
              " ",
              "part of the skill"
            ]
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: height * 0.05,
          left: "50%",
          transform: "translateX(-50%)",
          opacity: textProgress * 0.7
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "p",
          {
            style: {
              fontFamily: "Georgia, serif",
              fontSize: height * 0.018,
              color: COLORS.secondary,
              margin: 0,
              fontStyle: "italic"
            },
            children: "scripts \u2022 resources \u2022 detailed instructions"
          }
        )
      }
    )
  ] });
};

// src/proj_d1f513d9_e7f9_4fa8_b907_52671c885c1b/scenes/Scene7.tsx
var import_remotion8 = require("remotion");
var import_jsx_runtime8 = require("react/jsx-runtime");
var DigitalModule = ({ width, glowIntensity }) => {
  const height = width * 0.6;
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
    "div",
    {
      style: {
        filter: `drop-shadow(0 0 ${20 * glowIntensity}px rgba(66, 153, 225, 0.6)) drop-shadow(0 0 ${40 * glowIntensity}px rgba(66, 153, 225, 0.3))`
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("svg", { width, height, viewBox: `0 0 ${width} ${height}`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("defs", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("linearGradient", { id: "moduleGradient", x1: "0%", y1: "0%", x2: "100%", y2: "100%", children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("stop", { offset: "0%", stopColor: "#2b6cb0" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("stop", { offset: "50%", stopColor: "#1a365d" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("stop", { offset: "100%", stopColor: "#2c5282" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("filter", { id: "innerGlow", children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("feGaussianBlur", { stdDeviation: "3", result: "blur" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("feComposite", { in: "SourceGraphic", in2: "blur", operator: "over" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "rect",
          {
            x: 0,
            y: 0,
            width,
            height,
            rx: 16,
            fill: "url(#moduleGradient)",
            stroke: "#4299e1",
            strokeWidth: "2"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "rect",
          {
            x: width * 0.08,
            y: height * 0.2,
            width: width * 0.35,
            height: height * 0.15,
            rx: 4,
            fill: "rgba(255,255,255,0.1)"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "rect",
          {
            x: width * 0.08,
            y: height * 0.42,
            width: width * 0.25,
            height: height * 0.1,
            rx: 3,
            fill: "rgba(255,255,255,0.08)"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "circle",
          {
            cx: width * 0.75,
            cy: height * 0.35,
            r: height * 0.18,
            fill: "none",
            stroke: "#4299e1",
            strokeWidth: "2"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "circle",
          {
            cx: width * 0.75,
            cy: height * 0.35,
            r: height * 0.08,
            fill: "#4299e1"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "line",
          {
            x1: width * 0.75,
            y1: height * 0.35 - height * 0.18,
            x2: width * 0.75,
            y2: height * 0.08,
            stroke: "#4299e1",
            strokeWidth: "2"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "line",
          {
            x1: width * 0.75 + height * 0.18,
            y1: height * 0.35,
            x2: width * 0.92,
            y2: height * 0.35,
            stroke: "#4299e1",
            strokeWidth: "2"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "circle",
          {
            cx: width * 0.12,
            cy: height * 0.78,
            r: 6,
            fill: "#68d391"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "text",
          {
            x: width * 0.18,
            y: height * 0.82,
            fill: "rgba(255,255,255,0.7)",
            fontSize: width * 0.05,
            fontFamily: "monospace",
            children: "SKILL MODULE"
          }
        )
      ] })
    }
  );
};
var MergingElement = ({ fromX, fromY, toX, toY, progress, color, size }) => {
  const currentX = (0, import_remotion8.interpolate)(progress, [0, 1], [fromX, toX], {
    extrapolateRight: "clamp"
  });
  const currentY = (0, import_remotion8.interpolate)(progress, [0, 1], [fromY, toY], {
    extrapolateRight: "clamp"
  });
  const scale = (0, import_remotion8.interpolate)(progress, [0, 0.8, 1], [1, 0.8, 0], {
    extrapolateRight: "clamp"
  });
  const opacity = (0, import_remotion8.interpolate)(progress, [0, 0.9, 1], [1, 0.8, 0], {
    extrapolateRight: "clamp"
  });
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: currentX,
        top: currentY,
        width: size,
        height: size * 0.8,
        backgroundColor: color,
        borderRadius: 4,
        transform: `scale(${scale})`,
        opacity,
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
      }
    }
  );
};
var Scene7 = ({ startFrame }) => {
  const frame = (0, import_remotion8.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion8.useVideoConfig)();
  const relativeFrame = frame - startFrame;
  const keySyncRelative = 4;
  const mergeProgress = (0, import_remotion8.spring)({
    frame: relativeFrame,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 100 },
    durationInFrames: 12
  });
  const moduleProgress = (0, import_remotion8.spring)({
    frame: relativeFrame - keySyncRelative,
    fps,
    config: SPRING_CONFIG
  });
  const glowIntensity = (0, import_remotion8.interpolate)(
    relativeFrame,
    [keySyncRelative, keySyncRelative + 8, 19],
    [0.5, 1, 0.8],
    { extrapolateRight: "clamp" }
  );
  const textProgress = (0, import_remotion8.spring)({
    frame: relativeFrame - 6,
    fps,
    config: SPRING_CONFIG
  });
  const moduleWidth = width * 0.7;
  const mergingElements = [
    { fromX: width * 0.05, fromY: height * 0.2, color: COLORS.background },
    { fromX: width * 0.1, fromY: height * 0.35, color: "#e8c36a" },
    { fromX: width * 0.75, fromY: height * 0.15, color: "#2d3748" },
    { fromX: width * 0.8, fromY: height * 0.3, color: "#f6e05e" },
    { fromX: width * 0.7, fromY: height * 0.4, color: "#2c5282" }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_remotion8.AbsoluteFill, { children: [
    mergingElements.map((el, i) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      MergingElement,
      {
        fromX: el.fromX,
        fromY: el.fromY,
        toX: width * 0.5 - 30,
        toY: height * 0.3,
        progress: mergeProgress,
        color: el.color,
        size: 50 - i * 5
      },
      i
    )),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.25,
          left: "50%",
          transform: `translateX(-50%) scale(${moduleProgress})`,
          opacity: moduleProgress
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(DigitalModule, { width: moduleWidth, glowIntensity })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: height * 0.18,
          left: "50%",
          transform: `translateX(-50%) translateY(${(1 - textProgress) * 20}px)`,
          opacity: textProgress,
          textAlign: "center",
          width: "85%"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
          "p",
          {
            style: {
              fontFamily: "Georgia, serif",
              fontSize: height * 0.035,
              color: COLORS.primary,
              margin: 0,
              lineHeight: 1.5
            },
            children: [
              "So",
              " ",
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { color: COLORS.accent, fontWeight: "bold" }, children: "instead" }),
              " ",
              "of loading..."
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
          bottom: height * 0.08,
          left: "50%",
          transform: "translateX(-50%)",
          opacity: textProgress * 0.6
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "p",
          {
            style: {
              fontFamily: "Georgia, serif",
              fontSize: height * 0.02,
              color: COLORS.secondary,
              margin: 0,
              fontStyle: "italic"
            },
            children: "efficient loading \u2022 modular design"
          }
        )
      }
    )
  ] });
};

// src/proj_d1f513d9_e7f9_4fa8_b907_52671c885c1b/index.tsx
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
      id: "proj_d1f513d9_e7f9_4fa8_b907_52671c885c1b",
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
