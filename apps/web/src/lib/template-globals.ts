"use client";

import React from 'react';
import * as ReactDOM from 'react-dom';
import * as Remotion from 'remotion';

export function setupTemplateGlobals(): void {
  if (typeof window === 'undefined') return;
  (window as any).React = React;
  (window as any).ReactDOM = ReactDOM;
  (window as any).Remotion = Remotion;
}

// Auto-setup on import
setupTemplateGlobals();
