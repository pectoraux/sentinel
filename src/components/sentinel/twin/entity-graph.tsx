"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Sentinel — Entity Graph Renderer
 * =============================================================================
 * A canvas-based force-directed graph visualizing TwinEntity nodes and their
 * TwinRelationship edges. Nodes are colored by entity type and sized by
 * relationship count. Supports drag-to-reposition, click-to-select, and
 * hover tooltips.
 * =============================================================================
 */

export interface GraphNode {
  id: string;
  key: string;
  type: string;
  name: string;
  status: string;
  color: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  strength: number;
  bidirectional: boolean;
}

const EDGE_COLOR: Record<string, string> = {
  affects: "#ef4444",
  threatens: "#dc2626",
  contains: "#22c55e",
  within: "#22c55e",
  near: "#64748b",
  connects_to: "#0ea5e9",
  monitors: "#14b8a6",
  upstream: "#0ea5e9",
  downstream: "#0ea5e9",
  depends_on: "#f59e0b",
  borders: "#8b5cf6",
  supplies: "#0ea5e9",
};

interface GraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (node: GraphNode) => void;
  selectedId?: string;
  className?: string;
}

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export function EntityGraph({ nodes, edges, onNodeClick, selectedId, className }: GraphProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ w: 800, h: 450 });
  const [hovered, setHovered] = React.useState<GraphNode | null>(null);
  const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 });
  const simNodesRef = React.useRef<Map<string, SimNode>>(new Map());
  const dragRef = React.useRef<{ id: string | null; offsetX: number; offsetY: number }>({ id: null, offsetX: 0, offsetY: 0 });
  const animRef = React.useRef<number>(0);

  // Initialize simulation nodes
  React.useEffect(() => {
    const map = simNodesRef.current;
    const cx = size.w / 2;
    const cy = size.h / 2;
    for (const node of nodes) {
      if (!map.has(node.id)) {
        const angle = Math.random() * Math.PI * 2;
        const r = 80 + Math.random() * 120;
        map.set(node.id, {
          ...node,
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
          vx: 0,
          vy: 0,
          radius: 8,
        });
      } else {
        // Update properties in case nodes changed
        const existing = map.get(node.id)!;
        existing.key = node.key;
        existing.type = node.type;
        existing.name = node.name;
        existing.status = node.status;
        existing.color = node.color;
      }
    }
    // Remove deleted nodes
    const nodeIds = new Set(nodes.map((n) => n.id));
    for (const id of Array.from(map.keys())) {
      if (!nodeIds.has(id)) map.delete(id);
    }
    // Compute radius by degree
    const degree = new Map<string, number>();
    for (const e of edges) {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
    }
    for (const [id, deg] of degree) {
      const n = map.get(id);
      if (n) n.radius = 6 + Math.min(deg, 8) * 1.5;
    }
  }, [nodes, edges, size]);

  // Resize observer
  React.useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Force simulation + render loop
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

    const tick = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const simNodes = Array.from(simNodesRef.current.values());
      const cx = size.w / 2;
      const cy = size.h / 2;

      // Forces
      // 1. Repulsion between nodes
      for (let i = 0; i < simNodes.length; i++) {
        for (let j = i + 1; j < simNodes.length; j++) {
          const a = simNodes[i]!;
          const b = simNodes[j]!;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist2 = dx * dx + dy * dy + 0.01;
          const dist = Math.sqrt(dist2);
          const force = 1800 / dist2;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }

      // 2. Attraction along edges
      for (const e of edges) {
        const a = simNodesRef.current.get(e.source);
        const b = simNodesRef.current.get(e.target);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const idealDist = 90;
        const force = (dist - idealDist) * 0.04;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

      // 3. Centering force
      for (const n of simNodes) {
        n.vx += (cx - n.x) * 0.005;
        n.vy += (cy - n.y) * 0.005;
      }

      // Update positions (with drag check)
      for (const n of simNodes) {
        if (dragRef.current.id === n.id) continue;
        n.vx *= 0.85; // damping
        n.vy *= 0.85;
        n.x += n.vx;
        n.y += n.vy;
        // Keep within bounds
        n.x = Math.max(n.radius + 5, Math.min(size.w - n.radius - 5, n.x));
        n.y = Math.max(n.radius + 5, Math.min(size.h - n.radius - 5, n.y));
      }

      // Render
      ctx.fillStyle = "#0a1120";
      ctx.fillRect(0, 0, size.w, size.h);

      // Draw edges
      for (const e of edges) {
        const a = simNodesRef.current.get(e.source);
        const b = simNodesRef.current.get(e.target);
        if (!a || !b) continue;
        const color = EDGE_COLOR[e.type] ?? "#475569";
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.25 + e.strength * 0.4;
        ctx.lineWidth = 0.5 + e.strength * 1.5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        // Arrowhead for directed edges
        if (!e.bidirectional) {
          const angle = Math.atan2(b.y - a.y, b.x - a.x);
          const ax = b.x - Math.cos(angle) * (b.radius + 4);
          const ay = b.y - Math.sin(angle) * (b.radius + 4);
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(
            ax - Math.cos(angle - 0.4) * 6,
            ay - Math.sin(angle - 0.4) * 6,
          );
          ctx.lineTo(
            ax - Math.cos(angle + 0.4) * 6,
            ay - Math.sin(angle + 0.4) * 6,
          );
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // Draw nodes
      for (const n of simNodes) {
        const isSelected = selectedId === n.id;
        const isHovered = hovered?.id === n.id;

        // Selection ring
        if (isSelected) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + 4, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Node circle
        ctx.fillStyle = n.color;
        ctx.beginPath();
        ctx.arc(n.x, n.y, isHovered ? n.radius + 2 : n.radius, 0, Math.PI * 2);
        ctx.fill();

        // White outline
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Label (only for hovered or selected)
        if (isHovered || isSelected) {
          ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
          const label = n.name.length > 24 ? n.name.slice(0, 22) + "…" : n.name;
          const w = ctx.measureText(label).width + 12;
          ctx.fillRect(n.x - w / 2, n.y + n.radius + 6, w, 18);
          ctx.fillStyle = "#ffffff";
          ctx.font = "10px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(label, n.x, n.y + n.radius + 18);
        }
      }

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [edges, size, hovered, selectedId]);

  // Mouse handlers
  function getMouseNode(e: React.MouseEvent): SimNode | null {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    for (const n of simNodesRef.current.values()) {
      const dx = px - n.x;
      const dy = py - n.y;
      if (dx * dx + dy * dy < (n.radius + 4) * (n.radius + 4)) {
        return n;
      }
    }
    return null;
  }

  function handleMouseDown(e: React.MouseEvent) {
    const node = getMouseNode(e);
    if (node) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        dragRef.current = {
          id: node.id,
          offsetX: e.clientX - rect.left - node.x,
          offsetY: e.clientY - rect.top - node.y,
        };
      }
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    setMousePos({ x: px, y: py });

    if (dragRef.current.id) {
      const n = simNodesRef.current.get(dragRef.current.id);
      if (n) {
        n.x = px - dragRef.current.offsetX;
        n.y = py - dragRef.current.offsetY;
        n.vx = 0;
        n.vy = 0;
      }
    } else {
      const node = getMouseNode(e);
      setHovered(node);
    }
  }

  function handleMouseUp(e: React.MouseEvent) {
    if (dragRef.current.id) {
      // Check if this was a click (not a drag)
      const node = simNodesRef.current.get(dragRef.current.id);
      if (node) {
        onNodeClick?.(node);
      }
    }
    dragRef.current = { id: null, offsetX: 0, offsetY: 0 };
  }

  return (
    <div ref={containerRef} className={cn("relative h-full w-full overflow-hidden rounded-lg", className)}>
      <canvas
        ref={canvasRef}
        className="cursor-pointer touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { dragRef.current = { id: null, offsetX: 0, offsetY: 0 }; setHovered(null); }}
      />
      {hovered && (
        <div
          className="pointer-events-none absolute z-10 max-w-xs rounded-lg border border-slate-700 bg-slate-900/95 p-2 text-xs text-white shadow-xl"
          style={{ left: Math.min(mousePos.x + 14, size.w - 220), top: Math.max(mousePos.y - 50, 4) }}
        >
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: hovered.color }} />
            <span className="font-semibold">{hovered.name}</span>
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400 capitalize">
            {hovered.type.replace(/_/g, " ")} · {hovered.status}
          </div>
        </div>
      )}
    </div>
  );
}
