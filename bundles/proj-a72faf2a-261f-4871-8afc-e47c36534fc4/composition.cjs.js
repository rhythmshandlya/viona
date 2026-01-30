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

// src/proj_a72faf2a_261f_4871_8afc_e47c36534fc4/index.tsx
var index_exports = {};
__export(index_exports, {
  ProjA72faf2a261f48718afcE47c36534fc4: () => ProjA72faf2a261f48718afcE47c36534fc4,
  proj_a72faf2a_261f_4871_8afc_e47c36534fc4: () => proj_a72faf2a_261f_4871_8afc_e47c36534fc4
});
module.exports = __toCommonJS(index_exports);
var import_remotion4 = require("remotion");

// src/proj_a72faf2a_261f_4871_8afc_e47c36534fc4/constants.ts
var COLORS = {
  background: "#FFF9E1",
  // Pale yellow for a warm, playful vibe
  primary: "#F97316",
  // Orange
  secondary: "#8B5CF6",
  // Purple
  accent: "#22C55E",
  // Green
  text: "#1F2937",
  // Dark gray
  swiggy: "#FC8019",
  // Swiggy orange
  chocolate: "#4B2C20",
  // Dairy milk brown
  crispello: "#E91E63"
  // Crispello pink/magenta
};
var TIMING = {
  intro: {
    start: 0,
    duration: 300
    // 0-5s (60fps * 5)
  },
  craving: {
    start: 300,
    duration: 300
    // 5-10s
  },
  reality: {
    start: 600,
    duration: 523
    // 10-18.7s (roughly)
  }
};

// src/proj_a72faf2a_261f_4871_8afc_e47c36534fc4/components/Greeting.tsx
var import_remotion = require("remotion");
var import_jsx_runtime = require("react/jsx-runtime");
var Greeting = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const titleSpring = (0, import_remotion.spring)({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 }
  });
  const subtitleSpring = (0, import_remotion.spring)({
    frame: frame - 20,
    fps,
    config: { damping: 12, stiffness: 100 }
  });
  const calendarScale = (0, import_remotion.spring)({
    frame: frame - 10,
    fps,
    config: { damping: 10, stiffness: 100, mass: 0.5 }
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
    fontFamily: "Nunito, sans-serif"
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
      transform: `scale(${calendarScale})`,
      backgroundColor: "white",
      padding: "20px 40px",
      borderRadius: "20px",
      border: `3px solid ${COLORS.text}`,
      boxShadow: `10px 10px 0 ${COLORS.text}`,
      marginBottom: "40px"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: "40px", fontWeight: "bold" }, children: "TUESDAY" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: "30px", textAlign: "center" }, children: "EVENING" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      transform: `translateY(${(0, import_remotion.interpolate)(titleSpring, [0, 1], [50, 0])}px)`,
      opacity: titleSpring,
      fontSize: "80px",
      fontWeight: 900,
      color: COLORS.primary,
      textAlign: "center"
    }, children: '"I wanted to grab a bite..."' }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      transform: `translateY(${(0, import_remotion.interpolate)(subtitleSpring, [0, 1], [30, 0])}px)`,
      opacity: subtitleSpring,
      fontSize: "60px",
      fontWeight: 700,
      color: COLORS.secondary,
      marginTop: "20px"
    }, children: "\u{1F36D} something sweet \u{1F369}" })
  ] });
};

// src/proj_a72faf2a_261f_4871_8afc_e47c36534fc4/components/SwiggyDecision.tsx
var import_remotion2 = require("remotion");
var import_jsx_runtime2 = require("react/jsx-runtime");
var SwiggyDecision = () => {
  const frame = (0, import_remotion2.useCurrentFrame)();
  const { fps } = (0, import_remotion2.useVideoConfig)();
  const appScale = (0, import_remotion2.spring)({
    frame,
    fps,
    config: { damping: 10, stiffness: 100 }
  });
  const crossOpacity = (0, import_remotion2.interpolate)(frame, [60, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const crossScale = (0, import_remotion2.spring)({
    frame: frame - 60,
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.5 }
  });
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_remotion2.AbsoluteFill, { style: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
    overflow: "hidden"
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: {
      backgroundColor: "white",
      width: "400px",
      height: "600px",
      borderRadius: "40px",
      border: `8px solid ${COLORS.text}`,
      boxShadow: `20px 20px 0 ${COLORS.text}`,
      transform: `scale(${appScale})`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "20px",
      position: "relative"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
        width: "100%",
        height: "60px",
        backgroundColor: COLORS.swiggy,
        borderRadius: "15px",
        marginBottom: "20px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        color: "white",
        fontWeight: "bold",
        fontSize: "24px"
      }, children: "Swiggy" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { width: "100%", height: "100px", backgroundColor: "#eee", borderRadius: "10px", marginBottom: "10px" } }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { width: "100%", height: "100px", backgroundColor: "#eee", borderRadius: "10px", marginBottom: "10px" } }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { width: "100%", height: "100px", backgroundColor: "#eee", borderRadius: "10px", marginBottom: "10px" } }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        opacity: crossOpacity,
        transform: `scale(${crossScale})`,
        fontSize: "300px",
        color: "#ef4444",
        fontWeight: 900,
        zIndex: 10
      }, children: "\u2716" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
      marginTop: "60px",
      fontSize: "70px",
      fontWeight: 900,
      color: COLORS.text,
      textAlign: "center",
      opacity: (0, import_remotion2.interpolate)(frame, [80, 100], [0, 1])
    }, children: "BUT I DIDN'T..." })
  ] });
};

// src/proj_a72faf2a_261f_4871_8afc_e47c36534fc4/components/CrispelloScene.tsx
var import_remotion3 = require("remotion");
var import_jsx_runtime3 = require("react/jsx-runtime");
var CrispelloScene = () => {
  const frame = (0, import_remotion3.useCurrentFrame)();
  const { fps } = (0, import_remotion3.useVideoConfig)();
  const chocolateEnter = (0, import_remotion3.spring)({
    frame,
    fps,
    config: { damping: 10, stiffness: 60, mass: 1 }
  });
  const textFloat = Math.sin(frame / 10) * 10;
  const sparkScale = (0, import_remotion3.spring)({
    frame: frame - 40,
    fps,
    config: { damping: 8, stiffness: 200 }
  });
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_remotion3.AbsoluteFill, { style: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
      backgroundColor: COLORS.chocolate,
      width: "600px",
      height: "300px",
      borderRadius: "20px",
      border: `6px solid ${COLORS.text}`,
      boxShadow: `15px 15px 0 ${COLORS.text}`,
      transform: `scale(${chocolateEnter}) rotate(${(0, import_remotion3.interpolate)(chocolateEnter, [0, 1], [-5, 0])}deg)`,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      position: "relative"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
        color: "white",
        fontSize: "60px",
        fontWeight: 900,
        letterSpacing: "5px",
        textShadow: "4px 4px 0 rgba(0,0,0,0.5)"
      }, children: "DAIRY MILK" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
        backgroundColor: COLORS.crispello,
        padding: "10px 30px",
        borderRadius: "50px",
        color: "white",
        fontSize: "40px",
        fontWeight: 800,
        marginTop: "10px",
        transform: `scale(${1 + Math.sin(frame / 20) * 0.05})`,
        border: "3px solid white"
      }, children: "CRISPELLO" }),
      [0, 1, 2, 3].map((i) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
        position: "absolute",
        top: i % 2 === 0 ? "-40px" : "300px",
        left: i < 2 ? "-40px" : "580px",
        fontSize: "50px",
        transform: `scale(${sparkScale})`
      }, children: "\u2728" }, i))
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
      marginTop: "80px",
      fontSize: "100px",
      fontWeight: 900,
      color: COLORS.crispello,
      transform: `translateY(${textFloat}px) rotate(-3deg)`,
      textShadow: `5px 5px 0 ${COLORS.text}`
    }, children: "WHAT!" })
  ] });
};

// src/proj_a72faf2a_261f_4871_8afc_e47c36534fc4/index.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
var ProjA72faf2a261f48718afcE47c36534fc4 = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_remotion4.AbsoluteFill, { style: { backgroundColor: COLORS.background }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_remotion4.Sequence, { from: TIMING.intro.start, durationInFrames: TIMING.intro.duration, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Greeting, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_remotion4.Sequence, { from: TIMING.craving.start, durationInFrames: TIMING.craving.duration, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SwiggyDecision, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_remotion4.Sequence, { from: TIMING.reality.start, durationInFrames: TIMING.reality.duration, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(CrispelloScene, {}) })
  ] });
};
var proj_a72faf2a_261f_4871_8afc_e47c36534fc4 = ProjA72faf2a261f48718afcE47c36534fc4;
