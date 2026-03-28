import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants } from './constants';
import type { CountryHighlightProps } from './schema';
import { computeBboxViewport, MAP_STYLES, lngToPixelX, latToPixelY } from './lib/tile-math';
import { getSmoothZoomCamera, getDramaticZoomCamera, getKenBurnsCamera } from './lib/camera';
import { useCountries, findCountryIn } from './data/countries';
import MapTileGrid from './components/MapTileGrid';
import CountryOverlay from './components/CountryOverlay';
import CountryLabel from './components/CountryLabel';
import CityMarker from './components/CityMarker';

const CountryHighlight: React.FC<CountryHighlightProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { width, height, durationInFrames, fps } = useVideoConfig();
  const s = useScale();
  const styleConfig = MAP_STYLES[props.mapStyle];

  // ── Duration-relative timing ─────────────────────────────────────
  // Absolute durations (in frames, based on fps — animation speed stays constant)
  const fadeDuration = fps; // 1 second
  // Phase placement (proportional to total duration)
  const overlayEnterFrame = Math.round(durationInFrames * 0.25);
  const labelEnterFrame = Math.round(durationInFrames * 0.47);
  const cityEnterFrame = Math.round(durationInFrames * 0.69);
  const fadeOutStart = durationInFrames - fadeDuration;

  // ── Load country data (async from static JSON) ──────────────────
  const countries = useCountries();
  const country = countries
    ? findCountryIn(countries, props.countryName) || findCountryIn(countries, props.countryCode || '')
    : null;

  if (!countries || !country) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: props.transparent ? 'transparent' : '#1a1a2e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: s(40),
          fontFamily: 'sans-serif',
        }}
      >
        {!countries ? 'Loading...' : `Country not found: ${props.countryName}`}
      </AbsoluteFill>
    );
  }

  // ── Viewport from country bounding box ───────────────────────────
  const viewport = computeBboxViewport(country.bbox, width, height, props.mapPadding);

  // ── Camera ───────────────────────────────────────────────────────
  const camera = (() => {
    switch (props.animationStyle) {
      case 'dramaticZoom':
        return getDramaticZoomCamera(frame, width, height, durationInFrames);
      case 'kenBurns':
        return getKenBurnsCamera(frame, width, height, durationInFrames);
      case 'smoothZoom':
      default:
        return getSmoothZoomCamera(frame, width, height, durationInFrames);
    }
  })();

  // ── Map fade in ──────────────────────────────────────────────────
  const mapOpacity = interpolate(frame, [0, fadeDuration], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Global fade out ──────────────────────────────────────────────
  const fadeOut = interpolate(frame, [fadeOutStart, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── City screen position (inside camera-transformed space) ───────
  const cityScreenX =
    props.cityLng != null
      ? lngToPixelX(props.cityLng, viewport.zoom) + viewport.offsetX
      : undefined;
  const cityScreenY =
    props.cityLat != null
      ? latToPixelY(props.cityLat, viewport.zoom) + viewport.offsetY
      : undefined;

  // ── Tile margin for camera panning ───────────────────────────────
  const tileMargin = props.animationStyle === 'kenBurns' ? s(100) : width / 2;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: props.transparent ? 'transparent' : styleConfig.background,
        opacity: fadeOut,
        overflow: 'hidden',
      }}
    >
      {/* Camera-transformed world */}
      <div
        style={{
          transform: `translate(${camera.translateX}px, ${camera.translateY}px) scale(${camera.scale})`,
          transformOrigin: '0 0',
          width,
          height,
          position: 'absolute',
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
          enterFrame={overlayEnterFrame}
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
              enterFrame={cityEnterFrame}
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
          enterFrame={labelEnterFrame}
          fontFamily={FONTS.headline}
          color={COLORS.text}
        />
      )}
    </AbsoluteFill>
  );
};

export default CountryHighlight;
