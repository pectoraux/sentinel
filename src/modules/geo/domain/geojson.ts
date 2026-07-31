/**
 * Sentinel — GIS Engine: GeoJSON types
 * =============================================================================
 * Minimal GeoJSON type definitions (RFC 7946) for the Sentinel platform.
 * Used for serializing spatial features to/from the API and storage.
 * =============================================================================
 */

export type GeoJSONPosition = [number, number] | [number, number, number];

export type GeoJSONPoint = {
  type: "Point";
  coordinates: GeoJSONPosition;
};

export type GeoJSONLineString = {
  type: "LineString";
  coordinates: GeoJSONPosition[];
};

export type GeoJSONPolygon = {
  type: "Polygon";
  coordinates: GeoJSONPosition[][]; // [exterior, hole1, hole2, ...]
};

export type GeoJSONMultiPolygon = {
  type: "MultiPolygon";
  coordinates: GeoJSONPosition[][][];
};

export type GeoJSONGeometry =
  | GeoJSONPoint
  | GeoJSONLineString
  | GeoJSONPolygon
  | GeoJSONMultiPolygon;

export interface GeoJSONFeature<T extends GeoJSONGeometry = GeoJSONGeometry> {
  type: "Feature";
  geometry: T;
  properties: Record<string, unknown> | null;
  id?: string | number;
}

export interface GeoJSONFeatureCollection<
  T extends GeoJSONGeometry = GeoJSONGeometry,
> {
  type: "FeatureCollection";
  features: GeoJSONFeature<T>[];
}

/**
 * Build a GeoJSON Point feature.
 */
export function pointFeature(
  lng: number,
  lat: number,
  properties: Record<string, unknown> = {},
  id?: string,
): GeoJSONFeature<GeoJSONPoint> {
  return {
    type: "Feature",
    id,
    geometry: { type: "Point", coordinates: [lng, lat] },
    properties,
  };
}

/**
 * Build a GeoJSON Polygon feature from a coordinate ring.
 */
export function polygonFeature(
  ring: GeoJSONPosition[],
  properties: Record<string, unknown> = {},
  id?: string,
): GeoJSONFeature<GeoJSONPolygon> {
  // Ensure the ring is closed
  const closed =
    ring.length > 0 &&
    ring[0]![0] === ring[ring.length - 1]![0] &&
    ring[0]![1] === ring[ring.length - 1]![1]
      ? ring
      : [...ring, ring[0]!];
  return {
    type: "Feature",
    id,
    geometry: { type: "Polygon", coordinates: [closed] },
    properties,
  };
}

/**
 * Serialize a GeoJSON feature to a JSON string (for DB storage).
 */
export function serializeFeature(feature: GeoJSONFeature): string {
  return JSON.stringify(feature);
}

/**
 * Parse a GeoJSON feature from a JSON string.
 */
export function parseFeature<T extends GeoJSONGeometry = GeoJSONGeometry>(
  json: string,
): GeoJSONFeature<T> | null {
  try {
    return JSON.parse(json) as GeoJSONFeature<T>;
  } catch {
    return null;
  }
}
