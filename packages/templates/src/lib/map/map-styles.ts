import type { MapStyle, MapStyleConfig } from './types';

export const MAP_STYLES: Record<MapStyle, MapStyleConfig> = {
  satellite: {
    urlTemplate:
      'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    background: '#1a1a2e',
    darkMap: true,
  },
  watercolor: {
    urlTemplate: 'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg',
    background: '#F5F0EB',
    darkMap: false,
  },
  toner: {
    urlTemplate: 'https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}.png',
    background: '#000000',
    darkMap: true,
  },
  tonerLite: {
    urlTemplate: 'https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}.png',
    background: '#FFFFFF',
    darkMap: false,
  },
  terrain: {
    urlTemplate: 'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}.png',
    background: '#F4F0E8',
    darkMap: false,
  },
  osm: {
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    background: '#E8E0D8',
    darkMap: false,
  },
  darkMatter: {
    urlTemplate: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    background: '#0e0e0e',
    darkMap: true,
  },
  voyager: {
    urlTemplate: 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    background: '#F2EFE9',
    darkMap: false,
  },
  positron: {
    urlTemplate: 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    background: '#F2F2F2',
    darkMap: false,
  },
};
