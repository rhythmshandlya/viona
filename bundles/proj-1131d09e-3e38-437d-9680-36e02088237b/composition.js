// ../../src/proj_1131d09e_3e38_437d_9680_36e02088237b/index.tsx
import React4 from "react";
import { AbsoluteFill as AbsoluteFill3, Sequence } from "remotion";

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
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
var Heading = ({ title, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = spring({
    frame,
    fps,
    config: { damping: 12 }
  });
  const translateY = interpolate(opacity, [0, 1], [20, 0]);
  return /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", opacity, transform: `translateY(${translateY}px)` } }, /* @__PURE__ */ React.createElement("h1", { style: {
    fontFamily: FONTS.serif,
    fontSize: "100px",
    color: COLORS.primary,
    margin: 0,
    fontWeight: 700
  } }, title), subtitle && /* @__PURE__ */ React.createElement("h2", { style: {
    fontFamily: FONTS.sans,
    fontSize: "40px",
    color: COLORS.accent,
    marginTop: "10px",
    fontWeight: 300,
    letterSpacing: "2px",
    textTransform: "uppercase"
  } }, subtitle), /* @__PURE__ */ React.createElement("div", { style: {
    width: interpolate(opacity, [0, 1], [0, 200]),
    height: "4px",
    backgroundColor: COLORS.accent,
    margin: "30px auto"
  } }));
};

// ../../src/proj_1131d09e_3e38_437d_9680_36e02088237b/components/TranscriptVisual.tsx
import React2 from "react";
import { interpolate as interpolate2, spring as spring2, useCurrentFrame as useCurrentFrame2, useVideoConfig as useVideoConfig2, AbsoluteFill } from "remotion";
var TranscriptVisual = () => {
  const frame = useCurrentFrame2();
  const { fps } = useVideoConfig2();
  const progress = spring2({
    frame,
    fps,
    config: { damping: 10, stiffness: 100 }
  });
  const lines = [
    "Generate transcripts",
    "at the exact time",
    "I am speaking"
  ];
  return /* @__PURE__ */ React2.createElement(AbsoluteFill, { style: { justifyContent: "center", alignItems: "center" } }, /* @__PURE__ */ React2.createElement("div", { style: { width: "80%", background: "white", padding: "60px", borderRadius: "10px", boxShadow: "0 10px 30px rgba(0,0,0,0.1)", border: `2px solid ${COLORS.accent}` } }, /* @__PURE__ */ React2.createElement("div", { style: { fontFamily: FONTS.serif, fontSize: "60px", color: COLORS.primary, lineHeight: 1.4 } }, lines.map((line, i) => {
    const lineOpacity = spring2({
      frame: frame - i * 15,
      fps,
      config: { damping: 12 }
    });
    return /* @__PURE__ */ React2.createElement("div", { key: i, style: { opacity: lineOpacity, transform: `translateX(${interpolate2(lineOpacity, [0, 1], [-20, 0])}px)` } }, line);
  })), /* @__PURE__ */ React2.createElement("div", { style: { marginTop: "40px", height: "10px", width: "100%", background: COLORS.lightGray, borderRadius: "5px", overflow: "hidden" } }, /* @__PURE__ */ React2.createElement("div", { style: { height: "100%", width: `${progress * 100}%`, background: COLORS.accent } })), /* @__PURE__ */ React2.createElement("div", { style: { marginTop: "20px", textAlign: "right", fontFamily: FONTS.sans, color: COLORS.gray, fontSize: "24px" } }, "Timeline Accuracy: 99.8%")));
};

// ../../src/proj_1131d09e_3e38_437d_9680_36e02088237b/components/SpeedGauges.tsx
import React3 from "react";
import { interpolate as interpolate3, spring as spring3, useCurrentFrame as useCurrentFrame3, useVideoConfig as useVideoConfig3, AbsoluteFill as AbsoluteFill2 } from "remotion";
var SpeedGauges = () => {
  const frame = useCurrentFrame3();
  const { fps } = useVideoConfig3();
  const fastScale = spring3({
    frame: frame - 10,
    fps,
    config: { damping: 12 }
  });
  const slowScale = spring3({
    frame: frame - 25,
    fps,
    config: { damping: 12 }
  });
  const fastRotation = interpolate3(frame, [15, 60], [0, 180], { extrapolateRight: "clamp" });
  const slowRotation = interpolate3(frame, [30, 80], [0, 45], { extrapolateRight: "clamp" });
  return /* @__PURE__ */ React3.createElement(AbsoluteFill2, { style: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", padding: "100px" } }, /* @__PURE__ */ React3.createElement("div", { style: { transform: `scale(${fastScale})`, textAlign: "center" } }, /* @__PURE__ */ React3.createElement("div", { style: { width: "300px", height: "150px", background: "white", border: `3px solid ${COLORS.primary}`, borderRadius: "150px 150px 0 0", position: "relative", overflow: "hidden" } }, /* @__PURE__ */ React3.createElement("div", { style: { position: "absolute", bottom: 0, left: "50%", width: "140px", height: "4px", background: COLORS.accent, transformOrigin: "left center", transform: `translateX(0) rotate(${180 + fastRotation}deg)` } }), /* @__PURE__ */ React3.createElement("div", { style: { position: "absolute", bottom: "10px", left: "50%", transform: "translateX(-50%)", fontFamily: FONTS.sans, color: COLORS.primary, fontWeight: "bold" } }, "FAST")), /* @__PURE__ */ React3.createElement("div", { style: { marginTop: "20px", fontFamily: FONTS.serif, fontSize: "32px", color: COLORS.primary } }, "Rapid Speech")), /* @__PURE__ */ React3.createElement("div", { style: { transform: `scale(${slowScale})`, textAlign: "center" } }, /* @__PURE__ */ React3.createElement("div", { style: { width: "300px", height: "150px", background: "white", border: `3px solid ${COLORS.primary}`, borderRadius: "150px 150px 0 0", position: "relative", overflow: "hidden" } }, /* @__PURE__ */ React3.createElement("div", { style: { position: "absolute", bottom: 0, left: "50%", width: "140px", height: "4px", background: COLORS.accent, transformOrigin: "left center", transform: `translateX(0) rotate(${180 + slowRotation}deg)` } }), /* @__PURE__ */ React3.createElement("div", { style: { position: "absolute", bottom: "10px", left: "50%", transform: "translateX(-50%)", fontFamily: FONTS.sans, color: COLORS.primary, fontWeight: "bold" } }, "SLOW")), /* @__PURE__ */ React3.createElement("div", { style: { marginTop: "20px", fontFamily: FONTS.serif, fontSize: "32px", color: COLORS.primary } }, "Deliberate Pace")));
};

// ../../src/proj_1131d09e_3e38_437d_9680_36e02088237b/index.tsx
var Proj1131d09e3e38437d968036e02088237b = () => {
  return /* @__PURE__ */ React4.createElement(AbsoluteFill3, { style: { backgroundColor: COLORS.background } }, /* @__PURE__ */ React4.createElement(Sequence, { from: TIMING.scenes.intro.start, durationInFrames: TIMING.scenes.intro.end - TIMING.scenes.intro.start }, /* @__PURE__ */ React4.createElement(AbsoluteFill3, { style: { justifyContent: "center", alignItems: "center" } }, /* @__PURE__ */ React4.createElement(Heading, { title: "Railify", subtitle: "Temporal Accuracy Study" }))), /* @__PURE__ */ React4.createElement(Sequence, { from: TIMING.scenes.transcripts.start, durationInFrames: TIMING.scenes.transcripts.end - TIMING.scenes.transcripts.start }, /* @__PURE__ */ React4.createElement(TranscriptVisual, null)), /* @__PURE__ */ React4.createElement(Sequence, { from: TIMING.scenes.speed.start, durationInFrames: TIMING.scenes.speed.end - TIMING.scenes.speed.start }, /* @__PURE__ */ React4.createElement(SpeedGauges, null)));
};
var proj_1131d09e_3e38_437d_9680_36e02088237b = Proj1131d09e3e38437d968036e02088237b;
export {
  Proj1131d09e3e38437d968036e02088237b,
  proj_1131d09e_3e38_437d_9680_36e02088237b
};
