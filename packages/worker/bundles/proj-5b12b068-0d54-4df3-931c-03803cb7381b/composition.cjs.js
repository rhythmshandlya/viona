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

// src/proj_5b12b068_0d54_4df3_931c_03803cb7381b/index.tsx
var index_exports = {};
__export(index_exports, {
  Proj5b12b0680d544df3931c03803cb7381b: () => Proj5b12b0680d544df3931c03803cb7381b
});
module.exports = __toCommonJS(index_exports);
var import_remotion6 = require("remotion");

// src/proj_5b12b068_0d54_4df3_931c_03803cb7381b/constants.ts
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
  glassBorder: "rgba(255, 255, 255, 0.2)",
  ember: "#f59e0b",
  cyan: "#22d3ee",
  mint: "#10b981",
  void: "#020617",
  slate: "#1e293b",
  gold: "#fbbf24"
};
var SPRING_SETTLED = { damping: 20, stiffness: 100, mass: 0.8 };
var getResponsiveSizes = (width, height) => {
  const minDim = Math.min(width, height);
  return {
    fontSize: {
      xs: height * 0.018,
      sm: height * 0.022,
      md: height * 0.032,
      lg: height * 0.045,
      xl: height * 0.06
    },
    spacing: {
      xs: minDim * 0.02,
      sm: minDim * 0.03,
      md: minDim * 0.05,
      lg: minDim * 0.08
    },
    borderRadius: minDim * 0.02,
    minDim
  };
};

// src/proj_5b12b068_0d54_4df3_931c_03803cb7381b/components/HeapTree.tsx
var import_remotion = require("remotion");
var import_jsx_runtime = require("react/jsx-runtime");
var HeapNode = ({
  x,
  y,
  size,
  parentX,
  parentY,
  label,
  startFrame,
  isStressed
}) => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const entrance = (0, import_remotion.spring)({
    frame: frame - startFrame,
    fps,
    config: { damping: 20, stiffness: 100 }
  });
  const shake = isStressed ? Math.sin(frame * 1.5) * 5 : 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { style: { opacity: entrance, transform: `scale(${entrance})` }, children: [
    parentX !== void 0 && parentY !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "line",
      {
        x1: parentX,
        y1: parentY,
        x2: x,
        y2: y,
        stroke: COLORS.muted,
        strokeWidth: 4,
        strokeDasharray: "8 8"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "circle",
      {
        cx: x + shake,
        cy: y + shake,
        r: size,
        fill: isStressed ? COLORS.danger : COLORS.primary,
        stroke: COLORS.white,
        strokeWidth: 2
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "text",
      {
        x: x + shake,
        y: y + shake + 5,
        textAnchor: "middle",
        fill: COLORS.white,
        fontSize: 24,
        fontWeight: "bold",
        children: label
      }
    )
  ] });
};
var HeapTree = ({ startFrame, isStressed }) => {
  const nodes = [
    { id: "1", label: "10", x: 540, y: 200 },
    { id: "2", label: "15", x: 300, y: 400, pid: "1" },
    { id: "3", label: "20", x: 780, y: 400, pid: "1" },
    { id: "4", label: "25", x: 200, y: 600, pid: "2" },
    { id: "5", label: "30", x: 400, y: 600, pid: "2" },
    { id: "6", label: "35", x: 680, y: 600, pid: "3" },
    { id: "7", label: "40", x: 880, y: 600, pid: "3" }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: "1080", height: "800", viewBox: "0 0 1080 800", children: nodes.map((n, i) => {
    const parent = nodes.find((p) => p.id === n.pid);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      HeapNode,
      {
        id: n.id,
        label: n.label,
        x: n.x,
        y: n.y,
        size: 40,
        parentX: parent?.x,
        parentY: parent?.y,
        startFrame: startFrame + i * 5,
        isStressed
      },
      n.id
    );
  }) });
};

// src/proj_5b12b068_0d54_4df3_931c_03803cb7381b/components/TimingWheel.tsx
var import_remotion2 = require("remotion");
var import_jsx_runtime2 = require("react/jsx-runtime");
var TimingWheel = ({
  size,
  slots,
  rotationSpeed = 1,
  accentColor = COLORS.secondary,
  isSecondary = false
}) => {
  const frame = (0, import_remotion2.useCurrentFrame)();
  const rotation = frame * rotationSpeed;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: {
    width: size,
    height: size,
    borderRadius: "50%",
    border: `8px solid ${accentColor}`,
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transform: `rotate(${rotation}deg)`,
    boxShadow: `0 0 40px ${accentColor}44`,
    background: isSecondary ? "transparent" : `${COLORS.void}88`
  }, children: [
    Array.from({ length: slots }).map((_, i) => {
      const angle = i / slots * 360;
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            width: 4,
            height: 20,
            background: i % 5 === 0 ? COLORS.white : accentColor,
            transform: `rotate(${angle}deg) translateY(-${size / 2 - 10}px)`,
            opacity: 0.6
          }
        },
        i
      );
    }),
    !isSecondary && Array.from({ length: 12 }).map((_, i) => {
      const angle = i / 12 * 360;
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            color: COLORS.white,
            fontSize: size * 0.05,
            fontWeight: "bold",
            transform: `rotate(${angle}deg) translateY(-${size * 0.35}px) rotate(${-angle - rotation}deg)`
          },
          children: i * 5
        },
        i
      );
    }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
      position: "absolute",
      width: 4,
      height: size * 0.45,
      background: COLORS.danger,
      bottom: "50%",
      transformOrigin: "bottom",
      borderRadius: 2,
      boxShadow: `0 0 10px ${COLORS.danger}88`
    } }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
      width: size * 0.1,
      height: size * 0.1,
      borderRadius: "50%",
      background: COLORS.white,
      zIndex: 2,
      boxShadow: `0 0 20px ${COLORS.white}`
    } })
  ] });
};

// src/components/visual/particles/ParticleStream.tsx
var import_react = __toESM(require("react"));
var import_remotion3 = require("remotion");
var import_jsx_runtime3 = require("react/jsx-runtime");
var ParticleStream = ({
  direction = "right",
  density = 30,
  color = "#06b6d4",
  secondaryColor,
  speed = 1,
  particleSize = 1,
  opacity = 0.8,
  shape = "circle",
  trails = false,
  trailLength = 1,
  depth = false,
  pulse = false,
  glowIntensity = 1
}) => {
  const frame = (0, import_remotion3.useCurrentFrame)();
  const { width, height, fps } = (0, import_remotion3.useVideoConfig)();
  const minDim = Math.min(width, height);
  const particles = import_react.default.useMemo(() => {
    return Array.from({ length: density }, (_, i) => {
      const hash1 = (i * 17 + 13) % 100;
      const hash2 = (i * 31 + 7) % 100;
      const hash3 = (i * 23 + 11) % 100;
      const hash4 = (i * 29 + 3) % 100;
      const hash5 = (i * 37 + 19) % 100;
      return {
        id: i,
        offset: hash1,
        // Position offset (0-100%)
        size: (hash2 * 0.6 + 40) / 100,
        // Size variation (0.4-1.0)
        speedVariation: (hash3 * 0.5 + 75) / 100,
        // Speed variation (0.75-1.25)
        delay: hash4 / 100 * 90,
        // Spread delays across more frames
        depthLayer: depth ? hash5 < 20 ? "near" : hash5 < 70 ? "mid" : "far" : "mid",
        shapeType: shape === "mixed" ? ["circle", "dot", "line"][Math.floor(hash4 / 34)] : shape,
        colorShift: (hash5 - 50) / 100 * 0.15
        // Subtle hue variation
      };
    });
  }, [density, depth, shape]);
  const baseSize = minDim * 8e-3 * particleSize;
  const cycleFrames = fps * 2.5 / speed;
  const pulseValue = pulse ? 1 + Math.sin(frame * 0.1) * 0.15 : 1;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        pointerEvents: "none"
      },
      children: particles.map((particle) => {
        const adjustedFrame = (frame - particle.delay) * particle.speedVariation * speed;
        const progress = (adjustedFrame % cycleFrames + cycleFrames) % cycleFrames / cycleFrames;
        if (adjustedFrame < 0) return null;
        let x, y;
        const crossPos = particle.offset / 100;
        const waveOffset = Math.sin(progress * Math.PI * 3 + particle.offset) * minDim * 5e-3;
        switch (direction) {
          case "right":
            x = (0, import_remotion3.interpolate)(progress, [0, 1], [-0.08, 1.08]) * width;
            y = crossPos * height + waveOffset;
            break;
          case "left":
            x = (0, import_remotion3.interpolate)(progress, [0, 1], [1.08, -0.08]) * width;
            y = crossPos * height + waveOffset;
            break;
          case "down":
            x = crossPos * width + waveOffset;
            y = (0, import_remotion3.interpolate)(progress, [0, 1], [-0.08, 1.08]) * height;
            break;
          case "up":
            x = crossPos * width + waveOffset;
            y = (0, import_remotion3.interpolate)(progress, [0, 1], [1.08, -0.08]) * height;
            break;
        }
        const depthMultiplier = particle.depthLayer === "near" ? 1.5 : particle.depthLayer === "far" ? 0.6 : 1;
        const depthOpacity = particle.depthLayer === "near" ? 1 : particle.depthLayer === "far" ? 0.5 : 0.8;
        const size = baseSize * particle.size * depthMultiplier * pulseValue;
        const fadeOpacity = (0, import_remotion3.interpolate)(
          progress,
          [0, 0.08, 0.92, 1],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        const particleColor = secondaryColor ? `color-mix(in srgb, ${color} ${50 + particle.colorShift * 100}%, ${secondaryColor})` : color;
        const trailDir = direction === "right" ? "270deg" : direction === "left" ? "90deg" : direction === "down" ? "0deg" : "180deg";
        const actualTrailLength = trails ? size * 4 * trailLength : 0;
        const glowLayers = [
          `0 0 ${size * 1.5 * glowIntensity}px ${particleColor}`,
          `0 0 ${size * 3 * glowIntensity}px ${particleColor}60`,
          `0 0 ${size * 5 * glowIntensity}px ${particleColor}30`
        ].join(", ");
        return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_react.default.Fragment, { children: [
          trails && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: x,
                top: y,
                width: particle.shapeType === "line" ? actualTrailLength : size,
                height: particle.shapeType === "line" ? size * 0.3 : size,
                borderRadius: particle.shapeType === "line" ? size * 0.15 : "50%",
                background: `linear-gradient(${trailDir}, ${particleColor}, transparent)`,
                opacity: fadeOpacity * opacity * depthOpacity * 0.4,
                transform: `translate(-50%, -50%)`
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "div",
            {
              style: {
                position: "absolute",
                left: x,
                top: y,
                width: particle.shapeType === "line" ? size * 2 : size,
                height: particle.shapeType === "line" ? size * 0.4 : particle.shapeType === "dot" ? size * 0.6 : size,
                borderRadius: particle.shapeType === "line" ? size * 0.2 : "50%",
                background: particle.shapeType === "dot" ? particleColor : `radial-gradient(circle at 30% 30%, ${lightenColor(particleColor, 30)}, ${particleColor})`,
                opacity: fadeOpacity * opacity * depthOpacity,
                boxShadow: glowLayers,
                transform: "translate(-50%, -50%)"
              }
            }
          )
        ] }, particle.id);
      })
    }
  );
};
function lightenColor(hex, percent) {
  if (hex.startsWith("color-mix")) return hex;
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, (num >> 8 & 255) + amt);
  const B = Math.min(255, (num & 255) + amt);
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
}

// src/components/visual/data/Counter.tsx
var import_remotion4 = require("remotion");
var import_jsx_runtime4 = require("react/jsx-runtime");
var Counter = ({
  from,
  to,
  startFrame,
  durationFrames,
  format = "none",
  prefix = "",
  suffix = "",
  decimals = 0,
  fontSize = 1,
  color = "#ffffff",
  fontWeight = 700,
  animationStyle = "smooth",
  glow = false,
  glowColor,
  gradient = false,
  gradientColors = ["#8b5cf6", "#06b6d4"],
  punchOnComplete = false,
  fontFamily
}) => {
  const frame = (0, import_remotion4.useCurrentFrame)();
  const { width } = (0, import_remotion4.useVideoConfig)();
  const rawProgress = (0, import_remotion4.interpolate)(
    frame,
    [startFrame, startFrame + durationFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const eased = applyEasing(rawProgress, animationStyle);
  const currentValue = from + (to - from) * eased;
  let scale = 1;
  if (punchOnComplete && rawProgress >= 1) {
    const completedFrames = frame - (startFrame + durationFrames);
    if (completedFrames < 15) {
      const punchProgress = completedFrames / 15;
      scale = 1 + Math.sin(punchProgress * Math.PI) * 0.08;
    }
  }
  const formattedValue = formatNumber(currentValue, format, decimals);
  const actualFontFamily = fontFamily || 'system-ui, -apple-system, "SF Pro Display", "Segoe UI", sans-serif';
  const actualGlowColor = glowColor || color;
  const glowShadow = glow ? [
    `0 0 ${width * 0.01}px ${actualGlowColor}`,
    `0 0 ${width * 0.02}px ${actualGlowColor}80`,
    `0 0 ${width * 0.04}px ${actualGlowColor}40`
  ].join(", ") : "none";
  const gradientStyle = gradient ? {
    background: `linear-gradient(135deg, ${gradientColors.join(", ")})`,
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text"
  } : {};
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    "span",
    {
      style: {
        display: "inline-block",
        fontFamily: actualFontFamily,
        fontSize: `${fontSize}em`,
        fontWeight,
        color: gradient ? void 0 : color,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.03em",
        lineHeight: 1,
        textShadow: glowShadow,
        transform: `scale(${scale})`,
        transformOrigin: "center",
        ...gradientStyle
      },
      children: [
        prefix && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { opacity: 0.8, marginRight: "0.05em" }, children: prefix }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { fontFeatureSettings: '"tnum"' }, children: formattedValue }),
        suffix && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { opacity: 0.8, marginLeft: "0.05em", fontWeight: 500 }, children: suffix })
      ]
    }
  );
};
function applyEasing(progress, style) {
  switch (style) {
    case "bounce":
      if (progress < 0.9) {
        return import_remotion4.Easing.out(import_remotion4.Easing.cubic)(progress / 0.9) * 1.05;
      }
      return 1.05 - 0.05 * ((progress - 0.9) / 0.1);
    case "spring":
      const springEased = 1 - Math.pow(1 - progress, 4);
      const oscillation = Math.sin(progress * Math.PI * 3) * Math.pow(1 - progress, 2) * 0.1;
      return springEased + oscillation;
    case "dramatic":
      return import_remotion4.Easing.bezier(0.22, 1, 0.36, 1)(progress);
    case "smooth":
    default:
      return 1 - Math.pow(1 - progress, 3);
  }
}
function formatNumber(value, format, decimals) {
  switch (format) {
    case "compact":
      return formatCompact(value, decimals);
    case "currency":
      return value.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    case "percent":
      return value.toFixed(decimals);
    default:
      if (decimals > 0) {
        return value.toFixed(decimals);
      }
      return Math.round(value).toLocaleString("en-US");
  }
}
function formatCompact(value, decimals = 1) {
  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (absValue >= 1e12) {
    return `${sign}${(absValue / 1e12).toFixed(decimals)}T`;
  }
  if (absValue >= 1e9) {
    return `${sign}${(absValue / 1e9).toFixed(decimals)}B`;
  }
  if (absValue >= 1e6) {
    return `${sign}${(absValue / 1e6).toFixed(decimals)}M`;
  }
  if (absValue >= 1e3) {
    return `${sign}${(absValue / 1e3).toFixed(decimals)}K`;
  }
  return `${sign}${decimals > 0 ? absValue.toFixed(decimals) : Math.round(absValue)}`;
}

// src/components/visual/shapes/GlowingOrb.tsx
var import_remotion5 = require("remotion");
var import_jsx_runtime5 = require("react/jsx-runtime");
var GlowingOrb = ({
  size = 1,
  color = "#8b5cf6",
  secondaryColor,
  glowIntensity = 1,
  pulseSpeed = 1,
  sparkle = false,
  ring = false,
  ringColor
}) => {
  const frame = (0, import_remotion5.useCurrentFrame)();
  const { fps, width, height } = (0, import_remotion5.useVideoConfig)();
  const minDim = Math.min(width, height);
  const cycleFrames = fps * 2 / pulseSpeed;
  const pulseProgress = frame % cycleFrames / cycleFrames;
  const primaryPulse = Math.sin(pulseProgress * Math.PI * 2);
  const secondaryPulse = Math.sin(pulseProgress * Math.PI * 4) * 0.3;
  const combinedPulse = primaryPulse * 0.7 + secondaryPulse;
  const scale = 1 + combinedPulse * 0.06;
  const glowFactor = glowIntensity * (1 + combinedPulse * 0.4);
  const orbSize = minDim * 0.08 * size;
  const actualSecondaryColor = secondaryColor || lightenColor2(color, 30);
  const gradient = `
    radial-gradient(circle at 35% 35%, ${lightenColor2(color, 50)}90, transparent 40%),
    radial-gradient(circle at 50% 50%, ${actualSecondaryColor}, ${color} 60%, ${darkenColor(color, 20)} 100%)
  `;
  const glowSize1 = orbSize * 0.4 * glowFactor;
  const glowSize2 = orbSize * 0.8 * glowFactor;
  const glowSize3 = orbSize * 1.2 * glowFactor;
  const sparkleRotation = frame * 2;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "div",
    {
      style: {
        position: "relative",
        width: orbSize,
        height: orbSize
      },
      children: [
        ring && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: "50%",
              left: "50%",
              width: orbSize * 1.6,
              height: orbSize * 1.6,
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              border: `${orbSize * 0.02}px solid ${ringColor || `${color}40`}`,
              opacity: 0.5 + combinedPulse * 0.2
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: "50%",
              left: "50%",
              width: orbSize * 2.5,
              height: orbSize * 2.5,
              transform: "translate(-50%, -50%)",
              background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`,
              pointerEvents: "none"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: gradient,
              boxShadow: `
            0 0 ${glowSize1}px ${color}60,
            0 0 ${glowSize2}px ${color}40,
            0 0 ${glowSize3}px ${color}20,
            inset 0 -${orbSize * 0.1}px ${orbSize * 0.2}px ${darkenColor(color, 30)}40,
            inset 0 ${orbSize * 0.05}px ${orbSize * 0.1}px ${lightenColor2(color, 40)}30
          `,
              transform: `scale(${scale})`
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: "15%",
              left: "20%",
              width: "30%",
              height: "20%",
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${lightenColor2(color, 60)}80, transparent)`,
              filter: "blur(2px)",
              pointerEvents: "none"
            }
          }
        ),
        sparkle && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: "50%",
              left: "50%",
              width: orbSize * 1.2,
              height: orbSize * 1.2,
              transform: `translate(-50%, -50%) rotate(${sparkleRotation}deg)`,
              pointerEvents: "none"
            },
            children: [0, 90, 180, 270].map((angle) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "div",
              {
                style: {
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: 2,
                  height: orbSize * 0.15,
                  background: `linear-gradient(to bottom, ${lightenColor2(color, 50)}, transparent)`,
                  transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-${orbSize * 0.5}px)`,
                  opacity: 0.6 + primaryPulse * 0.4
                }
              },
              angle
            ))
          }
        )
      ]
    }
  );
};
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}
function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map((x) => {
    const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
}
function lightenColor2(hex, percent) {
  const { r, g, b } = hexToRgb(hex);
  const amt = Math.round(2.55 * percent);
  return rgbToHex(Math.min(255, r + amt), Math.min(255, g + amt), Math.min(255, b + amt));
}
function darkenColor(hex, percent) {
  const { r, g, b } = hexToRgb(hex);
  const amt = Math.round(2.55 * percent);
  return rgbToHex(Math.max(0, r - amt), Math.max(0, g - amt), Math.max(0, b - amt));
}

// src/proj_5b12b068_0d54_4df3_931c_03803cb7381b/index.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
var Proj5b12b0680d544df3931c03803cb7381b = () => {
  const frame = (0, import_remotion6.useCurrentFrame)();
  const { width, height, fps } = (0, import_remotion6.useVideoConfig)();
  const { fontSize, minDim } = getResponsiveSizes(width, height);
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_remotion6.AbsoluteFill, { style: { backgroundColor: COLORS.bg, color: COLORS.text, fontFamily: "system-ui, sans-serif" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { position: "absolute", inset: 0, opacity: 0.15 }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
      width: "100%",
      height: "100%",
      backgroundImage: `linear-gradient(${COLORS.muted} 1px, transparent 1px), linear-gradient(90deg, ${COLORS.muted} 1px, transparent 1px)`,
      backgroundSize: "100px 100px"
    } }) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_remotion6.Sequence, { from: 0, durationInFrames: 60, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { display: "flex", justifyContent: "center", alignItems: "center", width: "100%", height: "100%" }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
      transform: `translateY(${(0, import_remotion6.interpolate)(
        (0, import_remotion6.spring)({ frame, fps, config: SPRING_SETTLED }),
        [0, 1],
        [-200, 0]
      )}px)`,
      textAlign: "center"
    }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("h1", { style: { fontSize: fontSize.xl, color: COLORS.accent, textShadow: `0 0 20px ${COLORS.accent}88` }, children: [
      "SYSTEM DESIGN",
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("br", {}),
      "CHALLENGE"
    ] }) }) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_remotion6.Sequence, { from: 60, durationInFrames: 210, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 200 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { width: 400, height: 200, border: `4px solid ${COLORS.muted}`, borderTop: "none", borderRadius: "0 0 100px 100px", position: "relative" }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { position: "absolute", top: -400, left: 0, width: "100%", height: 400 }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(ParticleStream, { direction: "down", density: 40, color: COLORS.accent, speed: 2 }) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { marginTop: 200 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          Counter,
          {
            from: 0,
            to: 1e7,
            startFrame: 10,
            durationFrames: 120,
            format: "none",
            fontSize: fontSize.xl / 16,
            color: COLORS.warning,
            glow: true
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { fontSize: fontSize.md, textAlign: "center", marginTop: 20 }, children: "TASKS / SEC" })
      ] })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_remotion6.Sequence, { from: 270, durationInFrames: 330, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h2", { style: { fontSize: fontSize.lg, marginBottom: 50 }, children: "Priority Queue (Heap)" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(HeapTree, { startFrame: 0 })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_remotion6.Sequence, { from: 600, durationInFrames: 420, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
        position: "absolute",
        top: 200,
        fontSize: fontSize.xl,
        fontWeight: "bold",
        color: COLORS.danger,
        opacity: (0, import_remotion6.interpolate)(frame - 600, [150, 160, 170, 180], [0, 1, 0, 1], { extrapolateRight: "clamp" })
      }, children: "O(log n)" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(HeapTree, { startFrame: 0, isStressed: frame > 750 })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_remotion6.Sequence, { from: 1020, durationInFrames: 570, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h2", { style: { fontSize: fontSize.lg, marginBottom: 50, color: COLORS.success }, children: "O(1) CONSTANT TIME" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
        transform: `scale(${(0, import_remotion6.spring)({ frame: frame - 1150, fps, config: SPRING_SETTLED })})`
      }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(TimingWheel, { size: minDim * 0.7, slots: 60, rotationSpeed: 0.5 }) }),
      frame > 1350 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
        position: "absolute",
        left: (0, import_remotion6.interpolate)(frame, [1350, 1380], [200, 540], { extrapolateRight: "clamp" }),
        top: (0, import_remotion6.interpolate)(frame, [1350, 1365, 1380], [200, 400, 600], { extrapolateRight: "clamp" }),
        opacity: (0, import_remotion6.interpolate)(frame, [1380, 1390], [1, 0], { extrapolateLeft: "clamp" })
      }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(GlowingOrb, { size: 0.5, color: COLORS.accent, sparkle: true }) })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_remotion6.Sequence, { from: 1590, durationInFrames: 630, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { position: "relative" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { position: "absolute", left: "50%", top: "50%", transformOrigin: "center", translate: "-50% -50%", zIndex: 0 }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(TimingWheel, { size: minDim * 0.9, slots: 60, rotationSpeed: 0.05, accentColor: COLORS.primary, isSecondary: true }) }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { zIndex: 1 }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(TimingWheel, { size: minDim * 0.5, slots: 60, rotationSpeed: 3 }) }),
        frame > 2050 && frame < 2200 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(ParticleStream, { direction: "down", density: 20, color: COLORS.accent, speed: 3 }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { position: "absolute", bottom: 200, fontSize: fontSize.md, textAlign: "center", padding: "0 80px" }, children: "Levels cascade tasks down when they tick!" })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_remotion6.Sequence, { from: 2250, durationInFrames: 390, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", gap: 40, marginBottom: 100 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(TimingWheel, { size: minDim * 0.3, slots: 12, rotationSpeed: 2, accentColor: COLORS.muted, isSecondary: true }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(TimingWheel, { size: minDim * 0.3, slots: 12, rotationSpeed: -2, accentColor: COLORS.muted, isSecondary: true })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", gap: 100, alignItems: "center" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
          background: COLORS.white,
          color: COLORS.bg,
          padding: "20px 40px",
          borderRadius: 20,
          fontWeight: "bold",
          fontSize: fontSize.md,
          transform: `scale(${(0, import_remotion6.spring)({ frame: frame - 2450, fps, config: SPRING_SETTLED })})`
        }, children: "KAFKA" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
          background: COLORS.white,
          color: COLORS.bg,
          padding: "20px 40px",
          borderRadius: 20,
          fontWeight: "bold",
          fontSize: fontSize.md,
          transform: `scale(${(0, import_remotion6.spring)({ frame: frame - 2470, fps, config: SPRING_SETTLED })})`
        }, children: "NETTY" })
      ] })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_remotion6.Sequence, { from: 2640, durationInFrames: 327, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h2", { style: { fontSize: fontSize.xl, color: COLORS.accent }, children: "PRASANNA" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { fontSize: fontSize.md, color: COLORS.muted }, children: "ZOHO ENGINEER" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
        marginTop: 100,
        background: COLORS.primary,
        padding: "24px 80px",
        borderRadius: 50,
        fontSize: fontSize.md,
        fontWeight: "bold",
        transform: `scale(${(0, import_remotion6.interpolate)(
          Math.sin(frame * 0.1),
          [-1, 1],
          [0.95, 1.05]
        )})`
      }, children: "FOLLOW" })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
      position: "absolute",
      bottom: 0,
      left: 0,
      height: 10,
      background: COLORS.accent,
      width: `${frame / 2967 * 100}%`
    } })
  ] });
};
