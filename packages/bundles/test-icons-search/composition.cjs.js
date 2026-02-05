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

// src/test_icons_search/index.tsx
var index_exports = {};
__export(index_exports, {
  RemotionRoot: () => RemotionRoot,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_remotion = require("remotion");

// src/test_icons_search/constants.ts
var COLORS = {
  primary: "#00f5d4",
  // Cyan - nodes
  secondary: "#7b2cbf",
  // Purple - connections
  accent: "#f72585",
  // Magenta - search highlight
  success: "#00ff88",
  // Green - found/success
  warning: "#feca57",
  // Gold - comparison highlight
  dark: "#0a0a0f",
  // Near black
  darkAlt: "#12121a",
  // Slightly lighter dark
  light: "#e0e0e0",
  muted: "rgba(255, 255, 255, 0.5)"
};
var TYPOGRAPHY = {
  hero: { fontSize: 84, fontWeight: 900, lineHeight: 1.1 },
  title: { fontSize: 56, fontWeight: 800, lineHeight: 1.2 },
  subtitle: { fontSize: 42, fontWeight: 600, lineHeight: 1.3 },
  body: { fontSize: 36, fontWeight: 500, lineHeight: 1.5 },
  node: { fontSize: 32, fontWeight: 700 },
  caption: { fontSize: 28, fontWeight: 400 }
};
var SPRING_CONFIG = {
  default: { damping: 22, stiffness: 90, mass: 0.9 },
  bouncy: { damping: 15, stiffness: 120, mass: 0.8 },
  gentle: { damping: 30, stiffness: 60, mass: 1 }
};
var TIMING = {
  // Scene timing (in frames at 30fps)
  hook: { start: 0, duration: 75 },
  // 0-2.5s: Chaotic search
  organize: { start: 75, duration: 60 },
  // 2.5-4.5s: Numbers organize into tree
  explain: { start: 135, duration: 60 },
  // 4.5-6.5s: Show left/right rule
  search: { start: 195, duration: 60 },
  // 6.5-8.5s: Fast search demo
  payoff: { start: 255, duration: 45 }
  // 8.5-10s: Celebration
};
var BST_NODES = [
  { value: 50, x: 540, y: 500, level: 0 },
  { value: 25, x: 320, y: 700, level: 1 },
  { value: 75, x: 760, y: 700, level: 1 },
  { value: 10, x: 200, y: 900, level: 2 },
  { value: 35, x: 440, y: 900, level: 2 },
  { value: 60, x: 640, y: 900, level: 2 },
  { value: 90, x: 880, y: 900, level: 2 }
];
var BST_EDGES = [
  { from: 0, to: 1 },
  // 50 -> 25
  { from: 0, to: 2 },
  // 50 -> 75
  { from: 1, to: 3 },
  // 25 -> 10
  { from: 1, to: 4 },
  // 25 -> 35
  { from: 2, to: 5 },
  // 75 -> 60
  { from: 2, to: 6 }
  // 75 -> 90
];
var SEARCH_TARGET = 60;

// src/test_icons_search/index.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var AnimatedBackground = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const gradientAngle = (0, import_remotion.interpolate)(frame, [0, 300], [180, 200]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    import_remotion.AbsoluteFill,
    {
      style: {
        background: `linear-gradient(${gradientAngle}deg, #0a0a0f 0%, #12121a 40%, #1a1a2e 100%)`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              inset: 0,
              backgroundImage: "radial-gradient(circle at 2px 2px, rgba(0, 245, 212, 0.08) 1px, transparent 0)",
              backgroundSize: "60px 60px"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: "30%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 600,
              height: 600,
              background: "radial-gradient(circle, rgba(123, 44, 191, 0.15) 0%, transparent 70%)",
              filter: "blur(40px)"
            }
          }
        )
      ]
    }
  );
};
var TreeNode = ({
  value,
  x,
  y,
  scale,
  isHighlighted = false,
  isFound = false,
  showValue = true
}) => {
  const nodeColor = isFound ? COLORS.success : isHighlighted ? COLORS.accent : COLORS.primary;
  const glowIntensity = isHighlighted || isFound ? 0.6 : 0.2;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale})`,
        width: 80,
        height: 80,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${nodeColor} 0%, ${COLORS.secondary} 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 0 ${isHighlighted || isFound ? 40 : 20}px rgba(${isFound ? "0, 255, 136" : isHighlighted ? "247, 37, 133" : "0, 245, 212"}, ${glowIntensity})`,
        border: `3px solid ${isFound ? COLORS.success : isHighlighted ? COLORS.accent : "rgba(255,255,255,0.3)"}`
      },
      children: showValue && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "span",
        {
          style: {
            color: COLORS.light,
            ...TYPOGRAPHY.node,
            textShadow: "0 2px 4px rgba(0,0,0,0.5)"
          },
          children: value
        }
      )
    }
  );
};
var TreeEdge = ({
  x1,
  y1,
  x2,
  y2,
  progress,
  isHighlighted = false
}) => {
  const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x1,
        top: y1,
        width: length * progress,
        height: 4,
        background: isHighlighted ? `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.warning})` : `linear-gradient(90deg, ${COLORS.secondary}, ${COLORS.primary})`,
        transformOrigin: "0 50%",
        transform: `rotate(${angle}deg)`,
        boxShadow: isHighlighted ? `0 0 15px ${COLORS.accent}` : "0 0 8px rgba(0, 245, 212, 0.3)",
        borderRadius: 2
      }
    }
  );
};
var Spotlight = ({ x, y, scale }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale})`,
        width: 120,
        height: 120,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(247, 37, 133, 0.4) 0%, transparent 70%)",
        border: `3px solid ${COLORS.accent}`,
        boxShadow: `0 0 40px ${COLORS.accent}, inset 0 0 30px rgba(247, 37, 133, 0.3)`
      }
    }
  );
};
var HookScene = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const chaoticNumbers = [10, 25, 35, 50, 60, 75, 90, 15, 45, 80];
  const spotlightX = (0, import_remotion.interpolate)(
    frame,
    [0, 15, 30, 45, 60, 75],
    [200, 800, 300, 700, 500, 540],
    { extrapolateRight: "clamp" }
  );
  const spotlightY = (0, import_remotion.interpolate)(
    frame,
    [0, 15, 30, 45, 60, 75],
    [600, 900, 1200, 700, 1e3, 700],
    { extrapolateRight: "clamp" }
  );
  const titleScale = (0, import_remotion.spring)({
    frame,
    fps,
    config: SPRING_CONFIG.default
  });
  const titleOpacity = (0, import_remotion.interpolate)(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp"
  });
  const questionScale = (0, import_remotion.spring)({
    frame: frame - 30,
    fps,
    config: SPRING_CONFIG.bouncy
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    chaoticNumbers.map((num, i) => {
      const baseX = 150 + i % 5 * 180;
      const baseY = 600 + Math.floor(i / 5) * 400;
      const offsetX = Math.sin(frame * 0.1 + i * 2) * 30;
      const offsetY = Math.cos(frame * 0.08 + i * 1.5) * 25;
      const rotation = Math.sin(frame * 0.05 + i) * 15;
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "absolute",
            left: baseX + offsetX,
            top: baseY + offsetY,
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
            color: COLORS.muted,
            ...TYPOGRAPHY.title,
            opacity: 0.6
          },
          children: num
        },
        `chaos-${i}`
      );
    }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spotlight, { x: spotlightX, y: spotlightY, scale: 1 }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: 250,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: titleOpacity,
          transform: `scale(${titleScale})`
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "h1",
            {
              style: {
                color: COLORS.light,
                ...TYPOGRAPHY.hero,
                margin: 0
              },
              children: "Finding Data"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                color: COLORS.accent,
                ...TYPOGRAPHY.title,
                marginTop: 16,
                transform: `scale(${questionScale})`
              },
              children: "Too Slow? \u{1F50D}"
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: 300,
          left: 0,
          right: 0,
          textAlign: "center"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { color: COLORS.accent, ...TYPOGRAPHY.body }, children: [
          "Steps: ",
          Math.min(frame, 10)
        ] })
      }
    )
  ] });
};
var OrganizeScene = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const initialPositions = [
    { x: 200, y: 600 },
    { x: 800, y: 500 },
    { x: 300, y: 900 },
    { x: 700, y: 800 },
    { x: 500, y: 1100 },
    { x: 150, y: 700 },
    { x: 900, y: 1e3 }
  ];
  const getOrganizeProgress = (index) => {
    const delay = index * 6;
    return (0, import_remotion.spring)({
      frame: frame - delay,
      fps,
      config: SPRING_CONFIG.default
    });
  };
  const edgeProgress = (0, import_remotion.spring)({
    frame: frame - 30,
    fps,
    config: SPRING_CONFIG.gentle
  });
  const titleOpacity = (0, import_remotion.interpolate)(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp"
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: 200,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: titleOpacity
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "h2",
          {
            style: {
              color: COLORS.light,
              ...TYPOGRAPHY.title,
              margin: 0
            },
            children: "Organize It!"
          }
        )
      }
    ),
    BST_EDGES.map((edge, i) => {
      const fromNode = BST_NODES[edge.from];
      const toNode = BST_NODES[edge.to];
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        TreeEdge,
        {
          x1: fromNode.x,
          y1: fromNode.y,
          x2: toNode.x,
          y2: toNode.y,
          progress: edgeProgress
        },
        `edge-${i}`
      );
    }),
    BST_NODES.map((node, i) => {
      const progress = getOrganizeProgress(i);
      const initial = initialPositions[i];
      const x = (0, import_remotion.interpolate)(progress, [0, 1], [initial.x, node.x], {
        extrapolateRight: "clamp"
      });
      const y = (0, import_remotion.interpolate)(progress, [0, 1], [initial.y, node.y], {
        extrapolateRight: "clamp"
      });
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        TreeNode,
        {
          value: node.value,
          x,
          y,
          scale: progress
        },
        `node-${i}`
      );
    })
  ] });
};
var ExplainScene = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const treeScale = (0, import_remotion.spring)({
    frame,
    fps,
    config: SPRING_CONFIG.default
  });
  const leftArrowOpacity = (0, import_remotion.interpolate)(frame, [15, 30], [0, 1], {
    extrapolateRight: "clamp"
  });
  const rightArrowOpacity = (0, import_remotion.interpolate)(frame, [30, 45], [0, 1], {
    extrapolateRight: "clamp"
  });
  const compareValue = 35;
  const compareY = (0, import_remotion.interpolate)(frame, [0, 30], [300, 500], {
    extrapolateRight: "clamp"
  });
  const compareOpacity = (0, import_remotion.interpolate)(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp"
  });
  const showLeftDecision = frame > 30;
  const showRightDecision = frame > 45;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: 180,
          left: 60,
          right: 60,
          display: "flex",
          justifyContent: "space-around"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                opacity: leftArrowOpacity,
                textAlign: "center"
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.warning, ...TYPOGRAPHY.subtitle }, children: "Smaller \u2192 Left" })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                opacity: rightArrowOpacity,
                textAlign: "center"
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.success, ...TYPOGRAPHY.subtitle }, children: "Larger \u2192 Right" })
            }
          )
        ]
      }
    ),
    BST_EDGES.map((edge, i) => {
      const fromNode = BST_NODES[edge.from];
      const toNode = BST_NODES[edge.to];
      const isOnPath = edge.from === 0 && edge.to === 1 || edge.from === 1 && edge.to === 4;
      const shouldHighlight = isOnPath && edge.from === 0 && showLeftDecision || isOnPath && edge.from === 1 && showRightDecision;
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        TreeEdge,
        {
          x1: fromNode.x,
          y1: fromNode.y,
          x2: toNode.x,
          y2: toNode.y,
          progress: treeScale,
          isHighlighted: shouldHighlight
        },
        `edge-${i}`
      );
    }),
    BST_NODES.map((node, i) => {
      const isHighlighted = i === 0 && showLeftDecision || i === 1 && showRightDecision;
      const isFound = i === 4 && frame > 50;
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        TreeNode,
        {
          value: node.value,
          x: node.x,
          y: node.y,
          scale: treeScale,
          isHighlighted,
          isFound
        },
        `node-${i}`
      );
    }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: 540,
          top: compareY,
          transform: "translate(-50%, -50%)",
          opacity: compareOpacity
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              width: 70,
              height: 70,
              borderRadius: "50%",
              background: COLORS.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 30px ${COLORS.accent}`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.light, ...TYPOGRAPHY.node }, children: compareValue })
          }
        )
      }
    ),
    showLeftDecision && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: 430,
          top: 580,
          color: COLORS.warning,
          ...TYPOGRAPHY.caption,
          opacity: leftArrowOpacity
        },
        children: "35 < 50 \u2190"
      }
    ),
    showRightDecision && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: 360,
          top: 780,
          color: COLORS.success,
          ...TYPOGRAPHY.caption,
          opacity: rightArrowOpacity
        },
        children: "35 > 25 \u2192"
      }
    )
  ] });
};
var SearchScene = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const searchSteps = [
    { nodeIndex: 0, frame: 0 },
    // Start at 50
    { nodeIndex: 2, frame: 20 },
    // Go to 75
    { nodeIndex: 5, frame: 40 }
    // Found 60!
  ];
  let currentStep = 0;
  for (let i = 0; i < searchSteps.length; i++) {
    if (frame >= searchSteps[i].frame) {
      currentStep = i;
    }
  }
  const getSpotlightPos = () => {
    if (currentStep === 0 && frame < 20) {
      const progress = (0, import_remotion.interpolate)(frame, [0, 15], [0, 1], {
        extrapolateRight: "clamp"
      });
      return {
        x: (0, import_remotion.interpolate)(progress, [0, 1], [540, BST_NODES[0].x], {
          extrapolateRight: "clamp"
        }),
        y: (0, import_remotion.interpolate)(progress, [0, 1], [300, BST_NODES[0].y], {
          extrapolateRight: "clamp"
        })
      };
    } else if (currentStep === 1 && frame < 40) {
      const progress = (0, import_remotion.interpolate)(frame, [20, 35], [0, 1], {
        extrapolateRight: "clamp"
      });
      return {
        x: (0, import_remotion.interpolate)(progress, [0, 1], [BST_NODES[0].x, BST_NODES[2].x], {
          extrapolateRight: "clamp"
        }),
        y: (0, import_remotion.interpolate)(progress, [0, 1], [BST_NODES[0].y, BST_NODES[2].y], {
          extrapolateRight: "clamp"
        })
      };
    } else {
      const progress = (0, import_remotion.interpolate)(frame, [40, 55], [0, 1], {
        extrapolateRight: "clamp"
      });
      return {
        x: (0, import_remotion.interpolate)(progress, [0, 1], [BST_NODES[2].x, BST_NODES[5].x], {
          extrapolateRight: "clamp"
        }),
        y: (0, import_remotion.interpolate)(progress, [0, 1], [BST_NODES[2].y, BST_NODES[5].y], {
          extrapolateRight: "clamp"
        })
      };
    }
  };
  const spotlightPos = getSpotlightPos();
  const isFound = frame >= 50;
  const displaySteps = Math.min(currentStep + 1, 3);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: 200,
          left: 0,
          right: 0,
          textAlign: "center"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { color: COLORS.light, ...TYPOGRAPHY.title }, children: [
          "Finding",
          " ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.accent }, children: SEARCH_TARGET })
        ] })
      }
    ),
    BST_EDGES.map((edge, i) => {
      const fromNode = BST_NODES[edge.from];
      const toNode = BST_NODES[edge.to];
      const isOnPath = edge.from === 0 && edge.to === 2 && frame > 20 || edge.from === 2 && edge.to === 5 && frame > 40;
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        TreeEdge,
        {
          x1: fromNode.x,
          y1: fromNode.y,
          x2: toNode.x,
          y2: toNode.y,
          progress: 1,
          isHighlighted: isOnPath
        },
        `edge-${i}`
      );
    }),
    BST_NODES.map((node, i) => {
      const isSearched = i === 0 && frame > 5 || i === 2 && frame > 25 || i === 5 && frame > 45;
      const foundNode = i === 5 && isFound;
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        TreeNode,
        {
          value: node.value,
          x: node.x,
          y: node.y,
          scale: 1,
          isHighlighted: isSearched && !foundNode,
          isFound: foundNode
        },
        `node-${i}`
      );
    }),
    !isFound && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spotlight, { x: spotlightPos.x, y: spotlightPos.y, scale: 1 }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: 350,
          left: 0,
          right: 0,
          textAlign: "center"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { color: COLORS.primary, ...TYPOGRAPHY.subtitle }, children: [
          "Only ",
          displaySteps,
          " step",
          displaySteps > 1 ? "s" : "",
          "!"
        ] })
      }
    ),
    frame > 10 && frame < 40 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: 650,
          top: 580,
          color: COLORS.success,
          ...TYPOGRAPHY.caption,
          opacity: (0, import_remotion.interpolate)(frame, [10, 20], [0, 1], {
            extrapolateRight: "clamp"
          })
        },
        children: "60 > 50 \u2192"
      }
    ),
    frame > 30 && frame < 55 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: 680,
          top: 780,
          color: COLORS.warning,
          ...TYPOGRAPHY.caption,
          opacity: (0, import_remotion.interpolate)(frame, [30, 40], [0, 1], {
            extrapolateRight: "clamp"
          })
        },
        children: "60 < 75 \u2190"
      }
    )
  ] });
};
var PayoffScene = () => {
  const frame = (0, import_remotion.useCurrentFrame)();
  const { fps } = (0, import_remotion.useVideoConfig)();
  const particles = Array.from({ length: 20 }).map((_, i) => {
    const delay = i * 3;
    const progress = (0, import_remotion.spring)({
      frame: frame - delay,
      fps,
      config: SPRING_CONFIG.bouncy
    });
    const angle = i / 20 * Math.PI * 2;
    const radius = progress * 150;
    const opacity = (0, import_remotion.interpolate)(progress, [0, 0.8, 1], [0, 1, 0.5], {
      extrapolateRight: "clamp"
    });
    return {
      x: 540 + Math.cos(angle) * radius,
      y: 700 + Math.sin(angle) * radius,
      opacity,
      scale: progress
    };
  });
  const titleScale = (0, import_remotion.spring)({
    frame,
    fps,
    config: SPRING_CONFIG.bouncy
  });
  const comparisonOpacity = (0, import_remotion.interpolate)(frame, [20, 35], [0, 1], {
    extrapolateRight: "clamp"
  });
  const linearProgress = (0, import_remotion.interpolate)(frame, [25, 40], [0, 1], {
    extrapolateRight: "clamp"
  });
  const logProgress = (0, import_remotion.interpolate)(frame, [25, 32], [0, 1], {
    extrapolateRight: "clamp"
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    particles.map((p, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: p.x,
          top: p.y,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: i % 3 === 0 ? COLORS.primary : i % 3 === 1 ? COLORS.accent : COLORS.success,
          opacity: p.opacity,
          transform: `scale(${p.scale})`
        }
      },
      `particle-${i}`
    )),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          left: 540,
          top: 700,
          transform: `translate(-50%, -50%) scale(${titleScale})`
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              width: 120,
              height: 120,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${COLORS.success} 0%, ${COLORS.primary} 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 60px ${COLORS.success}`
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.dark, ...TYPOGRAPHY.title }, children: SEARCH_TARGET })
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          position: "absolute",
          top: 250,
          left: 0,
          right: 0,
          textAlign: "center",
          transform: `scale(${titleScale})`
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "h1",
          {
            style: {
              color: COLORS.light,
              ...TYPOGRAPHY.hero,
              margin: 0
            },
            children: "Found! \u2713"
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          bottom: 200,
          left: 80,
          right: 80,
          opacity: comparisonOpacity
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginBottom: 30 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "div",
              {
                style: {
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.muted, ...TYPOGRAPHY.caption }, children: "Linear Search" }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.accent, ...TYPOGRAPHY.caption }, children: "O(n) = 7 steps" })
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "div",
              {
                style: {
                  height: 24,
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  overflow: "hidden"
                },
                children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "div",
                  {
                    style: {
                      width: `${linearProgress * 100}%`,
                      height: "100%",
                      background: COLORS.accent,
                      borderRadius: 12
                    }
                  }
                )
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "div",
              {
                style: {
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.muted, ...TYPOGRAPHY.caption }, children: "BST Search" }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: COLORS.success, ...TYPOGRAPHY.caption }, children: "O(log n) = 3 steps" })
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "div",
              {
                style: {
                  height: 24,
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  overflow: "hidden"
                },
                children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "div",
                  {
                    style: {
                      width: `${logProgress * 43}%`,
                      height: "100%",
                      background: COLORS.success,
                      borderRadius: 12
                    }
                  }
                )
              }
            )
          ] })
        ]
      }
    )
  ] });
};
var MainComposition = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_remotion.AbsoluteFill, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AnimatedBackground, {}, "bg"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.hook.start, durationInFrames: TIMING.hook.duration, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HookScene, {}) }, "hook"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.organize.start, durationInFrames: TIMING.organize.duration, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OrganizeScene, {}) }, "organize"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.explain.start, durationInFrames: TIMING.explain.duration, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExplainScene, {}) }, "explain"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.search.start, durationInFrames: TIMING.search.duration, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SearchScene, {}) }, "search"),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_remotion.Sequence, { from: TIMING.payoff.start, durationInFrames: TIMING.payoff.duration, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PayoffScene, {}) }, "payoff")
  ] });
};
var RemotionRoot = () => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_remotion.Composition,
    {
      id: "test_icons_search",
      component: MainComposition,
      durationInFrames: 300,
      fps: 30,
      width: 1080,
      height: 1920
    }
  );
};
var index_default = MainComposition;
