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

// src/proj_bba70ece_9932_4382_98ea_35882692ae7c/Main.tsx
var Main_exports = {};
__export(Main_exports, {
  default: () => Main
});
module.exports = __toCommonJS(Main_exports);
var import_remotion5 = require("remotion");

// src/proj_bba70ece_9932_4382_98ea_35882692ae7c/scenes/scene_1.tsx
var import_three = require("@remotion/three");
var import_remotion = require("remotion");
var import_jsx_runtime = require("react/jsx-runtime");
var COLORS = {
  background: "#0f0f23",
  primary: "#3498db",
  secondary: "#f1c40f",
  accent: "#e74c3c",
  success: "#22c55e",
  white: "#ffffff",
  grid: "#2a2a4a"
};
var CarBody = ({ frame, fps, color }) => {
  const bounce = (0, import_remotion.spring)({
    frame,
    fps,
    config: { damping: 10, stiffness: 100 }
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { scale: bounce, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", { position: [0, 0.5, 0], children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: [2.5, 0.6, 1.2] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color, roughness: 0.2, metalness: 0.8 })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", { position: [-0.2, 1, 0], children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: [1.2, 0.5, 1] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color: "#333", transparent: true, opacity: 0.6, metalness: 1 })
    ] }),
    [[-0.8, 0.2, 0.65], [0.8, 0.2, 0.65], [-0.8, 0.2, -0.65], [0.8, 0.2, -0.65]].map((pos, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", { position: pos, rotation: [Math.PI / 2, 0, 0], children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("cylinderGeometry", { args: [0.3, 0.3, 0.2, 24] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color: "#111" })
    ] }, i))
  ] });
};
var Spoiler = ({ frame, fps }) => {
  const assemblyProgress = (0, import_remotion.spring)({
    frame: frame - 40,
    fps,
    config: { damping: 12, stiffness: 60 }
  });
  const posY = (0, import_remotion.interpolate)(assemblyProgress, [0, 1], [3, 0.85]);
  const scale = (0, import_remotion.interpolate)(assemblyProgress, [0, 1], [0.5, 1]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", { position: [-1.1, posY, 0], scale, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: [0.3, 0.05, 1.1] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color: COLORS.accent })
  ] });
};
var GarageFloor = ({ width }) => {
  const gridSize = width * 0.02;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { position: [0, -0.1, 0], children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("gridHelper", { args: [20, 20, COLORS.grid, COLORS.grid] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", { rotation: [-Math.PI / 2, 0, 0], position: [0, -0.05, 0], children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [50, 50] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color: COLORS.background })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", { position: [0, -0.2, 0], children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("cylinderGeometry", { args: [2, 2.2, 0.4, 32] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color: "#222", metalness: 0.5, roughness: 0.2 })
    ] })
  ] });
};
var Scene = () => {
  const { width, height, fps } = (0, import_remotion.useVideoConfig)();
  const frame = (0, import_remotion.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const rotation = (0, import_remotion.interpolate)(frame, [0, 175], [0, Math.PI * 2]);
  const colorIndex = Math.floor((0, import_remotion.interpolate)(frame, [60, 150], [0, 3], { extrapolateRight: "clamp" }));
  const activeColor = [COLORS.primary, COLORS.secondary, COLORS.accent, COLORS.success][colorIndex];
  const titleSpring = (0, import_remotion.spring)({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 }
  });
  const labels = ["AERODYNAMICS", "MODULAR CHASSIS", "PAINT FINISH"];
  const currentLabel = labels[Math.min(colorIndex, labels.length - 1)];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { style: { backgroundColor: COLORS.background, fontFamily: "sans-serif" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      import_three.ThreeCanvas,
      {
        width,
        height,
        camera: { position: [5, 4, 8], fov: 45 },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ambientLight", { intensity: 0.6 }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pointLight", { position: [10, 10, 10], intensity: 1.5, color: COLORS.white }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("spotLight", { position: [-5, 10, 5], intensity: 0.8, angle: 0.3, penumbra: 1 }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { rotation: [0, rotation, 0], children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CarBody, { frame, fps, color: activeColor }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spoiler, { frame, fps }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GarageFloor, { width })
          ] })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: 0, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      position: "absolute",
      top: height * 0.05,
      width: "100%",
      display: "flex",
      justifyContent: "center",
      opacity: titleSpring
    }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { style: {
      color: "white",
      fontSize: minDim * 0.08,
      fontWeight: "900",
      textTransform: "uppercase",
      letterSpacing: "4px",
      margin: 0,
      background: `linear-gradient(to right, ${COLORS.primary}, ${COLORS.accent})`,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      filter: `drop-shadow(0 2px 10px rgba(0,0,0,0.3))`
    }, children: "Modular Assembly" }) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
      position: "absolute",
      bottom: height * 0.1,
      left: 0,
      right: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: minDim * 0.02
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
        padding: `${minDim * 0.02}px ${minDim * 0.05}px`,
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        backdropFilter: "blur(10px)",
        borderRadius: minDim * 0.02,
        border: `1px solid rgba(255, 255, 255, 0.2)`,
        color: "white",
        fontSize: minDim * 0.04,
        fontWeight: "600",
        transition: "all 0.3s ease"
      }, children: [
        "STATUS: ",
        frame < 50 ? "ASSEMBLING" : "COMPLETE"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
        fontSize: minDim * 0.035,
        color: activeColor,
        fontWeight: "bold",
        letterSpacing: "2px",
        textShadow: `0 0 15px ${activeColor}66`
      }, children: currentLabel })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      position: "absolute",
      right: width * 0.05,
      top: "40%",
      display: "flex",
      flexDirection: "column",
      gap: minDim * 0.03
    }, children: [COLORS.primary, COLORS.secondary, COLORS.accent, COLORS.success].map((c, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          width: minDim * 0.05,
          height: minDim * 0.05,
          borderRadius: "50%",
          backgroundColor: c,
          border: `3px solid ${i === colorIndex ? "white" : "transparent"}`,
          transform: i === colorIndex ? "scale(1.3)" : "scale(1)",
          transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          boxShadow: i === colorIndex ? `0 0 20px ${c}` : "none"
        }
      },
      c
    )) })
  ] });
};
var scene_1_default = Scene;

// src/proj_bba70ece_9932_4382_98ea_35882692ae7c/scenes/scene_2.tsx
var import_three2 = require("@remotion/three");
var import_remotion2 = require("remotion");
var THREE = __toESM(require("three"));
var import_react = require("react");
var import_jsx_runtime2 = require("react/jsx-runtime");
var COLORS2 = {
  background: "#1a1a1a",
  primary: "#3498db",
  secondary: "#f1c40f",
  accent: "#e74c3c",
  green: "#2ecc71",
  white: "#ffffff",
  grid: "#333333"
};
var CarModel = ({ rotationY, positionX }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("group", { position: [positionX, -0.5, 0], rotation: [0, rotationY, 0], children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("mesh", { position: [0, 0.2, 0], children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("boxGeometry", { args: [2.2, 0.4, 1] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("meshStandardMaterial", { color: "#333333", metalness: 0.8, roughness: 0.2 })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("mesh", { position: [0.7, 0.5, 0], children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("boxGeometry", { args: [0.8, 0.2, 0.9] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("meshStandardMaterial", { color: COLORS2.secondary, metalness: 0.6, roughness: 0.3 })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("mesh", { position: [-0.2, 0.8, 0], children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("boxGeometry", { args: [1, 0.1, 0.8] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("meshStandardMaterial", { color: COLORS2.primary, metalness: 0.6, roughness: 0.3 })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("mesh", { position: [-0.2, 0.45, 0.46], children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("boxGeometry", { args: [1, 0.5, 0.1] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("meshStandardMaterial", { color: COLORS2.accent, metalness: 0.6, roughness: 0.3 })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("mesh", { position: [-0.8, 0.45, 0], children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("boxGeometry", { args: [0.6, 0.5, 0.9] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("meshStandardMaterial", { color: COLORS2.green, metalness: 0.6, roughness: 0.3 })
    ] }),
    [[-0.7, 0, 0.5], [0.7, 0, 0.5], [-0.7, 0, -0.5], [0.7, 0, -0.5]].map((pos, i) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("mesh", { position: pos, rotation: [Math.PI / 2, 0, 0], children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("cylinderGeometry", { args: [0.3, 0.3, 0.2, 24] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("meshStandardMaterial", { color: "#111111" })
    ] }, i)),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("mesh", { position: [-1, 0.7, 0], children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("boxGeometry", { args: [0.2, 0.05, 0.8] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("meshStandardMaterial", { color: "#222222" })
    ] })
  ] });
};
var Floor = ({ offset }) => {
  const gridHelper = (0, import_react.useMemo)(() => new THREE.GridHelper(100, 100, 4473924, 2236962), []);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("group", { position: [offset, -0.5, 0], children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("primitive", { object: gridHelper }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("mesh", { rotation: [-Math.PI / 2, 0, 0], position: [0, -0.01, 0], children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("planeGeometry", { args: [100, 100] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("meshStandardMaterial", { color: COLORS2.background })
    ] })
  ] });
};
function ConstructionScene() {
  const { width, height, fps } = (0, import_remotion2.useVideoConfig)();
  const frame = (0, import_remotion2.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const orbitRotation = (0, import_remotion2.interpolate)(frame, [0, 150], [0, Math.PI * 2]);
  const panProgress = (0, import_remotion2.spring)({
    frame: frame - 100,
    fps,
    config: { damping: 20, stiffness: 60 }
  });
  const cameraX = (0, import_remotion2.interpolate)(panProgress, [0, 1], [0, 10]);
  const carX = (0, import_remotion2.interpolate)(panProgress, [0, 1], [0, -2]);
  const cameraZ = (0, import_remotion2.interpolate)(frame, [0, 75, 150], [5, 3.5, 8]);
  const titleOpacity = (0, import_remotion2.interpolate)(frame, [0, 20], [1, 1]);
  const labelOpacity = (0, import_remotion2.interpolate)(frame, [0, 30, 90, 110], [0, 1, 1, 0]);
  const labelScale = (0, import_remotion2.spring)({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 }
  });
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_remotion2.AbsoluteFill, { style: { backgroundColor: COLORS2.background }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      import_three2.ThreeCanvas,
      {
        width,
        height,
        camera: { position: [cameraX, 1.5, cameraZ], fov: 45 },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ambientLight", { intensity: 0.6 }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("pointLight", { position: [10, 10, 10], intensity: 1.5 }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("spotLight", { position: [-5, 10, 5], angle: 0.3, penumbra: 1, intensity: 2 }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            CarModel,
            {
              rotationY: orbitRotation,
              positionX: carX
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Floor, { offset: 0 }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("mesh", { position: [carX + 1.2, 0.8, 0], scale: labelScale * labelOpacity, children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("sphereGeometry", { args: [0.05, 16, 16] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("meshStandardMaterial", { color: COLORS2.secondary, emissive: COLORS2.secondary, emissiveIntensity: 1 })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("mesh", { position: [carX - 0.5, 0.4, 0.7], scale: labelScale * labelOpacity, children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("sphereGeometry", { args: [0.05, 16, 16] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("meshStandardMaterial", { color: COLORS2.accent, emissive: COLORS2.accent, emissiveIntensity: 1 })
          ] })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
      position: "absolute",
      top: height * 0.05,
      width: "100%",
      textAlign: "center",
      color: COLORS2.white,
      fontFamily: "system-ui, sans-serif",
      opacity: titleOpacity
    }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h1", { style: {
      fontSize: minDim * 0.06,
      margin: 0,
      textTransform: "uppercase",
      letterSpacing: "0.2em",
      fontWeight: 900,
      textShadow: "0 0 20px rgba(255,255,255,0.3)"
    }, children: "Modular Assembly" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: {
      position: "absolute",
      bottom: height * 0.1,
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: minDim * 0.02
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_remotion2.Sequence, { from: 20, layout: "none", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
        background: "rgba(255, 255, 255, 0.1)",
        backdropFilter: "blur(10px)",
        padding: `${minDim * 0.02}px ${minDim * 0.05}px`,
        borderRadius: minDim * 0.05,
        border: "1px solid rgba(255, 255, 255, 0.2)",
        color: COLORS2.white,
        fontSize: minDim * 0.035,
        opacity: labelOpacity,
        transform: `scale(${labelScale})`,
        fontWeight: 500
      }, children: "Vibrant Color Profiles Applied" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_remotion2.Sequence, { from: 110, layout: "none", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
        color: COLORS2.primary,
        fontSize: minDim * 0.04,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.1em"
      }, children: "Transitioning to Workshop..." }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
      position: "absolute",
      right: minDim * 0.05,
      top: height * 0.2,
      width: minDim * 0.15,
      height: height * 0.4,
      background: "rgba(255, 255, 255, 0.05)",
      borderRadius: minDim * 0.02,
      border: "1px solid rgba(255, 255, 255, 0.1)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-around",
      alignItems: "center",
      opacity: labelOpacity
    }, children: [COLORS2.accent, COLORS2.secondary, COLORS2.primary, COLORS2.green].map((c, i) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
      width: minDim * 0.06,
      height: minDim * 0.06,
      borderRadius: "50%",
      backgroundColor: c,
      boxShadow: `0 0 15px ${c}66`
    } }, i)) })
  ] });
}

// src/proj_bba70ece_9932_4382_98ea_35882692ae7c/scenes/scene_3.tsx
var import_three3 = require("@remotion/three");
var import_remotion3 = require("remotion");
var import_jsx_runtime3 = require("react/jsx-runtime");
var COLORS3 = {
  background: "#1a1a1a",
  blue: "#3498db",
  yellow: "#f1c40f",
  red: "#e74c3c",
  green: "#2ecc71",
  grid: "#333333",
  wireframe: "#444444"
};
var CarModel2 = ({ color, isWireframe, progress }) => {
  const meshOpacity = isWireframe ? 0.3 : (0, import_remotion3.interpolate)(progress, [0, 1], [0, 1]);
  const scale = isWireframe ? 1 : (0, import_remotion3.interpolate)(progress, [0, 0.2, 1], [0, 1.1, 1]);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("group", { scale, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("mesh", { position: [0, 0.5, 0], children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("boxGeometry", { args: [2, 0.5, 4] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "meshStandardMaterial",
        {
          color,
          wireframe: isWireframe,
          transparent: true,
          opacity: meshOpacity
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("mesh", { position: [0, 1.2, -0.5], children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("boxGeometry", { args: [1.8, 0.8, 2] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "meshStandardMaterial",
        {
          color,
          wireframe: isWireframe,
          transparent: true,
          opacity: meshOpacity * 0.8
        }
      )
    ] }),
    [-1, 1].map(
      (x) => [-1.5, 1.5].map((z) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("mesh", { position: [x * 1.1, 0.4, z], rotation: [0, 0, Math.PI / 2], children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("cylinderGeometry", { args: [0.4, 0.4, 0.3, 24] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("meshStandardMaterial", { color: "#222" })
      ] }, `${x}-${z}`))
    )
  ] });
};
var Panel = ({ startPos, endPos, progress, color }) => {
  const currentPos = [
    (0, import_remotion3.interpolate)(progress, [0, 1], [startPos[0], endPos[0]]),
    (0, import_remotion3.interpolate)(progress, [0, 1], [startPos[1], endPos[1]]),
    (0, import_remotion3.interpolate)(progress, [0, 1], [startPos[2], endPos[2]])
  ];
  const opacity = (0, import_remotion3.interpolate)(progress, [0, 0.2], [0, 1]);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("mesh", { position: currentPos, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("boxGeometry", { args: [2.1, 0.1, 1.5] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("meshStandardMaterial", { color, transparent: true, opacity })
  ] });
};
var GarageScene = () => {
  const frame = (0, import_remotion3.useCurrentFrame)();
  const { width, height, fps } = (0, import_remotion3.useVideoConfig)();
  const minDim = Math.min(width, height);
  const camX = (0, import_remotion3.interpolate)(frame, [0, 150], [-6, 6], { extrapolateRight: "clamp" });
  const assemblySpring = (0, import_remotion3.spring)({
    frame: frame - 60,
    fps,
    config: { damping: 12, stiffness: 60 }
  });
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_remotion3.AbsoluteFill, { style: { backgroundColor: COLORS3.background }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      import_three3.ThreeCanvas,
      {
        width,
        height,
        camera: { position: [camX, 4, 10], fov: 45 },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("ambientLight", { intensity: 0.6 }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("directionalLight", { position: [10, 10, 5], intensity: 1.5 }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("pointLight", { position: [-10, 5, -5], intensity: 0.5, color: COLORS3.blue }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("gridHelper", { args: [100, 50, COLORS3.grid, COLORS3.grid], position: [0, 0, 0] }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("group", { position: [-6, 0, 0], children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(CarModel2, { color: COLORS3.yellow, isWireframe: false, progress: 1 }) }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("group", { position: [6, 0, 0], children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(CarModel2, { color: COLORS3.wireframe, isWireframe: true, progress: 1 }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              Panel,
              {
                startPos: [5, 5, 0],
                endPos: [0, 0.76, 1.2],
                progress: assemblySpring,
                color: COLORS3.blue
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              Panel,
              {
                startPos: [8, 2, -2],
                endPos: [0, 0.76, -1.2],
                progress: (0, import_remotion3.spring)({ frame: frame - 80, fps, config: { damping: 14 } }),
                color: COLORS3.blue
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              Panel,
              {
                startPos: [2, 6, 4],
                endPos: [0, 1.6, -0.5],
                progress: (0, import_remotion3.spring)({ frame: frame - 100, fps, config: { damping: 15 } }),
                color: COLORS3.blue
              }
            )
          ] })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_remotion3.Sequence, { from: 0, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
      position: "absolute",
      top: height * 0.05,
      width: "100%",
      textAlign: "center",
      color: "white",
      fontSize: minDim * 0.05,
      fontFamily: "sans-serif",
      fontWeight: "bold",
      textTransform: "uppercase",
      letterSpacing: "0.2em"
    }, children: "Modular Assembly" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_remotion3.Sequence, { from: 110, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
      position: "absolute",
      bottom: height * 0.15,
      left: "50%",
      transform: "translateX(-50%)",
      backgroundColor: "rgba(52, 152, 219, 0.2)",
      padding: `${minDim * 0.02}px ${minDim * 0.05}px`,
      borderRadius: minDim * 0.02,
      border: `2px solid ${COLORS3.blue}`,
      backdropFilter: "blur(10px)",
      color: "white",
      fontSize: minDim * 0.04,
      fontFamily: "sans-serif",
      opacity: (0, import_remotion3.spring)({ frame: frame - 110, fps })
    }, children: "STATUS: APPLYING BLUE METALLIC" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
      position: "absolute",
      top: "40%",
      right: (0, import_remotion3.interpolate)(frame, [0, 150], [-200, 100], { extrapolateRight: "clamp" }),
      display: "flex",
      flexDirection: "column",
      gap: minDim * 0.02
    }, children: ["Material: Alloy", "Color: #3498db", "Module: Body_North"].map((text, i) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
      background: "rgba(255,255,255,0.1)",
      color: COLORS3.blue,
      padding: "5px 15px",
      borderRadius: "4px",
      fontFamily: "monospace",
      fontSize: minDim * 0.02,
      borderLeft: `4px solid ${COLORS3.blue}`
    }, children: text }, i)) })
  ] });
};
var scene_3_default = GarageScene;

// src/proj_bba70ece_9932_4382_98ea_35882692ae7c/scenes/scene_4.tsx
var import_three4 = require("@remotion/three");
var import_remotion4 = require("remotion");
var THREE2 = __toESM(require("three"));
var import_react2 = require("react");
var import_jsx_runtime4 = require("react/jsx-runtime");
var COLORS4 = {
  bg: "#1a1a1a",
  primary: "#3498db",
  secondary: "#f1c40f",
  accent: "#e74c3c",
  grid: "#333333",
  brad: "#2ecc71",
  blippi: "#e67e22"
};
var CarModel3 = ({ color, position, assembledProgress }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("group", { position, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("mesh", { position: [0, 0.2, 0], children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("boxGeometry", { args: [2, 0.3, 1] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("meshStandardMaterial", { color: "#444" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("mesh", { position: [0, 0.6, 0], scale: [assembledProgress, assembledProgress, assembledProgress], children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("boxGeometry", { args: [1.8, 0.6, 0.9] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("meshStandardMaterial", { color, metalness: 0.7, roughness: 0.2 })
    ] }),
    [-0.7, 0.7].map((x) => [-0.5, 0.5].map((z) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("mesh", { position: [x, 0.1, z], rotation: [Math.PI / 2, 0, 0], children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("cylinderGeometry", { args: [0.25, 0.25, 0.2, 16] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("meshStandardMaterial", { color: "#111" })
    ] }, `${x}-${z}`)))
  ] });
};
var Character = ({ color, position, waveAmount, scale }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("group", { position, scale: [scale, scale, scale], children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("mesh", { position: [0, 0.6, 0], children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("capsuleGeometry", { args: [0.2, 0.6, 4, 8] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("meshStandardMaterial", { color })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("mesh", { position: [0, 1.3, 0], children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("sphereGeometry", { args: [0.18, 16, 16] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("meshStandardMaterial", { color: "#ffdbac" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("group", { position: [0.2, 1, 0], rotation: [0, 0, -waveAmount * 1.5], children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("mesh", { position: [0, 0.2, 0], children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("boxGeometry", { args: [0.08, 0.4, 0.08] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("meshStandardMaterial", { color })
    ] }) })
  ] });
};
function ModularAssemblyScene() {
  const { width, height, fps } = (0, import_remotion4.useVideoConfig)();
  const frame = (0, import_remotion4.useCurrentFrame)();
  const minDim = Math.min(width, height);
  const assemblyProgress = (0, import_remotion4.interpolate)(frame, [0, 40], [0.8, 1], {
    extrapolateRight: "clamp"
  });
  const cameraZ = (0, import_remotion4.interpolate)(frame, [0, 80], [3, 8], {
    extrapolateRight: "clamp"
  });
  const cameraX = (0, import_remotion4.interpolate)(frame, [0, 80], [3, 0], {
    extrapolateRight: "clamp"
  });
  const car1X = -3;
  const car2X = 2.5;
  const bradEntrance = (0, import_remotion4.spring)({
    frame: frame - 40,
    fps,
    config: { damping: 12, stiffness: 100 }
  });
  const blippiEntrance = (0, import_remotion4.spring)({
    frame: frame - 55,
    fps,
    config: { damping: 12, stiffness: 100 }
  });
  const waving = Math.sin(frame * 0.2) * 0.5 + 0.5;
  const floorGrid = (0, import_react2.useMemo)(() => {
    return new THREE2.GridHelper(20, 20, COLORS4.grid, COLORS4.grid);
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_remotion4.AbsoluteFill, { style: { backgroundColor: COLORS4.bg }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      import_three4.ThreeCanvas,
      {
        width,
        height,
        camera: { position: [cameraX, 2, cameraZ], fov: 45 },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("ambientLight", { intensity: 0.6 }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("pointLight", { position: [5, 5, 5], intensity: 1.5 }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("directionalLight", { position: [-5, 8, 2], intensity: 0.8 }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("primitive", { object: floorGrid, position: [0, -0.01, 0] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(CarModel3, { color: COLORS4.secondary, position: [car1X, 0, 0], assembledProgress: 1 }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(CarModel3, { color: COLORS4.primary, position: [car2X, 0, 0], assembledProgress: assemblyProgress }),
          frame > 40 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            Character,
            {
              color: COLORS4.brad,
              position: [car2X + 1.2, 0, 1],
              waveAmount: waving,
              scale: bradEntrance
            }
          ),
          frame > 55 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            Character,
            {
              color: COLORS4.blippi,
              position: [car2X + 2, 0, 0.8],
              waveAmount: waving * 0.8,
              scale: blippiEntrance
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_remotion4.Sequence, { from: 0, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
      position: "absolute",
      top: height * 0.05,
      width: "100%",
      textAlign: "center",
      color: "white",
      fontSize: minDim * 0.05,
      fontFamily: "sans-serif",
      fontWeight: "bold",
      opacity: (0, import_remotion4.interpolate)(frame, [0, 30], [0, 1])
    }, children: "MODULAR ASSEMBLY COMPLETE" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_remotion4.Sequence, { from: 60, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: {
      position: "absolute",
      bottom: height * 0.15,
      left: width * 0.55,
      display: "flex",
      flexDirection: "column",
      gap: minDim * 0.02,
      opacity: bradEntrance
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
        background: "rgba(255,255,255,0.1)",
        backdropFilter: "blur(10px)",
        padding: `${minDim * 0.02}px ${minDim * 0.04}px`,
        borderRadius: minDim * 0.02,
        border: `2px solid ${COLORS4.brad}`,
        color: "white",
        fontSize: minDim * 0.035,
        fontFamily: "sans-serif"
      }, children: 'Brad: "Nice to meet you!"' }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
        background: "rgba(255,255,255,0.1)",
        backdropFilter: "blur(10px)",
        padding: `${minDim * 0.02}px ${minDim * 0.04}px`,
        borderRadius: minDim * 0.02,
        border: `2px solid ${COLORS4.blippi}`,
        color: "white",
        fontSize: minDim * 0.035,
        fontFamily: "sans-serif",
        marginLeft: minDim * 0.05,
        opacity: blippiEntrance
      }, children: `Blippi: "I'm Blippi!"` })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
      position: "absolute",
      bottom: height * 0.05,
      width: "100%",
      textAlign: "center",
      color: "rgba(255,255,255,0.5)",
      fontSize: minDim * 0.025,
      fontFamily: "sans-serif",
      letterSpacing: "2px"
    }, children: "CHARACTER INTERACTION AREA" })
  ] });
}

// src/proj_bba70ece_9932_4382_98ea_35882692ae7c/Main.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
function Main() {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_remotion5.AbsoluteFill, { style: { background: "#1a1a1a" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_remotion5.Sequence, { from: 0, durationInFrames: 175, name: "scene_1", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(scene_1_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_remotion5.Sequence, { from: 175, durationInFrames: 150, name: "scene_2", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ConstructionScene, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_remotion5.Sequence, { from: 325, durationInFrames: 225, name: "scene_3", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(scene_3_default, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_remotion5.Sequence, { from: 550, durationInFrames: 187, name: "scene_4", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ModularAssemblyScene, {}) })
  ] });
}
