import React from 'react';

interface IconProps {
  size?: number;
  color?: string;
}

export const FolderIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24">
    <path fill={color} d="M20 18H4V8h16m0-2h-8l-2-2H4c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2"/>
  </svg>
);

export const ServerIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24">
    <g fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      <rect width="20" height="8" x="2" y="2" rx="2" ry="2" fill={color}/>
      <rect width="20" height="8" x="2" y="14" rx="2" ry="2" fill={color}/>
      <circle cx="6" cy="6" r="1" fill="#0a0a0f"/>
      <circle cx="6" cy="18" r="1" fill="#0a0a0f"/>
    </g>
  </svg>
);

export const ToolsIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24">
    <path fill={color} d="m21.71 20.29l-1.42 1.42a1 1 0 0 1-1.41 0L7 9.85A3.8 3.8 0 0 1 6 10a4 4 0 0 1-3.78-5.3l2.54 2.54l.53-.53l1.42-1.42l.53-.53L4.7 2.22A4 4 0 0 1 10 6a3.8 3.8 0 0 1-.15 1l11.86 11.88a1 1 0 0 1 0 1.41M2.29 18.88a1 1 0 0 0 0 1.41l1.42 1.42a1 1 0 0 0 1.41 0l5.47-5.46l-2.83-2.83M20 2l-4 2v2l-2.17 2.17l2 2L18 8h2l2-4Z"/>
  </svg>
);

export const CheckmarkIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 512 512">
    <path fill={color} d="M256 48C141.31 48 48 141.31 48 256s93.31 208 208 208s208-93.31 208-208S370.69 48 256 48m108.25 138.29l-134.4 160a16 16 0 0 1-12 5.71h-.27a16 16 0 0 1-11.89-5.3l-57.6-64a16 16 0 1 1 23.78-21.4l45.29 50.32l122.59-145.91a16 16 0 0 1 24.5 20.58"/>
  </svg>
);

export const WarningIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 16 16">
    <path fill={color} d="M14.57 13.54L8.39 1.63c-.34-.67-1.43-.67-1.78 0L.43 13.54c-.16.31-.15.68.03.98s.51.48.86.48h12.36c.35 0 .67-.18.85-.48s.2-.67.04-.98M7 6c0-.28.22-.5.5-.5s.5.22.5.5v3.5c0 .28-.22.5-.5.5S7 9.78 7 9.5zm.5 7c-.55 0-1-.45-1-1s.45-1 1-1s1 .45 1 1s-.45 1-1 1"/>
  </svg>
);
