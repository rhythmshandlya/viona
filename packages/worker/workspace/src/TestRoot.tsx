import "./index.css";
import React from "react";
import { Composition, AbsoluteFill } from "remotion";

const TestComp: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <h1 style={{ color: "white", fontSize: 60, fontFamily: "sans-serif" }}>Template Studio Works!</h1>
  </AbsoluteFill>
);

export const TestRoot: React.FC = () => (
  <Composition id="test" component={TestComp} durationInFrames={150} fps={30} width={1080} height={1080} />
);
