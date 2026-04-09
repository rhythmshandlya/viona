import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants } from './constants';
import type { VoxMapProps } from './schema';
import { computeBboxViewport, MAP_STYLES, lngToPixelX, latToPixelY } from './lib/tile-math';
import { getSmoothZoomCamera, getDramaticZoomCamera, getKenBurnsCamera } from './lib/camera';
import { findCountry } from './data/countries';
import MapTileGrid from './components/MapTileGrid';
import CountryOverlay from './components/CountryOverlay';
import CountryLabel from './components/CountryLabel';
import CityMarker from './components/CityMarker';
import { FilmGrain } from '../../vox/effects';

const VoxMap: React.FC<VoxMapProps> = (props) => {
  const { COLORS, FONTS } = getConstants();
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const s = useScale();
  const styleConfig = MAP_STYLES[props.mapStyle];

  const country = findCountry(props.countryName) || findCountry(props.countryCode || '');

  if (!country) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: COLORS.background,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: COLORS.text, fontSize: s(40), fontFamily: 'sans-serif',
        }}
      >
        Country not found: {props.countryName}
      </AbsoluteFill>
    );
  }

  const viewport = computeBboxViewport(country.bbox, width, height, props.mapPadding);

  const camera = (() => {
    switch (props.animationStyle) {
      case 'dramaticZoom': return getDramaticZoomCamera(frame, width, height);
      case 'kenBurns': return getKenBurnsCamera(frame, width, height);
      case 'smoothZoom':
      default: return getSmoothZoomCamera(frame, width, height);
    }
  })();

  const mapOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const fadeOut = interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const cityScreenX = props.cityLng != null
    ? lngToPixelX(props.cityLng, viewport.zoom) + viewport.offsetX
    : undefined;
  const cityScreenY = props.cityLat != null
    ? latToPixelY(props.cityLat, viewport.zoom) + viewport.offsetY
    : undefined;

  const tileMargin = props.animationStyle === 'kenBurns' ? s(100) : width / 2;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: styleConfig.background,
        opacity: fadeOut,
        overflow: 'hidden',
      }}
    >
      {/* Camera-transformed world */}
      <div
        style={{
          transform: `translate(${camera.translateX}px, ${camera.translateY}px) scale(${camera.scale})`,
          transformOrigin: '0 0',
          width, height,
          position: 'absolute',
          // Vox documentary desaturation
          filter: 'saturate(0.2) contrast(1.15) brightness(0.7)',
        }}
      >
        {/* Map tiles */}
        <div style={{ opacity: mapOpacity, position: 'absolute', inset: 0 }}>
          <MapTileGrid
            viewport={viewport}
            width={width}
            height={height}
            mapStyle={props.mapStyle}
            margin={tileMargin}
          />
        </div>

        {/* Country overlay */}
        <CountryOverlay
          polygons={country.polygons}
          zoom={viewport.zoom}
          offsetX={viewport.offsetX}
          offsetY={viewport.offsetY}
          highlightColor={props.highlightColor}
          highlightOpacity={props.highlightOpacity}
          showBorder={props.showBorder}
          borderColor={props.borderColor}
          borderWidth={props.borderWidth}
          enterFrame={90}
          width={width}
          height={height}
        />

        {/* City marker */}
        {props.showCityMarker &&
          props.cityName &&
          cityScreenX != null &&
          cityScreenY != null && (
            <CityMarker
              x={cityScreenX}
              y={cityScreenY}
              label={props.cityName}
              enterFrame={250}
              color={COLORS.primary}
              fontFamily={FONTS.body}
            />
          )}
      </div>

      {/* Fixed overlays (outside camera transform) */}
      {props.showCountryName && (
        <CountryLabel
          label={props.countryName.toUpperCase()}
          fontSize={props.countryNameSize}
          enterFrame={170}
          fontFamily={FONTS.headline}
          color={COLORS.text}
        />
      )}

      {/* Vox film grain */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
        <FilmGrain opacity={0.15} seed={22} />
      </div>
    </AbsoluteFill>
  );
};

export default VoxMap;
