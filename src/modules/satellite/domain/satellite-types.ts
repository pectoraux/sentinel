/**
 * Sentinel — Satellite Ingestion Domain
 * =============================================================================
 * Satellite sources, raster pipeline stages, tile coordinate math, scheduling.
 * Reuses M3 tile coordinate transforms for tiling.
 * =============================================================================
 */

export type Satellite = "sentinel2" | "landsat8" | "sentinel1" | "landsat9";

export const SATELLITE_META: Record<Satellite, { label: string; agency: string; resolutionM: number; revisitDays: number; bands: string[]; color: string }> = {
  sentinel2: { label: "Sentinel-2", agency: "ESA", resolutionM: 10, revisitDays: 5, bands: ["B02", "B03", "B04", "B08", "B11", "B12"], color: "#0ea5e9" },
  landsat8: { label: "Landsat-8", agency: "NASA/USGS", resolutionM: 30, revisitDays: 16, bands: ["B2", "B3", "B4", "B5", "B6", "B7"], color: "#22c55e" },
  sentinel1: { label: "Sentinel-1", agency: "ESA", resolutionM: 10, revisitDays: 6, bands: ["VV", "VH"], color: "#f59e0b" },
  landsat9: { label: "Landsat-9", agency: "NASA/USGS", resolutionM: 30, revisitDays: 16, bands: ["B2", "B3", "B4", "B5", "B6", "B7"], color: "#8b5cf6" },
};

export type ProcessingStage = "pending" | "downloading" | "rectifying" | "tiling" | "caching" | "ready" | "archived" | "failed";

export const PIPELINE_STAGES: Array<{ stage: ProcessingStage; label: string; description: string }> = [
  { stage: "pending", label: "Scheduled", description: "Scene acquisition scheduled" },
  { stage: "downloading", label: "Downloading", description: "Raw data download from satellite provider" },
  { stage: "rectifying", label: "Rectifying", description: "Atmospheric correction + georeferencing" },
  { stage: "tiling", label: "Tiling", description: "Raster tiled into XYZ pyramid" },
  { stage: "caching", label: "Caching", description: "Tiles cached for fast serving" },
  { stage: "ready", label: "Ready", description: "Scene processed and ready for use" },
  { stage: "archived", label: "Archived", description: "Scene moved to historical archive" },
  { stage: "failed", label: "Failed", description: "Processing failed" },
];

export function stageIndex(stage: ProcessingStage): number {
  return PIPELINE_STAGES.findIndex((s) => s.stage === stage);
}

export type Frequency = "daily" | "weekly" | "monthly" | "manual";

export const FREQUENCY_META: Record<Frequency, { label: string; cron: string; intervalDays: number }> = {
  daily: { label: "Daily", cron: "0 6 * * *", intervalDays: 1 },
  weekly: { label: "Weekly", cron: "0 6 * * 1", intervalDays: 7 },
  monthly: { label: "Monthly", cron: "0 6 1 * *", intervalDays: 30 },
  manual: { label: "Manual", cron: "", intervalDays: 0 },
};

export type CacheStatus = "cached" | "stale" | "evicted" | "pending";

export const CACHE_STATUS_META: Record<CacheStatus, { label: string; color: string }> = {
  cached: { label: "Cached", color: "#22c55e" },
  stale: { label: "Stale", color: "#f59e0b" },
  evicted: { label: "Evicted", color: "#ef4444" },
  pending: { label: "Pending", color: "#64748b" },
};

/**
 * Compute the number of tiles in a pyramid from zoom 0 to maxZoom.
 */
export function tilePyramidCount(maxZoom: number): number {
  let count = 0;
  for (let z = 0; z <= maxZoom; z++) {
    count += Math.pow(4, z);
  }
  return count;
}

/**
 * Estimate cache size in bytes for a scene.
 */
export function estimateCacheSize(tileCount: number, avgTileSizeBytes: number = 20480): number {
  return tileCount * avgTileSizeBytes;
}

/**
 * Format bytes to human-readable.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
