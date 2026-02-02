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

// src/proj_c9b2ab0e_8fbc_4e9a_a15e_252f94536675/index.tsx
var index_exports = {};
__export(index_exports, {
  ProjC9b2ab0e8fbc4e9aA15e252f94536675: () => ProjC9b2ab0e8fbc4e9aA15e252f94536675
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");
var import_remotion = require("remotion");

// src/proj_c9b2ab0e_8fbc_4e9a_a15e_252f94536675/constants.ts
var COLORS = {
  bg: "#0f0f23",
  primary: "#8b5cf6",
  secondary: "#3b82f6",
  accent: "#06b6d4",
  success: "#22c55e",
  warning: "#eab308",
  danger: "#ef4444",
  white: "#ffffff",
  text: "#e2e8f0",
  muted: "#64748b",
  glass: "rgba(255, 255, 255, 0.1)",
  glassBorder: "rgba(255, 255, 255, 0.2)"
};
var SPRING_SETTLED = { damping: 22, stiffness: 90, mass: 0.9 };

// src/proj_c9b2ab0e_8fbc_4e9a_a15e_252f94536675/index.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var CommentBlock = ({ id, color, size, y, opacity, style }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        top: `${y}px`,
        width: size,
        height: size * 0.6,
        backgroundColor: color,
        borderRadius: size * 0.1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `translateX(-50%)`,
        opacity,
        boxShadow: `0 4px 10px rgba(0,0,0,0.3)`,
        border: `2px solid ${COLORS.glassBorder}`,
        ...style
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "span",
        {
          style: {
            color: "white",
            fontSize: size * 0.25,
            fontWeight: "bold",
            fontFamily: "sans-serif"
          },
          children: [
            "ID: ",
            id
          ]
        }
      )
    }
  );
};
var Scene1 = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height } = (0, import_remotion.useVideoConfig)();
  const minDim = Math.min(width, height);
  const s1CommentSize = minDim * 0.15;
  const s1Comments = (0, import_react.useMemo)(() => Array.from({ length: 20 }).map((_, i) => ({ id: i + 1, delay: i * 8 })), []);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.AbsoluteFill, { style: { backgroundColor: COLORS.bg }, children: s1Comments.map((c) => {
    const localFrame = frame - c.delay;
    if (localFrame < 0) return null;
    const s1Speed = (0, import_remotion.interpolate)(localFrame, [0, 100], [1, 2], { extrapolateRight: "clamp" });
    const s1y = (0, import_remotion.interpolate)(localFrame * s1Speed, [0, 60], [-100, height + 100]);
    const s1op = (0, import_remotion.interpolate)(s1y, [0, 200, height - 200, height], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommentBlock, { id: c.id, color: COLORS.primary, size: s1CommentSize, y: s1y, opacity: s1op }, c.id);
  }) });
};
var Scene2 = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height } = (0, import_remotion.useVideoConfig)();
  const minDim = Math.min(width, height);
  const s2CommentSize = minDim * 0.15;
  const s2Comments = (0, import_react.useMemo)(() => Array.from({ length: 15 }).map((_, i) => ({ id: i + 20, delay: i * 10 })), []);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.AbsoluteFill, { style: { backgroundColor: COLORS.bg }, children: s2Comments.map((c) => {
    const lFrame = frame - c.delay;
    if (lFrame < 0) return null;
    const winner = c.id === 27;
    const s2Color = winner ? COLORS.accent : COLORS.primary;
    const s2Speed = winner && lFrame > 30 && lFrame < 60 ? 0.3 : 1;
    const s2y = (0, import_remotion.interpolate)(lFrame * s2Speed, [0, 60], [-100, height + 100]);
    const s2op = (0, import_remotion.interpolate)(s2y, [0, 200, height - 200, height], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const s2Scale = winner ? (0, import_remotion.interpolate)(lFrame, [10, 30], [1, 1.3], { extrapolateRight: "clamp" }) : 1;
    const s2Glow = winner ? (0, import_remotion.interpolate)(lFrame, [10, 30], [0, 20], { extrapolateRight: "clamp" }) : 0;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommentBlock, { id: c.id, color: s2Color, size: s2CommentSize, y: s2y, opacity: s2op, style: { transform: `translateX(-50%) scale(${s2Scale})`, boxShadow: `0 0 ${s2Glow}px ${COLORS.accent}` } }, c.id);
  }) });
};
var Scene3 = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height, fps } = (0, import_remotion.useVideoConfig)();
  const minDim = Math.min(width, height);
  const s3BoxSpring = (0, import_remotion.spring)({ frame: frame - 10, fps, config: SPRING_SETTLED });
  const s3Overflow = frame >= 80;
  const s3Shake = s3Overflow ? Math.sin(frame * 2) * (0, import_remotion.interpolate)(frame, [80, 120], [0, 1], { extrapolateRight: "clamp" }) * 10 : 0;
  const s3ColP = (0, import_remotion.interpolate)(frame, [80, 110], [0, 1], { extrapolateRight: "clamp" });
  const s3Color = `rgb(${(0, import_remotion.interpolate)(s3ColP, [0, 1], [59, 239])}, ${(0, import_remotion.interpolate)(s3ColP, [0, 1], [130, 68])}, ${(0, import_remotion.interpolate)(s3ColP, [0, 1], [246, 68])})`;
  const s3Blocks = (0, import_react.useMemo)(() => Array.from({ length: 12 }), []);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: { backgroundColor: COLORS.bg, display: "flex", justifyContent: "center", alignItems: "center" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { width: minDim * 0.6, height: minDim * 0.6, border: `4px solid ${s3Overflow ? COLORS.danger : COLORS.secondary}`, borderRadius: 20, backgroundColor: s3Color, display: "flex", flexWrap: "wrap", padding: 20, gap: 10, transform: `scale(${s3BoxSpring}) translate(${s3Shake}px, 0px)`, position: "relative", overflow: "hidden" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { position: "absolute", top: 10, left: 10, color: "white", fontWeight: "bold", fontSize: 24 }, children: "RAM" }),
      s3Blocks.map((_, i) => {
        const bFrame = frame - 20 - i * 5;
        const bScale = (0, import_remotion.spring)({ frame: bFrame, fps, config: SPRING_SETTLED });
        return bFrame >= 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { width: "20%", height: "20%", backgroundColor: COLORS.white, borderRadius: 5, transform: `scale(${bScale})` } }, i) : null;
      })
    ] }),
    frame > 110 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { position: "absolute", top: height * 0.3, fontSize: 120, opacity: (0, import_remotion.interpolate)(frame, [110, 130], [0, 1], { extrapolateRight: "clamp" }) }, children: "\u2753" })
  ] });
};
var Scene4 = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { height } = (0, import_remotion.useVideoConfig)();
  const text = "RESERVOIR SAMPLING";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.AbsoluteFill, { style: { backgroundColor: COLORS.bg, display: "flex", justifyContent: "center", alignItems: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "flex", gap: 5 }, children: text.split("").map((char, i) => {
    const d = i * 3;
    const op = (0, import_remotion.interpolate)(frame - 10 - d, [0, 10], [0, 1], { extrapolateRight: "clamp" });
    const ty = (0, import_remotion.interpolate)(frame - 10 - d, [0, 10], [20, 0], { extrapolateRight: "clamp" });
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.accent, fontSize: height * 0.06, fontWeight: 800, opacity: op, transform: `translateY(${ty}px)`, textShadow: `0 0 15px ${COLORS.accent}44` }, children: char === " " ? "\xA0" : char }, i);
  }) }) });
};
var Scene5 = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { width, height, fps } = (0, import_remotion.useVideoConfig)();
  const minDim = Math.min(width, height);
  const s5ResScale = (0, import_remotion.spring)({ frame: frame - 10, fps, config: SPRING_SETTLED });
  const s5Slide = (0, import_remotion.spring)({ frame: frame - 70, fps, config: SPRING_SETTLED });
  const s5cX = (0, import_remotion.interpolate)(s5Slide, [0, 1], [-200, width * 0.2]);
  const s5Rot = (0, import_remotion.interpolate)(frame - 90, [0, 30], [0, 360], { extrapolateRight: "clamp" });
  const s5DieOp = (0, import_remotion.interpolate)(frame - 90, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const s5FormOp = (0, import_remotion.interpolate)(frame - 160, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const s5SwapF = 240;
  const s5IsSwap = frame >= s5SwapF;
  const s5SwapS = (0, import_remotion.spring)({ frame: frame - s5SwapF, fps, config: SPRING_SETTLED });
  const s5OldX = s5IsSwap ? (0, import_remotion.interpolate)(s5SwapS, [0, 1], [width * 0.5, width * 1.2], { extrapolateRight: "clamp" }) : width * 0.5;
  const s5NewX = s5IsSwap ? (0, import_remotion.interpolate)(s5SwapS, [0, 1], [width * 0.2, width * 0.5], { extrapolateRight: "clamp" }) : s5cX;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: { backgroundColor: COLORS.bg }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", fontSize: 60, color: COLORS.accent, fontWeight: "bold", opacity: s5FormOp }, children: "P = 1/n" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { position: "absolute", top: "30%", left: "50%", transform: `translateX(-50%) rotate(${s5Rot}deg)`, fontSize: 80, opacity: s5DieOp }, children: "\u{1F3B2}" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { position: "absolute", left: "50%", top: "50%", transform: `translate(-50%, -50%) scale(${s5ResScale})`, width: minDim * 0.3, height: minDim * 0.3, border: `4px solid ${COLORS.accent}`, borderRadius: 20, boxShadow: `0 0 20px ${COLORS.accent}44` }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { textAlign: "center", color: "white", marginTop: 10 }, children: "Winner" }),
      (!s5IsSwap || frame < s5SwapF + 20) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { position: "absolute", left: "50%", top: "60%", transform: `translate(-50%, -50%) translateX(${s5OldX - width * 0.5}px)`, width: "80%", height: "40%", backgroundColor: COLORS.primary, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }, children: "ID: 15" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { position: "absolute", left: s5NewX, top: "50%", transform: `translate(-50%, -50%)`, width: minDim * 0.2, height: minDim * 0.12, backgroundColor: COLORS.accent, borderRadius: 10, display: s5IsSwap && frame > s5SwapF + 10 ? "flex" : frame > 70 ? "flex" : "none", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold" }, children: "ID: n" }),
    s5IsSwap && frame < s5SwapF + 30 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: 100, height: 100, borderRadius: "50%", backgroundColor: "white", opacity: (0, import_remotion.interpolate)(frame - s5SwapF, [0, 10], [0.8, 0], { extrapolateRight: "clamp" }) } })
  ] });
};
var Scene6 = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width } = (0, import_remotion.useVideoConfig)();
  const minDim = width * 0.6;
  const s6Split = (0, import_remotion.spring)({ frame: frame - 10, fps, config: SPRING_SETTLED });
  const s6Bs = Array.from({ length: 5 });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: { backgroundColor: COLORS.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { position: "relative", height: minDim * 0.5, width: "100%", display: "flex", justifyContent: "center", alignItems: "center", gap: 20 }, children: s6Bs.map((_, i) => {
      const off = (i - 2) * (minDim * 0.18) * s6Split;
      const sc = (0, import_remotion.interpolate)(s6Split, [0, 1], [1.5, 1], { extrapolateRight: "clamp" });
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { width: minDim * 0.15, height: minDim * 0.15, border: `3px solid ${COLORS.accent}`, borderRadius: 10, transform: `translateX(${off}px) scale(${sc})`, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 20 }, children: "W" }, i);
    }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { marginTop: 50, fontSize: 80, color: COLORS.accent, fontWeight: "bold", opacity: (0, import_remotion.interpolate)(frame - 100, [0, 20], [0, 1], { extrapolateRight: "clamp" }), transform: `scale(${(0, import_remotion.spring)({ frame: frame - 100, fps, config: SPRING_SETTLED })})` }, children: "P = ? / n" })
  ] });
};
var Scene7 = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const minDim = Math.min(width, height);
  const pScale = (0, import_remotion.spring)({ frame: frame - 10, fps, config: SPRING_SETTLED });
  const op = (0, import_remotion.interpolate)(frame - 40, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const s7h = height;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: { backgroundColor: COLORS.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: minDim * 0.04 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { width: minDim * 0.3, height: minDim * 0.3, borderRadius: "50%", backgroundColor: COLORS.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: minDim * 0.1, transform: `scale(${pScale})`, border: `${minDim * 0.01}px solid ${COLORS.accent}` }, children: "\u{1F468}\u200D\u{1F4BB}" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { color: "white", fontSize: minDim * 0.06, fontWeight: "bold", opacity: op }, children: "Prasanna" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { color: COLORS.accent, fontSize: minDim * 0.04, opacity: (0, import_remotion.interpolate)(frame - 60, [0, 20], [0, 1], { extrapolateRight: "clamp" }) }, children: "Technical Architect @ Zoho" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "flex", gap: minDim * 0.04, marginTop: minDim * 0.04 }, children: ["Follow", "Share"].map((t, i) => {
      const s = (0, import_remotion.spring)({ frame: frame - (120 + i * 20), fps, config: { ...SPRING_SETTLED, damping: 15 } });
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { padding: `${minDim * 0.02}px ${minDim * 0.04}px`, borderRadius: 50, backgroundColor: COLORS.accent, color: "white", fontSize: minDim * 0.032, fontWeight: "bold", transform: `scale(${s})`, boxShadow: `0 0 20px ${COLORS.accent}66` }, children: t }, i);
    }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "none" }, children: s7h })
  ] });
};
var ProjC9b2ab0e8fbc4e9aA15e252f94536675 = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: { backgroundColor: COLORS.bg }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 0, durationInFrames: 150, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene1, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 180, durationInFrames: 120, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene2, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 300, durationInFrames: 450, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene3, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 810, durationInFrames: 150, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene4, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 960, durationInFrames: 690, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene5, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 1650, durationInFrames: 330, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene6, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 1980, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene7, {}) })
  ] });
};
