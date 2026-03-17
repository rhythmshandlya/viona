"use client";

import React from 'react';
import * as Remotion from 'remotion';

export function setupTemplateGlobals(): void {
  if (typeof window === 'undefined') return;
  (window as any).React = React;
  (window as any).Remotion = Remotion;
}

// Auto-setup on import
setupTemplateGlobals();
