/**
 * Remotion Root component.
 *
 * Claude Code will generate project-specific compositions in src/<project-id>/
 * and register them here dynamically.
 *
 * This file serves as a placeholder. During generation, Claude will:
 * 1. Create src/<project-id>/index.tsx with the main composition
 * 2. Create src/<project-id>/constants.ts with colors and timing
 * 3. Update this file to import and register the composition
 */

import "./index.css";
import { Composition } from "remotion";

// Placeholder composition for initial setup verification
const PlaceholderComposition: React.FC = () => {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0f172a",
        color: "#e2e8f0",
        fontFamily: "system-ui, sans-serif",
        fontSize: 48,
      }}
    >
      Workspace Ready
    </div>
  );
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Placeholder"
        component={PlaceholderComposition}
        durationInFrames={30}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
