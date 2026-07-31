"use client";

import * as React from "react";
import {
  FileText,
  Image as ImageIcon,
  Video,
  AudioWaveform,
  MapPin,
  Cpu,
  Shield,
  ShieldCheck,
  Lock,
  Hash,
  History,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  image: ImageIcon,
  video: Video,
  audio: AudioWaveform,
  document: FileText,
  gps_track: MapPin,
  sensor_log: Cpu,
  report: FileText,
  other: FileText,
};

const TYPE_COLOR: Record<string, string> = {
  image: "#0ea5e9", video: "#ef4444", audio: "#f59e0b", document: "#22c55e",
  gps_track: "#8b5cf6", sensor_log: "#14b8a6", report: "#a78bfa", other: "#64748b",
};

const TYPE_OPTIONS = [
  { value: "image", label: "Image", mediaType: "image/jpeg" },
  { value: "video", label: "Video", mediaType: "video/mp4" },
  { value: "audio", label: "Audio", mediaType: "audio/mpeg" },
  { value: "document", label: "Document", mediaType: "application/pdf" },
  { value: "gps_track", label: "GPS Track", mediaType: "application/gpx+xml" },
  { value: "sensor_log", label: "Sensor Log", mediaType: "application/json" },
  { value: "report", label: "Report", mediaType: "application/pdf" },
  { value: "other", label: "Other", mediaType: "application/octet-stream" },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function EvidenceDashboard({ initialSummary }: { initialSummary: any }) {
  const [summary, setSummary] = React.useState(initialSummary);
  const [selectedEvidence, setSelectedEvidence] = React.useState<any>(null);
  const [verifyResult, setVerifyResult] = React.useState<any>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [loadingVerify, setLoadingVerify] = React.useState(false);

  // Upload form state
  const [showUpload, setShowUpload] = React.useState(false);
  const [uploadForm, setUploadForm] = React.useState({
    title: "",
    type: "image",
    description: "",
    lat: "",
    lng: "",
    storageKey: "",
  });
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/v1/evidence/summary", { cache: "no-store" });
      if (res.ok) setSummary(await res.json());
    } catch {}
  }, []);

  React.useEffect(() => {
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [refresh]);

  // Load evidence detail when selected
  React.useEffect(() => {
    if (!selectedEvidence) return;
    setLoadingDetail(true);
    fetch(`/api/v1/evidence/${selectedEvidence.id}`)
      .then((r) => r.json())
      .then((data) => setSelectedEvidence(data))
      .catch(() => {})
      .finally(() => setLoadingDetail(false));
  }, [selectedEvidence?.id]);

  const verifyEvidence = async (id: string) => {
    setLoadingVerify(true);
    try {
      const res = await fetch(`/api/v1/evidence/${id}/verify`, { method: "POST" });
      if (res.ok) setVerifyResult(await res.json());
    } catch {}
    setLoadingVerify(false);
  };

  const submitUpload = async () => {
    if (!uploadForm.title.trim()) return;
    setUploading(true);
    setUploadError(null);
    try {
      const typeOpt = TYPE_OPTIONS.find((t) => t.value === uploadForm.type);
      const payload: any = {
        title: uploadForm.title.trim(),
        type: uploadForm.type,
        mediaType: typeOpt?.mediaType ?? "application/octet-stream",
        description: uploadForm.description.trim(),
        storageKey: uploadForm.storageKey.trim() || undefined,
      };
      if (uploadForm.lat) payload.lat = Number(uploadForm.lat);
      if (uploadForm.lng) payload.lng = Number(uploadForm.lng);
      const res = await fetch("/api/v1/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? `Failed (${res.status})`);
      }
      setShowUpload(false);
      setUploadForm({ title: "", type: "image", description: "", lat: "", lng: "", storageKey: "" });
      await refresh();
      showToast("Evidence uploaded — hash chain created");
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const totalSize = summary.totalSizeBytes ?? 0;
  const recentUploads = summary.recentUploads ?? [];

  return (
    <div className="space-y-4 min-w-0 overflow-hidden">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-md border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-400 shadow-lg backdrop-blur">
          {toast}
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <EvKpi icon={FileText} label="Total Evidence" value={summary.total ?? 0} hint={`${summary.byType?.length ?? 0} types`} />
        <EvKpi icon={History} label="Total Versions" value={summary.totalVersions ?? 0} hint="snapshots" />
        <EvKpi icon={ShieldCheck} label="Verified" value={summary.verified ?? 0} hint="chain-checked" />
        <EvKpi icon={Lock} label="Encrypted" value={summary.encrypted ?? 0} hint="at-rest" />
        <EvKpi icon={Hash} label="Chain Valid" value={summary.chainValid ?? 0} hint={`${summary.chainBroken ?? 0} broken`} />
        <EvKpi icon={Cpu} label="Total Size" value={formatSize(totalSize)} hint="storage" />
      </div>

      {/* Evidence gallery + detail */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 min-w-0">
        {/* Gallery */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Evidence Gallery</CardTitle>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2">
                  {summary.byType?.map((t: any) => (
                    <span key={t.type} className="flex items-center gap-1 text-[10px]">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TYPE_COLOR[t.type] ?? "#6b7280" }} />
                      <span className="text-muted-foreground">{t.count}</span>
                    </span>
                  ))}
                </div>
                <Button size="sm" onClick={() => setShowUpload((s) => !s)} className="h-7 gap-1 text-xs">
                  {showUpload ? (
                    <XCircle className="h-3.5 w-3.5" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  {showUpload ? "Close" : "Upload"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {showUpload && (
              <div className="mb-3 rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-primary">Upload Evidence</p>
                <Input
                  placeholder="Title (e.g. Excavator photo at site B)"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm((s) => ({ ...s, title: e.target.value }))}
                  className="h-8 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={uploadForm.type}
                    onChange={(e) => setUploadForm((s) => ({ ...s, type: e.target.value }))}
                    className="h-8 rounded-md border border-border bg-card px-2 text-sm"
                  >
                    {TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <Input
                    placeholder="Storage key (demo)"
                    value={uploadForm.storageKey}
                    onChange={(e) => setUploadForm((s) => ({ ...s, storageKey: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <Textarea
                  placeholder="Description..."
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm((s) => ({ ...s, description: e.target.value }))}
                  className="min-h-[60px] text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Lat"
                    value={uploadForm.lat}
                    onChange={(e) => setUploadForm((s) => ({ ...s, lat: e.target.value }))}
                    className="h-8 text-sm"
                  />
                  <Input
                    placeholder="Lng"
                    value={uploadForm.lng}
                    onChange={(e) => setUploadForm((s) => ({ ...s, lng: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                {uploadError && (
                  <p className="text-[11px] text-destructive">{uploadError}</p>
                )}
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowUpload(false)} disabled={uploading} className="h-7 text-xs">
                    Cancel
                  </Button>
                  <Button size="sm" onClick={submitUpload} disabled={uploading || !uploadForm.title.trim()} className="h-7 text-xs gap-1">
                    {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    Upload &amp; Hash
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[450px] overflow-y-auto -mr-2 pr-2">
              {recentUploads.map((ev: any) => {
                const Icon = TYPE_ICON[ev.type] ?? FileText;
                const color = TYPE_COLOR[ev.type] ?? "#6b7280";
                return (
                  <button
                    key={ev.id}
                    onClick={() => setSelectedEvidence(ev)}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                      selectedEvidence?.id === ev.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card/50 hover:bg-accent/50",
                    )}
                  >
                    <div
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md"
                      style={{ backgroundColor: color + "20", color }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{ev.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {ev.mediaType} · {formatSize(ev.sizeBytes)}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        <span className="text-[9px] text-muted-foreground">v{ev.currentVersion}</span>
                        {ev.verified && (
                          <span className="flex items-center gap-0.5 text-[9px] text-emerald-600 dark:text-emerald-400">
                            <ShieldCheck className="h-2.5 w-2.5" /> verified
                          </span>
                        )}
                        {ev.encrypted && (
                          <span className="flex items-center gap-0.5 text-[9px] text-amber-600 dark:text-amber-400">
                            <Lock className="h-2.5 w-2.5" /> encrypted
                          </span>
                        )}
                        {ev.chainValid ? (
                          <span className="flex items-center gap-0.5 text-[9px] text-emerald-600 dark:text-emerald-400">
                            <Hash className="h-2.5 w-2.5" /> chain ok
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-[9px] text-destructive">
                            <AlertTriangle className="h-2.5 w-2.5" /> broken
                          </span>
                        )}
                        <span className="ml-auto text-[9px] text-muted-foreground">{timeAgo(ev.createdAt)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
              {recentUploads.length === 0 && (
                <p className="col-span-full py-8 text-center text-xs text-muted-foreground">No evidence uploaded yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Detail panel */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Evidence Detail</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {selectedEvidence ? (
              loadingDetail ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold leading-tight">{selectedEvidence.title}</p>
                    {selectedEvidence.description && (
                      <p className="mt-1 text-[11px] text-muted-foreground">{selectedEvidence.description}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="rounded border border-border/60 bg-card/40 p-2">
                      <p className="text-muted-foreground uppercase">Type</p>
                      <p className="font-medium capitalize">{selectedEvidence.type?.replace(/_/g, " ")}</p>
                    </div>
                    <div className="rounded border border-border/60 bg-card/40 p-2">
                      <p className="text-muted-foreground uppercase">Size</p>
                      <p className="font-medium">{formatSize(selectedEvidence.sizeBytes)}</p>
                    </div>
                    <div className="rounded border border-border/60 bg-card/40 p-2">
                      <p className="text-muted-foreground uppercase">Version</p>
                      <p className="font-medium">v{selectedEvidence.currentVersion}</p>
                    </div>
                    <div className="rounded border border-border/60 bg-card/40 p-2">
                      <p className="text-muted-foreground uppercase">Media</p>
                      <p className="font-mono text-[9px] truncate">{selectedEvidence.mediaType}</p>
                    </div>
                  </div>

                  {/* GPS */}
                  {selectedEvidence.lat != null && selectedEvidence.lng != null && (
                    <div className="rounded border border-border/60 bg-card/40 p-2">
                      <p className="text-[10px] text-muted-foreground uppercase mb-1">GPS Location</p>
                      <p className="font-mono text-[10px]">
                        {selectedEvidence.lat.toFixed(6)}°, {selectedEvidence.lng.toFixed(6)}°
                      </p>
                    </div>
                  )}

                  {/* Hash chain */}
                  <div className="rounded border border-border/60 bg-card/40 p-2">
                    <p className="text-[10px] text-muted-foreground uppercase mb-1">Hash Chain</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Hash className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-[9px] text-muted-foreground">checksum:</span>
                        <code className="font-mono text-[9px] truncate">{selectedEvidence.checksum?.slice(0, 24)}…</code>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Hash className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-[9px] text-muted-foreground">current:</span>
                        <code className="font-mono text-[9px] truncate">{selectedEvidence.currentHash?.slice(0, 24)}…</code>
                      </div>
                      {selectedEvidence.previousHash && (
                        <div className="flex items-center gap-1.5">
                          <ChevronRight className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0 rotate-90" />
                          <span className="text-[9px] text-muted-foreground">prev:</span>
                          <code className="font-mono text-[9px] truncate">{selectedEvidence.previousHash?.slice(0, 24)}…</code>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Metadata */}
                  {selectedEvidence.metadata && typeof selectedEvidence.metadata === "object" && (
                    <div className="rounded border border-border/60 bg-card/40 p-2">
                      <p className="text-[10px] text-muted-foreground uppercase mb-1">Metadata</p>
                      <div className="max-h-32 space-y-0.5 overflow-y-auto -mr-2 pr-2">
                        {Object.entries(selectedEvidence.metadata).slice(0, 8).map(([k, v]) => (
                          <div key={k} className="flex justify-between gap-2 text-[9px]">
                            <span className="text-muted-foreground">{k.replace(/_/g, " ")}:</span>
                            <span className="font-mono text-right truncate">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Version history */}
                  {selectedEvidence.versions && selectedEvidence.versions.length > 1 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase mb-1">Version History ({selectedEvidence.versions.length})</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto -mr-2 pr-2">
                        {selectedEvidence.versions.map((v: any) => (
                          <div key={v.version} className="flex items-center gap-1.5 text-[9px] rounded border border-border/40 p-1">
                            <Badge variant="outline" className="text-[8px]">v{v.version}</Badge>
                            <span className="text-muted-foreground truncate flex-1">{v.changeReason}</span>
                            <span className="font-mono text-muted-foreground">{v.combinedHash?.slice(0, 8)}…</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Verify button */}
                  <button
                    onClick={() => verifyEvidence(selectedEvidence.id)}
                    disabled={loadingVerify}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md border border-primary bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    {loadingVerify ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-3 w-3" />
                    )}
                    Verify Hash Chain
                  </button>

                  {verifyResult && (
                    <div className={cn(
                      "rounded-md border p-2 text-xs",
                      verifyResult.valid
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "border-destructive/50 bg-destructive/10 text-destructive",
                    )}>
                      <div className="flex items-center gap-1.5">
                        {verifyResult.valid ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                        <span className="font-medium">
                          {verifyResult.valid ? "Chain intact" : "Chain broken"}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px]">
                        {verifyResult.valid
                          ? `All ${verifyResult.versionCount} versions verified ✓`
                          : `Broken at v${verifyResult.brokenAt}: ${verifyResult.reason}`}
                      </p>
                    </div>
                  )}
                </div>
              )
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Select evidence to see details.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Type distribution + hash chain visualization */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 min-w-0">
        {/* Type distribution */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Evidence by Type</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.byType?.map((item: any) => {
                const color = TYPE_COLOR[item.type] ?? "#6b7280";
                const pct = summary.total > 0 ? (item.count / summary.total) * 100 : 0;
                const Icon = TYPE_ICON[item.type] ?? FileText;
                return (
                  <div key={item.type} className="flex items-center gap-2">
                    <Icon className="h-3 w-3 flex-shrink-0" style={{ color }} />
                    <span className="w-20 text-[10px] font-medium capitalize">{item.type.replace(/_/g, " ")}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                    <span className="w-8 text-right text-[10px] font-bold tabular-nums">{item.count}</span>
                  </div>
                );
              })}
            </div>
            <Separator className="my-3" />
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-lg font-bold tabular-nums">{summary.verified ?? 0}</p>
                <p className="text-[9px] text-muted-foreground uppercase">Verified</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums">{summary.encrypted ?? 0}</p>
                <p className="text-[9px] text-muted-foreground uppercase">Encrypted</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{summary.chainValid ?? 0}</p>
                <p className="text-[9px] text-muted-foreground uppercase">Chain OK</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums text-destructive">{summary.chainBroken ?? 0}</p>
                <p className="text-[9px] text-muted-foreground uppercase">Broken</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hash chain explanation */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Tamper Detection</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground mb-3">
              Every evidence item is hash-chained: each version&apos;s combined hash links to the
              previous version. Any modification breaks the chain — making tampering immediately
              detectable.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/5 p-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">SHA-256 Content Hash</p>
                  <p className="text-[9px] text-muted-foreground">Cryptographic fingerprint of file content</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/5 p-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Hash Chain (blockchain-style)</p>
                  <p className="text-[9px] text-muted-foreground">Each version links to previous via combined hash</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded border border-amber-500/30 bg-amber-500/5 p-2">
                <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <div>
                  <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">AES-256-GCM Encryption</p>
                  <p className="text-[9px] text-muted-foreground">At-rest encryption with KMS-managed keys</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded border border-sky-500/30 bg-sky-500/5 p-2">
                <MapPin className="h-4 w-4 text-sky-600 dark:text-sky-400 flex-shrink-0" />
                <div>
                  <p className="text-[11px] font-medium text-sky-700 dark:text-sky-400">GPS Tagging</p>
                  <p className="text-[9px] text-muted-foreground">Every item geo-tagged with lat/lng + optional track</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded border border-violet-500/30 bg-violet-500/5 p-2">
                <History className="h-4 w-4 text-violet-600 dark:text-violet-400 flex-shrink-0" />
                <div>
                  <p className="text-[11px] font-medium text-violet-700 dark:text-violet-400">Version History</p>
                  <p className="text-[9px] text-muted-foreground">Immutable snapshots with validFrom/validTo ranges</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EvKpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {hint && <span className="text-[9px] text-muted-foreground uppercase tracking-wide">{hint}</span>}
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
    </div>
  );
}
