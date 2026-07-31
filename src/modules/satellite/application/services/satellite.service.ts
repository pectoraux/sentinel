/**
 * Sentinel — Satellite Ingestion Service
 * =============================================================================
 * Scheduled satellite imagery ingestion: Sentinel-2, Landsat-8.
 * Raster pipeline: download → rectify → tile → cache → archive.
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/infrastructure/observability/logger";
import { tileToQuadkey } from "@/modules/geo/domain/spatial/coordinate-transforms";
import { createHash } from "node:crypto";
import {
  SATELLITE_META,
  PIPELINE_STAGES,
  FREQUENCY_META,
  tilePyramidCount,
  estimateCacheSize,
  formatBytes,
  type Satellite,
  type ProcessingStage,
} from "../../domain/satellite-types";

export class SatelliteIngestionService {
  /**
   * Schedule a new ingestion task.
   */
  async schedule(params: {
    name: string;
    satellite: string;
    bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
    frequency?: string;
    maxCloudCover?: number;
    minResolutionM?: number;
    bands?: string[];
    createdById?: string;
  }): Promise<{ id: string }> {
    const [minLng, minLat, maxLng, maxLat] = params.bbox;
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const freq = params.frequency ?? "weekly";
    const freqMeta = FREQUENCY_META[freq as keyof typeof FREQUENCY_META] ?? FREQUENCY_META.weekly;
    const nextRunAt = freqMeta.intervalDays > 0
      ? new Date(Date.now() + freqMeta.intervalDays * 24 * 60 * 60 * 1000)
      : null;

    const schedule = await db.ingestionSchedule.create({
      data: {
        name: params.name,
        satellite: params.satellite,
        bbox: JSON.stringify(params.bbox),
        centerLat,
        centerLng,
        frequency: freq,
        cronExpression: freqMeta.cron,
        nextRunAt,
        maxCloudCover: params.maxCloudCover ?? 20,
        minResolutionM: params.minResolutionM ?? 10,
        bands: params.bands ? JSON.stringify(params.bands) : null,
        isActive: true,
        createdById: params.createdById,
      },
    });

    logger.info("satellite.scheduled", { id: schedule.id, satellite: params.satellite, frequency: freq });
    return { id: schedule.id };
  }

  /**
   * Simulate ingesting a satellite scene (in production this would download from Copernicus/USGS).
   * Runs through the full raster pipeline: download → rectify → tile → cache → ready.
   */
  async ingestScene(params: {
    satellite: string;
    acquisitionDate: Date;
    cloudCover: number;
    bbox: [number, number, number, number];
    resolutionM?: number;
    scheduledById?: string;
    scheduleId?: string;
  }): Promise<{ sceneId: string; status: string; tileCount: number }> {
    const [minLng, minLat, maxLng, maxLat] = params.bbox;
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const sat = params.satellite as Satellite;
    const satMeta = SATELLITE_META[sat] ?? SATELLITE_META.sentinel2;
    const resolutionM = params.resolutionM ?? satMeta.resolutionM;

    // Generate a realistic scene ID
    const sceneIdStr = `${sat.toUpperCase()}_${params.acquisitionDate.toISOString().slice(0, 10).replace(/-/g, "")}_${centerLat.toFixed(2)}_${centerLng.toFixed(2)}`;
    const hash = createHash("sha256").update(sceneIdStr).digest("hex").slice(0, 8);
    const officialSceneId = `${satMeta.label.replace("-", "")}_${hash}_${params.acquisitionDate.toISOString().slice(0, 10)}`;

    // Create scene record with "downloading" status
    const scene = await db.satelliteScene.create({
      data: {
        sceneId: officialSceneId,
        satellite: params.satellite,
        sensor: satMeta.bands.length > 2 ? "MSI" : "SAR",
        acquisitionDate: params.acquisitionDate,
        cloudCover: params.cloudCover,
        sunAzimuth: 140 + Math.random() * 40,
        sunElevation: 45 + Math.random() * 20,
        bbox: JSON.stringify(params.bbox),
        centerLat,
        centerLng,
        resolutionM,
        status: "processing",
        processingStage: "downloading",
        bands: JSON.stringify(satMeta.bands),
        metadata: JSON.stringify({ satellite: satMeta.label, agency: satMeta.agency, resolutionM, bands: satMeta.bands }),
        scheduledById: params.scheduledById,
        sizeBytes: Math.floor(50 + Math.random() * 200) * 1024 * 1024, // 50-250 MB
      },
    });

    // Simulate pipeline progression (in production each stage is a background job)
    const stages: ProcessingStage[] = ["rectifying", "tiling", "caching", "ready"];
    for (const stage of stages) {
      await db.satelliteScene.update({
        where: { id: scene.id },
        data: { processingStage: stage, status: stage === "ready" ? "ready" : "processing" },
      });
      logger.debug("satellite.pipeline", { sceneId: scene.id, stage });
    }

    // Generate tiles (simulate tiling at zoom levels 8-14)
    const maxZoom = 14;
    const tileCount = await this.generateTiles(scene.id, minLng, minLat, maxLng, maxLat, maxZoom, resolutionM);

    // Update scene with tile info
    await db.satelliteScene.update({
      where: { id: scene.id },
      data: {
        processingStage: "ready",
        status: "ready",
        tiledStorageKey: `satellite/tiles/${scene.id}`,
        thumbnailKey: `satellite/thumbnails/${scene.id}.png`,
        processedAt: new Date(),
      },
    });

    // Link to schedule
    if (params.scheduleId) {
      await db.ingestionSchedule.update({
        where: { id: params.scheduleId },
        data: { lastRunAt: new Date(), lastSceneId: scene.id },
      });
    }

    // Update cache stats
    await this.updateCacheStats();

    logger.info("satellite.ingested", { sceneId: scene.id, officialSceneId, tileCount, status: "ready" });
    return { sceneId: scene.id, status: "ready", tileCount };
  }

  /**
   * Generate raster tiles for a scene at multiple zoom levels.
   * Uses M3 tile coordinate math for XYZ tiling scheme.
   */
  private async generateTiles(
    sceneId: string,
    minLng: number,
    minLat: number,
    maxLng: number,
    maxLat: number,
    maxZoom: number,
    resolutionM: number,
  ): Promise<number> {
    let tileCount = 0;
    const batchSize = 50; // limit tiles per zoom level for demo
    const zoomLevels = [8, 10, 12, 14]; // multi-resolution pyramid

    for (const z of zoomLevels) {
      // Compute tile range for this bbox at this zoom
      const n = Math.pow(2, z);
      const minTileX = Math.floor(((minLng + 180) / 360) * n);
      const maxTileX = Math.floor(((maxLng + 180) / 360) * n);
      const maxTileY = Math.floor(((1 - Math.log(Math.tan(maxLat * Math.PI / 180) + 1 / Math.cos(maxLat * Math.PI / 180)) / Math.PI) / 2) * n);
      const minTileY = Math.floor(((1 - Math.log(Math.tan(minLat * Math.PI / 180) + 1 / Math.cos(minLat * Math.PI / 180)) / Math.PI) / 2) * n);

      const xRange = Math.min(maxTileX - minTileX + 1, batchSize);
      const yRange = Math.min(maxTileY - minTileY + 1, batchSize);

      for (let x = 0; x < xRange; x++) {
        for (let y = 0; y < yRange; y++) {
          const tileX = minTileX + x;
          const tileY = minTileY + y;
          const quadkey = tileToQuadkey(z, tileX, tileY);

          await db.rasterTile.create({
            data: {
              sceneId,
              z,
              x: tileX,
              y: tileY,
              quadkey,
              storageKey: `satellite/tiles/${sceneId}/${z}/${tileX}/${tileY}.png`,
              sizeBytes: Math.floor(10 + Math.random() * 30) * 1024, // 10-40 KB per tile
              contentType: "image/png",
              cacheStatus: "cached",
              cachedAt: new Date(),
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 day cache
              bands: JSON.stringify(["B04", "B03", "B02"]), // RGB
              checksum: createHash("sha256").update(`${sceneId}-${z}-${tileX}-${tileY}`).digest("hex"),
            },
          }).catch(() => {});
          tileCount++;
        }
      }
    }

    return tileCount;
  }

  /**
   * List satellite scenes with filters.
   */
  async listScenes(params?: {
    satellite?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const { limit = 50, offset = 0, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.satellite) where.satellite = filters.satellite;
    if (filters.status) where.status = filters.status;

    const [scenes, total] = await Promise.all([
      db.satelliteScene.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { acquisitionDate: "desc" },
        include: { _count: { select: { tiles: true } } },
      }),
      db.satelliteScene.count({ where }),
    ]);

    return {
      scenes: scenes.map((s) => ({
        ...s,
        bbox: JSON.parse(s.bbox),
        bands: s.bands ? JSON.parse(s.bands) : null,
        metadata: s.metadata ? JSON.parse(s.metadata) : null,
        tileCount: s._count.tiles,
        sizeFormatted: formatBytes(s.sizeBytes),
      })),
      total,
    };
  }

  /**
   * Get a scene by ID with tiles.
   */
  async getScene(id: string) {
    const scene = await db.satelliteScene.findUnique({
      where: { id },
      include: {
        tiles: { take: 20, orderBy: { z: "asc" } },
        _count: { select: { tiles: true } },
      },
    });
    if (!scene) return null;
    return {
      ...scene,
      bbox: JSON.parse(scene.bbox),
      bands: scene.bands ? JSON.parse(scene.bands) : null,
      metadata: scene.metadata ? JSON.parse(scene.metadata) : null,
      tileCount: scene._count.tiles,
      sizeFormatted: formatBytes(scene.sizeBytes),
      tiles: scene.tiles.map((t) => ({ ...t, bands: t.bands ? JSON.parse(t.bands) : null })),
    };
  }

  /**
   * List ingestion schedules.
   */
  async listSchedules() {
    const schedules = await db.ingestionSchedule.findMany({
      where: { isActive: true },
      orderBy: { nextRunAt: "asc" },
      include: {
        lastScene: { select: { id: true, sceneId: true, acquisitionDate: true, status: true } },
      },
    });
    return {
      schedules: schedules.map((s) => ({
        ...s,
        bbox: JSON.parse(s.bbox),
        bands: s.bands ? JSON.parse(s.bands) : null,
        lastScene: s.lastScene,
      })),
    };
  }

  /**
   * Get tile cache statistics.
   */
  async getCacheStats() {
    const [
      totalTiles,
      cachedTiles,
      staleTiles,
      evictedTiles,
      pendingTiles,
      totalSize,
      byZoom,
      byScene,
      recentTiles,
    ] = await Promise.all([
      db.rasterTile.count(),
      db.rasterTile.count({ where: { cacheStatus: "cached" } }),
      db.rasterTile.count({ where: { cacheStatus: "stale" } }),
      db.rasterTile.count({ where: { cacheStatus: "evicted" } }),
      db.rasterTile.count({ where: { cacheStatus: "pending" } }),
      db.rasterTile.aggregate({ _sum: { sizeBytes: true } }),
      db.rasterTile.groupBy({ by: ["z"], _count: true, _sum: { sizeBytes: true } }),
      db.rasterTile.groupBy({ by: ["sceneId"], _count: true, _sum: { sizeBytes: true } }),
      db.rasterTile.findMany({
        take: 10,
        orderBy: { cachedAt: "desc" },
        select: { id: true, sceneId: true, z: true, x: true, y: true, quadkey: true, sizeBytes: true, cacheStatus: true, cachedAt: true, accessCount: true },
      }),
    ]);

    const totalAccess = await db.rasterTile.aggregate({ _sum: { accessCount: true } });
    const totalCached = cachedTiles + staleTiles + evictedTiles + pendingTiles;
    const hitRate = totalCached > 0 ? cachedTiles / totalCached : 0;

    return {
      totalTiles,
      byStatus: { cached: cachedTiles, stale: staleTiles, evicted: evictedTiles, pending: pendingTiles },
      totalSizeBytes: totalSize._sum.sizeBytes ?? 0,
      totalSizeFormatted: formatBytes(totalSize._sum.sizeBytes ?? 0),
      hitRate,
      totalAccessCount: totalAccess._sum.accessCount ?? 0,
      byZoom: byZoom.map((z) => ({ z: z.z, count: z._count, sizeBytes: z._sum.sizeBytes ?? 0, sizeFormatted: formatBytes(z._sum.sizeBytes ?? 0) })),
      byScene: byScene.map((s) => ({ sceneId: s.sceneId, count: s._count, sizeBytes: s._sum.sizeBytes ?? 0 })),
      recent: recentTiles,
    };
  }

  /**
   * Evict stale tiles from cache (LRU eviction).
   */
  async evictStale(): Promise<{ evicted: number }> {
    const result = await db.rasterTile.updateMany({
      where: { cacheStatus: "stale" },
      data: { cacheStatus: "evicted" },
    });
    await this.updateCacheStats();
    logger.info("satellite.cache_evicted", { count: result.count });
    return { evicted: result.count };
  }

  /**
   * Archive a scene (move to historical archive).
   */
  async archiveScene(sceneId: string): Promise<void> {
    await db.satelliteScene.update({
      where: { id: sceneId },
      data: { status: "archived", processingStage: "archived" },
    });
    logger.info("satellite.archived", { sceneId });
  }

  /**
   * Get historical archive.
   */
  async getArchive(params?: { satellite?: string; limit?: number }) {
    const { limit = 50, satellite } = params ?? {};
    const where: Record<string, unknown> = { status: "archived" };
    if (satellite) where.satellite = satellite;

    const scenes = await db.satelliteScene.findMany({
      where,
      take: limit,
      orderBy: { acquisitionDate: "desc" },
      select: {
        id: true, sceneId: true, satellite: true, acquisitionDate: true,
        cloudCover: true, centerLat: true, centerLng: true,
        resolutionM: true, sizeBytes: true, processedAt: true,
      },
    });

    return {
      archive: scenes.map((s) => ({ ...s, sizeFormatted: formatBytes(s.sizeBytes) })),
      count: scenes.length,
    };
  }

  /**
   * Update cache stats table.
   */
  private async updateCacheStats(): Promise<void> {
    const [totalTiles, cachedTiles, staleTiles, evictedTiles, totalSize] = await Promise.all([
      db.rasterTile.count(),
      db.rasterTile.count({ where: { cacheStatus: "cached" } }),
      db.rasterTile.count({ where: { cacheStatus: "stale" } }),
      db.rasterTile.count({ where: { cacheStatus: "evicted" } }),
      db.rasterTile.aggregate({ _sum: { sizeBytes: true } }),
    ]);

    await db.tileCacheStats.create({
      data: {
        totalTiles,
        cachedTiles,
        staleTiles,
        evictedTiles,
        totalCacheBytes: totalSize._sum.sizeBytes ?? 0,
        hitRate: totalTiles > 0 ? cachedTiles / totalTiles : 0,
        missRate: totalTiles > 0 ? (staleTiles + evictedTiles) / totalTiles : 0,
        computedAt: new Date(),
      },
    }).catch(() => {});
  }

  /**
   * Aggregate summary.
   */
  async summary() {
    const [
      totalScenes,
      bySatellite,
      byStatus,
      byProcessingStage,
      totalTiles,
      cachedTiles,
      totalSchedule,
      activeSchedules,
      totalCacheBytes,
      avgCloudCover,
      recentScenes,
      archiveCount,
    ] = await Promise.all([
      db.satelliteScene.count(),
      db.satelliteScene.groupBy({ by: ["satellite"], _count: true }),
      db.satelliteScene.groupBy({ by: ["status"], _count: true }),
      db.satelliteScene.groupBy({ by: ["processingStage"], _count: true }),
      db.rasterTile.count(),
      db.rasterTile.count({ where: { cacheStatus: "cached" } }),
      db.ingestionSchedule.count(),
      db.ingestionSchedule.count({ where: { isActive: true } }),
      db.rasterTile.aggregate({ _sum: { sizeBytes: true } }),
      db.satelliteScene.aggregate({ _avg: { cloudCover: true } }),
      db.satelliteScene.findMany({
        take: 8,
        orderBy: { acquisitionDate: "desc" },
        include: { _count: { select: { tiles: true } } },
      }),
      db.satelliteScene.count({ where: { status: "archived" } }),
    ]);

    return {
      scenes: {
        total: totalScenes,
        bySatellite: bySatellite.map((s) => ({ satellite: s.satellite, count: s._count })),
        byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
        byStage: byProcessingStage.map((s) => ({ stage: s.processingStage, count: s._count })),
        avgCloudCover: avgCloudCover._avg.cloudCover ?? 0,
        archived: archiveCount,
      },
      tiles: {
        total: totalTiles,
        cached: cachedTiles,
        totalSizeBytes: totalCacheBytes._sum.sizeBytes ?? 0,
        totalSizeFormatted: formatBytes(totalCacheBytes._sum.sizeBytes ?? 0),
      },
      schedules: {
        total: totalSchedule,
        active: activeSchedules,
      },
      recent: recentScenes.map((s) => ({
        id: s.id,
        sceneId: s.sceneId,
        satellite: s.satellite,
        acquisitionDate: s.acquisitionDate,
        cloudCover: s.cloudCover,
        status: s.status,
        processingStage: s.processingStage,
        resolutionM: s.resolutionM,
        centerLat: s.centerLat,
        centerLng: s.centerLng,
        tileCount: s._count.tiles,
        sizeFormatted: formatBytes(s.sizeBytes),
      })),
    };
  }
}

let _svc: SatelliteIngestionService | null = null;
export function getSatelliteIngestionService(): SatelliteIngestionService {
  if (!_svc) _svc = new SatelliteIngestionService();
  return _svc;
}
