"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Sentinel — Canvas Map Renderer
 * =============================================================================
 * A self-contained, offline-capable map renderer using HTML Canvas + Web
 * Mercator projection. Renders POI markers, polygon regions, a coordinate
 * grid, and tile boundaries — all without external tile servers (critical
 * for the sandbox environment and for air-gapped deployments).
 *
 * Features:
 *   - Pan (drag) and zoom (wheel / buttons)
 *   - Web Mercator projection (EPSG:3857)
 *   - POI markers colored by type/severity
 *   - Polygon region rendering with fill + stroke
 *   - Lat/lng grid overlay with labels
 *   - Tile boundary overlay (XYZ scheme) at current zoom
 *   - Hover tooltip on POIs
 *   - Click to select POI / show coordinates
 *   - Layer visibility control (via parent props)
 * =============================================================================
 */

export interface MapPOI {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  status?: string;
  severity?: string;
}

export interface MapRegion {
  id: string;
  name: string;
  type: string;
  coordinates: [number, number][]; // [lng, lat] ring
  areaKm2?: number;
}

export interface MapLayer {
  key: string;
  name: string;
  type: string;
  visible: boolean;
  opacity: number;
}

interface MapProps {
  pois: MapPOI[];
  regions: MapRegion[];
  layers: MapLayer[];
  center: { lng: number; lat: number };
  zoom: number;
  onCenterChange?: (center: { lng: number; lat: number }) => void;
  onZoomChange?: (zoom: number) => void;
  onPOIClick?: (poi: MapPOI) => void;
  showGrid?: boolean;
  showTiles?: boolean;
  className?: string;
}

const POI_COLORS: Record<string, string> = {
  mining_site: "#ef4444",
  incident: "#dc2626",
  water_body: "#0ea5e9",
  settlement: "#a78bfa",
  sensor_station: "#10b981",
  checkpoint: "#f59e0b",
  forest_reserve: "#22c55e",
};

const SEVERITY_RING: Record<string, string> = {
  critical: "#7f1d1d",
  high: "#dc2626",
  medium: "#f59e0b",
  low: "#6b7280",
};

const REGION_COLORS: Record<string, string> = {
  mining_concession: "#ef4444",
  hot_zone: "#f97316",
  forest_reserve: "#22c55e",
  water_body: "#0ea5e9",
  protected_area: "#8b5cf6",
};

const MAX_LAT = 85.05112878;
const DEG_TO_RAD = Math.PI / 180;

function lngLatToPixel(lng: number, lat: number, zoom: number, canvasW: number, canvasH: number, centerLng: number, centerLat: number) {
  const n = Math.pow(2, zoom);
  const latC = Math.max(-MAX_LAT, Math.min(MAX_LAT, centerLat));
  const centerPxX = ((centerLng + 180) / 360) * n * 256;
  const centerPxY = ((1 - Math.log(Math.tan(latC * DEG_TO_RAD) + 1 / Math.cos(latC * DEG_TO_RAD)) / Math.PI) / 2) * n * 256;
  const latClamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const pxX = ((lng + 180) / 360) * n * 256;
  const pxY = ((1 - Math.log(Math.tan(latClamped * DEG_TO_RAD) + 1 / Math.cos(latClamped * DEG_TO_RAD)) / Math.PI) / 2) * n * 256;
  return {
    x: canvasW / 2 + (pxX - centerPxX),
    y: canvasH / 2 + (pxY - centerPxY),
  };
}

function pixelToLngLat(px: number, py: number, zoom: number, canvasW: number, canvasH: number, centerLng: number, centerLat: number) {
  const n = Math.pow(2, zoom);
  const latC = Math.max(-MAX_LAT, Math.min(MAX_LAT, centerLat));
  const centerPxX = ((centerLng + 180) / 360) * n * 256;
  const centerPxY = ((1 - Math.log(Math.tan(latC * DEG_TO_RAD) + 1 / Math.cos(latC * DEG_TO_RAD)) / Math.PI) / 2) * n * 256;
  const worldPxX = centerPxX + (px - canvasW / 2);
  const worldPxY = centerPxY + (py - canvasH / 2);
  const lng = (worldPxX / (n * 256)) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * (worldPxY / (n * 256)))));
  return { lng, lat: (latRad * 180) / Math.PI };
}

export function CanvasMap({
  pois,
  regions,
  layers,
  center,
  zoom,
  onCenterChange,
  onZoomChange,
  onPOIClick,
  showGrid = true,
  showTiles = false,
  className,
}: MapProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ w: 800, h: 500 });
  const [hovered, setHovered] = React.useState<MapPOI | null>(null);
  const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 });
  const [cursorLngLat, setCursorLngLat] = React.useState<{ lng: number; lat: number } | null>(null);
  const dragState = React.useRef<{ dragging: boolean; lastX: number; lastY: number; startCenter: { lng: number; lat: number } | null }>({
    dragging: false,
    lastX: 0,
    lastY: 0,
    startCenter: null,
  });

  // Resize observer
  React.useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Render
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, size.w, size.h);

    const visibleLayerKeys = new Set(layers.filter((l) => l.visible).map((l) => l.key));
    const showMiningSites = visibleLayerKeys.has("mining-sites");
    const showWaterBodies = visibleLayerKeys.has("water-bodies");
    const showForestReserves = visibleLayerKeys.has("forest-reserves");
    const showSettlements = visibleLayerKeys.has("settlements");
    const showHotZones = visibleLayerKeys.has("hot-zones");

    // Grid overlay
    if (showGrid) {
      drawGrid(ctx, size.w, size.h, center, zoom);
    }

    // Tile boundary overlay
    if (showTiles) {
      drawTileBoundaries(ctx, size.w, size.h, center, zoom);
    }

    // Draw regions (polygons) — filtered by layer
    for (const region of regions) {
      const visible =
        (region.type === "mining_concession" && showMiningSites) ||
        (region.type === "hot_zone" && showHotZones) ||
        (region.type === "forest_reserve" && showForestReserves) ||
        (region.type === "water_body" && showWaterBodies) ||
        (region.type === "protected_area" && showForestReserves);
      if (!visible) continue;

      const pts = region.coordinates.map(([lng, lat]) =>
        lngLatToPixel(lng, lat, zoom, size.w, size.h, center.lng, center.lat),
      );
      if (pts.length < 2) continue;

      const color = REGION_COLORS[region.type] ?? "#6b7280";
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(pts[0]!.x, pts[0]!.y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i]!.x, pts[i]!.y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label
      const centroid = pts.reduce((a, p) => ({ x: a.x + p.x / pts.length, y: a.y + p.y / pts.length }), { x: 0, y: 0 });
      ctx.fillStyle = color;
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(region.name, centroid.x, centroid.y);
    }

    // Draw POIs — filtered by type → layer mapping
    for (const poi of pois) {
      const visible =
        (poi.type === "mining_site" && showMiningSites) ||
        (poi.type === "incident" && showMiningSites) ||
        (poi.type === "water_body" && showWaterBodies) ||
        (poi.type === "settlement" && showSettlements) ||
        (poi.type === "sensor_station" && showMiningSites) ||
        (poi.type === "checkpoint" && showMiningSites);
      if (!visible) continue;

      const { x, y } = lngLatToPixel(poi.lng, poi.lat, zoom, size.w, size.h, center.lng, center.lat);
      if (x < -20 || x > size.w + 20 || y < -20 || y > size.h + 20) continue;

      const color = POI_COLORS[poi.type] ?? "#6b7280";
      const radius = poi.type === "incident" ? 6 : poi.severity === "critical" ? 5 : 4;
      const isHovered = hovered?.id === poi.id;

      // Severity ring
      if (poi.severity && SEVERITY_RING[poi.severity]) {
        ctx.strokeStyle = SEVERITY_RING[poi.severity]!;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Main dot
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, isHovered ? radius + 2 : radius, 0, Math.PI * 2);
      ctx.fill();

      // White outline
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Hover label
      if (isHovered) {
        ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
        ctx.fillRect(x + 10, y - 28, ctx.measureText(poi.name).width + 16, 20);
        ctx.fillStyle = "#ffffff";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(poi.name, x + 18, y - 14);
      }
    }
  }, [pois, regions, layers, center, zoom, size, hovered, showGrid, showTiles]);

  // Mouse handlers
  function handleMouseDown(e: React.MouseEvent) {
    dragState.current.dragging = true;
    dragState.current.lastX = e.clientX;
    dragState.current.lastY = e.clientY;
    dragState.current.startCenter = { ...center };
  }

  function handleMouseMove(e: React.MouseEvent) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    setMousePos({ x: px, y: py });
    setCursorLngLat(pixelToLngLat(px, py, zoom, size.w, size.h, center.lng, center.lat));

    if (dragState.current.dragging) {
      const dx = e.clientX - dragState.current.lastX;
      const dy = e.clientY - dragState.current.lastY;
      const n = Math.pow(2, zoom);
      const centerPxX = ((center.lng + 180) / 360) * n * 256;
      const centerPxY = ((1 - Math.log(Math.tan(Math.max(-MAX_LAT, Math.min(MAX_LAT, center.lat)) * DEG_TO_RAD) + 1 / Math.cos(Math.max(-MAX_LAT, Math.min(MAX_LAT, center.lat)) * DEG_TO_RAD)) / Math.PI) / 2) * n * 256;
      const newCenterPxX = centerPxX - dx;
      const newCenterPxY = centerPxY - dy;
      const newLng = (newCenterPxX / (n * 256)) * 360 - 180;
      const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * (newCenterPxY / (n * 256)))));
      onCenterChange?.({ lng: newLng, lat: (latRad * 180) / Math.PI });
      dragState.current.lastX = e.clientX;
      dragState.current.lastY = e.clientY;
    } else {
      // Hover detection
      let found: MapPOI | null = null;
      for (const poi of pois) {
        const { x, y } = lngLatToPixel(poi.lng, poi.lat, zoom, size.w, size.h, center.lng, center.lat);
        const dx = px - x;
        const dy = py - y;
        if (dx * dx + dy * dy < 100) {
          found = poi;
          break;
        }
      }
      setHovered(found);
    }
  }

  function handleMouseUp() {
    dragState.current.dragging = false;
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    const newZoom = Math.max(1, Math.min(18, zoom + delta));
    onZoomChange?.(newZoom);
  }

  function handleClick(e: React.MouseEvent) {
    if (dragState.current.startCenter && (Math.abs(e.clientX - (dragState.current.lastX)) > 3 || Math.abs(e.clientY - (dragState.current.lastY)) > 3)) {
      return; // was dragging
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    for (const poi of pois) {
      const { x, y } = lngLatToPixel(poi.lng, poi.lat, zoom, size.w, size.h, center.lng, center.lat);
      const dx = px - x;
      const dy = py - y;
      if (dx * dx + dy * dy < 100) {
        onPOIClick?.(poi);
        return;
      }
    }
  }

  return (
    <div ref={containerRef} className={cn("relative h-full w-full overflow-hidden rounded-lg", className)}>
      <canvas
        ref={canvasRef}
        className="cursor-crosshair touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleClick}
      />
      {/* Coordinate readout */}
      {cursorLngLat && (
        <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-slate-900/80 px-2 py-1 font-mono text-[10px] text-slate-300">
          {cursorLngLat.lat.toFixed(4)}°, {cursorLngLat.lng.toFixed(4)}° · z{zoom}
        </div>
      )}
      {/* Hover tooltip */}
      {hovered && (
        <div
          className="pointer-events-none absolute z-10 max-w-xs rounded-lg border border-slate-700 bg-slate-900/95 p-2 text-xs text-white shadow-xl"
          style={{ left: Math.min(mousePos.x + 14, size.w - 200), top: Math.max(mousePos.y - 60, 4) }}
        >
          <div className="font-semibold">{hovered.name}</div>
          <div className="mt-0.5 text-[10px] text-slate-400">
            <span className="inline-block h-2 w-2 rounded-full mr-1" style={{ backgroundColor: POI_COLORS[hovered.type] ?? "#6b7280" }} />
            {hovered.type.replace(/_/g, " ")} · {hovered.status}
            {hovered.severity && ` · ${hovered.severity}`}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-500 font-mono">
            {hovered.lat.toFixed(4)}°, {hovered.lng.toFixed(4)}°
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grid drawing
// ---------------------------------------------------------------------------

function drawGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  center: { lng: number; lat: number },
  zoom: number,
) {
  // Grid interval depends on zoom
  const intervals = [45, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005, 0.002, 0.001];
  const idx = Math.min(Math.floor(zoom), intervals.length - 1);
  const interval = intervals[idx] ?? 0.001;

  ctx.strokeStyle = "rgba(56, 68, 88, 0.5)";
  ctx.lineWidth = 0.5;
  ctx.font = "9px monospace";
  ctx.fillStyle = "rgba(100, 120, 150, 0.6)";

  // Compute visible bounds
  const topLeft = pixelToLngLat(0, 0, zoom, w, h, center.lng, center.lat);
  const bottomRight = pixelToLngLat(w, h, zoom, w, h, center.lng, center.lat);

  // Vertical lines (longitude)
  const lngStart = Math.floor(topLeft.lng / interval) * interval;
  const lngEnd = Math.ceil(bottomRight.lng / interval) * interval;
  for (let lng = lngStart; lng <= lngEnd; lng += interval) {
    const { x } = lngLatToPixel(lng, center.lat, zoom, w, h, center.lng, center.lat);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.fillText(`${lng.toFixed(interval < 1 ? 2 : 0)}°`, x + 3, h - 4);
  }

  // Horizontal lines (latitude)
  const latStart = Math.floor(bottomRight.lat / interval) * interval;
  const latEnd = Math.ceil(topLeft.lat / interval) * interval;
  for (let lat = latStart; lat <= latEnd; lat += interval) {
    const { y } = lngLatToPixel(center.lng, lat, zoom, w, h, center.lng, center.lat);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.fillText(`${lat.toFixed(interval < 1 ? 2 : 0)}°`, 4, y - 3);
  }
}

// ---------------------------------------------------------------------------
// Tile boundary overlay
// ---------------------------------------------------------------------------

function drawTileBoundaries(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  center: { lng: number; lat: number },
  zoom: number,
) {
  const n = Math.pow(2, zoom);
  const latC = Math.max(-MAX_LAT, Math.min(MAX_LAT, center.lat));
  const centerPxX = ((center.lng + 180) / 360) * n * 256;
  const centerPxY = ((1 - Math.log(Math.tan(latC * DEG_TO_RAD) + 1 / Math.cos(latC * DEG_TO_RAD)) / Math.PI) / 2) * n * 256;
  const topLeftPxX = centerPxX - w / 2;
  const topLeftPxY = centerPxY - h / 2;

  const tileXStart = Math.floor(topLeftPxX / 256);
  const tileXEnd = Math.ceil((topLeftPxX + w) / 256);
  const tileYStart = Math.floor(topLeftPxY / 256);
  const tileYEnd = Math.ceil((topLeftPxY + h) / 256);

  ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
  ctx.lineWidth = 0.5;
  ctx.fillStyle = "rgba(100, 116, 139, 0.5)";
  ctx.font = "8px monospace";
  ctx.textAlign = "center";

  for (let tx = tileXStart; tx <= tileXEnd; tx++) {
    for (let ty = tileYStart; ty <= tileYEnd; ty++) {
      const pxX = tx * 256 - topLeftPxX + w / 2 - centerPxX + topLeftPxX;
      const screenX = tx * 256 - topLeftPxX;
      const screenY = ty * 256 - topLeftPxY;
      ctx.strokeRect(screenX, screenY, 256, 256);
      ctx.fillText(`${zoom}/${tx}/${ty}`, screenX + 128, screenY + 128);
    }
  }
}
