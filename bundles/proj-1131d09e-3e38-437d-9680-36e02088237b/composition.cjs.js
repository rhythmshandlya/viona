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

// ../../src/proj_1131d09e_3e38_437d_9680_36e02088237b/index.tsx
var index_exports = {};
__export(index_exports, {
  Proj1131d09e3e38437d968036e02088237b: () => Proj1131d09e3e38437d968036e02088237b,
  proj_1131d09e_3e38_437d_9680_36e02088237b: () => proj_1131d09e_3e38_437d_9680_36e02088237b
});
module.exports = __toCommonJS(index_exports);
var import_react4 = __toESM(require("react"));
var import_remotion4 = require("remotion");

// ../../src/proj_1131d09e_3e38_437d_9680_36e02088237b/constants.ts
var COLORS = {
  background: "#F5F5DC",
  // cream
  primary: "#1E3A5F",
  // navy
  accent: "#D4AF37",
  // gold
  text: "#1E3A5F",
  // navy
  gray: "#4B5563",
  lightGray: "#E5E7EB"
};
var FONTS = {
  serif: "'Playfair Display', Georgia, serif",
  sans: "Inter, system-ui, sans-serif"
};
var TIMING = {
  fps: 32,
  durationInFrames: 637,
  scenes: {
    intro: {
      start: 0,
      end: 5 * 32
      // 0:00 - 0:05
    },
    transcripts: {
      start: 6 * 32,
      end: 14 * 32
      // 0:06 - 0:13 (plus buffer)
    },
    speed: {
      start: 15 * 32,
      end: 20 * 32
      // 0:15 - 0:19 (plus buffer)
    }
  }
};

// ../../src/proj_1131d09e_3e38_437d_9680_36e02088237b/components/Heading.tsx
var import_react = __toESM(require("react"));
var import_remotion = require("remotion");
var Heading = ({ title, subtitle }) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const opacity = (0, import_remotion.spring)({
    frame,
    fps,
    config: { damping: 12 }
  });
  const translateY = (0, import_remotion.interpolate)(opacity, [0, 1], [20, 0]);
  return /* @__PURE__ */ import_react.default.createElement("div", { style: { textAlign: "center", opacity, transform: `translateY(${translateY}px)` } }, /* @__PURE__ */ import_react.default.createElement("h1", { style: {
    fontFamily: FONTS.serif,
    fontSize: "100px",
    color: COLORS.primary,
    margin: 0,
    fontWeight: 700
  } }, title), subtitle && /* @__PURE__ */ import_react.default.createElement("h2", { style: {
    fontFamily: FONTS.sans,
    fontSize: "40px",
    color: COLORS.accent,
    marginTop: "10px",
    fontWeight: 300,
    letterSpacing: "2px",
    textTransform: "uppercase"
  } }, subtitle), /* @__PURE__ */ import_react.default.createElement("div", { style: {
    width: (0, import_remotion.interpolate)(opacity, [0, 1], [0, 200]),
    height: "4px",
    backgroundColor: COLORS.accent,
    margin: "30px auto"
  } }));
};

// ../../src/proj_1131d09e_3e38_437d_9680_36e02088237b/components/TranscriptVisual.tsx
var import_react2 = __toESM(require("react"));
var import_remotion2 = require("remotion");
var TranscriptVisual = () => {
  const frame = (0, import_remotion2.useCurrentFrame)();
  const { fps } = (0, import_remotion2.useVideoConfig)();
  const progress = (0, import_remotion2.spring)({
    frame,
    fps,
    config: { damping: 10, stiffness: 100 }
  });
  const lines = [
    "Generate transcripts",
    "at the exact time",
    "I am speaking"
  ];
  return /* @__PURE__ */ import_react2.default.createElement(import_remotion2.AbsoluteFill, { style: { justifyContent: "center", alignItems: "center" } }, /* @__PURE__ */ import_react2.default.createElement("div", { style: { width: "80%", background: "white", padding: "60px", borderRadius: "10px", boxShadow: "0 10px 30px rgba(0,0,0,0.1)", border: `2px solid ${COLORS.accent}` } }, /* @__PURE__ */ import_react2.default.createElement("div", { style: { fontFamily: FONTS.serif, fontSize: "60px", color: COLORS.primary, lineHeight: 1.4 } }, lines.map((line, i) => {
    const lineOpacity = (0, import_remotion2.spring)({
      frame: frame - i * 15,
      fps,
      config: { damping: 12 }
    });
    return /* @__PURE__ */ import_react2.default.createElement("div", { key: i, style: { opacity: lineOpacity, transform: `translateX(${(0, import_remotion2.interpolate)(lineOpacity, [0, 1], [-20, 0])}px)` } }, line);
  })), /* @__PURE__ */ import_react2.default.createElement("div", { style: { marginTop: "40px", height: "10px", width: "100%", background: COLORS.lightGray, borderRadius: "5px", overflow: "hidden" } }, /* @__PURE__ */ import_react2.default.createElement("div", { style: { height: "100%", width: `${progress * 100}%`, background: COLORS.accent } })), /* @__PURE__ */ import_react2.default.createElement("div", { style: { marginTop: "20px", textAlign: "right", fontFamily: FONTS.sans, color: COLORS.gray, fontSize: "24px" } }, "Timeline Accuracy: 99.8%")));
};

// ../../src/proj_1131d09e_3e38_437d_9680_36e02088237b/components/SpeedGauges.tsx
var import_react3 = __toESM(require("react"));
var import_remotion3 = require("remotion");
var SpeedGauges = () => {
  const frame = (0, import_remotion3.useCurrentFrame)();
  const { fps } = (0, import_remotion3.useVideoConfig)();
  const fastScale = (0, import_remotion3.spring)({
    frame: frame - 10,
    fps,
    config: { damping: 12 }
  });
  const slowScale = (0, import_remotion3.spring)({
    frame: frame - 25,
    fps,
    config: { damping: 12 }
  });
  const fastRotation = (0, import_remotion3.interpolate)(frame, [15, 60], [0, 180], { extrapolateRight: "clamp" });
  const slowRotation = (0, import_remotion3.interpolate)(frame, [30, 80], [0, 45], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ import_react3.default.createElement(import_remotion3.AbsoluteFill, { style: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", padding: "100px" } }, /* @__PURE__ */ import_react3.default.createElement("div", { style: { transform: `scale(${fastScale})`, textAlign: "center" } }, /* @__PURE__ */ import_react3.default.createElement("div", { style: { width: "300px", height: "150px", background: "white", border: `3px solid ${COLORS.primary}`, borderRadius: "150px 150px 0 0", position: "relative", overflow: "hidden" } }, /* @__PURE__ */ import_react3.default.createElement("div", { style: { position: "absolute", bottom: 0, left: "50%", width: "140px", height: "4px", background: COLORS.accent, transformOrigin: "left center", transform: `translateX(0) rotate(${180 + fastRotation}deg)` } }), /* @__PURE__ */ import_react3.default.createElement("div", { style: { position: "absolute", bottom: "10px", left: "50%", transform: "translateX(-50%)", fontFamily: FONTS.sans, color: COLORS.primary, fontWeight: "bold" } }, "FAST")), /* @__PURE__ */ import_react3.default.createElement("div", { style: { marginTop: "20px", fontFamily: FONTS.serif, fontSize: "32px", color: COLORS.primary } }, "Rapid Speech")), /* @__PURE__ */ import_react3.default.createElement("div", { style: { transform: `scale(${slowScale})`, textAlign: "center" } }, /* @__PURE__ */ import_react3.default.createElement("div", { style: { width: "300px", height: "150px", background: "white", border: `3px solid ${COLORS.primary}`, borderRadius: "150px 150px 0 0", position: "relative", overflow: "hidden" } }, /* @__PURE__ */ import_react3.default.createElement("div", { style: { position: "absolute", bottom: 0, left: "50%", width: "140px", height: "4px", background: COLORS.accent, transformOrigin: "left center", transform: `translateX(0) rotate(${180 + slowRotation}deg)` } }), /* @__PURE__ */ import_react3.default.createElement("div", { style: { position: "absolute", bottom: "10px", left: "50%", transform: "translateX(-50%)", fontFamily: FONTS.sans, color: COLORS.primary, fontWeight: "bold" } }, "SLOW")), /* @__PURE__ */ import_react3.default.createElement("div", { style: { marginTop: "20px", fontFamily: FONTS.serif, fontSize: "32px", color: COLORS.primary } }, "Deliberate Pace")));
};

// ../../src/proj_1131d09e_3e38_437d_9680_36e02088237b/index.tsx
var Proj1131d09e3e38437d968036e02088237b = () => {
  return /* @__PURE__ */ import_react4.default.createElement(import_remotion4.AbsoluteFill, { style: { backgroundColor: COLORS.background } }, /* @__PURE__ */ import_react4.default.createElement(import_remotion4.Sequence, { from: TIMING.scenes.intro.start, durationInFrames: TIMING.scenes.intro.end - TIMING.scenes.intro.start }, /* @__PURE__ */ import_react4.default.createElement(import_remotion4.AbsoluteFill, { style: { justifyContent: "center", alignItems: "center" } }, /* @__PURE__ */ import_react4.default.createElement(Heading, { title: "Railify", subtitle: "Temporal Accuracy Study" }))), /* @__PURE__ */ import_react4.default.createElement(import_remotion4.Sequence, { from: TIMING.scenes.transcripts.start, durationInFrames: TIMING.scenes.transcripts.end - TIMING.scenes.transcripts.start }, /* @__PURE__ */ import_react4.default.createElement(TranscriptVisual, null)), /* @__PURE__ */ import_react4.default.createElement(import_remotion4.Sequence, { from: TIMING.scenes.speed.start, durationInFrames: TIMING.scenes.speed.end - TIMING.scenes.speed.start }, /* @__PURE__ */ import_react4.default.createElement(SpeedGauges, null)));
};
var proj_1131d09e_3e38_437d_9680_36e02088237b = Proj1131d09e3e38437d968036e02088237b;
