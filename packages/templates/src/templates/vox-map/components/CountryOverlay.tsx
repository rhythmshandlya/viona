import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { countryToSvgPaths } from '../lib/geo-utils';

interface CountryOverlayProps {
  polygons: [number, number][][];
  zoom: number;
  offsetX: number;
  offsetY: number;
  highlightColor: string;
  highlightOpacity: number;
  showBorder: boolean;
  borderColor: string;
  borderWidth: number;
  enterFrame: number;
  width: number;
  height: number;
}

const CountryOverlay: React.FC<CountryOverlayProps> = ({
  polygons,
  zoom,
  offsetX,
  offsetY,
  highlightColor,
  highlightOpacity,
  showBorder,
  borderColor,
  borderWidth,
  enterFrame,
  width,
  height,
}) => {
  const frame = useCurrentFrame();
  const paths = countryToSvgPaths(polygons, zoom, offsetX, offsetY);

  const opacity = interpolate(frame, [enterFrame, enterFrame + 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <svg
      width={width}
      height={height}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        overflow: 'visible',
        opacity,
      }}
    >
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill={highlightColor}
          fillOpacity={highlightOpacity}
          stroke={showBorder ? borderColor : 'none'}
          strokeWidth={showBorder ? borderWidth : 0}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
};

export default CountryOverlay;
