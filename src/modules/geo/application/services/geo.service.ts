/**
 * Sentinel — GIS Engine: Application Services
 * =============================================================================
 * POIService, RegionService, LayerService, SpatialQueryService, TileService.
 * Each service abstracts SQLite (dev) vs PostgreSQL+PostGIS (prod) — dev uses
 * the pure-TS spatial algorithms with in-memory filtering; prod delegates to
 * native PostGIS functions for maximum performance.
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/infrastructure/observability/logger";
import { config } from "@/config";
import {
  haversineDistance,
  findWithinRadius,
  findNearest,
  findWithinPolygon,
  findWithinBBox,
  pointInPolygon,
  polygonAreaKm2,
  polygonCentroid,
  lngLatToTile,
  tileToBBox,
  tileToQuadkey,
  type LngLat,
  type Polygon,
  type BBox,
} from "../../domain/spatial";
import {
  pointFeature,
  polygonFeature,
  serializeFeature,
  parseFeature,
  type GeoJSONFeature,
  type GeoJSONPoint,
  type GeoJSONPolygon,
  type GeoJSONFeatureCollection,
} from "../../domain/geojson";

// ---------------------------------------------------------------------------
// POIService — Point of Interest CRUD + spatial queries
// ---------------------------------------------------------------------------

export class POIService {
  async list(params?: {
    type?: string;
    status?: string;
    layerId?: string;
    country?: string;
    bbox?: BBox;
    limit?: number;
    offset?: number;
  }) {
    const { limit = 200, offset = 0, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;
    if (filters.layerId) where.layerId = filters.layerId;
    if (filters.country) where.country = filters.country;
    if (filters.bbox) {
      where.AND = [
        { lng: { gte: filters.bbox.minLng } },
        { lng: { lte: filters.bbox.maxLng } },
        { lat: { gte: filters.bbox.minLat } },
        { lat: { lte: filters.bbox.maxLat } },
      ];
    }

    const [pois, total] = await Promise.all([
      db.pointOfInterest.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
        include: { layer: { select: { key: true, name: true } } },
      }),
      db.pointOfInterest.count({ where }),
    ]);

    return {
      pois: pois.map((p) => this.serialize(p)),
      total,
    };
  }

  async create(params: {
    name: string;
    type: string;
    lat: number;
    lng: number;
    layerId?: string;
    country?: string;
    region?: string;
    status?: string;
    severity?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ id: string }> {
    const geojson = serializeFeature(
      pointFeature(params.lng, params.lat, {
        name: params.name,
        type: params.type,
        ...params.metadata,
      }),
    );
    const poi = await db.pointOfInterest.create({
      data: {
        name: params.name,
        type: params.type,
        lat: params.lat,
        lng: params.lng,
        geojson,
        layerId: params.layerId,
        country: params.country,
        region: params.region,
        status: params.status ?? "active",
        severity: params.severity,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
    logger.info("poi.created", { id: poi.id, type: poi.type });
    return { id: poi.id };
  }

  /**
   * Find POIs within a radius (meters) of a center point.
   * Dev: TS Haversine. Prod: PostGIS ST_DWithin (via raw query).
   */
  async findWithinRadius(center: { lng: number; lat: number }, radiusM: number, type?: string) {
    if (config.DATABASE_PROVIDER === "postgresql") {
      return this.findWithinRadiusPostGIS(center, radiusM, type);
    }
    // Dev: load all POIs (bbox-pre-filtered) and compute in TS
    const marginDeg = radiusM / 111000;
    const candidates = await db.pointOfInterest.findMany({
      where: {
        lng: { gte: center.lng - marginDeg, lte: center.lng + marginDeg },
        lat: { gte: center.lat - marginDeg, lte: center.lat + marginDeg },
        ...(type ? { type } : {}),
      },
    });
    const points = candidates.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      lat: p.lat,
      lng: p.lng,
      status: p.status,
      severity: p.severity,
    }));
    const result = findWithinRadius(center, radiusM, points);
    return { pois: result, count: result.length };
  }

  private async findWithinRadiusPostGIS(center: { lng: number; lat: number }, radiusM: number, type?: string) {
    const rows = (await db.$queryRaw`
      SELECT id, name, type, lat, lng,
             ST_Distance("geoPoint", ST_MakePoint(${center.lng}, ${center.lat})::geography) as distance
      FROM "PointOfInterest"
      WHERE "geoPoint" IS NOT NULL
        AND ST_DWithin("geoPoint", ST_MakePoint(${center.lng}, ${center.lat})::geography, ${radiusM})
        ${type ? db.$queryRaw`AND type = ${type}` : db.$queryRaw``}
      ORDER BY distance ASC
    `) as Array<{ id: string; name: string; type: string; lat: number; lng: number; distance: number }>;
    return { pois: rows, count: rows.length };
  }

  /**
   * Find the N nearest POIs to a center point.
   */
  async findNearest(center: { lng: number; lat: number }, n: number, type?: string) {
    if (config.DATABASE_PROVIDER === "postgresql") {
      return this.findNearestPostGIS(center, n, type);
    }
    const candidates = await db.pointOfInterest.findMany({
      where: type ? { type } : undefined,
    });
    const points = candidates.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      lat: p.lat,
      lng: p.lng,
      status: p.status,
    }));
    const result = findNearest(center, n, points);
    return { pois: result, count: result.length };
  }

  private async findNearestPostGIS(center: { lng: number; lat: number }, n: number, type?: string) {
    const rows = (await db.$queryRaw`
      SELECT id, name, type, lat, lng,
             ST_Distance("geoPoint", ST_MakePoint(${center.lng}, ${center.lat})::geography) as distance
      FROM "PointOfInterest"
      WHERE "geoPoint" IS NOT NULL
        ${type ? db.$queryRaw`AND type = ${type}` : db.$queryRaw``}
      ORDER BY "geoPoint" <-> ST_MakePoint(${center.lng}, ${center.lat})::geography
      LIMIT ${n}
    `) as Array<{ id: string; name: string; type: string; lat: number; lng: number; distance: number }>;
    return { pois: rows, count: rows.length };
  }

  /**
   * Find POIs within a polygon (GeoJSON coordinates).
   */
  async findWithinPolygon(polygon: LngLat[], type?: string) {
    if (config.DATABASE_PROVIDER === "postgresql") {
      // Could use the PostGIS find_pois_within_polygon function
      // For portability, fall through to TS implementation (works everywhere)
    }
    const ring = polygon as Polygon;
    // Bbox pre-filter
    const minLng = Math.min(...polygon.map((p) => p[0]));
    const maxLng = Math.max(...polygon.map((p) => p[0]));
    const minLat = Math.min(...polygon.map((p) => p[1]));
    const maxLat = Math.max(...polygon.map((p) => p[1]));
    const candidates = await db.pointOfInterest.findMany({
      where: {
        lng: { gte: minLng, lte: maxLng },
        lat: { gte: minLat, lte: maxLat },
        ...(type ? { type } : {}),
      },
    });
    const points = candidates.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      lat: p.lat,
      lng: p.lng,
      status: p.status,
    }));
    const result = findWithinPolygon(ring, points);
    return { pois: result, count: result.length };
  }

  private serialize(p: {
    id: string;
    name: string;
    type: string;
    lat: number;
    lng: number;
    geojson: string | null;
    layerId: string | null;
    country: string | null;
    region: string | null;
    status: string;
    severity: string | null;
    metadata: string | null;
    layer?: { key: string; name: string } | null;
  }) {
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      lat: p.lat,
      lng: p.lng,
      geojson: p.geojson ? parseFeature(p.geojson) : null,
      layerId: p.layerId,
      layer: p.layer,
      country: p.country,
      region: p.region,
      status: p.status,
      severity: p.severity,
      metadata: p.metadata ? JSON.parse(p.metadata) : null,
    };
  }
}

// ---------------------------------------------------------------------------
// RegionService — Spatial region (polygon) CRUD
// ---------------------------------------------------------------------------

export class RegionService {
  async list(params?: { type?: string; country?: string; layerId?: string }) {
    const where: Record<string, unknown> = {};
    if (params?.type) where.type = params.type;
    if (params?.country) where.country = params.country;
    if (params?.layerId) where.layerId = params.layerId;
    const regions = await db.spatialRegion.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { layer: { select: { key: true, name: true } } },
    });
    return {
      regions: regions.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        geojson: parseFeature<GeoJSONPolygon>(r.geojson),
        bbox: r.bbox ? JSON.parse(r.bbox) : null,
        areaKm2: r.areaKm2,
        country: r.country,
        region: r.region,
        layerId: r.layerId,
        layer: r.layer,
        status: r.status,
        metadata: r.metadata ? JSON.parse(r.metadata) : null,
      })),
    };
  }

  async create(params: {
    name: string;
    type: string;
    coordinates: LngLat[]; // exterior ring
    layerId?: string;
    country?: string;
    region?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ id: string }> {
    const ring = params.coordinates;
    const feature = polygonFeature(ring, { name: params.name, type: params.type });
    const geojson = serializeFeature(feature);
    const area = polygonAreaKm2(ring as Polygon);
    const [minLng, minLat, maxLng, maxLat] = [
      Math.min(...ring.map((p) => p[0])),
      Math.min(...ring.map((p) => p[1])),
      Math.max(...ring.map((p) => p[0])),
      Math.max(...ring.map((p) => p[1])),
    ];
    const bbox = JSON.stringify({ minLng, minLat, maxLng, maxLat });
    const region = await db.spatialRegion.create({
      data: {
        name: params.name,
        type: params.type,
        geojson,
        bbox,
        areaKm2: area,
        layerId: params.layerId,
        country: params.country,
        region: params.region,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
    logger.info("region.created", { id: region.id, type: region.type, areaKm2: area });
    return { id: region.id };
  }
}

// ---------------------------------------------------------------------------
// LayerService — Map layer management
// ---------------------------------------------------------------------------

export class LayerService {
  async list() {
    const layers = await db.geoLayer.findMany({
      orderBy: [{ zIndex: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { points: true, regions: true } },
      },
    });
    return {
      layers: layers.map((l) => ({
        id: l.id,
        key: l.key,
        name: l.name,
        type: l.type,
        source: l.source,
        description: l.description,
        visible: l.visible,
        zIndex: l.zIndex,
        opacity: l.opacity,
        config: l.config ? JSON.parse(l.config) : null,
        pointCount: l._count.points,
        regionCount: l._count.regions,
      })),
    };
  }

  async toggle(key: string, visible: boolean): Promise<void> {
    await db.geoLayer.update({ where: { key }, data: { visible } });
    logger.info("layer.toggled", { key, visible });
  }

  async setOpacity(key: string, opacity: number): Promise<void> {
    await db.geoLayer.update({ where: { key }, data: { opacity } });
  }
}

// ---------------------------------------------------------------------------
// TileService — Tile manifest & coordinate math
// ---------------------------------------------------------------------------

export class TileService {
  /**
   * Get the tile (z/x/y) that contains a given coordinate at a zoom level.
   */
  tileForCoordinate(lng: number, lat: number, zoom: number) {
    const tile = lngLatToTile(lng, lat, zoom);
    const bbox = tileToBBox(tile.x, tile.y, zoom);
    const quadkey = tileToQuadkey(zoom, tile.x, tile.y);
    return {
      zoom,
      x: tile.x,
      y: tile.y,
      quadkey,
      bbox: { minLng: bbox[0], minLat: bbox[1], maxLng: bbox[2], maxLat: bbox[3] },
    };
  }

  /**
   * Get the tile manifest for a layer at a specific zoom (which tiles are cached).
   */
  async manifestForLayer(layerId: string, zoom: number) {
    const tiles = await db.geoTileManifest.findMany({
      where: { layerId, z: zoom },
      take: 1000,
    });
    return {
      layerId,
      zoom,
      tileCount: tiles.length,
      cached: tiles.filter((t) => t.status === "cached").length,
      tiles: tiles.map((t) => ({
        z: t.z,
        x: t.x,
        y: t.y,
        status: t.status,
        sizeBytes: t.sizeBytes,
        quadkey: tileToQuadkey(t.z, t.x, t.y),
      })),
    };
  }

  /**
   * Compute the set of tiles needed to cover a bounding box at a zoom level.
   * Returns an array of { x, y, z, quadkey } — used for tile prefetching.
   */
  tilesForBBox(bbox: BBox, zoom: number) {
    const minTile = lngLatToTile(bbox.minLng, bbox.maxLat, zoom); // NW corner
    const maxTile = lngLatToTile(bbox.maxLng, bbox.minLat, zoom); // SE corner
    const tiles: Array<{ x: number; y: number; z: number; quadkey: string }> = [];
    for (let x = minTile.x; x <= maxTile.x; x++) {
      for (let y = minTile.y; y <= maxTile.y; y++) {
        tiles.push({ x, y, z: zoom, quadkey: tileToQuadkey(zoom, x, y) });
      }
    }
    return { tiles, count: tiles.length };
  }
}

// ---------------------------------------------------------------------------
// SpatialQueryService — unified spatial query API
// ---------------------------------------------------------------------------

export class SpatialQueryService {
  async summary() {
    const [
      poiCount,
      poiByType,
      poiByStatus,
      regionCount,
      regionByType,
      layerCount,
      activeLayers,
    ] = await Promise.all([
      db.pointOfInterest.count(),
      db.pointOfInterest.groupBy({ by: ["type"], _count: true }),
      db.pointOfInterest.groupBy({ by: ["status"], _count: true }),
      db.spatialRegion.count(),
      db.spatialRegion.groupBy({ by: ["type"], _count: true }),
      db.geoLayer.count(),
      db.geoLayer.count({ where: { visible: true } }),
    ]);

    const totalArea = await db.spatialRegion
      .aggregate({ _sum: { areaKm2: true } })
      .then((r) => r._sum.areaKm2 ?? 0);

    return {
      pointsOfInterest: {
        total: poiCount,
        byType: poiByType.map((g) => ({ type: g.type, count: g._count })),
        byStatus: poiByStatus.map((g) => ({ status: g.status, count: g._count })),
      },
      regions: {
        total: regionCount,
        byType: regionByType.map((g) => ({ type: g.type, count: g._count })),
        totalAreaKm2: totalArea,
      },
      layers: {
        total: layerCount,
        active: activeLayers,
      },
      database: {
        provider: config.DATABASE_PROVIDER,
        spatialEngine: config.DATABASE_PROVIDER === "postgresql" ? "PostGIS" : "TypeScript (Haversine + ray-casting)",
      },
    };
  }

  /**
   * Export all POIs as a GeoJSON FeatureCollection (for map rendering).
   */
  async exportPOIsAsGeoJSON(params?: { type?: string; bbox?: BBox }): Promise<GeoJSONFeatureCollection> {
    const { pois } = await new POIService().list({
      type: params?.type,
      bbox: params?.bbox,
      limit: 10000,
    });
    return {
      type: "FeatureCollection",
      features: pois.map((p) =>
        pointFeature(p.lng, p.lat, {
          id: p.id,
          name: p.name,
          type: p.type,
          status: p.status,
          severity: p.severity,
        }, p.id),
      ) as GeoJSONFeature[],
    };
  }

  /**
   * Export all regions as a GeoJSON FeatureCollection.
   */
  async exportRegionsAsGeoJSON(): Promise<GeoJSONFeatureCollection> {
    const { regions } = await new RegionService().list();
    return {
      type: "FeatureCollection",
      features: regions
        .filter((r) => r.geojson)
        .map((r) => {
          const feature = r.geojson!;
          return {
            ...feature,
            properties: {
              ...feature.properties,
              id: r.id,
              name: r.name,
              type: r.type,
              areaKm2: r.areaKm2,
              status: r.status,
            },
          };
        }),
    };
  }
}

// ---------------------------------------------------------------------------
// Singletons
// ---------------------------------------------------------------------------

let _poi: POIService | null = null;
let _reg: RegionService | null = null;
let _lay: LayerService | null = null;
let _til: TileService | null = null;
let _spq: SpatialQueryService | null = null;

export function getPOIService(): POIService {
  if (!_poi) _poi = new POIService();
  return _poi;
}
export function getRegionService(): RegionService {
  if (!_reg) _reg = new RegionService();
  return _reg;
}
export function getLayerService(): LayerService {
  if (!_lay) _lay = new LayerService();
  return _lay;
}
export function getTileService(): TileService {
  if (!_til) _til = new TileService();
  return _til;
}
export function getSpatialQueryService(): SpatialQueryService {
  if (!_spq) _spq = new SpatialQueryService();
  return _spq;
}
