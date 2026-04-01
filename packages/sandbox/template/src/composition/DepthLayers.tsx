import React, { createContext, useContext } from 'react';

/**
 * Depth layer context — used by PlayerComposition to collect
 * behind-speaker and in-front-of-speaker children from scene renders.
 *
 * When rendering outside a depth context (e.g., in the playground or
 * in a non-depth scene), both wrappers render children inline — no
 * layer splitting.
 */

interface DepthLayerContextValue {
  /** Register content for the behind-speaker (scene-bg) layer */
  registerBehind: (node: React.ReactNode) => void;
  /** Register content for the in-front-of-speaker (scene-fg) layer */
  registerFront: (node: React.ReactNode) => void;
  /** Whether we are inside a depth-aware rendering context */
  active: boolean;
}

const DepthLayerContext = createContext<DepthLayerContextValue>({
  registerBehind: () => {},
  registerFront: () => {},
  active: false,
});

export const DepthLayerProvider = DepthLayerContext.Provider;
export const useDepthLayer = () => useContext(DepthLayerContext);

/**
 * BehindSpeaker — wraps elements that render behind the person.
 *
 * In a depth-aware context: elements are extracted to the scene-bg track
 * (position 1), which renders below the person matte layer.
 *
 * Outside depth context (playground, non-depth scenes): renders inline
 * as a transparent AbsoluteFill — no visual difference.
 */
export const BehindSpeaker: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { active, registerBehind } = useDepthLayer();

  if (active) {
    // In depth context, register children for the bg layer
    // and render nothing here — PlayerComposition places them
    registerBehind(children);
    return null;
  }

  // Fallback: render inline (non-depth context)
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {children}
    </div>
  );
};

/**
 * InFrontOfSpeaker — wraps elements that render in front of the person.
 *
 * In a depth-aware context: elements are extracted to the scene-fg track
 * (position 3), which renders above the person matte layer.
 *
 * Outside depth context: renders inline.
 */
export const InFrontOfSpeaker: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { active, registerFront } = useDepthLayer();

  if (active) {
    registerFront(children);
    return null;
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {children}
    </div>
  );
};
