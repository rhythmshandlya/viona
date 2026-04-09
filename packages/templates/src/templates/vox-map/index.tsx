import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { VoxMapProps } from './schema';
import { VOX_COLORS, VOX_SIZES, VOX_FONTS, sf, voxEaseOut } from '../../vox/constants';
import { voxEntrance, voxExit, voxIdle } from '../../vox/animations';
import { FilmGrain } from '../../vox/effects';
import { useScale } from '../../use-scale';

// Reuse country-highlight's geographic infrastructure
import { computeBboxViewport, MAP_STYLES, lngToPixelX, latToPixelY } from '../country-highlight/lib/tile-math';
import { getSmoothZoomCamera, getDramaticZoomCamera, getKenBurnsCamera } from '../country-highlight/lib/camera';
import { findCountry } from '../country-highlight/data/countries';
import MapTileGrid from '../country-highlight/components/MapTileGrid';
import CountryOverlay from '../country-highlight/components/CountryOverlay';
import CityMarker from '../country-highlight/components/CityMarker';

const VoxMap: React.FC<VoxMapProps> = (props) => {
  const { title, countryName, countryCode, mapStyle, highlightColor, highlightOpacity,
    cityName, cityLat, cityLng, showCountryName, mapPadding, animationStyle } = props;

  const frame = useCurrentFrame();
  const { durationInFrames, width: W, height: H } = useVideoConfig();
  const s = useScale();
  const styleConfig = MAP_STYLES[mapStyle];

  const entrance = voxEntrance(frame, 3, undefined, 'up', s(12));
  const exitStart = durationInFrames - 10;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };
  const combinedOpacity = entrance.opacity * exit.opacity;
  const idle = voxIdle(frame, 44);

  // Find country
  const country = findCountry(countryName) || findCountry(countryCode || '');

  if (!country) {
    return (
      <AbsoluteFill style={{
        backgroundColor: '#0a1a2e',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: VOX_COLORS.offWhite, fontSize: s(32), fontFamily: VOX_FONTS.body,
      }}>
        Country not found: {countryName}
      </AbsoluteFill>
    );
  }

  // Viewport from country bounding box
  const viewport = computeBboxViewport(country.bbox, W, H, mapPadding);

  // Camera animation
  const camera = (() => {
    switch (animationStyle) {
      case 'dramaticZoom': return getDramaticZoomCamera(frame, W, H);
      case 'kenBurns': return getKenBurnsCamera(frame, W, H);
      default: return getSmoothZoomCamera(frame, W, H);
    }
  })();

  // Phased reveals
  const mapOpacity = interpolate(frame, [5, 25], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const overlayOpacity = interpolate(frame, [40, 70], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const labelOpacity = interpolate(frame, [80, 100], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const fadeOut = interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // City screen position
  const cityScreenX = cityLng != null
    ? lngToPixelX(cityLng, viewport.zoom) + viewport.offsetX
    : undefined;
  const cityScreenY = cityLat != null
    ? latToPixelY(cityLat, viewport.zoom) + viewport.offsetY
    : undefined;

  const tileMargin = animationStyle === 'kenBurns' ? s(100) : W / 2;

  return (
    <AbsoluteFill style={{
      backgroundColor: styleConfig.background,
      opacity: fadeOut,
      overflow: 'hidden',
    }}>
      {/* Desaturation + dark overlay for Vox documentary feel */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(10,20,40,0.3) 0%, rgba(10,20,40,0.1) 50%, rgba(10,20,40,0.4) 100%)',
        zIndex: 2, pointerEvents: 'none',
      }} />

      {/* Camera-transformed map world */}
      <div style={{
        transform: `translate(${camera.translateX}px, ${camera.translateY}px) scale(${camera.scale})`,
        transformOrigin: '0 0',
        width: W, height: H,
        position: 'absolute',
        filter: 'saturate(0.4) contrast(1.1)',
      }}>
        {/* Map tiles */}
        <div style={{ opacity: mapOpacity, position: 'absolute', inset: 0 }}>
          <MapTileGrid
            viewport={viewport}
            width={W}
            height={H}
            mapStyle={mapStyle}
            margin={tileMargin}
          />
        </div>

        {/* Country highlight overlay */}
        <div style={{ opacity: overlayOpacity }}>
          <CountryOverlay
            polygons={country.polygons}
            zoom={viewport.zoom}
            offsetX={viewport.offsetX}
            offsetY={viewport.offsetY}
            highlightColor={highlightColor}
            highlightOpacity={highlightOpacity}
            showBorder={true}
            borderColor={VOX_COLORS.highlight}
            borderWidth={3}
            enterFrame={0}
            width={W}
            height={H}
          />
        </div>

        {/* City marker */}
        {cityName && cityScreenX != null && cityScreenY != null && (
          <div style={{ opacity: labelOpacity }}>
            <CityMarker
              x={cityScreenX}
              y={cityScreenY}
              label={cityName}
              enterFrame={0}
              color={VOX_COLORS.highlight}
              fontFamily={VOX_FONTS.body}
            />
          </div>
        )}
      </div>

      {/* Title overlay — Vox style (top left, outside camera) */}
      {title && (
        <div style={{
          position: 'absolute',
          top: s(50),
          left: s(50),
          right: s(50),
          zIndex: 3,
          opacity: labelOpacity * combinedOpacity,
          transform: `translateY(${idle.translateY}px)`,
        }}>
          <div style={{
            display: 'inline-block',
            backgroundColor: 'rgba(10, 20, 40, 0.75)',
            padding: `${s(10)}px ${s(18)}px`,
            borderLeft: `${s(4)}px solid ${VOX_COLORS.highlight}`,
          }}>
            <span style={{
              fontFamily: VOX_FONTS.headline,
              fontSize: s(VOX_SIZES.h3),
              fontWeight: 700,
              color: VOX_COLORS.offWhite,
              lineHeight: 1.2,
            }}>
              {title}
            </span>
          </div>
        </div>
      )}

      {/* Country name label — large, centered */}
      {showCountryName && (
        <div style={{
          position: 'absolute',
          bottom: s(120),
          left: 0, right: 0,
          textAlign: 'center',
          zIndex: 3,
          opacity: labelOpacity * combinedOpacity,
        }}>
          <span style={{
            fontFamily: VOX_FONTS.headline,
            fontSize: s(VOX_SIZES.hero),
            fontWeight: 700,
            color: VOX_COLORS.offWhite,
            letterSpacing: s(4),
            textTransform: 'uppercase' as const,
            textShadow: '0 2px 20px rgba(0,0,0,0.6)',
          }}>
            {countryName}
          </span>
        </div>
      )}

      {/* Coordinate readout — bottom left */}
      <div style={{
        position: 'absolute',
        bottom: s(40),
        left: s(50),
        zIndex: 3,
        opacity: labelOpacity * combinedOpacity * 0.5,
      }}>
        <span style={{
          fontFamily: VOX_FONTS.mono,
          fontSize: s(VOX_SIZES.tiny * 0.8),
          color: 'rgba(200, 215, 230, 0.6)',
          letterSpacing: s(1),
        }}>
          {cityLat != null && cityLng != null
            ? `${Math.abs(cityLat).toFixed(2)}°${cityLat >= 0 ? 'N' : 'S'} ${Math.abs(cityLng).toFixed(2)}°${cityLng >= 0 ? 'E' : 'W'}`
            : ''}
        </span>
      </div>

      {/* Film grain on top of everything */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 4 }}>
        <FilmGrain opacity={0.15} seed={22} />
      </div>
    </AbsoluteFill>
  );
};

export default VoxMap;
