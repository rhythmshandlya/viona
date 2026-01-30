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

// src/proj_dd09f8ea_e501_439a_b1cb_ba00a7664ac6/index.tsx
var index_exports = {};
__export(index_exports, {
  ProjDd09f8eaE501439aB1cbBa00a7664ac6: () => ProjDd09f8eaE501439aB1cbBa00a7664ac6
});
module.exports = __toCommonJS(index_exports);
var import_remotion5 = require("remotion");

// src/proj_dd09f8ea_e501_439a_b1cb_ba00a7664ac6/constants.ts
var COLORS = {
  background: "#0a0a0a",
  backgroundGradient: ["#0f0f1a", "#050505"],
  orange: "#f97316",
  yellow: "#eab308",
  pink: "#ec4899",
  green: "#22c55e",
  blue: "#3b82f6",
  text: "#FFFFFF",
  white: "#FFFFFF",
  gray: "rgba(255, 255, 255, 0.4)"
};
var FPS = 32;
var TIMING = {
  railifyStart: 0,
  railifyDuration: Math.floor(5.5 * FPS),
  transcriptStart: Math.floor(5.5 * FPS),
  transcriptDuration: Math.floor(8.5 * FPS),
  speedStart: Math.floor(14 * FPS),
  speedDuration: Math.floor(5.9 * FPS)
};

// src/proj_dd09f8ea_e501_439a_b1cb_ba00a7664ac6/components/LogoVisual.tsx
var import_remotion = require("remotion");
var import_jsx_runtime = require("react/jsx-runtime");
var LogoVisual = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const scale = (0, import_remotion.spring)({
    frame,
    fps,
    config: {
      damping: 10,
      stiffness: 200
    }
  });
  const float = Math.sin(frame / 15) * 40;
  const rotation = Math.sin(frame / 20) * 8;
  const pulse = (0, import_remotion.interpolate)(Math.sin(frame / 10), [-1, 1], [0.9, 1.1]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: {
    justifyContent: "center",
    alignItems: "center"
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      position: "absolute",
      width: "800px",
      height: "800px",
      background: `radial-gradient(circle, ${COLORS.orange}44 0%, transparent 70%)`,
      transform: `scale(${pulse * scale})`,
      borderRadius: "50%"
    } }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
      backgroundColor: COLORS.orange,
      borderRadius: "80px",
      padding: "100px 150px",
      transform: `scale(${scale}) translateY(${float}px) rotate(${rotation}deg)`,
      boxShadow: "0 40px 100px rgba(0, 0, 0, 0.6)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "40px",
      border: "6px solid rgba(255,255,255,0.3)"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
        fontSize: "180px",
        fontWeight: "900",
        color: COLORS.white,
        fontFamily: "Plus Jakarta Sans, Inter, system-ui, sans-serif",
        letterSpacing: "-4px",
        textShadow: "0 10px 20px rgba(0,0,0,0.2)"
      }, children: "Railify" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
        height: "24px",
        width: "100%",
        backgroundColor: COLORS.yellow,
        borderRadius: "12px",
        boxShadow: "inset 0 4px 8px rgba(0,0,0,0.2)"
      } })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      marginTop: "150px",
      fontSize: "70px",
      color: COLORS.white,
      fontWeight: "800",
      fontFamily: "Plus Jakarta Sans, Inter, system-ui, sans-serif",
      opacity: (0, import_remotion.interpolate)(frame, [0, 20], [0, 1]),
      transform: `translateY(${(0, import_remotion.interpolate)(frame, [0, 20], [40, 0])}px)`,
      textAlign: "center",
      textShadow: "0 4px 10px rgba(0,0,0,0.5)"
    }, children: "Testing transcripts..." })
  ] });
};

// src/proj_dd09f8ea_e501_439a_b1cb_ba00a7664ac6/components/TranscriptVisual.tsx
var import_remotion2 = require("remotion");
var import_jsx_runtime2 = require("react/jsx-runtime");
var Word = ({ word, index, activeIndex }) => {
  const { fps } = (0, import_remotion2.useVideoConfig)();
  const frame = (0, import_remotion2.useCurrentFrame)();
  const isActive = index === activeIndex;
  const pop = (0, import_remotion2.spring)({
    frame: frame - index * 2,
    // Faster stagger
    fps,
    config: {
      damping: 12,
      stiffness: 200
    }
  });
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    "span",
    {
      style: {
        display: "inline-block",
        marginRight: "25px",
        color: isActive ? COLORS.yellow : index < activeIndex ? COLORS.white : "rgba(255,255,255,0.3)",
        transform: `scale(${isActive ? 1.3 : pop})`,
        fontWeight: isActive ? "900" : "700",
        textShadow: isActive ? `0 0 20px ${COLORS.yellow}66` : "none",
        transition: "color 0.1s ease-out"
        // Small transition for color is usually okay if it's not the primary animation, but let's avoid it to be safe
      },
      children: word
    }
  );
};
var TranscriptVisual = () => {
  const frame = (0, import_remotion2.useCurrentFrame)();
  const { fps } = (0, import_remotion2.useVideoConfig)();
  const text = "generate transcripts for the exact time I am speaking";
  const words = text.split(" ");
  const activeWordIndex = Math.floor((0, import_remotion2.interpolate)(frame, [0, 240], [0, words.length], {
    extrapolateRight: "clamp"
  }));
  const entry = (0, import_remotion2.spring)({
    frame,
    fps,
    config: { damping: 15, stiffness: 100 }
  });
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_remotion2.AbsoluteFill, { style: {
    justifyContent: "center",
    alignItems: "center"
  }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
    width: "94%",
    padding: "80px",
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: "60px",
    border: "3px solid rgba(255,255,255,0.15)",
    backdropFilter: "blur(20px)",
    transform: `scale(${entry})`,
    opacity: entry,
    boxShadow: "0 40px 100px rgba(0,0,0,0.8)"
  }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
    fontSize: "90px",
    // Increased font size
    lineHeight: "1.3",
    fontFamily: "Plus Jakarta Sans, Inter, system-ui, sans-serif",
    textAlign: "center",
    color: COLORS.white
  }, children: words.map((word, i) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Word, { word, index: i, activeIndex: activeWordIndex }, i)) }) }) });
};

// src/proj_dd09f8ea_e501_439a_b1cb_ba00a7664ac6/components/SpeedVisual.tsx
var import_remotion3 = require("remotion");
var import_jsx_runtime3 = require("react/jsx-runtime");
var SpeedVisual = () => {
  const frame = (0, import_remotion3.useCurrentFrame)();
  const { fps, width } = (0, import_remotion3.useVideoConfig)();
  const fastX = (0, import_remotion3.interpolate)(frame % 15, [0, 15], [-250, width + 250]);
  const slowX = (0, import_remotion3.interpolate)(frame % 100, [0, 100], [-150, width + 150]);
  const entry = (0, import_remotion3.spring)({
    frame,
    fps,
    config: { damping: 15, stiffness: 100 }
  });
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_remotion3.AbsoluteFill, { style: {
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden"
  }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
    width: "94%",
    padding: "60px",
    opacity: entry,
    display: "flex",
    flexDirection: "column",
    gap: "120px",
    transform: `scale(${entry})`
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
      position: "relative",
      backgroundColor: "rgba(255, 255, 255, 0.05)",
      padding: "60px",
      borderRadius: "60px",
      border: "3px solid rgba(255, 255, 255, 0.1)",
      backdropFilter: "blur(15px)",
      boxShadow: "0 30px 60px rgba(0,0,0,0.5)"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
        fontSize: "90px",
        fontWeight: "900",
        color: COLORS.orange,
        marginBottom: "40px",
        fontFamily: "Plus Jakarta Sans, Inter, system-ui, sans-serif",
        display: "flex",
        alignItems: "center",
        gap: "30px",
        textShadow: "0 4px 10px rgba(0,0,0,0.5)"
      }, children: [
        "FAST ",
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { fontSize: "130px" }, children: "\u{1F680}" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
        width: "100%",
        height: "180px",
        background: "rgba(0,0,0,0.6)",
        borderRadius: "90px",
        position: "relative",
        overflow: "hidden",
        border: "2px solid rgba(255,255,255,0.1)"
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
          position: "absolute",
          width: "200%",
          height: "100%",
          background: "repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(255,255,255,0.05) 60px, rgba(255,255,255,0.05) 120px)",
          transform: `translateX(-${frame * 40 % 120}px)`
        } }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
          position: "absolute",
          left: fastX,
          top: "50%",
          transform: "translate(-50%, -50%)",
          fontSize: "150px",
          filter: "drop-shadow(0 0 30px rgba(249, 115, 22, 0.8))"
        }, children: "\u26A1" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
      position: "relative",
      backgroundColor: "rgba(255, 255, 255, 0.05)",
      padding: "60px",
      borderRadius: "60px",
      border: "3px solid rgba(255, 255, 255, 0.1)",
      backdropFilter: "blur(15px)",
      boxShadow: "0 30px 60px rgba(0,0,0,0.5)"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
        fontSize: "90px",
        fontWeight: "900",
        color: COLORS.green,
        marginBottom: "40px",
        fontFamily: "Plus Jakarta Sans, Inter, system-ui, sans-serif",
        display: "flex",
        alignItems: "center",
        gap: "30px",
        textShadow: "0 4px 10px rgba(0,0,0,0.5)"
      }, children: [
        "SLOW ",
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { fontSize: "130px" }, children: "\u{1F422}" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
        width: "100%",
        height: "180px",
        background: "rgba(0,0,0,0.6)",
        borderRadius: "90px",
        position: "relative",
        overflow: "hidden",
        border: "2px solid rgba(255,255,255,0.1)"
      }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
        position: "absolute",
        left: slowX,
        top: "50%",
        transform: "translate(-50%, -50%)",
        fontSize: "150px",
        filter: "drop-shadow(0 0 30px rgba(34, 197, 94, 0.8))"
      }, children: "\u{1F40C}" }) })
    ] })
  ] }) });
};

// src/proj_dd09f8ea_e501_439a_b1cb_ba00a7664ac6/components/Background.tsx
var import_remotion4 = require("remotion");
var import_jsx_runtime4 = require("react/jsx-runtime");
var Background = () => {
  const frame = (0, import_remotion4.useCurrentFrame)();
  const { width, height } = (0, import_remotion4.useVideoConfig)();
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_remotion4.AbsoluteFill, { style: {
    background: `radial-gradient(circle at 50% 50%, ${COLORS.backgroundGradient[0]}, ${COLORS.backgroundGradient[1]})`
  }, children: [
    [...Array(15)].map((_, i) => {
      const opacity = (0, import_remotion4.interpolate)(
        (frame + i * 40) % 200,
        [0, 100, 200],
        [0, 0.15, 0],
        { extrapolateRight: "clamp" }
      );
      const x = i * 379 % width;
      const y = i * 517 % height;
      const size = 100 + i * 50 % 300;
      const rotate = (0, import_remotion4.interpolate)(frame + i * 2, [0, 200], [0, 360]);
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: x - size / 2,
            top: y - size / 2,
            width: size,
            height: size,
            border: `2px solid ${COLORS.white}`,
            borderRadius: i % 2 === 0 ? "20%" : "50%",
            opacity,
            transform: `rotate(${rotate}deg) scale(${1 + Math.sin(frame / 30 + i) * 0.1})`
          }
        },
        i
      );
    }),
    [...Array(30)].map((_, i) => {
      const y = (frame * (1 + i % 3) + i * 100) % (height + 200) - 100;
      const x = i * 73 % width;
      const opacity = (0, import_remotion4.interpolate)(y, [-50, 0, height, height + 50], [0, 0.4, 0.4, 0]);
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: x,
            top: y,
            width: 4,
            height: 4,
            backgroundColor: i % 3 === 0 ? COLORS.orange : i % 3 === 1 ? COLORS.yellow : COLORS.white,
            borderRadius: "50%",
            opacity,
            boxShadow: `0 0 10px ${COLORS.white}`
          }
        },
        `p-${i}`
      );
    })
  ] });
};

// src/proj_dd09f8ea_e501_439a_b1cb_ba00a7664ac6/index.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
var ProjDd09f8eaE501439aB1cbBa00a7664ac6 = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_remotion5.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Background, {}),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_remotion5.Sequence, { from: TIMING.railifyStart, durationInFrames: TIMING.railifyDuration, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(LogoVisual, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_remotion5.Sequence, { from: TIMING.transcriptStart, durationInFrames: TIMING.transcriptDuration, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(TranscriptVisual, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_remotion5.Sequence, { from: TIMING.speedStart, durationInFrames: TIMING.speedDuration, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(SpeedVisual, {}) })
  ] });
};
