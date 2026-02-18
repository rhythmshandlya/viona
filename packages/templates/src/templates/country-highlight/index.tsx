import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import { getConstants } from './constants';
import type { CountryHighlightProps } from './schema';
import { computeBboxViewport, MAP_STYLES, lngToPixelX, latToPixelY } from './lib/tile-math';
import { getSmoothZoomCamera, getDramaticZoomCamera, getKenBurnsCamera } from './lib/camera';
import { findCountry } from './data/countries';
import MapTileGrid from './components/MapTileGrid';
import CountryOverlay from './components/CountryOverlay';
import CountryLabel from './components/CountryLabel';
import CityMarker from './components/CityMarker';

const WIDTH = 1080;
const HEIGHT = 1080;

const CountryHighlight: React.FC<CountryHighlightProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const styleConfig = MAP_STYLES[props.mapStyle];

  // ── Find country data ──────────────────────────────────────────
  const country = findCountry(props.countryName) || findCountry(props.countryCode || '');

  if (!country) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: '#1a1a2e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 40,
          fontFamily: 'sans-serif',
        }}
      >
        Country not found: {props.countryName}
      </AbsoluteFill>
    );
  }

  // ── Viewport from country bounding box ─────────────────────────
  const viewport = computeBboxViewport(country.bbox, WIDTH, HEIGHT, props.mapPadding);

  // ── Camera ─────────────────────────────────────────────────────
  const camera = (() => {
    switch (props.animationStyle) {
      case 'dramaticZoom':
        return getDramaticZoomCamera(frame);
      case 'kenBurns':
        return getKenBurnsCamera(frame);
      case 'smoothZoom':
      default:
        return getSmoothZoomCamera(frame);
    }
  })();

  // ── Map fade in ────────────────────────────────────────────────
  const mapOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // ── Global fade out ────────────────────────────────────────────
  const fadeOut = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── City screen position (inside camera-transformed space) ─────
  const cityScreenX =
    props.cityLng != null
      ? lngToPixelX(props.cityLng, viewport.zoom) + viewport.offsetX
      : undefined;
  const cityScreenY =
    props.cityLat != null
      ? latToPixelY(props.cityLat, viewport.zoom) + viewport.offsetY
      : undefined;

  // ── Tile margin for camera panning ─────────────────────────────
  const tileMargin = props.animationStyle === 'kenBurns' ? 100 : WIDTH / 2;

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
          width: WIDTH,
          height: HEIGHT,
          position: 'absolute',
        }}
      >
        {/* Map tiles */}
        <div style={{ opacity: mapOpacity, position: 'absolute', inset: 0 }}>
          <MapTileGrid
            viewport={viewport}
            width={WIDTH}
            height={HEIGHT}
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
          width={WIDTH}
          height={HEIGHT}
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
    </AbsoluteFill>
  );
};

export default CountryHighlight;
