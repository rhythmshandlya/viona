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

// src/proj_8d76d4ee_c789_4bb8_9c02_8da51ee25f6a/Main.tsx
var Main_exports = {};
__export(Main_exports, {
  default: () => Main_default
});
module.exports = __toCommonJS(Main_exports);
var import_remotion = require("remotion");
var import_jsx_runtime = require("react/jsx-runtime");
var VisualContent = ({ frame, width, height }) => {
  const minDim = Math.min(width, height);
  const hue = (0, import_remotion.interpolate)(frame, [0, 300], [250, 290]);
  const bgStyle = {
    background: `linear-gradient(135deg, hsl(${hue}, 70%, 10%), hsl(${hue + 30}, 80%, 20%))`
  };
  const floatingParticles = Array.from({ length: 30 }).map((_, i) => {
    const floatY = (frame * (0.5 + i * 0.1) + i * 100) % (height * 1.5) - height * 0.25;
    const floatX = Math.sin(frame * 0.02 + i) * 30 + i / 30 * width;
    const particleOpacity = (0, import_remotion.interpolate)(floatY, [0, height * 0.5, height], [0, 0.4, 0]);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      position: "absolute",
      left: floatX,
      top: floatY,
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: "rgba(255,255,255,0.8)",
      opacity: particleOpacity,
      boxShadow: "0 0 10px rgba(139,92,246,0.8)"
    } }, i);
  });
  const words = "Imagine you're building a giveaway system".split(" ");
  const wordAnimation = words.map((word, i) => {
    const wordDelay = i * 8;
    const wordOpacity = (0, import_remotion.interpolate)(frame - wordDelay, [0, 15], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp"
    });
    const wordY = (0, import_remotion.interpolate)(frame - wordDelay, [0, 15], [40, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp"
    });
    const wordScale = (0, import_remotion.spring)({ frame: frame - wordDelay, fps: 30, config: { damping: 10, stiffness: 150 } });
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
      opacity: wordOpacity,
      transform: `translateY(${wordY}px) scale(${Math.max(0, wordScale)})`,
      fontSize: width * 0.06,
      fontWeight: 800,
      color: "white",
      textShadow: "0 0 30px rgba(139,92,246,0.8)"
    }, children: word }, i);
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: bgStyle, children: [
    floatingParticles,
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      padding: minDim * 0.04,
      gap: minDim * 0.025,
      boxSizing: "border-box"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
        flex: "0 0 auto",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: height * 0.08
      }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { style: {
        fontSize: width * 0.1,
        textAlign: "center",
        margin: 0,
        color: "white"
      }, children: "Giveaway Challenge" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
        flex: 1,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden"
      }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: width * 0.02
      }, children: wordAnimation }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
        flex: "0 0 auto",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: height * 0.06
      }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { fontSize: width * 0.05, textAlign: "center", margin: 0, color: "rgba(255,255,255,0.7)" }, children: "Millions of comments, one winner." }) })
    ] })
  ] });
};
var Main = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height } = (0, import_remotion.useVideoConfig)();
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VisualContent, { frame, width, height });
};
var Main_default = Main;
