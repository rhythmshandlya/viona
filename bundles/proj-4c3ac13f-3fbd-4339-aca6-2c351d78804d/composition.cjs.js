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

// src/proj_4c3ac13f_3fbd_4339_aca6_2c351d78804d/index.tsx
var index_exports = {};
__export(index_exports, {
  Proj4c3ac13f3fbd4339Aca62c351d78804d: () => Proj4c3ac13f3fbd4339Aca62c351d78804d
});
module.exports = __toCommonJS(index_exports);
var import_remotion4 = require("remotion");

// src/proj_4c3ac13f_3fbd_4339_aca6_2c351d78804d/constants.ts
var COLORS = {
  background: "#000000",
  text: "#ffffff",
  accent: "#ef4444"
};
var TIMING = {
  fps: 32,
  intro: {
    start: 0,
    end: 160
    // ~5s
  },
  transcripts: {
    start: 160,
    end: 416
    // ~13s
  },
  speed: {
    start: 480,
    // ~15s
    end: 637
    // ~19.9s
  }
};
var TYPOGRAPHY = {
  fontFamily: "Bebas Neue, Impact, sans-serif"
};

// src/proj_4c3ac13f_3fbd_4339_aca6_2c351d78804d/components/IntroSection.tsx
var import_remotion = require("remotion");
var import_jsx_runtime = require("react/jsx-runtime");
var IntroSection = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, height } = (0, import_remotion.useVideoConfig)();
  const scale = (0, import_remotion.spring)({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 }
  });
  const opacity = (0, import_remotion.interpolate)(frame, [0, 10], [0, 1]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    color: COLORS.text,
    fontFamily: TYPOGRAPHY.fontFamily,
    padding: 54
  }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
    fontSize: height * 0.08,
    fontWeight: 900,
    textAlign: "center",
    transform: `scale(${scale})`,
    opacity,
    lineHeight: 1
  }, children: [
    "TESTING",
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.accent }, children: "RAILIFY" })
  ] }) });
};

// src/proj_4c3ac13f_3fbd_4339_aca6_2c351d78804d/components/TranscriptSection.tsx
var import_remotion2 = require("remotion");
var import_jsx_runtime2 = require("react/jsx-runtime");
var WORDS = ["GENERATE", "TRANSCRIPTS", "FOR", "THE", "EXACT", "TIME"];
var TranscriptSection = () => {
  const frame = (0, import_remotion2.useCurrentFrame)();
  const { height } = (0, import_remotion2.useVideoConfig)();
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-start",
    color: COLORS.text,
    fontFamily: TYPOGRAPHY.fontFamily,
    padding: 54
  }, children: WORDS.map((word, i) => {
    const wordStart = i * 15;
    const opacity = (0, import_remotion2.interpolate)(frame, [wordStart, wordStart + 10], [0, 1], {
      extrapolateRight: "clamp"
    });
    const translateX = (0, import_remotion2.interpolate)(frame, [wordStart, wordStart + 10], [-50, 0], {
      extrapolateRight: "clamp"
    });
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "div",
      {
        style: {
          fontSize: height * 0.07,
          fontWeight: 900,
          opacity,
          transform: `translateX(${translateX}px)`,
          marginBottom: 10,
          lineHeight: 1,
          backgroundColor: i % 2 === 0 ? COLORS.accent : "transparent",
          padding: "0 10px"
        },
        children: word
      },
      word
    );
  }) });
};

// src/proj_4c3ac13f_3fbd_4339_aca6_2c351d78804d/components/SpeedSection.tsx
var import_remotion3 = require("remotion");
var import_jsx_runtime3 = require("react/jsx-runtime");
var SpeedSection = () => {
  const frame = (0, import_remotion3.useCurrentFrame)();
  const { fps, height } = (0, import_remotion3.useVideoConfig)();
  const isFast = frame < 60;
  const speedScale = (0, import_remotion3.spring)({
    frame: isFast ? frame : frame - 60,
    fps,
    config: { damping: 10, stiffness: 150 }
  });
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    color: COLORS.text,
    fontFamily: TYPOGRAPHY.fontFamily,
    padding: 54,
    backgroundColor: isFast ? COLORS.accent : COLORS.background
  }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
    fontSize: height * 0.1,
    fontWeight: 900,
    transform: `scale(${speedScale * (isFast ? 1.5 : 1)})`,
    textAlign: "center",
    lineHeight: 0.9
  }, children: isFast ? "VERY FAST" : "VERY SLOW" }) });
};

// src/proj_4c3ac13f_3fbd_4339_aca6_2c351d78804d/index.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
var Proj4c3ac13f3fbd4339Aca62c351d78804d = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_remotion4.AbsoluteFill, { style: { backgroundColor: COLORS.background }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_remotion4.Sequence, { from: TIMING.intro.start, durationInFrames: TIMING.intro.end - TIMING.intro.start, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IntroSection, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_remotion4.Sequence, { from: TIMING.transcripts.start, durationInFrames: TIMING.transcripts.end - TIMING.transcripts.start, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(TranscriptSection, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_remotion4.Sequence, { from: TIMING.speed.start, durationInFrames: TIMING.speed.end - TIMING.speed.start, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SpeedSection, {}) })
  ] });
};
