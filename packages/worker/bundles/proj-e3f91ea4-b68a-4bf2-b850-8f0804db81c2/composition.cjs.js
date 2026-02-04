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

// src/proj_e3f91ea4_b68a_4bf2_b850_8f0804db81c2/Main.tsx
var Main_exports = {};
__export(Main_exports, {
  default: () => Main
});
module.exports = __toCommonJS(Main_exports);
var import_remotion = require("remotion");
var import_jsx_runtime = require("react/jsx-runtime");
function Main() {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height, fps } = (0, import_remotion.useVideoConfig)();
  const hue = (0, import_remotion.interpolate)(frame, [0, 300], [250, 290]);
  const titleOpacity = (0, import_remotion.interpolate)(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });
  const titleY = (0, import_remotion.interpolate)(frame, [0, 40], [80, 0], { extrapolateRight: "clamp" });
  const titleScale = (0, import_remotion.spring)({ frame, fps, config: { damping: 12, stiffness: 100 } });
  const pulse = Math.sin(frame * 0.08) * 0.15 + 1;
  const particles = Array.from({ length: 40 }).map((_, i) => {
    const speed = 0.3 + i % 5 * 0.15;
    const floatY = (frame * speed + i * 60) % (height * 1.3) - height * 0.15;
    const floatX = Math.sin(frame * 0.015 + i * 0.5) * 40 + i / 40 * width;
    const size = 3 + i % 5 * 2;
    const particleOpacity = (0, import_remotion.interpolate)(floatY, [-50, height * 0.3, height * 0.7, height + 50], [0, 0.6, 0.6, 0]);
    return { x: floatX, y: floatY, size, opacity: particleOpacity };
  });
  const words = "System Design Challenge".split(" ");
  const orbitElements = Array.from({ length: 8 }).map((_, i) => {
    const angle = frame * 0.015 + i / 8 * Math.PI * 2;
    const orbitRadius = Math.min(width, height) * 0.25;
    const x = Math.cos(angle) * orbitRadius;
    const y = Math.sin(angle) * orbitRadius * 0.4;
    const elementOpacity = (0, import_remotion.interpolate)(frame, [60 + i * 10, 80 + i * 10], [0, 0.8], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return { x, y, opacity: elementOpacity };
  });
  const progressStart = 120;
  const progress = (0, import_remotion.interpolate)(frame, [progressStart, progressStart + 120], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const counterValue = Math.floor((0, import_remotion.interpolate)(frame, [progressStart, progressStart + 120], [0, 1e6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const subtitleOpacity = (0, import_remotion.interpolate)(frame, [180, 210], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const subtitleY = (0, import_remotion.interpolate)(frame, [180, 220], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: {
    background: `linear-gradient(135deg, hsl(${hue}, 70%, 8%), hsl(${hue + 40}, 60%, 15%), hsl(${hue}, 80%, 12%))`
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: "50%",
          top: "45%",
          width: width * 0.7 * pulse,
          height: width * 0.7 * pulse,
          transform: "translate(-50%, -50%)",
          background: "radial-gradient(circle, rgba(139,92,246,0.25) 0%, rgba(6,182,212,0.1) 40%, transparent 70%)",
          borderRadius: "50%"
        }
      }
    ),
    particles.map((p, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: p.x,
          top: p.y,
          width: p.size,
          height: p.size,
          borderRadius: "50%",
          background: i % 3 === 0 ? "#8b5cf6" : i % 3 === 1 ? "#06b6d4" : "#ec4899",
          opacity: p.opacity,
          boxShadow: `0 0 ${p.size * 2}px currentColor`
        }
      },
      i
    )),
    orbitElements.map((el, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: "50%",
          top: "42%",
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${i % 2 === 0 ? "#8b5cf6" : "#06b6d4"}, ${i % 2 === 0 ? "#06b6d4" : "#ec4899"})`,
          transform: `translate(calc(-50% + ${el.x}px), calc(-50% + ${el.y}px))`,
          opacity: el.opacity,
          boxShadow: "0 0 20px rgba(139,92,246,0.6)"
        }
      },
      `orbit-${i}`
    )),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: width * 0.06,
          gap: height * 0.04
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: width * 0.025,
                opacity: titleOpacity,
                transform: `translateY(${titleY}px)`
              },
              children: words.map((word, i) => {
                const wordDelay = i * 12;
                const wordOpacity = (0, import_remotion.interpolate)(frame - wordDelay, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                const wordY = (0, import_remotion.interpolate)(frame - wordDelay, [0, 20], [50, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                const wordScale = (0, import_remotion.spring)({ frame: frame - wordDelay, fps, config: { damping: 10, stiffness: 120 } });
                return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "span",
                  {
                    style: {
                      fontSize: width * 0.09,
                      fontWeight: 900,
                      color: "white",
                      opacity: wordOpacity,
                      transform: `translateY(${wordY}px) scale(${Math.max(0, wordScale)})`,
                      textShadow: "0 0 60px rgba(139,92,246,0.8), 0 0 120px rgba(6,182,212,0.4)",
                      letterSpacing: "-0.02em"
                    },
                    children: word
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
                fontSize: width * 0.15,
                fontWeight: 900,
                background: "linear-gradient(135deg, #8b5cf6, #06b6d4, #ec4899)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                opacity: (0, import_remotion.interpolate)(frame, [100, 130], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                transform: `scale(${(0, import_remotion.spring)({ frame: frame - 100, fps, config: { damping: 12 } })})`,
                textShadow: "0 0 80px rgba(139,92,246,0.5)"
              },
              children: counterValue.toLocaleString()
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                width: "70%",
                height: 12,
                background: "rgba(255,255,255,0.1)",
                borderRadius: 6,
                overflow: "hidden",
                opacity: (0, import_remotion.interpolate)(frame, [progressStart - 20, progressStart], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                boxShadow: "inset 0 2px 4px rgba(0,0,0,0.3)"
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "div",
                {
                  style: {
                    width: `${progress}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #8b5cf6, #06b6d4, #22c55e)",
                    borderRadius: 6,
                    boxShadow: "0 0 20px rgba(139,92,246,0.6)"
                  }
                }
              )
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "p",
            {
              style: {
                fontSize: width * 0.04,
                color: "rgba(255,255,255,0.8)",
                textAlign: "center",
                margin: 0,
                opacity: subtitleOpacity,
                transform: `translateY(${subtitleY}px)`,
                maxWidth: "80%"
              },
              children: "Organizing millions of tasks with elegant efficiency"
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
          bottom: 0,
          left: 0,
          right: 0,
          height: height * 0.15,
          background: "linear-gradient(to top, rgba(0,0,0,0.4), transparent)"
        }
      }
    )
  ] });
}
