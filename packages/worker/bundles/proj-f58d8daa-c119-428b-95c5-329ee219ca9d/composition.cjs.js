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

// src/proj_f58d8daa_c119_428b_95c5_329ee219ca9d/Main.tsx
var Main_exports = {};
__export(Main_exports, {
  default: () => Main
});
module.exports = __toCommonJS(Main_exports);
var import_remotion6 = require("remotion");

// src/proj_f58d8daa_c119_428b_95c5_329ee219ca9d/scenes/scene_1.tsx
var import_remotion2 = require("remotion");

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
var SlideLeft = ({
  children,
  delay = 0,
  distance = 50,
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
  const translateX = (0, import_remotion.interpolate)(progress, [0, 1], [distance, 0]);
  const opacity = (0, import_remotion.interpolate)(progress, [0, 1], [0, 1]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
    transform: `translateX(${translateX}px)`,
    opacity
  }, children });
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
var FadeInDown = ({
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
  const translateY = (0, import_remotion.interpolate)(progress, [0, 1], [-distance, 0]);
  const opacity = (0, import_remotion.interpolate)(progress, [0, 0.6], [0, 1], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { transform: `translateY(${translateY}px)`, opacity }, children });
};
var ZoomIn = ({
  children,
  delay = 0,
  duration,
  style = "modern",
  speed = "normal"
}) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const dur = duration || PREMIUM_DURATIONS[style][speed];
  if (frame < delay) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { opacity: 0 }, children });
  const progress = (0, import_remotion.spring)({
    frame: frame - delay,
    fps,
    config: { damping: 14, stiffness: 100, mass: 1 },
    durationInFrames: dur
  });
  const scale = (0, import_remotion.interpolate)(progress, [0, 1], [0.3, 1]);
  const opacity = (0, import_remotion.interpolate)(progress, [0, 0.4], [0, 1], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { transform: `scale(${scale})`, opacity, transformOrigin: "center" }, children });
};
var Tada = ({
  children,
  delay = 0,
  duration = 30
}) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  if (frame < delay) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children });
  const elapsed = frame - delay;
  if (elapsed > duration) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children });
  const t = elapsed / duration;
  let scale;
  let rotate;
  if (t < 0.1) {
    scale = (0, import_remotion.interpolate)(t, [0, 0.1], [1, 0.9]);
    rotate = (0, import_remotion.interpolate)(t, [0, 0.1], [0, -3]);
  } else if (t < 0.3) {
    scale = (0, import_remotion.interpolate)(t, [0.1, 0.2], [0.9, 1.1]);
    rotate = Math.sin((t - 0.1) * Math.PI * 15) * 3;
  } else if (t < 0.8) {
    scale = 1.1;
    rotate = Math.sin((t - 0.1) * Math.PI * 10) * 3 * (1 - (t - 0.3) / 0.5);
  } else {
    scale = (0, import_remotion.interpolate)(t, [0.8, 1], [1.1, 1]);
    rotate = 0;
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
    transform: `scale(${scale}) rotate(${rotate}deg)`,
    transformOrigin: "center"
  }, children });
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

// src/proj_f58d8daa_c119_428b_95c5_329ee219ca9d/scenes/scene_1.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var BlueprintGrid = ({
  minDim,
  color
}) => {
  const gridSize = minDim * 0.05;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        width: "100%",
        height: "100%",
        backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`,
        backgroundSize: `${gridSize}px ${gridSize}px`,
        opacity: 0.2
      }
    }
  );
};
var PartLabel = ({ text, x, y, minDim }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        padding: `${minDim * 5e-3}px ${minDim * 0.015}px`,
        backgroundColor: "white",
        border: `1px solid #FF8C00`,
        borderRadius: minDim * 0.01,
        fontFamily: "monospace",
        fontSize: minDim * 0.02,
        color: "#555",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
      },
      children: text
    }
  );
};
function WorkshopScene() {
  const { width, height, fps } = (0, import_remotion2.useVideoConfig)();
  const frame = (0, import_remotion2.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const bgColor = "#F0F0F0";
  const primaryColor = "#FF8C00";
  const secondaryColor = "#007BFF";
  const accentColor = "#4CAF50";
  const carWidth = width * 0.6;
  const carHeight = height * 0.25;
  const carX = width * 0.1;
  const carY = height * 0.45;
  const roofSnapsAt = 45;
  const fillStartsAt = 60;
  const roofProgress = (0, import_remotion2.spring)({
    frame: frame - roofSnapsAt,
    fps,
    config: SPRING_CONFIGS.modern
  });
  const fillProgress = (0, import_remotion2.spring)({
    frame: frame - fillStartsAt,
    fps,
    config: SPRING_CONFIGS.modern
  });
  const wheels = [
    { x: carX + carWidth * 0.2, id: "WL-01" },
    { x: carX + carWidth * 0.8, id: "WL-02" }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_remotion2.AbsoluteFill, { style: { backgroundColor: bgColor }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(BlueprintGrid, { minDim, color: "#ccc" }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: carY + carHeight + minDim * 0.05,
          width: "100%",
          height: 4,
          backgroundColor: "#333",
          borderRadius: 2
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(FadeInDown, { delay: 0, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: height * 0.05,
          width: "100%",
          textAlign: "center",
          fontFamily: "Inter, system-ui, sans-serif"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "h1",
            {
              style: {
                fontSize: minDim * 0.06,
                color: "#333",
                margin: 0,
                fontWeight: 800,
                letterSpacing: "-1px"
              },
              children: "MODULAR ASSEMBLY"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "div",
            {
              style: {
                fontSize: minDim * 0.025,
                color: primaryColor,
                fontWeight: 600
              },
              children: "UNIT-ID: 8055-CAR-01"
            }
          )
        ]
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_remotion2.AbsoluteFill, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
        "svg",
        {
          viewBox: `0 0 ${width} ${height}`,
          style: { width: "100%", height: "100%" },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("filter", { id: "glow", x: "-20%", y: "-20%", width: "140%", height: "140%", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("feGaussianBlur", { stdDeviation: "5", result: "blur" }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("feComposite", { in: "SourceGraphic", in2: "blur", operator: "over" })
            ] }) }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "path",
              {
                d: `M ${carX} ${carY + carHeight} L ${carX + carWidth} ${carY + carHeight} L ${carX + carWidth} ${carY + carHeight * 0.6} L ${carX + carWidth * 0.7} ${carY + carHeight * 0.4} L ${carX + carWidth * 0.3} ${carY + carHeight * 0.4} L ${carX} ${carY + carHeight * 0.6} Z`,
                stroke: "#999",
                strokeWidth: "3",
                fill: "none",
                strokeDasharray: "10 5"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "path",
              {
                d: `M ${carX} ${carY + carHeight} L ${carX + carWidth} ${carY + carHeight} L ${carX + carWidth} ${carY + carHeight * 0.6} L ${carX} ${carY + carHeight * 0.6} Z`,
                fill: primaryColor,
                opacity: fillProgress * 0.9
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "rect",
              {
                x: carX + carWidth * 0.25,
                y: carY + carHeight * 0.4,
                width: carWidth * 0.5,
                height: carHeight * 0.2,
                fill: secondaryColor,
                opacity: fillProgress * 0.8
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "g",
              {
                transform: `translate(0, ${(0, import_remotion2.interpolate)(
                  roofProgress,
                  [0, 1],
                  [-200, 0]
                )})`,
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                    "path",
                    {
                      d: `M ${carX + carWidth * 0.3} ${carY + carHeight * 0.4} L ${carX + carWidth * 0.4} ${carY + carHeight * 0.2} L ${carX + carWidth * 0.6} ${carY + carHeight * 0.2} L ${carX + carWidth * 0.7} ${carY + carHeight * 0.4} Z`,
                      fill: accentColor,
                      stroke: "white",
                      strokeWidth: "4"
                    }
                  ),
                  frame > roofSnapsAt && frame < roofSnapsAt + 30 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(GlowPulse, { speed: "fast", delay: 0, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                    "circle",
                    {
                      cx: carX + carWidth * 0.5,
                      cy: carY + carHeight * 0.3,
                      r: minDim * 0.05,
                      fill: "yellow",
                      opacity: 0.3
                    }
                  ) })
                ]
              }
            )
          ]
        }
      ),
      wheels.map((wheel, i) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_remotion2.Sequence, { from: 0, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: wheel.x - minDim * 0.045,
            top: carY + carHeight - minDim * 0.045
          },
          children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ZoomIn, { delay: i * 10, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "div",
            {
              style: {
                width: minDim * 0.09,
                height: minDim * 0.09,
                borderRadius: "50%",
                border: `8px solid #333`,
                backgroundColor: "#555",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                boxShadow: "0 4px 8px rgba(0,0,0,0.3)"
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                "div",
                {
                  style: {
                    width: "40%",
                    height: "40%",
                    borderRadius: "50%",
                    backgroundColor: "#ccc"
                  }
                }
              )
            }
          ) })
        }
      ) }, wheel.id)),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(BounceIn, { delay: 70, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        PartLabel,
        {
          text: "PN-455 (ROOF)",
          x: carX + carWidth * 0.4,
          y: carY + carHeight * 0.15,
          minDim
        }
      ) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(BounceIn, { delay: 80, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        PartLabel,
        {
          text: "CH-SEC-A",
          x: carX - minDim * 0.05,
          y: carY + carHeight * 0.6,
          minDim
        }
      ) })
    ] }),
    frame > 110 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      import_remotion2.AbsoluteFill,
      {
        style: {
          top: carY - minDim * 0.1,
          left: carX + carWidth * 0.2,
          width: "fit-content",
          height: "fit-content"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Tada, { delay: 0, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 20px",
              background: "white",
              borderRadius: 20,
              boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
              border: `2px solid ${accentColor}`
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                "svg",
                {
                  viewBox: "0 0 24 24",
                  width: minDim * 0.03,
                  height: minDim * 0.03,
                  fill: accentColor,
                  children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" })
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                "span",
                {
                  style: {
                    fontWeight: "bold",
                    color: "#333",
                    fontSize: minDim * 0.02
                  },
                  children: "ASSEMBLY COMPLETE"
                }
              )
            ]
          }
        ) })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: height * 0.1,
          width: "100%",
          padding: `0 ${width * 0.1}px`,
          textAlign: "center"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(FadeInUp, { delay: 100, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "div",
          {
            style: {
              backgroundColor: "rgba(255, 255, 255, 0.9)",
              padding: minDim * 0.03,
              borderRadius: minDim * 0.02,
              boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
              border: "1px solid #ddd"
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "p",
              {
                style: {
                  fontSize: minDim * 0.025,
                  color: "#444",
                  margin: 0,
                  fontStyle: "italic",
                  lineHeight: 1.4
                },
                children: '"Wow, what a cool looking car now. The final modules have been successfully integrated into the chassis."'
              }
            )
          }
        ) })
      }
    )
  ] });
}

// src/proj_f58d8daa_c119_428b_95c5_329ee219ca9d/scenes/scene_2.tsx
var import_remotion3 = require("remotion");
var import_jsx_runtime3 = require("react/jsx-runtime");
var CarGraphic = ({
  width,
  height,
  color = "#FF8C00",
  isWireframe = false,
  opacity = 1
}) => {
  const strokeWidth = width * 0.015;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { width, height, position: "relative", opacity }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("svg", { width: "100%", height: "100%", viewBox: "0 0 200 120", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "rect",
      {
        x: "20",
        y: "50",
        width: "160",
        height: "40",
        rx: "10",
        fill: isWireframe ? "transparent" : color,
        stroke: color,
        strokeWidth
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "path",
      {
        d: "M 50 50 L 70 20 L 130 20 L 150 50 Z",
        fill: isWireframe ? "transparent" : "#007BFF",
        stroke: isWireframe ? color : "#007BFF",
        strokeWidth
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "circle",
      {
        cx: "55",
        cy: "95",
        r: "18",
        fill: isWireframe ? "transparent" : "#333",
        stroke: color,
        strokeWidth
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "circle",
      {
        cx: "145",
        cy: "95",
        r: "18",
        fill: isWireframe ? "transparent" : "#333",
        stroke: color,
        strokeWidth
      }
    ),
    !isWireframe && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M 75 25 L 125 25 L 140 45 L 60 45 Z", fill: "#fff", opacity: "0.3" })
  ] }) });
};
function WorkshopScene2() {
  const { width, height, fps } = (0, import_remotion3.useVideoConfig)();
  const frame = (0, import_remotion3.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const panStartFrame = 40;
  const panProgress = (0, import_remotion3.spring)({
    frame: frame - panStartFrame,
    fps,
    config: { damping: 20, stiffness: 30 }
  });
  const gridOffset = (0, import_remotion3.interpolate)(panProgress, [0, 1], [0, -width * 0.7]);
  const carX = (0, import_remotion3.interpolate)(panProgress, [0, 1], [width * 0.2, -width * 0.3]);
  const glintProgress = (0, import_remotion3.interpolate)(frame, [10, 25, 40], [-100, 200, 200]);
  const silhouetteX = (0, import_remotion3.interpolate)(panProgress, [0.3, 1], [width * 1.2, width * 0.6]);
  const silhouetteOpacity = (0, import_remotion3.interpolate)(panProgress, [0.3, 0.6], [0, 0.6]);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_remotion3.AbsoluteFill, { style: { backgroundColor: "#F0F0F0", overflow: "hidden" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          width: width * 3,
          height,
          left: gridOffset,
          backgroundImage: `
						linear-gradient(to right, #D1D1D1 1px, transparent 1px),
						linear-gradient(to bottom, #D1D1D1 1px, transparent 1px)
					`,
          backgroundSize: `${minDim * 0.1}px ${minDim * 0.1}px`,
          zIndex: 0
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
      position: "absolute",
      top: height * 0.05,
      width: "100%",
      textAlign: "center",
      zIndex: 10
    }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("h1", { style: {
      fontSize: height * 0.04,
      color: "#333",
      fontFamily: "sans-serif",
      margin: 0
    }, children: [
      "Assembly Stage: ",
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { color: "#4CAF50" }, children: "Verified" })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_remotion3.AbsoluteFill, { style: { display: "flex", alignItems: "center", justifyContent: "flex-start" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { position: "absolute", left: carX, top: height * 0.4 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(GlowPulse, { speed: "slow", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Tada, { delay: 10, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(CarGraphic, { width: minDim * 0.6, height: minDim * 0.4 }) }) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          overflow: "hidden",
          pointerEvents: "none"
        }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
          width: "20%",
          height: "200%",
          background: "rgba(255,255,255,0.4)",
          transform: `translateX(${glintProgress}%) rotate(25deg)`,
          position: "absolute",
          top: "-50%"
        } }) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(FadeIn, { delay: 20, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
          marginTop: minDim * 0.02,
          backgroundColor: "rgba(255,255,255,0.9)",
          padding: "8px 16px",
          borderRadius: 8,
          border: "2px solid #FF8C00",
          fontFamily: "monospace",
          fontSize: height * 0.015
        }, children: "UNIT: MOD-CAR-X1 // STATUS: COMPLETE" }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { position: "absolute", left: silhouetteX, top: height * 0.45 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          CarGraphic,
          {
            width: minDim * 0.5,
            height: minDim * 0.3,
            color: "#007BFF",
            isWireframe: true,
            opacity: silhouetteOpacity
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
          marginTop: minDim * -0.05,
          marginLeft: minDim * 0.1,
          color: "#007BFF",
          fontFamily: "monospace",
          fontSize: height * 0.02,
          opacity: silhouetteOpacity,
          fontWeight: "bold"
        }, children: "> NEW_PROJECT_DETECTED" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
      position: "absolute",
      top: height * 0.7,
      width: "100%",
      height: 4,
      backgroundColor: "#333",
      opacity: 0.5
    } }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
      position: "absolute",
      bottom: height * 0.1,
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: height * 0.02
    }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
      width: width * 0.8,
      height: height * 0.1,
      backgroundColor: "white",
      borderRadius: 20,
      boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
      display: "flex",
      alignItems: "center",
      padding: `0 ${width * 0.05}px`,
      border: "1px solid #EEE"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
        width: 12,
        height: 12,
        borderRadius: "50%",
        backgroundColor: "#4CAF50",
        marginRight: 15
      } }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { style: {
        fontSize: height * 0.02,
        color: "#666",
        fontFamily: "sans-serif"
      }, children: "Workspace Active: Panning to adjacent project module..." })
    ] }) })
  ] });
}

// src/proj_f58d8daa_c119_428b_95c5_329ee219ca9d/scenes/scene_3.tsx
var import_remotion4 = require("remotion");
var import_jsx_runtime4 = require("react/jsx-runtime");
var WorkshopScene3 = () => {
  const { width, height } = (0, import_remotion4.useVideoConfig)();
  const frame = (0, import_remotion4.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const colors = {
    background: "#F0F0F0",
    primary: "#FF8C00",
    // Orange (First car)
    secondary: "#007BFF",
    // Blue (Brad's car)
    accent: "#4CAF50",
    // Success/Progress
    grid: "#E0E0E0",
    text: "#333333"
  };
  const panProgress = (0, import_remotion4.interpolate)(frame, [0, 150], [0, -width], {
    extrapolateRight: "clamp",
    easing: import_remotion4.Easing.bezier(0.4, 0, 0.2, 1)
  });
  const carWidth = width * 0.6;
  const carHeight = height * 0.15;
  const groundY = height * 0.7;
  const assemblyProgress = (0, import_remotion4.interpolate)(frame, [40, 180], [0.3, 0.85], {
    extrapolateRight: "clamp"
  });
  const toolY = (0, import_remotion4.interpolate)(Math.sin(frame * 0.1), [-1, 1], [-10, 10]);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_remotion4.AbsoluteFill, { style: { backgroundColor: colors.background, overflow: "hidden" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          width: width * 3,
          height,
          left: panProgress,
          backgroundImage: `
            linear-gradient(${colors.grid} 1px, transparent 1px),
            linear-gradient(90deg, ${colors.grid} 1px, transparent 1px)
          `,
          backgroundSize: `${minDim * 0.05}px ${minDim * 0.05}px`
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: groundY,
          width: width * 3,
          height: 4,
          backgroundColor: "#CCCCCC",
          left: panProgress
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { position: "absolute", left: panProgress, width: width * 2, height }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { position: "absolute", left: width * 0.2, top: groundY - carHeight }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
          width: carWidth,
          height: carHeight,
          backgroundColor: `${colors.primary}33`,
          border: `3px solid ${colors.primary}`,
          borderRadius: minDim * 0.02,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { color: colors.primary, fontWeight: "bold", fontSize: minDim * 0.03 }, children: "COMPLETED" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { position: "absolute", bottom: -minDim * 0.04, left: carWidth * 0.15, width: minDim * 0.08, height: minDim * 0.08, borderRadius: "50%", backgroundColor: "#333" } }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { position: "absolute", bottom: -minDim * 0.04, right: carWidth * 0.15, width: minDim * 0.08, height: minDim * 0.08, borderRadius: "50%", backgroundColor: "#333" } })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { position: "absolute", left: width * 1.2, top: groundY - carHeight }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(GlowPulse, { color: colors.secondary, style: { borderRadius: minDim * 0.02 }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: {
          width: carWidth,
          height: carHeight,
          backgroundColor: `${colors.secondary}11`,
          border: `3px dashed ${colors.secondary}`,
          borderRadius: minDim * 0.02,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative"
        }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
            width: carWidth * assemblyProgress,
            height: carHeight * 0.4,
            backgroundColor: colors.secondary,
            borderRadius: minDim * 0.01,
            opacity: 0.8
          } }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { position: "absolute", top: -height * 0.1, transform: `translateY(${toolY}px)` }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Tada, { delay: 20, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("svg", { viewBox: "0 0 24 24", width: minDim * 0.1, height: minDim * 0.1, fill: "none", stroke: colors.secondary, strokeWidth: "2", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" }) }) }) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
            position: "absolute",
            bottom: -height * 0.08,
            width: "100%",
            height: height * 0.02,
            backgroundColor: "#ddd",
            borderRadius: 10,
            overflow: "hidden"
          }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
            width: `${assemblyProgress * 100}%`,
            height: "100%",
            backgroundColor: colors.accent,
            transition: "width 0.1s linear"
          } }) })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { position: "absolute", top: -height * 0.15, width: "100%", textAlign: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ScaleIn, { delay: 50, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
          backgroundColor: "#FFF",
          padding: `${minDim * 0.01}px ${minDim * 0.03}px`,
          borderRadius: 20,
          boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          border: `1px solid ${colors.secondary}`
        }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { color: colors.secondary, fontWeight: "bold", fontSize: minDim * 0.035 }, children: "MODULE B-72: ASSEMBLY IN PROGRESS" }) }) }) })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_remotion4.AbsoluteFill, { style: { height: height * 0.15, justifyContent: "center", alignItems: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SlideLeft, { delay: 30, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
      backgroundColor: "rgba(255,255,255,0.9)",
      padding: `${minDim * 0.02}px ${minDim * 0.05}px`,
      borderRadius: minDim * 0.01,
      borderBottom: `4px solid ${colors.secondary}`
    }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h1", { style: {
      margin: 0,
      fontSize: minDim * 0.05,
      color: colors.text,
      fontFamily: "sans-serif"
    }, children: "Collaborative Workshop Floor" }) }) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_remotion4.AbsoluteFill, { style: { top: height * 0.85, height: height * 0.15, justifyContent: "center", alignItems: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(FadeIn, { delay: 100, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: {
      display: "flex",
      alignItems: "center",
      gap: minDim * 0.02,
      backgroundColor: "white",
      padding: minDim * 0.02,
      borderRadius: 12
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { width: 12, height: 12, borderRadius: "50%", backgroundColor: colors.secondary } }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { fontSize: minDim * 0.035, color: "#666", fontWeight: 500 }, children: "Connecting to peer workstation..." })
    ] }) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
      position: "absolute",
      top: (0, import_remotion4.interpolate)(frame % 50, [0, 50], [0, height]),
      width: "100%",
      height: 2,
      background: "rgba(0, 123, 255, 0.1)",
      pointerEvents: "none"
    } })
  ] });
};
var scene_3_default = WorkshopScene3;

// src/proj_f58d8daa_c119_428b_95c5_329ee219ca9d/scenes/scene_4.tsx
var import_remotion5 = require("remotion");
var import_jsx_runtime5 = require("react/jsx-runtime");
var Scene4 = () => {
  const { width, height, fps } = (0, import_remotion5.useVideoConfig)();
  const frame = (0, import_remotion5.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const bgColor = "#F0F0F0";
  const primaryColor = "#FF8C00";
  const secondaryColor = "#007BFF";
  const accentColor = "#4CAF50";
  const avatarEntryStart = 20;
  const handshakeStart = 80;
  const labelRevealStart = 110;
  const zoom = (0, import_remotion5.interpolate)(frame, [0, 60], [1, 0.85], {
    extrapolateRight: "clamp"
  });
  const sprConfig = { damping: 15, stiffness: 60 };
  const orangeX = (0, import_remotion5.interpolate)(
    (0, import_remotion5.spring)({ frame: frame - avatarEntryStart, fps, config: sprConfig }),
    [0, 1],
    [-width * 0.2, width * 0.25]
  );
  const blueX = (0, import_remotion5.interpolate)(
    (0, import_remotion5.spring)({ frame: frame - avatarEntryStart, fps, config: sprConfig }),
    [0, 1],
    [width * 0.5, width * 0.75]
  );
  const lineProgress = (0, import_remotion5.spring)({
    frame: frame - handshakeStart,
    fps,
    config: { damping: 20, stiffness: 100 }
  });
  const Car = ({ color, x, y, scale = 1 }) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale})`,
        width: minDim * 0.4,
        height: minDim * 0.2
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("svg", { viewBox: "0 0 200 100", style: { width: "100%", height: "100%" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("rect", { x: "20", y: "40", width: "160", height: "40", rx: "10", fill: color, fillOpacity: "0.2", stroke: color, strokeWidth: "3" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("rect", { x: "50", y: "15", width: "100", height: "30", rx: "15", fill: color, fillOpacity: "0.1", stroke: color, strokeWidth: "3" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("circle", { cx: "55", cy: "80", r: "15", fill: bgColor, stroke: color, strokeWidth: "3" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("circle", { cx: "145", cy: "80", r: "15", fill: bgColor, stroke: color, strokeWidth: "3" })
      ] })
    }
  );
  const Avatar = ({ color, label, side }) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: minDim * 0.02 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "div",
      {
        style: {
          width: minDim * 0.15,
          height: minDim * 0.15,
          borderRadius: "50%",
          background: color,
          border: `${minDim * 0.01}px solid white`,
          boxShadow: "0 10px 20px rgba(0,0,0,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("svg", { viewBox: "0 0 24 24", width: "60%", height: "60%", fill: "white", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("path", { d: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" }) })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "div",
      {
        style: {
          background: "white",
          padding: `${minDim * 0.01}px ${minDim * 0.03}px`,
          borderRadius: minDim * 0.05,
          border: `2px solid ${color}`,
          fontWeight: "bold",
          fontSize: minDim * 0.035,
          color: "#333",
          boxShadow: "0 4px 10px rgba(0,0,0,0.05)"
        },
        children: label
      }
    )
  ] });
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_remotion5.AbsoluteFill, { style: { backgroundColor: bgColor, overflow: "hidden" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          width: "100%",
          height: "100%",
          backgroundImage: `radial-gradient(#d1d1d1 1px, transparent 1px)`,
          backgroundSize: `${minDim * 0.05}px ${minDim * 0.05}px`,
          opacity: 0.5
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: height * 0.2,
          width: "100%",
          height: 2,
          background: "#ccc"
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "div",
      {
        style: {
          flex: 1,
          display: "flex",
          flexDirection: "column",
          transform: `scale(${zoom})`,
          transformOrigin: "center center"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { height: height * 0.15, padding: minDim * 0.05, textAlign: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(FadeIn, { children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h1", { style: {
            fontSize: minDim * 0.06,
            color: "#333",
            margin: 0,
            fontFamily: "sans-serif",
            textTransform: "uppercase",
            letterSpacing: 2
          }, children: "Social Interaction" }) }) }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { flex: 1, position: "relative" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Car, { color: secondaryColor, x: blueX, y: height * 0.45 }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Car, { color: primaryColor, x: orangeX, y: height * 0.45 }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "svg",
              {
                style: {
                  position: "absolute",
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none"
                },
                children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "line",
                  {
                    x1: orangeX,
                    y1: height * 0.65,
                    x2: orangeX + (blueX - orangeX) * lineProgress,
                    y2: height * 0.65,
                    stroke: accentColor,
                    strokeWidth: minDim * 0.01,
                    strokeDasharray: "10 10"
                  }
                )
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "div",
              {
                style: {
                  position: "absolute",
                  left: orangeX,
                  top: height * 0.65,
                  transform: "translate(-50%, -50%)"
                },
                children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(BounceIn, { delay: 20, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Avatar, { color: primaryColor, label: "Blippi", side: "left" }) })
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "div",
              {
                style: {
                  position: "absolute",
                  left: blueX,
                  top: height * 0.65,
                  transform: "translate(-50%, -50%)"
                },
                children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ScaleIn, { delay: 40, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Avatar, { color: secondaryColor, label: "Brad", side: "right" }) })
              }
            ),
            frame > handshakeStart && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "div",
              {
                style: {
                  position: "absolute",
                  left: (orangeX + blueX) / 2,
                  top: height * 0.65,
                  transform: "translate(-50%, -50%)"
                },
                children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_remotion5.Sequence, { from: 0, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Tada, { children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "div",
                  {
                    style: {
                      width: minDim * 0.12,
                      height: minDim * 0.12,
                      background: "white",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: `0 0 ${minDim * 0.05}px ${accentColor}`,
                      border: `4px solid ${accentColor}`
                    },
                    children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("svg", { viewBox: "0 0 24 24", width: "70%", height: "70%", fill: accentColor, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("path", { d: "M23 8h-3v4l-3-3-3 3V8h-3v14h12V8zm-1 12h-4v-7l1 1 1-1v7h2v-7l1 1 1-1v7zm-5-11h-2v2h2V9zM8 8H5v4l-3-3-3 3V8h-3v14h12V8zM7 20H3v-7l1 1 1-1v7h2v-7l1 1 1-1v7z" }) })
                  }
                ) }) })
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
            "div",
            {
              style: {
                height: height * 0.25,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                gap: minDim * 0.02
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { opacity: frame > labelRevealStart ? 1 : 0, transition: "opacity 0.5s" }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(GlowPulse, { color: accentColor, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "div",
                  {
                    style: {
                      background: "rgba(76, 175, 80, 0.1)",
                      padding: `${minDim * 0.02}px ${minDim * 0.05}px`,
                      borderRadius: minDim * 0.02,
                      border: `2px solid ${accentColor}`,
                      color: accentColor,
                      fontSize: minDim * 0.04,
                      fontWeight: "bold",
                      fontFamily: "monospace"
                    },
                    children: "MODULAR COLLABORATION ACTIVE"
                  }
                ) }) }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(FadeIn, { delay: 140, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "div",
                  {
                    style: {
                      fontSize: minDim * 0.035,
                      color: "#666",
                      maxWidth: "80%",
                      textAlign: "center",
                      fontStyle: "italic"
                    },
                    children: "Technical knowledge is exchanged through shared workspace interaction."
                  }
                ) })
              ]
            }
          )
        ]
      }
    )
  ] });
};
var scene_4_default = Scene4;

// src/proj_f58d8daa_c119_428b_95c5_329ee219ca9d/Main.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
function Main() {
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_remotion6.AbsoluteFill, { style: { background: "#F0F0F0" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_remotion6.Sequence, { from: 0, durationInFrames: 175, name: "scene_1", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(WorkshopScene, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_remotion6.Sequence, { from: 175, durationInFrames: 150, name: "scene_2", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(WorkshopScene2, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_remotion6.Sequence, { from: 325, durationInFrames: 200, name: "scene_3", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(scene_3_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_remotion6.Sequence, { from: 525, durationInFrames: 212, name: "scene_4", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(scene_4_default, {}) })
  ] });
}
