/**
 * Sentinel — GIS Engine module barrel.
 */
export {
  POIService,
  RegionService,
  LayerService,
  TileService,
  SpatialQueryService,
  getPOIService,
  getRegionService,
  getLayerService,
  getTileService,
  getSpatialQueryService,
} from "./application/services/geo.service";

export {
  // Coordinate transforms
  lngLatToMercator,
  mercatorToLngLat,
  lngLatToPixel,
  pixelToLngLat,
  lngLatToTile,
  tileToBBox,
  tileToCenterLngLat,
  tileToQuadkey,
  quadkeyToTile,
  bboxOfPoints,
  pointInBBox,
  expandBBox,
  lngLatToMGRS,
  mapSizePx,
  EARTH_RADIUS_M,
  TILE_SIZE,
  MAX_LAT_MERCATOR,
  // Spatial algorithms
  haversineDistance,
  distanceAndBearing,
  pointInPolygon,
  pointInGeoJSONPolygon,
  polygonAreaDegrees,
  polygonAreaKm2,
  polygonCentroid,
  findWithinRadius,
  findNearest,
  findWithinPolygon,
  findWithinBBox,
  interpolateGreatCircle,
  KDTree,
  // Types
  type LngLat,
  type Polygon,
  type BBox,
  type SpatialPoint,
} from "./domain/spatial";

export {
  pointFeature,
  polygonFeature,
  serializeFeature,
  parseFeature,
  type GeoJSONFeature,
  type GeoJSONFeatureCollection,
  type GeoJSONPoint,
  type GeoJSONPolygon,
  type GeoJSONGeometry,
  type GeoJSONPosition,
} from "./domain/geojson";
