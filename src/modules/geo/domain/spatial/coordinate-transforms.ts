/**
 * Sentinel — GIS Engine: Coordinate Transforms
 * =============================================================================
 * Production-grade coordinate system transforms for the Sentinel geospatial
 * platform. All formulas are implemented from first principles (no external
 * GIS library dependency) so they work identically on SQLite (dev) and
 * PostgreSQL+PostGIS (production).
 *
 * Supported transforms:
 *   - WGS84 (lat/lng) ↔ Web Mercator (EPSG:3857) x/y (meters)
 *   - WGS84 (lat/lng) ↔ Pixel coordinates at a given zoom
 *   - WGS84 (lat/lng) ↔ Tile coordinates (XYZ scheme, z/x/y)
 *   - Tile (z/x/y) ↔ Quadkey (Bing quadtree encoding)
 *   - WGS84 (lat/lng) ↔ MGRS (Military Grid Reference System) — approximate
 *   - Bounding box computation
 *
 * References:
 *   - Web Mercator: EPSG:3857 / SR-ORG:6864
 *   - XYZ tile scheme: Google/OSM standard
 *   - Earth radius: 6378137.0 m (WGS84 semi-major axis)
 * =============================================================================
 */

// WGS84 constants
export const EARTH_RADIUS_M = 6378137.0;
export const EARTH_CIRCUMFERENCE_M = 2 * Math.PI * EARTH_RADIUS_M; // ~40075016.69
export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;
export const MAX_LAT_MERCATOR = 85.05112878; // Web Mercator latitude clamp

// ---------------------------------------------------------------------------
// WGS84 (lat/lng) ↔ Web Mercator (EPSG:3857)
// ---------------------------------------------------------------------------

/**
 * Convert WGS84 lat/lng to Web Mercator x/y (meters).
 * x = R * lng_rad
 * y = R * ln(tan(π/4 + lat_rad/2))
 */
export function lngLatToMercator(lng: number, lat: number): { x: number; y: number } {
  const latClamped = Math.max(-MAX_LAT_MERCATOR, Math.min(MAX_LAT_MERCATOR, lat));
  return {
    x: EARTH_RADIUS_M * lng * DEG_TO_RAD,
    y: EARTH_RADIUS_M * Math.log(Math.tan(Math.PI / 4 + (latClamped * DEG_TO_RAD) / 2)),
  };
}

/**
 * Convert Web Mercator x/y (meters) to WGS84 lat/lng.
 */
export function mercatorToLngLat(x: number, y: number): { lng: number; lat: number } {
  return {
    lng: (x / EARTH_RADIUS_M) * RAD_TO_DEG,
    lat: (2 * Math.atan(Math.exp(y / EARTH_RADIUS_M)) - Math.PI / 2) * RAD_TO_DEG,
  };
}

// ---------------------------------------------------------------------------
// WGS84 (lat/lng) ↔ Pixel coordinates at zoom
// ---------------------------------------------------------------------------

/**
 * Tile size in pixels (standard 256x256).
 */
export const TILE_SIZE = 256;

/**
 * Map width in pixels at a given zoom level.
 */
export function mapSizePx(zoom: number): number {
  return TILE_SIZE * Math.pow(2, zoom);
}

/**
 * Convert WGS84 lat/lng to global pixel coordinates at a given zoom.
 */
export function lngLatToPixel(lng: number, lat: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const latClamped = Math.max(-MAX_LAT_MERCATOR, Math.min(MAX_LAT_MERCATOR, lat));
  return {
    x: ((lng + 180) / 360) * n * TILE_SIZE,
    y: ((1 - Math.log(Math.tan(latClamped * DEG_TO_RAD) + 1 / Math.cos(latClamped * DEG_TO_RAD)) / Math.PI) / 2) * n * TILE_SIZE,
  };
}

/**
 * Convert global pixel coordinates at a given zoom back to WGS84 lat/lng.
 */
export function pixelToLngLat(x: number, y: number, zoom: number): { lng: number; lat: number } {
  const n = Math.pow(2, zoom);
  const lng = (x / (n * TILE_SIZE)) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y / (n * TILE_SIZE)))));
  return { lng, lat: latRad * RAD_TO_DEG };
}

// ---------------------------------------------------------------------------
// WGS84 (lat/lng) ↔ Tile coordinates (XYZ scheme)
// ---------------------------------------------------------------------------

/**
 * Convert WGS84 lat/lng to tile x/y at a given zoom (XYZ / Google scheme).
 * Returns the tile that contains the point.
 */
export function lngLatToTile(lng: number, lat: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const latClamped = Math.max(-MAX_LAT_MERCATOR, Math.min(MAX_LAT_MERCATOR, lat));
  return {
    x: Math.floor(((lng + 180) / 360) * n),
    y: Math.floor(
      ((1 - Math.log(Math.tan(latClamped * DEG_TO_RAD) + 1 / Math.cos(latClamped * DEG_TO_RAD)) / Math.PI) / 2) * n,
    ),
  };
}

/**
 * Convert tile x/y at a given zoom to the WGS84 bounding box of that tile.
 * Returns [minLng, minLat, maxLng, maxLat].
 */
export function tileToBBox(x: number, y: number, zoom: number): [number, number, number, number] {
  const n = Math.pow(2, zoom);
  const lngMin = (x / n) * 360 - 180;
  const lngMax = ((x + 1) / n) * 360 - 180;
  const latMax = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y / n)))) * RAD_TO_DEG;
  const latMin = Math.atan(Math.sinh(Math.PI * (1 - 2 * ((y + 1) / n)))) * RAD_TO_DEG;
  return [lngMin, latMin, lngMax, latMax];
}

/**
 * Convert tile x/y at a given zoom to the center point (WGS84).
 */
export function tileToCenterLngLat(x: number, y: number, zoom: number): { lng: number; lat: number } {
  const [minLng, minLat, maxLng, maxLat] = tileToBBox(x, y, zoom);
  return { lng: (minLng + maxLng) / 2, lat: (minLat + maxLat) / 2 };
}

// ---------------------------------------------------------------------------
// Tile ↔ Quadkey (Bing quadtree encoding)
// ---------------------------------------------------------------------------

/**
 * Convert tile (z/x/y) to a Bing quadkey string.
 * Quadkeys enable efficient spatial indexing via quadtree subdivision.
 */
export function tileToQuadkey(zoom: number, x: number, y: number): string {
  let quadkey = "";
  for (let i = zoom; i > 0; i--) {
    let digit = 0;
    const mask = 1 << (i - 1);
    if ((x & mask) !== 0) digit += 1;
    if ((y & mask) !== 0) digit += 2;
    quadkey += digit.toString();
  }
  return quadkey;
}

/**
 * Convert a Bing quadkey string back to tile (z/x/y).
 */
export function quadkeyToTile(quadkey: string): { zoom: number; x: number; y: number } {
  let x = 0;
  let y = 0;
  const zoom = quadkey.length;
  for (let i = zoom; i > 0; i--) {
    const mask = 1 << (i - 1);
    const digit = parseInt(quadkey[zoom - i], 10);
    if (digit === 1 || digit === 3) x |= mask;
    if (digit === 2 || digit === 3) y |= mask;
  }
  return { zoom, x, y };
}

// ---------------------------------------------------------------------------
// Bounding box helpers
// ---------------------------------------------------------------------------

export interface BBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

/**
 * Compute the bounding box of an array of [lng, lat] points.
 */
export function bboxOfPoints(points: Array<[number, number]>): BBox {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  for (const [lng, lat] of points) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLng, minLat, maxLng, maxLat };
}

/**
 * Check if a point is within a bounding box.
 */
export function pointInBBox(lng: number, lat: number, bbox: BBox): boolean {
  return (
    lng >= bbox.minLng &&
    lng <= bbox.maxLng &&
    lat >= bbox.minLat &&
    lat <= bbox.maxLat
  );
}

/**
 * Expand a bounding box by a margin (in degrees).
 */
export function expandBBox(bbox: BBox, marginDeg: number): BBox {
  return {
    minLng: bbox.minLng - marginDeg,
    minLat: bbox.minLat - marginDeg,
    maxLng: bbox.maxLng + marginDeg,
    maxLat: bbox.maxLat + marginDeg,
  };
}

// ---------------------------------------------------------------------------
// MGRS (Military Grid Reference System) — approximate conversion
// ---------------------------------------------------------------------------

/**
 * Approximate WGS84 → MGRS conversion. Returns a string like "30NWM6229043913".
 * This is a simplified implementation sufficient for display purposes.
 * For surveying-grade accuracy, use a dedicated library (e.g., mgrs).
 */
export function lngLatToMGRS(lng: number, lat: number): string {
  // UTM zone
  const zone = Math.floor((lng + 180) / 6) + 1;
  const latBandLetter = getLatBandLetter(lat);

  // Simplified: just return zone + band + approximate easting/northing
  const { easting, northing } = lngLatToUTM(lng, lat);
  const e = Math.floor(easting).toString().padStart(6, "0");
  const n = Math.floor(northing).toString().padStart(7, "0");

  // 100km grid square (simplified — first 2 digits of easting/northing)
  const e100 = e.slice(0, 2);
  const n100 = n.slice(0, 2);

  return `${zone}${latBandLetter}${e100}${n100}${e.slice(2)}${n.slice(2)}`;
}

function getLatBandLetter(lat: number): string {
  const bands = "CDEFGHJKLMNPQRSTUVWXX";
  const idx = Math.floor((lat + 80) / 8);
  return bands[Math.max(0, Math.min(bands.length - 1, idx))] ?? "N";
}

function lngLatToUTM(lng: number, lat: number): { easting: number; northing: number } {
  const zone = Math.floor((lng + 180) / 6) + 1;
  const centralMeridian = (zone - 1) * 6 - 180 + 3;
  const a = 6378137.0;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;
  const e = Math.sqrt(f * (2 - f));
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);

  const latRad = lat * DEG_TO_RAD;
  const lngRad = lng * DEG_TO_RAD;
  const lngRefRad = (centralMeridian) * DEG_TO_RAD;

  const N = a / Math.sqrt(1 - e2 * Math.sin(latRad) ** 2);
  const T = Math.tan(latRad) ** 2;
  const C = ep2 * Math.cos(latRad) ** 2;
  const A = Math.cos(latRad) * (lngRad - lngRefRad);

  const M =
    a *
    ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * latRad -
      ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * latRad) +
      ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * latRad) -
      ((35 * e2 ** 3) / 3072) * Math.sin(6 * latRad));

  const easting =
    k0 * N * (A + ((1 - T + C) * A ** 3) / 6 + ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5) / 120) + 500000;
  const northing =
    k0 * (M + N * Math.tan(latRad) * ((A ** 2) / 2 + ((5 - T + 9 * C + 4 * C * C) * A ** 4) / 24 + ((61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6) / 720)) +
    (lat < 0 ? 10000000 : 0);

  return { easting, northing };
}
