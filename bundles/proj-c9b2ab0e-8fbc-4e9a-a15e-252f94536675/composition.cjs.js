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

// src/proj_c9b2ab0e_8fbc_4e9a_a15e_252f94536675/index.tsx
var index_exports = {};
__export(index_exports, {
  ProjC9b2ab0e8fbc4e9aA15e252f94536675: () => ProjC9b2ab0e8fbc4e9aA15e252f94536675
});
module.exports = __toCommonJS(index_exports);
var import_react = __toESM(require("react"));
var import_remotion = require("remotion");

// src/proj_c9b2ab0e_8fbc_4e9a_a15e_252f94536675/constants.ts
var COLORS = {
  bg: "#0f0f23",
  bgSecondary: "#1a1a3e",
  primary: "#8b5cf6",
  // Purple
  secondary: "#3b82f6",
  // Blue
  accent: "#06b6d4",
  // Cyan
  success: "#22c55e",
  // Green
  warning: "#eab308",
  // Yellow
  danger: "#ef4444",
  // Red
  white: "#ffffff",
  text: "#e2e8f0",
  muted: "#64748b",
  glass: "rgba(255, 255, 255, 0.1)",
  glassBorder: "rgba(255, 255, 255, 0.2)",
  comment1: "#3b82f6",
  // Blue for early comment
  comment2: "#8b5cf6",
  // Purple for stream
  comment3: "#06b6d4"
  // Cyan for highlighting
};
var SPRING_CONFIGS = {
  settled: { damping: 22, stiffness: 90, mass: 0.9 },
  responsive: { damping: 20, stiffness: 100, mass: 0.8 },
  subtle: { damping: 25, stiffness: 60, mass: 0.9 }
};
var TIMING = {
  // Scene S01: 0-540
  S01_START: 0,
  S01_COMMENT_START: 15,
  S01_COMMENT_INCREASE: 60,
  S01_MEMORY_APPEAR: 150,
  S01_HERO_START: 300,
  S01_HERO_END: 450,
  S01_END: 540,
  // Scene S02: 600-810
  S02_START: 600,
  S02_FIRST_COMMENT: 630,
  S02_MEMORY_PULSE: 690,
  S02_DIE_APPEAR: 750,
  S02_HERO_START: 720,
  S02_HERO_END: 810,
  // Scene S03: 810-1590
  S03_START: 810,
  S03_NTH_COMMENT: 840,
  S03_DIE_ROLL: 960,
  S03_SWAP: 1020,
  S03_REPEAT: 1110,
  S03_HERO_START: 1260,
  S03_HERO_END: 1470,
  S03_END: 1590,
  // Scene S04: 1590-1590
  S04_START: 1590,
  // Scene S05: 1650-1890
  S05_START: 1650,
  S05_MULTI_SLOTS: 1650,
  S05_STREAM_REROUTE: 1710,
  S05_PROBABILITY: 1770,
  S05_HERO_START: 1800,
  S05_HERO_END: 1890,
  // Scene S06: 1890-2334
  S06_START: 1890,
  S06_SLOTS_FADE: 1920,
  S06_TEXT_APPEAR: 1980,
  S06_ICONS_APPEAR: 2070,
  S06_END: 2334
};
var PARTICLES = {
  INITIAL_COUNT: 10,
  MAX_COUNT: 50,
  SPAWN_INTERVAL: 6,
  // Frames between particle spawns (>= 6 for stagger)
  PARTICLE_SIZE: 20,
  FLOW_SPEED: 2,
  DRIFT_VARIATION: 0.5
};
var MEMORY = {
  SINGLE_SLOT_SIZE: 120,
  MULTI_SLOT_SIZE: 80,
  SLOT_GAP: 20,
  GLOW_INTENSITY: 15
};
var DIE = {
  SIZE: 60,
  ROLL_DURATION: 30
};

// src/proj_c9b2ab0e_8fbc_4e9a_a15e_252f94536675/index.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var ProjC9b2ab0e8fbc4e9aA15e252f94536675 = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion.useVideoConfig)();
  const minDim = Math.min(width, height);
  const fontSize = {
    xs: height * 0.018,
    sm: height * 0.022,
    md: height * 0.032,
    lg: height * 0.045,
    xl: height * 0.06
  };
  const spacing = {
    xs: minDim * 0.02,
    sm: minDim * 0.03,
    md: minDim * 0.05,
    lg: minDim * 0.08
  };
  const hueShift = (0, import_remotion.interpolate)(frame, [0, 2334], [0, 15]);
  const baseHue = 220;
  const backgroundStyle = {
    background: `radial-gradient(ellipse at center, 
      hsl(${baseHue + hueShift}, 25%, 12%) 0%, 
      hsl(${baseHue + hueShift + 20}, 20%, 18%) 70%)`
  };
  const s01Active = frame >= TIMING.S01_START && frame < TIMING.S01_END;
  const s01CommentCount = Math.min(
    Math.floor((frame - TIMING.S01_START) / PARTICLES.SPAWN_INTERVAL) + PARTICLES.INITIAL_COUNT,
    PARTICLES.MAX_COUNT
  );
  const s01Particles = [];
  if (s01Active) {
    for (let i = 0; i < s01CommentCount; i++) {
      const spawnFrame = TIMING.S01_START + i * PARTICLES.SPAWN_INTERVAL;
      if (spawnFrame <= frame) {
        const baseX = width / 2 + (Math.random() - 0.5) * width * 0.3;
        s01Particles.push({
          id: i,
          spawnFrame,
          x: baseX,
          y: (0, import_remotion.interpolate)(frame - spawnFrame, [0, 30], [-50, height * 0.4], {
            extrapolateRight: "clamp"
          }),
          targetY: height * 0.4,
          color: i % 3 === 0 ? COLORS.comment1 : i % 3 === 1 ? COLORS.comment2 : COLORS.comment3,
          size: PARTICLES.PARTICLE_SIZE,
          delay: i
        });
      }
    }
  }
  const memorySlotVisible = frame >= TIMING.S01_MEMORY_APPEAR;
  const memorySlotScale = (0, import_remotion.spring)({
    frame: frame - TIMING.S01_MEMORY_APPEAR,
    fps,
    config: SPRING_CONFIGS.settled
  });
  const s01HeroActive = frame >= TIMING.S01_HERO_START && frame <= TIMING.S01_HERO_END;
  const s02Active = frame >= TIMING.S02_START && frame < TIMING.S02_HERO_END;
  const s02FirstParticle = frame >= TIMING.S02_FIRST_COMMENT;
  const s02SecondParticle = frame >= TIMING.S02_FIRST_COMMENT + 30;
  const firstParticleY = s02FirstParticle ? (0, import_remotion.interpolate)(
    frame - TIMING.S02_FIRST_COMMENT,
    [0, 30],
    [height * 0.3, height * 0.45],
    { extrapolateRight: "clamp" }
  ) : height * 0.3;
  const secondParticleY = s02SecondParticle ? (0, import_remotion.interpolate)(
    frame - (TIMING.S02_FIRST_COMMENT + 30),
    [0, 30],
    [height * 0.5, height * 0.45],
    { extrapolateRight: "clamp" }
  ) : height * 0.5;
  const memoryPulse = frame >= TIMING.S02_MEMORY_PULSE;
  const pulseScale = memoryPulse ? (0, import_remotion.spring)({
    frame: frame - TIMING.S02_MEMORY_PULSE,
    fps,
    config: SPRING_CONFIGS.subtle
  }) : 1;
  const dieVisible = frame >= TIMING.S02_DIE_APPEAR;
  const dieScale = dieVisible ? (0, import_remotion.spring)({
    frame: frame - TIMING.S02_DIE_APPEAR,
    fps,
    config: SPRING_CONFIGS.responsive
  }) : 0;
  const s03Active = frame >= TIMING.S03_START && frame < TIMING.S03_END;
  const [memorySlot, setMemorySlot] = import_react.default.useState({ winner: null, frame: 0 });
  import_react.default.useEffect(() => {
    if (s03Active) {
      const cycle1 = frame >= TIMING.S03_NTH_COMMENT && frame < TIMING.S03_DIE_ROLL;
      const cycle2 = frame >= TIMING.S03_REPEAT && frame < TIMING.S03_REPEAT + 60;
      if (cycle1 && memorySlot.winner === null) {
        setMemorySlot({ winner: 1, frame });
      }
      if (frame >= TIMING.S03_SWAP && memorySlot.winner === 1) {
        setMemorySlot({ winner: 2, frame });
      }
      if (cycle2 && frame === TIMING.S03_REPEAT + 15) {
        setMemorySlot({ winner: 3, frame });
      }
      if (cycle2 && frame === TIMING.S03_REPEAT + 45) {
        setMemorySlot({ winner: 4, frame });
      }
    }
  }, [frame, s03Active, memorySlot.winner]);
  const dieRolling = frame >= TIMING.S03_DIE_ROLL && frame < TIMING.S03_DIE_ROLL + 30;
  const dieRollProgress = dieRolling ? (0, import_remotion.interpolate)(
    frame - TIMING.S03_DIE_ROLL,
    [0, 30],
    [0, 1],
    { extrapolateRight: "clamp" }
  ) : 0;
  const s05Active = frame >= TIMING.S05_START && frame < TIMING.S05_HERO_END;
  const slotTransformProgress = s05Active ? (0, import_remotion.spring)({
    frame: frame - TIMING.S05_START,
    fps,
    config: SPRING_CONFIGS.responsive
  }) : 0;
  const showFiveSlots = frame >= TIMING.S05_MULTI_SLOTS;
  const s06Active = frame >= TIMING.S06_START;
  const nameVisible = frame >= TIMING.S06_TEXT_APPEAR;
  const nameOpacity = nameVisible ? (0, import_remotion.interpolate)(
    frame - TIMING.S06_TEXT_APPEAR,
    [0, 15],
    [0, 1],
    { extrapolateRight: "clamp" }
  ) : 0;
  const nameY = nameVisible ? (0, import_remotion.spring)({
    frame: frame - TIMING.S06_TEXT_APPEAR,
    fps,
    config: SPRING_CONFIGS.settled
  }) : 0;
  const iconsVisible = frame >= TIMING.S06_ICONS_APPEAR;
  const iconsOpacity = iconsVisible ? (0, import_remotion.interpolate)(
    frame - TIMING.S06_ICONS_APPEAR,
    [0, 15],
    [0, 1],
    { extrapolateRight: "clamp" }
  ) : 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: { ...backgroundStyle, overflow: "hidden" }, children: [
    s01Active && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.Sequence, { from: 0, durationInFrames: TIMING.S01_END, children: [
      s01Particles.map((particle) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: particle.x,
            top: particle.y,
            width: particle.size,
            height: particle.size,
            borderRadius: "50%",
            background: particle.color,
            opacity: 0.7,
            boxShadow: `0 0 8px ${particle.color}`
          }
        },
        particle.id
      )),
      memorySlotVisible && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(-50%, -50%) scale(${memorySlotScale})`,
            width: MEMORY.SINGLE_SLOT_SIZE,
            height: MEMORY.SINGLE_SLOT_SIZE,
            borderRadius: minDim * 0.02,
            background: COLORS.glass,
            border: `2px solid ${COLORS.glassBorder}`,
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: fontSize.lg,
            color: COLORS.text,
            fontWeight: 600,
            opacity: s01HeroActive ? 1 : 0.8,
            boxShadow: s01HeroActive ? `0 0 ${MEMORY.GLOW_INTENSITY}px ${COLORS.accent}66` : "none"
          },
          children: "RAM"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            top: spacing.lg,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: fontSize.xl,
            fontWeight: 800,
            color: COLORS.white,
            textAlign: "center"
          },
          children: "Live Stream Giveaway"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            bottom: spacing.lg,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: fontSize.sm,
            color: COLORS.muted,
            textAlign: "center",
            maxWidth: width * 0.8,
            opacity: frame > 100 ? 1 : 0
          },
          children: frame < TIMING.S01_MEMORY_APPEAR ? "Millions of comments pouring in..." : frame < TIMING.S01_HERO_START ? "But you can't store them all" : "One slot. Infinite stream."
        }
      )
    ] }),
    s02Active && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.Sequence, { from: TIMING.S02_START, durationInFrames: TIMING.S02_HERO_END - TIMING.S02_START, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(-50%, -50%) scale(${pulseScale})`,
            width: MEMORY.SINGLE_SLOT_SIZE,
            height: MEMORY.SINGLE_SLOT_SIZE,
            borderRadius: minDim * 0.02,
            background: COLORS.glass,
            border: `2px solid ${COLORS.glassBorder}`,
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: fontSize.lg,
            color: COLORS.text,
            fontWeight: 600,
            boxShadow: `0 0 ${MEMORY.GLOW_INTENSITY}px ${COLORS.secondary}66`
          },
          children: "1x"
        }
      ),
      s02FirstParticle && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: "50%",
            top: firstParticleY,
            transform: "translateX(-50%)",
            width: PARTICLES.PARTICLE_SIZE * 1.2,
            height: PARTICLES.PARTICLE_SIZE * 1.2,
            borderRadius: "50%",
            background: COLORS.comment1,
            boxShadow: `0 0 12px ${COLORS.comment1}`
          }
        }
      ),
      s02SecondParticle && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: "50%",
            top: secondParticleY,
            transform: "translateX(-50%)",
            width: PARTICLES.PARTICLE_SIZE * 1.2,
            height: PARTICLES.PARTICLE_SIZE * 1.2,
            borderRadius: "50%",
            background: COLORS.comment3,
            boxShadow: `0 0 12px ${COLORS.comment3}`
          }
        }
      ),
      dieVisible && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: "50%",
            top: "35%",
            transform: `translate(-50%, -50%) scale(${dieScale})`,
            width: DIE.SIZE,
            height: DIE.SIZE,
            borderRadius: minDim * 0.015,
            background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: fontSize.md,
            fontWeight: 800,
            color: COLORS.white,
            boxShadow: `0 0 15px ${COLORS.primary}66`
          },
          children: "?"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            top: spacing.lg,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: fontSize.lg,
            fontWeight: 700,
            color: COLORS.white,
            textAlign: "center"
          },
          children: "Equal Probability?"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            bottom: spacing.lg,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: fontSize.sm,
            color: COLORS.muted,
            textAlign: "center",
            maxWidth: width * 0.8
          },
          children: "First vs Millionth Comment"
        }
      )
    ] }),
    s03Active && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.Sequence, { from: TIMING.S03_START, durationInFrames: TIMING.S03_END - TIMING.S03_START, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "div",
        {
          style: {
            position: "absolute",
            left: "50%",
            top: "45%",
            transform: "translate(-50%, -50%)",
            width: MEMORY.SINGLE_SLOT_SIZE,
            height: MEMORY.SINGLE_SLOT_SIZE,
            borderRadius: minDim * 0.02,
            background: COLORS.glass,
            border: `2px solid ${COLORS.glassBorder}`,
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            fontSize: fontSize.lg,
            fontWeight: 700,
            color: COLORS.success,
            boxShadow: `0 0 20px ${COLORS.success}66`
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: "Winner" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: fontSize.xl, fontWeight: 800 }, children: memorySlot.winner ? `#${memorySlot.winner}` : "---" })
          ]
        }
      ),
      frame >= TIMING.S03_NTH_COMMENT && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: "50%",
            top: "25%",
            width: DIE.SIZE * 1.2,
            height: DIE.SIZE * 1.2,
            borderRadius: minDim * 0.015,
            background: dieRolling ? `linear-gradient(${frame % 360}deg, ${COLORS.primary}, ${COLORS.accent})` : `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: fontSize.md,
            fontWeight: 800,
            color: COLORS.white,
            transform: dieRolling ? `translate(-50%, -50%) rotate(${dieRollProgress * 360}deg) scale(${1 + dieRollProgress * 0.2})` : "translate(-50%, -50%)",
            boxShadow: `0 0 15px ${COLORS.primary}66`
          },
          children: dieRolling ? "1/n" : "1/n"
        }
      ),
      frame >= TIMING.S03_NTH_COMMENT && frame < TIMING.S03_HERO_END && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: Array.from({ length: 5 }).map((_, i) => {
        const particleFrame = TIMING.S03_NTH_COMMENT + i * 20;
        if (frame < particleFrame || frame > particleFrame + 30) return null;
        const progress = (0, import_remotion.interpolate)(
          frame - particleFrame,
          [0, 30],
          [0, 1],
          { extrapolateRight: "clamp" }
        );
        const x = width * 0.3 + progress * width * 0.4;
        const y = height * 0.65 + Math.sin(progress * Math.PI) * 20;
        return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: x,
              top: y,
              width: PARTICLES.PARTICLE_SIZE * 0.8,
              height: PARTICLES.PARTICLE_SIZE * 0.8,
              borderRadius: "50%",
              background: COLORS.secondary,
              opacity: 0.6
            }
          },
          i
        );
      }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            top: spacing.lg,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: fontSize.xl,
            fontWeight: 800,
            color: COLORS.white,
            textAlign: "center"
          },
          children: "Reservoir Sampling"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            bottom: spacing.lg,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: fontSize.sm,
            color: COLORS.muted,
            textAlign: "center",
            maxWidth: width * 0.8
          },
          children: frame < TIMING.S03_DIE_ROLL ? "Keep one current winner" : frame < TIMING.S03_SWAP ? "Roll 1/n die" : frame < TIMING.S03_REPEAT ? "Replace or keep" : "Repeat for every comment"
        }
      )
    ] }),
    frame >= TIMING.S04_START && frame < TIMING.S05_START && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.S04_START, durationInFrames: TIMING.S05_START - TIMING.S04_START, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: DIE.SIZE * 1.2,
          height: DIE.SIZE * 1.2,
          borderRadius: minDim * 0.015,
          background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: fontSize.xl,
          fontWeight: 800,
          color: COLORS.white,
          boxShadow: `0 0 20px ${COLORS.primary}88`
        },
        children: "?"
      }
    ) }),
    s05Active && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.Sequence, { from: TIMING.S05_START, durationInFrames: TIMING.S05_HERO_END - TIMING.S05_START, children: [
      showFiveSlots && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: "50%",
            top: "45%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            gap: spacing.sm
          },
          children: Array.from({ length: 5 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                width: MEMORY.MULTI_SLOT_SIZE,
                height: MEMORY.MULTI_SLOT_SIZE,
                borderRadius: minDim * 0.02,
                background: COLORS.glass,
                border: `2px solid ${COLORS.glassBorder}`,
                backdropFilter: "blur(10px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: fontSize.md,
                fontWeight: 700,
                color: COLORS.primary,
                opacity: 0.8,
                transform: `scale(${slotTransformProgress})`
              },
              children: i + 1
            },
            i
          ))
        }
      ),
      frame >= TIMING.S05_PROBABILITY && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: "50%",
            top: "25%",
            transform: "translate(-50%, -50%)",
            width: DIE.SIZE * 1.2,
            height: DIE.SIZE * 1.2,
            borderRadius: minDim * 0.015,
            background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.secondary})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: fontSize.md,
            fontWeight: 800,
            color: COLORS.white,
            boxShadow: `0 0 15px ${COLORS.accent}66`
          },
          children: "5/n"
        }
      ),
      frame >= TIMING.S05_STREAM_REROUTE && frame < TIMING.S05_HERO_END && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: Array.from({ length: 8 }).map((_, i) => {
        const particleFrame = TIMING.S05_STREAM_REROUTE + i * 10;
        if (frame < particleFrame || frame > particleFrame + 25) return null;
        const progress = (0, import_remotion.interpolate)(
          frame - particleFrame,
          [0, 25],
          [0, 1],
          { extrapolateRight: "clamp" }
        );
        const x = width * 0.25 + progress * width * 0.5;
        const y = height * 0.65 + Math.sin(progress * Math.PI * 2) * 15;
        return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              left: x,
              top: y,
              width: PARTICLES.PARTICLE_SIZE * 0.7,
              height: PARTICLES.PARTICLE_SIZE * 0.7,
              borderRadius: "50%",
              background: COLORS.comment2,
              opacity: 0.5
            }
          },
          i
        );
      }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            top: spacing.lg,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: fontSize.xl,
            fontWeight: 800,
            color: COLORS.white,
            textAlign: "center"
          },
          children: "Challenge: 5 Winners"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            bottom: spacing.lg,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: fontSize.sm,
            color: COLORS.muted,
            textAlign: "center",
            maxWidth: width * 0.8
          },
          children: frame < TIMING.S05_PROBABILITY ? "Multiple memory slots" : "Modified probability: 5/n"
        }
      )
    ] }),
    s06Active && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.Sequence, { from: TIMING.S06_START, durationInFrames: TIMING.S06_END - TIMING.S06_START, children: [
      nameVisible && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: height * 0.35,
              left: "50%",
              transform: `translate(-50%, ${-50 + nameY * 50}%)`,
              fontSize: fontSize.xl,
              fontWeight: 800,
              color: COLORS.white,
              textAlign: "center",
              opacity: nameOpacity
            },
            children: "Prasanna"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: height * 0.42,
              left: "50%",
              transform: `translate(-50%, ${-50 + nameY * 50}%)`,
              fontSize: fontSize.md,
              color: COLORS.muted,
              textAlign: "center",
              opacity: nameOpacity
            },
            children: "Technical Architectures at Zoho"
          }
        )
      ] }),
      iconsVisible && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            top: height * 0.55,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: spacing.lg,
            opacity: iconsOpacity
          },
          children: ["Follow", "Share", "Like"].map((label, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                padding: spacing.sm,
                minWidth: 80,
                borderRadius: minDim * 0.02,
                background: COLORS.glass,
                border: `2px solid ${COLORS.glassBorder}`,
                backdropFilter: "blur(10px)",
                fontSize: fontSize.sm,
                fontWeight: 600,
                color: COLORS.white,
                textAlign: "center",
                cursor: "pointer"
              },
              children: label
            },
            label
          ))
        }
      ),
      frame >= TIMING.S06_START + 60 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            top: spacing.lg,
            left: "50%",
            transform: "translateX(-50%)",
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`,
            opacity: 0.6
          }
        }
      ),
      frame >= TIMING.S06_START + 30 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            bottom: spacing.lg,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: fontSize.sm,
            color: COLORS.muted,
            textAlign: "center"
          },
          children: "Follow for more engineering insights"
        }
      )
    ] })
  ] });
};
