import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import type { MagazineCountryProps } from './schema';
import { MAGAZINE_COLORS, MAGAZINE_FONTS } from '../../magazine/constants';
import { ScaledContainer } from '../../magazine/ScaledContainer';
import { findCountry } from '../country-highlight/data/countries';
import { computeBboxViewport, lngToPixelX, latToPixelY } from '../country-highlight/lib/tile-math';
import type { MapStyle } from '../country-highlight/lib/tile-math';
import { getSmoothZoomCamera, getDramaticZoomCamera, getKenBurnsCamera } from '../country-highlight/lib/camera';
import MapTileGrid from '../country-highlight/components/MapTileGrid';
import CountryOverlay from '../country-highlight/components/CountryOverlay';
import { editorialReveal, magazineEasing } from '../../magazine/animations';
import { FONT_SIZES } from '../../magazine/constants';
import CityMarker from '../country-highlight/components/CityMarker';

const BASE_W = 1080;
const BASE_H = 1920;

const MagazineCountry: React.FC<MagazineCountryProps> = (props) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const width = BASE_W;
  const height = BASE_H;

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
    <ScaledContainer baseWidth={BASE_W} baseHeight={BASE_H}>
      <div style={{
        position: 'absolute', inset: 0,
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

      {/* Lower-third news banner */}
      {props.showCountryName && (() => {
        const bannerReveal = editorialReveal(frame, 90, 18);
        const barWidth = interpolate(frame, [88, 105], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
        });
        const factsReveal = editorialReveal(frame, 110, 15);

        const facts = [
          props.capital && `Capital: ${props.capital}`,
          props.population && `Pop: ${props.population}`,
          props.region && props.region,
        ].filter(Boolean);

        return (
          <div style={{
            position: 'absolute', bottom: 100, left: 60,
            opacity: bannerReveal.opacity,
            transform: `translateY(${bannerReveal.translateY}px)`,
          }}>
            {/* White card */}
            <div style={{
              backgroundColor: '#ffffff',
              padding: '28px 40px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
            }}>
              {/* Red accent bar at top edge */}
              <div style={{
                position: 'absolute', top: 0, left: 0,
                width: `${barWidth * 100}%`, height: 4,
                backgroundColor: MAGAZINE_COLORS.accent,
              }} />

              {/* Country name */}
              <div style={{
                fontFamily: MAGAZINE_FONTS.headline,
                fontSize: props.countryNameSize * 0.6,
                fontWeight: 700, color: MAGAZINE_COLORS.text,
                textTransform: 'uppercase', letterSpacing: '0.04em',
                lineHeight: 1.1,
              }}>
                {props.countryName}
              </div>

              {/* Facts row */}
              {facts.length > 0 && (
                <div style={{
                  display: 'flex', gap: 20, marginTop: 14,
                  opacity: factsReveal.opacity,
                  transform: `translateY(${factsReveal.translateY}px)`,
                }}>
                  {facts.map((fact, i) => (
                    <div key={i} style={{
                      fontFamily: MAGAZINE_FONTS.accent,
                      fontSize: FONT_SIZES.body,
                      color: MAGAZINE_COLORS.secondary,
                      letterSpacing: '0.02em',
                    }}>
                      {fact}{i < facts.length - 1 ? '' : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}
      </div>
    </ScaledContainer>
  );
};

export default MagazineCountry;
