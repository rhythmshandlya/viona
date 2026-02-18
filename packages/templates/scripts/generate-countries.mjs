/**
 * One-time script to generate country data from Natural Earth 50m.
 * Run: node packages/templates/scripts/generate-countries.mjs
 */

const URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';

const PRECISION = 1000; // 3 decimal places

function round(v) {
  return Math.round(v * PRECISION) / PRECISION;
}

/**
 * Douglas-Peucker simplification to reduce vertex count while preserving shape.
 * Keeps enough detail for smooth rendering without bloating file size.
 */
function simplifyRing(ring, tolerance) {
  if (ring.length <= 3) return ring;

  let maxDist = 0;
  let maxIdx = 0;

  const start = ring[0];
  const end = ring[ring.length - 1];

  for (let i = 1; i < ring.length - 1; i++) {
    const d = pointToLineDist(ring[i], start, end);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyRing(ring.slice(0, maxIdx + 1), tolerance);
    const right = simplifyRing(ring.slice(maxIdx), tolerance);
    return left.slice(0, -1).concat(right);
  }

  return [start, end];
}

function pointToLineDist(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = a[0] + t * dx;
  const projY = a[1] + t * dy;
  return Math.sqrt((p[0] - projX) ** 2 + (p[1] - projY) ** 2);
}

async function main() {
  console.log('Fetching Natural Earth 50m countries...');
  const res = await fetch(URL);
  const geojson = await res.json();

  const countries = [];

  for (const feature of geojson.features) {
    const props = feature.properties;
    const name = props.NAME || props.ADMIN || '';
    const iso_a3 = props.ISO_A3 || '';
    const iso_a2 = props.ISO_A2 || '';

    if (!feature.geometry || !name || iso_a3 === '-99') continue;

    let polygons = [];
    if (feature.geometry.type === 'Polygon') {
      polygons = [feature.geometry.coordinates[0]];
    } else if (feature.geometry.type === 'MultiPolygon') {
      polygons = feature.geometry.coordinates.map((poly) => poly[0]);
    }

    // Simplify with Douglas-Peucker (tolerance in degrees, ~0.1° ≈ 11km)
    // Then round coordinates
    polygons = polygons
      .map((ring) => simplifyRing(ring, 0.1))
      .filter((ring) => ring.length >= 4) // need at least 3 vertices + closing
      .map((ring) => ring.map(([lng, lat]) => [round(lng), round(lat)]));

    if (polygons.length === 0) continue;

    // Compute bounding box
    let minLng = Infinity,
      maxLng = -Infinity,
      minLat = Infinity,
      maxLat = -Infinity;
    for (const ring of polygons) {
      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }

    // Compute centroid
    let sumLng = 0,
      sumLat = 0,
      count = 0;
    for (const ring of polygons) {
      for (const [lng, lat] of ring) {
        sumLng += lng;
        sumLat += lat;
        count++;
      }
    }

    countries.push({
      name,
      iso_a3,
      iso_a2,
      bbox: [round(minLng), round(minLat), round(maxLng), round(maxLat)],
      centroid: [round(sumLng / count), round(sumLat / count)],
      polygons,
    });
  }

  countries.sort((a, b) => a.name.localeCompare(b.name));

  const ts = `/**
 * Natural Earth 50m country data (simplified).
 * Auto-generated — do not edit manually.
 */

export interface CountryData {
  name: string;
  iso_a3: string;
  iso_a2: string;
  /** [minLng, minLat, maxLng, maxLat] */
  bbox: [number, number, number, number];
  /** [lng, lat] */
  centroid: [number, number];
  /** Array of polygon outer rings, each ring is [lng, lat][] */
  polygons: [number, number][][];
}

export const COUNTRIES: CountryData[] = ${JSON.stringify(countries)};

/**
 * Find a country by name, ISO A3, or ISO A2 code.
 * Case-insensitive matching.
 */
export function findCountry(nameOrCode: string): CountryData | undefined {
  const q = nameOrCode.trim().toLowerCase();
  return COUNTRIES.find(
    (c) =>
      c.name.toLowerCase() === q ||
      c.iso_a3.toLowerCase() === q ||
      c.iso_a2.toLowerCase() === q
  );
}
`;

  const path = await import('path');
  const fs = await import('fs');
  const outPath = path.resolve(
    import.meta.dirname,
    '../src/templates/country-highlight/data/countries.ts'
  );
  fs.writeFileSync(outPath, ts, 'utf-8');

  console.log(`Written ${countries.length} countries to ${outPath}`);
  const stat = fs.statSync(outPath);
  console.log(`File size: ${(stat.size / 1024).toFixed(1)} KB`);

  // Print some stats
  let totalVertices = 0;
  for (const c of countries) {
    for (const ring of c.polygons) totalVertices += ring.length;
  }
  console.log(`Total vertices: ${totalVertices}`);

  // Sample: UK vertex count
  const uk = countries.find((c) => c.iso_a3 === 'GBR');
  if (uk) {
    const ukVerts = uk.polygons.reduce((s, r) => s + r.length, 0);
    console.log(`UK vertices: ${ukVerts} across ${uk.polygons.length} polygons`);
  }
}

main().catch(console.error);
