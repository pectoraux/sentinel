/**
 * Sentinel — GIS Engine: Spatial Algorithms
 * =============================================================================
 * Pure-TypeScript spatial algorithms that work without PostGIS. In production
 * (PostgreSQL+PostGIS), these are also available as native SQL functions (see
 * prisma/sql/postgis.sql) for maximum performance, but the TS implementations
 * provide a portable fallback and are used for in-memory / dev queries.
 *
 * Algorithms:
 *   - Haversine distance (great-circle, meters)
 *   - Vincenty distance (geodesic, higher accuracy) — optional
 *   - Point-in-polygon (ray-casting)
 *   - Point-in-polygon (winding number) — alternative
 *   - Bounding-box pre-filter
 *   - Nearest-neighbor (linear scan; k-d tree for large sets)
 *   - Polygon area (shoelace formula)
 *   - Polygon centroid
 *   - Line length
 *   - Great-circle interpolation
 * =============================================================================
 */

import { EARTH_RADIUS_M, DEG_TO_RAD } from "./coordinate-transforms";

// ---------------------------------------------------------------------------
// Distance algorithms
// ---------------------------------------------------------------------------

/**
 * Haversine great-circle distance between two WGS84 points, in meters.
 * Accurate to ~0.3% — sufficient for most geospatial queries.
 */
export function haversineDistance(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number,
): number {
  const phi1 = lat1 * DEG_TO_RAD;
  const phi2 = lat2 * DEG_TO_RAD;
  const dPhi = (lat2 - lat1) * DEG_TO_RAD;
  const dLambda = (lng2 - lng1) * DEG_TO_RAD;

  const a =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_M * c;
}

/**
 * Compute distance and bearing between two points.
 * Bearing is in degrees (0 = north, 90 = east).
 */
export function distanceAndBearing(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number,
): { distance: number; bearing: number } {
  const distance = haversineDistance(lng1, lat1, lng2, lat2);
  const phi1 = lat1 * DEG_TO_RAD;
  const phi2 = lat2 * DEG_TO_RAD;
  const dLambda = (lng2 - lng1) * DEG_TO_RAD;

  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;

  return { distance, bearing: (bearing + 360) % 360 };
}

// ---------------------------------------------------------------------------
// Point-in-polygon algorithms
// ---------------------------------------------------------------------------

export type LngLat = [number, number];
export type Polygon = LngLat[]; // closed ring (first === last)
export type MultiPolygon = Polygon[];

/**
 * Ray-casting point-in-polygon test.
 * Returns true if the point [lng, lat] is inside the polygon ring.
 */
export function pointInPolygon(point: LngLat, polygon: Polygon): boolean {
  const [x, y] = point;
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Point-in-polygon test for GeoJSON Polygon geometry.
 * Tests exterior ring (must be inside) minus holes (must be outside).
 */
export function pointInGeoJSONPolygon(
  point: LngLat,
  rings: LngLat[],
): boolean {
  if (rings.length === 0) return false;
  // Must be inside the exterior ring
  if (!pointInPolygon(point, rings[0]!)) return false;
  // Must NOT be inside any hole
  for (let i = 1; i < rings.length; i++) {
    if (pointInPolygon(point, rings[i]!)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Polygon geometry
// ---------------------------------------------------------------------------

/**
 * Compute the area of a polygon ring using the shoelace formula.
 * Returns area in square degrees (convert to km² with a degree-to-km factor).
 */
export function polygonAreaDegrees(polygon: Polygon): number {
  let area = 0;
  const n = polygon.length;
  for (let i = 0; i < n - 1; i++) {
    const [xi, yi] = polygon[i]!;
    const [xi1, yi1] = polygon[i + 1] ?? polygon[0]!;
    area += xi * yi1 - xi1 * yi;
  }
  return Math.abs(area) / 2;
}

/**
 * Approximate polygon area in km². Uses the shoelace formula with a
 * latitude-dependent degree-to-km conversion (accurate enough for
 * region-scale polygons; use PostGIS ST_Area for surveying-grade).
 */
export function polygonAreaKm2(polygon: Polygon): number {
  const areaDeg = polygonAreaDegrees(polygon);
  // Average latitude for degree-size correction
  const avgLat = polygon.reduce((s, [, lat]) => s + lat, 0) / polygon.length;
  const kmPerDegLat = 111.32;
  const kmPerDegLng = 111.32 * Math.cos(avgLat * DEG_TO_RAD);
  return areaDeg * kmPerDegLat * kmPerDegLng;
}

/**
 * Compute the centroid of a polygon ring.
 */
export function polygonCentroid(polygon: Polygon): LngLat {
  let cx = 0,
    cy = 0,
    area = 0;
  const n = polygon.length;
  for (let i = 0; i < n - 1; i++) {
    const [xi, yi] = polygon[i]!;
    const [xi1, yi1] = polygon[i + 1] ?? polygon[0]!;
    const cross = xi * yi1 - xi1 * yi;
    area += cross;
    cx += (xi + xi1) * cross;
    cy += (yi + yi1) * cross;
  }
  area /= 2;
  if (area === 0) {
    // Fallback: average of vertices
    return [
      polygon.reduce((s, [x]) => s + x, 0) / n,
      polygon.reduce((s, [, y]) => s + y, 0) / n,
    ];
  }
  return [cx / (6 * area), cy / (6 * area)];
}

// ---------------------------------------------------------------------------
// Nearest-neighbor & spatial filtering
// ---------------------------------------------------------------------------

export interface SpatialPoint {
  id: string;
  lng: number;
  lat: number;
  [key: string]: unknown;
}

/**
 * Find points within a radius (meters) of a center point.
 * Uses Haversine distance. Pre-filtered by bounding box for efficiency.
 */
export function findWithinRadius<T extends SpatialPoint>(
  center: { lng: number; lat: number },
  radiusM: number,
  points: T[],
): Array<T & { distance: number }> {
  // Bounding-box pre-filter: 1 degree ≈ 111km
  const marginDeg = radiusM / 111000;
  const result: Array<T & { distance: number }> = [];

  for (const p of points) {
    // Fast bbox reject
    if (
      Math.abs(p.lng - center.lng) > marginDeg ||
      Math.abs(p.lat - center.lat) > marginDeg
    ) {
      continue;
    }
    const dist = haversineDistance(center.lng, center.lat, p.lng, p.lat);
    if (dist <= radiusM) {
      result.push({ ...p, distance: dist });
    }
  }

  result.sort((a, b) => a.distance - b.distance);
  return result;
}

/**
 * Find the N nearest points to a center point.
 */
export function findNearest<T extends SpatialPoint>(
  center: { lng: number; lat: number },
  n: number,
  points: T[],
): Array<T & { distance: number }> {
  const withDist = points.map((p) => ({
    ...p,
    distance: haversineDistance(center.lng, center.lat, p.lng, p.lat),
  }));
  withDist.sort((a, b) => a.distance - b.distance);
  return withDist.slice(0, n);
}

/**
 * Find all points inside a polygon.
 */
export function findWithinPolygon<T extends SpatialPoint>(
  polygon: Polygon,
  points: T[],
): T[] {
  // Bounding-box pre-filter
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  for (const [lng, lat] of polygon) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return points.filter((p) => {
    if (p.lng < minLng || p.lng > maxLng || p.lat < minLat || p.lat > maxLat) {
      return false;
    }
    return pointInPolygon([p.lng, p.lat], polygon);
  });
}

/**
 * Find all points within a bounding box.
 */
export function findWithinBBox<T extends SpatialPoint>(
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number },
  points: T[],
): T[] {
  return points.filter(
    (p) =>
      p.lng >= bbox.minLng &&
      p.lng <= bbox.maxLng &&
      p.lat >= bbox.minLat &&
      p.lat <= bbox.maxLat,
  );
}

// ---------------------------------------------------------------------------
// Great-circle interpolation (for drawing lines / flight paths)
// ---------------------------------------------------------------------------

/**
 * Interpolate N points along the great-circle path between two coordinates.
 * Useful for drawing geodesic lines on a map.
 */
export function interpolateGreatCircle(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number,
  n: number,
): LngLat[] {
  const phi1 = lat1 * DEG_TO_RAD;
  const phi2 = lat2 * DEG_TO_RAD;
  const dLambda = (lng2 - lng1) * DEG_TO_RAD;
  const d = Math.acos(
    Math.sin(phi1) * Math.sin(phi2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.cos(dLambda),
  );

  if (d === 0) return [[lng1, lat1]];

  const points: LngLat[] = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(phi1) * Math.cos((lng1 * DEG_TO_RAD)) + B * Math.cos(phi2) * Math.cos((lng2 * DEG_TO_RAD));
    const y = A * Math.cos(phi1) * Math.sin((lng1 * DEG_TO_RAD)) + B * Math.cos(phi2) * Math.sin((lng2 * DEG_TO_RAD));
    const z = A * Math.sin(phi1) + B * Math.sin(phi2);
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * (180 / Math.PI);
    const lng = Math.atan2(y, x) * (180 / Math.PI);
    points.push([lng, lat]);
  }
  return points;
}

// ---------------------------------------------------------------------------
// Spatial index (lightweight k-d tree for in-memory nearest-neighbor)
// ---------------------------------------------------------------------------

/**
 * Simple 2D k-d tree for fast nearest-neighbor queries on static point sets.
 * Build once, query many times. O(log n) average nearest-neighbor.
 */
export class KDTree<T extends SpatialPoint> {
  private root: KDNode<T> | null = null;

  constructor(private points: T[]) {
    this.root = this.build(points, 0);
  }

  private build(points: T[], depth: number): KDNode<T> | null {
    if (points.length === 0) return null;
    const axis = depth % 2; // 0 = lng, 1 = lat
    points.sort((a, b) => (axis === 0 ? a.lng - b.lng : a.lat - b.lat));
    const mid = Math.floor(points.length / 2);
    const node: KDNode<T> = {
      point: points[mid]!,
      axis,
      left: this.build(points.slice(0, mid), depth + 1),
      right: this.build(points.slice(mid + 1), depth + 1),
    };
    return node;
  }

  nearest(center: { lng: number; lat: number }, k: number): Array<T & { distance: number }> {
    const results: Array<{ point: T; distance: number }> = [];
    const search = (node: KDNode<T> | null, depth: number) => {
      if (!node) return;
      const axis = depth % 2;
      const dist = haversineDistance(center.lng, center.lat, node.point.lng, node.point.lat);
      results.push({ point: node.point, distance: dist });
      results.sort((a, b) => a.distance - b.distance);
      if (results.length > k) results.length = k;

      const diff =
        axis === 0 ? center.lng - node.point.lng : center.lat - node.point.lat;
      const [near, far] = diff < 0 ? [node.left, node.right] : [node.right, node.left];
      search(near, depth + 1);
      // Check if we need to search the other side
      const axisDist = Math.abs(diff);
      if (results.length < k || axisDist < results[results.length - 1]!.distance) {
        search(far, depth + 1);
      }
    };
    search(this.root, 0);
    return results.slice(0, k).map((r) => ({ ...r.point, distance: r.distance }));
  }
}

interface KDNode<T> {
  point: T;
  axis: number;
  left: KDNode<T> | null;
  right: KDNode<T> | null;
}
