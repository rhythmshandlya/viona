import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import type { MagazineCountryProps } from './schema';
import { MAGAZINE_COLORS, MAGAZINE_FONTS } from '../../magazine/constants';
import { findCountry } from '../country-highlight/data/countries';
import { computeBboxViewport, lngToPixelX, latToPixelY } from '../country-highlight/lib/tile-math';
import type { MapStyle } from '../country-highlight/lib/tile-math';
import { getSmoothZoomCamera, getDramaticZoomCamera, getKenBurnsCamera } from '../country-highlight/lib/camera';
import MapTileGrid from '../country-highlight/components/MapTileGrid';
import CountryOverlay from '../country-highlight/components/CountryOverlay';
import CountryLabel from '../country-highlight/components/CountryLabel';
import CityMarker from '../country-highlight/components/CityMarker';

const MagazineCountry: React.FC<MagazineCountryProps> = (props) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const country = findCountry(props.countryName) || findCountry(props.countryCode || '');

  if (!country) {
    return (
      <AbsoluteFill style={{
        backgroundColor: '#f8fafc',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: MAGAZINE_FONTS.body, fontSize: 36, color: MAGAZINE_COLORS.accent,
      }}>
        Country not found: {props.countryName}
      </AbsoluteFill>
    );
  }

  // ── Viewport from country bbox ──────────────────────────────────────
  const viewport = computeBboxViewport(country.bbox, width, height, props.mapPadding);

  // ── Camera ──────────────────────────────────────────────────────────
  const camera = (() => {
    switch (props.animationStyle) {
      case 'dramaticZoom':
        return getDramaticZoomCamera(frame, width, height);
      case 'kenBurns':
        return getKenBurnsCamera(frame, width, height);
      case 'smoothZoom':
      default:
        return getSmoothZoomCamera(frame, width, height);
    }
  })();

  // ── Map fade in ─────────────────────────────────────────────────────
  const mapOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Fade out ────────────────────────────────────────────────────────
  const fadeOut = interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── City marker screen position ─────────────────────────────────────
  const cityScreenX =
    props.cityLng != null
      ? lngToPixelX(props.cityLng, viewport.zoom) + viewport.offsetX
      : undefined;
  const cityScreenY =
    props.cityLat != null
      ? latToPixelY(props.cityLat, viewport.zoom) + viewport.offsetY
      : undefined;

  const tileMargin = props.animationStyle === 'kenBurns' ? 100 : width / 2;

  return (
    <AbsoluteFill style={{
      backgroundColor: '#f8fafc',
      opacity: fadeOut,
      overflow: 'hidden',
    }}>
      {/* Camera-transformed world */}
      <div style={{
        transform: `translate(${camera.translateX}px, ${camera.translateY}px) scale(${camera.scale})`,
        transformOrigin: '0 0',
        width, height,
        position: 'absolute',
      }}>
        {/* Map tiles */}
        <div style={{ opacity: mapOpacity, position: 'absolute', inset: 0 }}>
          <MapTileGrid
            viewport={viewport}
            width={width}
            height={height}
            mapStyle={props.mapStyle as MapStyle}
            margin={tileMargin}
          />
        </div>

        {/* Country polygon overlay */}
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
              enterFrame={120}
              color={MAGAZINE_COLORS.accent}
              fontFamily={MAGAZINE_FONTS.body}
            />
          )}
      </div>

      {/* Country label (fixed, outside camera) */}
      {props.showCountryName && (
        <CountryLabel
          label={props.countryName.toUpperCase()}
          fontSize={props.countryNameSize}
          enterFrame={100}
          fontFamily={MAGAZINE_FONTS.headline}
          color={MAGAZINE_COLORS.text}
        />
      )}
    </AbsoluteFill>
  );
};

export default MagazineCountry;
