"use client";

import * as React from "react";
import {
  AlertTriangle,
  MessageSquare,
  Eye,
  Share2,
  Users,
  Activity,
  MapPin,
  Clock,
  Loader2,
  Radio,
  Send,
  Bell,
  BellOff,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const SEVERITY_COLOR: Record<string, string> = {
  low: "text-sky-500",
  medium: "text-amber-500",
  high: "text-orange-500",
  critical: "text-destructive",
};

const STATUS_COLOR: Record<string, string> = {
  open: "text-amber-600 dark:text-amber-400",
  investigating: "text-sky-600 dark:text-sky-400",
  verified: "text-emerald-600 dark:text-emerald-400",
  resolved: "text-muted-foreground",
  false_positive: "text-destructive",
};

const TYPE_COLOR: Record<string, string> = {
  pollution: "#ef4444",
  deforestation: "#22c55e",
  illegal_mining: "#f97316",
  water_contamination: "#0ea5e9",
  land_degradation: "#a78bfa",
  wildlife_crime: "#14b8a6",
  other: "#64748b",
};

const TYPE_OPTIONS = [
  { value: "illegal_mining", label: "Illegal Mining" },
  { value: "water_contamination", label: "Water Contamination" },
  { value: "deforestation", label: "Deforestation" },
  { value: "pollution", label: "Pollution" },
  { value: "land_degradation", label: "Land Degradation" },
  { value: "wildlife_crime", label: "Wildlife Crime" },
  { value: "other", label: "Other" },
];

const SEVERITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const STREAM_EVENT_COLOR: Record<string, string> = {
  created: "bg-emerald-500",
  commented: "bg-sky-500",
  subscribed: "bg-violet-500",
  unsubscribed: "bg-muted-foreground",
  watched: "bg-violet-500",
  shared: "bg-amber-500",
  viewed: "bg-muted-foreground",
  status_changed: "bg-orange-500",
  evidence_attached: "bg-teal-500",
  severity_changed: "bg-red-500",
  description_updated: "bg-blue-500",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function IntelligenceDashboard({ initialSummary }: { initialSummary: any }) {
  const [summary, setSummary] = React.useState(initialSummary);
  const [events, setEvents] = React.useState<any[]>(initialSummary.recentEvents ?? []);
  const [selectedEvent, setSelectedEvent] = React.useState<any>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [stream, setStream] = React.useState<any>(null);
  const [loadingStream, setLoadingStream] = React.useState(false);

  // Interactive state
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [createForm, setCreateForm] = React.useState({
    title: "",
    type: "illegal_mining",
    severity: "medium",
    description: "",
    lat: "",
    lng: "",
    locationName: "",
  });
  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  // Per-event action state
  const [subscribed, setSubscribed] = React.useState<Record<string, boolean>>({});
  const [actionLoading, setActionLoading] = React.useState<Record<string, boolean>>({});
  const [commentOpen, setCommentOpen] = React.useState<Record<string, boolean>>({});
  const [commentText, setCommentText] = React.useState<Record<string, string>>({});
  const [toast, setToast] = React.useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  // Load event detail when selected
  React.useEffect(() => {
    if (!selectedEvent) return;
    setLoadingDetail(true);
    fetch(`/api/v1/intelligence/events/${selectedEvent.id}`)
      .then((r) => r.json())
      .then((data) => setSelectedEvent(data))
      .catch(() => {})
      .finally(() => setLoadingDetail(false));
    // Also load stream
    setLoadingStream(true);
    fetch(`/api/v1/intelligence/events/${selectedEvent.id}/stream`)
      .then((r) => r.json())
      .then((data) => setStream(data))
      .catch(() => {})
      .finally(() => setLoadingStream(false));
  }, [selectedEvent?.id]);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/v1/intelligence/summary", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
        setEvents(data.recentEvents ?? []);
      }
    } catch {}
  }, []);

  React.useEffect(() => {
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [refresh]);

  // --- Create event
  const submitCreate = async () => {
    if (!createForm.title.trim() || !createForm.type) return;
    setCreating(true);
    setCreateError(null);
    try {
      const payload: any = {
        title: createForm.title.trim(),
        type: createForm.type,
        severity: createForm.severity,
        description: createForm.description.trim(),
        locationName: createForm.locationName.trim() || undefined,
      };
      if (createForm.lat) payload.lat = Number(createForm.lat);
      if (createForm.lng) payload.lng = Number(createForm.lng);
      const res = await fetch("/api/v1/intelligence/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? `Failed (${res.status})`);
      }
      setShowCreateForm(false);
      setCreateForm({
        title: "",
        type: "illegal_mining",
        severity: "medium",
        description: "",
        lat: "",
        lng: "",
        locationName: "",
      });
      await refresh();
      showToast("Event created — autonomous investigator notified.");
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Failed to create event");
    } finally {
      setCreating(false);
    }
  };

  // --- Subscribe / unsubscribe
  const toggleSubscribe = async (eventId: string) => {
    setActionLoading((s) => ({ ...s, [`sub-${eventId}`]: true }));
    try {
      const isSubbed = subscribed[eventId];
      const res = await fetch(`/api/v1/intelligence/events/${eventId}/subscribe`, {
        method: isSubbed ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: isSubbed ? undefined : JSON.stringify({ type: "watch" }),
      });
      if (res.ok) {
        setSubscribed((s) => ({ ...s, [eventId]: !isSubbed }));
        showToast(isSubbed ? "Unsubscribed" : "Subscribed — you'll get updates");
      } else {
        showToast("Action failed");
      }
    } catch {
      showToast("Network error");
    } finally {
      setActionLoading((s) => ({ ...s, [`sub-${eventId}`]: false }));
    }
  };

  // --- Share
  const shareEvent = async (eventId: string) => {
    setActionLoading((s) => ({ ...s, [`share-${eventId}`]: true }));
    try {
      const res = await fetch(`/api/v1/intelligence/events/${eventId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "internal", message: "Shared from dashboard" }),
      });
      if (res.ok) {
        showToast("Event shared");
        await refresh();
      } else {
        showToast("Share failed");
      }
    } catch {
      showToast("Network error");
    } finally {
      setActionLoading((s) => ({ ...s, [`share-${eventId}`]: false }));
    }
  };

  // --- Comment
  const submitComment = async (eventId: string) => {
    const text = (commentText[eventId] ?? "").trim();
    if (!text) return;
    setActionLoading((s) => ({ ...s, [`comment-${eventId}`]: true }));
    try {
      const res = await fetch(`/api/v1/intelligence/events/${eventId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      if (res.ok) {
        setCommentText((s) => ({ ...s, [eventId]: "" }));
        setCommentOpen((s) => ({ ...s, [eventId]: false }));
        showToast("Comment posted");
        await refresh();
        if (selectedEvent?.id === eventId) {
          // Re-load detail to show the new comment
          fetch(`/api/v1/intelligence/events/${eventId}`)
            .then((r) => r.json())
            .then((data) => setSelectedEvent(data))
            .catch(() => {});
        }
      } else {
        showToast("Comment failed");
      }
    } catch {
      showToast("Network error");
    } finally {
      setActionLoading((s) => ({ ...s, [`comment-${eventId}`]: false }));
    }
  };

  return (
    <div className="space-y-4 min-w-0 overflow-hidden">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-md border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-400 shadow-lg backdrop-blur">
          {toast}
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <IntelKpi icon={AlertTriangle} label="Events" value={summary.total ?? 0} hint={`${summary.byType?.length ?? 0} types`} />
        <IntelKpi icon={MessageSquare} label="Comments" value={summary.totalComments ?? 0} hint="discussions" />
        <IntelKpi icon={Users} label="Subscriptions" value={summary.totalSubscriptions ?? 0} hint="watch+follow" />
        <IntelKpi icon={Share2} label="Shares" value={summary.totalShares ?? 0} hint="propagation" />
        <IntelKpi icon={Activity} label="Stream Entries" value={summary.totalStreamEntries ?? 0} hint="event-sourced" />
        <IntelKpi icon={AlertTriangle} label="Critical" value={summary.bySeverity?.find((s: any) => s.severity === "critical")?.count ?? 0} hint="severity" />
      </div>

      {/* Event feed + detail */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 min-w-0">
        {/* Feed */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Community Feed</CardTitle>
              </div>
              <Button size="sm" onClick={() => setShowCreateForm((s) => !s)} className="h-7 gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" />
                {showCreateForm ? "Close" : "Report Event"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {showCreateForm && (
              <div className="mb-3 rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-primary">Create Intelligence Event</p>
                <Input
                  placeholder="Title (e.g. Cyanide spill near Prestea)"
                  value={createForm.title}
                  onChange={(e) => setCreateForm((s) => ({ ...s, title: e.target.value }))}
                  className="h-8 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={createForm.type}
                    onChange={(e) => setCreateForm((s) => ({ ...s, type: e.target.value }))}
                    className="h-8 rounded-md border border-border bg-card px-2 text-sm"
                  >
                    {TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <select
                    value={createForm.severity}
                    onChange={(e) => setCreateForm((s) => ({ ...s, severity: e.target.value }))}
                    className="h-8 rounded-md border border-border bg-card px-2 text-sm"
                  >
                    {SEVERITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <Textarea
                  placeholder="Description of what you observed..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm((s) => ({ ...s, description: e.target.value }))}
                  className="min-h-[60px] text-sm"
                />
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    placeholder="Lat"
                    value={createForm.lat}
                    onChange={(e) => setCreateForm((s) => ({ ...s, lat: e.target.value }))}
                    className="h-8 text-sm"
                  />
                  <Input
                    placeholder="Lng"
                    value={createForm.lng}
                    onChange={(e) => setCreateForm((s) => ({ ...s, lng: e.target.value }))}
                    className="h-8 text-sm"
                  />
                  <Input
                    placeholder="Location name"
                    value={createForm.locationName}
                    onChange={(e) => setCreateForm((s) => ({ ...s, locationName: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                {createError && (
                  <p className="text-[11px] text-destructive">{createError}</p>
                )}
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowCreateForm(false)} disabled={creating} className="h-7 text-xs">
                    Cancel
                  </Button>
                  <Button size="sm" onClick={submitCreate} disabled={creating || !createForm.title.trim()} className="h-7 text-xs gap-1">
                    {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    Create Event
                  </Button>
                </div>
              </div>
            )}

            <div className="max-h-[500px] space-y-2 overflow-y-auto -mr-2 pr-2">
              {events.map((ev: any) => (
                <div
                  key={ev.id}
                  className={cn(
                    "w-full text-left rounded-lg border p-3 transition-colors",
                    selectedEvent?.id === ev.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card/50 hover:bg-accent/50",
                  )}
                >
                  <button
                    onClick={() => setSelectedEvent(ev)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: TYPE_COLOR[ev.type] ?? "#6b7280" }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-tight">{ev.title}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{ev.description}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                          <span className={cn("font-medium capitalize", SEVERITY_COLOR[ev.severity])}>{ev.severity}</span>
                          <span>·</span>
                          <span className={cn("capitalize", STATUS_COLOR[ev.status])}>{ev.status}</span>
                          {ev.locationName && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-0.5 truncate">
                                <MapPin className="h-2.5 w-2.5" />
                                {ev.locationName}
                              </span>
                            </>
                          )}
                          <span className="ml-auto">{timeAgo(ev.createdAt)}</span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-0.5">
                            <MessageSquare className="h-2.5 w-2.5" />
                            {ev.commentCount}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Eye className="h-2.5 w-2.5" />
                            {ev.viewCount}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Users className="h-2.5 w-2.5" />
                            {ev.subscriberCount}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Share2 className="h-2.5 w-2.5" />
                            {ev.shareCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Action row */}
                  <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-border/40 pt-2">
                    <button
                      onClick={() => toggleSubscribe(ev.id)}
                      disabled={actionLoading[`sub-${ev.id}`]}
                      className={cn(
                        "inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-colors disabled:opacity-50",
                        subscribed[ev.id]
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted hover:bg-accent text-muted-foreground",
                      )}
                    >
                      {actionLoading[`sub-${ev.id}`] ? (
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      ) : subscribed[ev.id] ? (
                        <BellOff className="h-2.5 w-2.5" />
                      ) : (
                        <Bell className="h-2.5 w-2.5" />
                      )}
                      {subscribed[ev.id] ? "Subscribed" : "Subscribe"}
                    </button>
                    <button
                      onClick={() => setCommentOpen((s) => ({ ...s, [ev.id]: !s[ev.id] }))}
                      className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-accent transition-colors"
                    >
                      <MessageSquare className="h-2.5 w-2.5" />
                      Comment
                    </button>
                    <button
                      onClick={() => shareEvent(ev.id)}
                      disabled={actionLoading[`share-${ev.id}`]}
                      className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50"
                    >
                      {actionLoading[`share-${ev.id}`] ? (
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      ) : (
                        <Share2 className="h-2.5 w-2.5" />
                      )}
                      Share
                    </button>
                  </div>

                  {commentOpen[ev.id] && (
                    <div className="mt-2 flex items-end gap-2">
                      <Textarea
                        placeholder="Add a comment..."
                        value={commentText[ev.id] ?? ""}
                        onChange={(e) => setCommentText((s) => ({ ...s, [ev.id]: e.target.value }))}
                        className="min-h-[40px] text-xs"
                      />
                      <Button
                        size="sm"
                        onClick={() => submitComment(ev.id)}
                        disabled={actionLoading[`comment-${ev.id}`] || !(commentText[ev.id] ?? "").trim()}
                        className="h-8 gap-1 text-xs"
                      >
                        {actionLoading[`comment-${ev.id}`] ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Send className="h-3 w-3" />
                        )}
                        Post
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {events.length === 0 && (
                <p className="py-8 text-center text-xs text-muted-foreground">No intelligence events yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Detail + Stream */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Event Detail</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {selectedEvent ? (
                loadingDetail ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold">{selectedEvent.title}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{selectedEvent.description}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[10px]">
                      <Badge variant="outline" className={cn("text-[9px] capitalize", SEVERITY_COLOR[selectedEvent.severity])}>
                        {selectedEvent.severity}
                      </Badge>
                      <Badge variant="outline" className={cn("text-[9px] capitalize", STATUS_COLOR[selectedEvent.status])}>
                        {selectedEvent.status}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] capitalize" style={{ color: TYPE_COLOR[selectedEvent.type] }}>
                        {selectedEvent.type.replace(/_/g, " ")}
                      </Badge>
                      <span className="ml-auto text-muted-foreground">v{selectedEvent.streamVersion}</span>
                    </div>
                    {selectedEvent.locationName && (
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <MapPin className="h-2.5 w-2.5" />
                        {selectedEvent.locationName}
                        {selectedEvent.lat && (
                          <span className="font-mono">({selectedEvent.lat.toFixed(3)}°, {selectedEvent.lng?.toFixed(3)}°)</span>
                        )}
                      </div>
                    )}

                    {/* Comments */}
                    {selectedEvent.comments && selectedEvent.comments.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                          Comments ({selectedEvent.comments.length})
                        </p>
                        <div className="max-h-40 space-y-1.5 overflow-y-auto -mr-2 pr-2">
                          {selectedEvent.comments.map((c: any) => (
                            <div key={c.id} className="rounded border border-border/60 bg-card/40 p-2">
                              <p className="text-[11px]">{c.body}</p>
                              <p className="mt-0.5 text-[9px] text-muted-foreground">{timeAgo(c.createdAt)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Inline comment composer on detail panel */}
                    <div className="flex items-end gap-2">
                      <Textarea
                        placeholder="Add a comment..."
                        value={commentText[selectedEvent.id] ?? ""}
                        onChange={(e) => setCommentText((s) => ({ ...s, [selectedEvent.id]: e.target.value }))}
                        className="min-h-[40px] text-xs"
                      />
                      <Button
                        size="sm"
                        onClick={() => submitComment(selectedEvent.id)}
                        disabled={actionLoading[`comment-${selectedEvent.id}`] || !(commentText[selectedEvent.id] ?? "").trim()}
                        className="h-8 gap-1 text-xs"
                      >
                        {actionLoading[`comment-${selectedEvent.id}`] ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Send className="h-3 w-3" />
                        )}
                        Post
                      </Button>
                    </div>

                    {/* Engagement stats */}
                    <Separator />
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <p className="text-base font-bold tabular-nums">{selectedEvent.commentCount}</p>
                        <p className="text-[9px] text-muted-foreground uppercase">Comments</p>
                      </div>
                      <div>
                        <p className="text-base font-bold tabular-nums">{selectedEvent.subscriberCount}</p>
                        <p className="text-[9px] text-muted-foreground uppercase">Subs</p>
                      </div>
                      <div>
                        <p className="text-base font-bold tabular-nums">{selectedEvent.shareCount}</p>
                        <p className="text-[9px] text-muted-foreground uppercase">Shares</p>
                      </div>
                      <div>
                        <p className="text-base font-bold tabular-nums">{selectedEvent.viewCount}</p>
                        <p className="text-[9px] text-muted-foreground uppercase">Views</p>
                      </div>
                    </div>

                    {/* Detail-level action buttons */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={subscribed[selectedEvent.id] ? "default" : "outline"}
                        onClick={() => toggleSubscribe(selectedEvent.id)}
                        disabled={actionLoading[`sub-${selectedEvent.id}`]}
                        className="h-8 gap-1 text-xs"
                      >
                        {actionLoading[`sub-${selectedEvent.id}`] ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : subscribed[selectedEvent.id] ? (
                          <BellOff className="h-3 w-3" />
                        ) : (
                          <Bell className="h-3 w-3" />
                        )}
                        {subscribed[selectedEvent.id] ? "Subscribed" : "Subscribe"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => shareEvent(selectedEvent.id)}
                        disabled={actionLoading[`share-${selectedEvent.id}`]}
                        className="h-8 gap-1 text-xs"
                      >
                        {actionLoading[`share-${selectedEvent.id}`] ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Share2 className="h-3 w-3" />
                        )}
                        Share
                      </Button>
                    </div>
                  </div>
                )
              ) : (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  Select an event from the feed.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Event Stream (source of truth) */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Event Stream</CardTitle>
                </div>
                {stream && (
                  <Badge variant="outline" className="text-[10px]">
                    {stream.entryCount} entries
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {selectedEvent && stream ? (
                loadingStream ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="max-h-48 space-y-1 overflow-y-auto -mr-2 pr-2">
                    {stream.stream?.slice().reverse().map((entry: any) => (
                      <div key={entry.id} className="flex items-start gap-2 text-[10px]">
                        <span className={cn("mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full", STREAM_EVENT_COLOR[entry.eventType] ?? "bg-muted")} />
                        <div className="min-w-0 flex-1">
                          <span className="font-medium capitalize">{entry.eventType.replace(/_/g, " ")}</span>
                          <span className="text-muted-foreground ml-1">v{entry.version}</span>
                          {entry.payload && Object.keys(entry.payload).length > 0 && (
                            <span className="text-muted-foreground ml-1 truncate">
                              {entry.payload.body ? `: ${entry.payload.body.slice(0, 60)}` : entry.payload.subscriptionType ? `: ${entry.payload.subscriptionType}` : entry.payload.platform ? `: ${entry.payload.platform}` : ""}
                            </span>
                          )}
                          <span className="text-muted-foreground ml-auto float-right">{timeAgo(entry.timestamp)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Stream loads when you select an event.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Distribution + event sourcing explanation */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 min-w-0">
        {/* Distribution */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Events by Type</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.byType?.map((item: any) => {
                const color = TYPE_COLOR[item.type] ?? "#6b7280";
                const pct = summary.total > 0 ? (item.count / summary.total) * 100 : 0;
                return (
                  <div key={item.type} className="flex items-center gap-2">
                    <span className="w-28 text-[10px] font-medium capitalize">{item.type.replace(/_/g, " ")}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                    <span className="w-8 text-right text-[10px] font-bold tabular-nums">{item.count}</span>
                  </div>
                );
              })}
            </div>
            <Separator className="my-3" />
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold tabular-nums">{summary.totalComments ?? 0}</p>
                <p className="text-[9px] text-muted-foreground uppercase">Comments</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums">{summary.totalSubscriptions ?? 0}</p>
                <p className="text-[9px] text-muted-foreground uppercase">Subscriptions</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums">{summary.totalStreamEntries ?? 0}</p>
                <p className="text-[9px] text-muted-foreground uppercase">Stream Events</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Event sourcing explanation */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Event Sourcing</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground mb-3">
              Everything is event-sourced. Each action (create, comment, subscribe,
              share, view) appends an immutable event to the stream. The current state
              is a projection — a fold over the event log. Nothing is mutated in place.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/5 p-2">
                <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Append-Only Event Log</p>
                  <p className="text-[9px] text-muted-foreground">Every action recorded forever — complete audit trail</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded border border-violet-500/30 bg-violet-500/5 p-2">
                <Clock className="h-4 w-4 text-violet-600 dark:text-violet-400 flex-shrink-0" />
                <div>
                  <p className="text-[11px] font-medium text-violet-700 dark:text-violet-400">Temporal Replay</p>
                  <p className="text-[9px] text-muted-foreground">Rebuild state at any point in time (integrates with M5)</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded border border-sky-500/30 bg-sky-500/5 p-2">
                <Bell className="h-4 w-4 text-sky-600 dark:text-sky-400 flex-shrink-0" />
                <div>
                  <p className="text-[11px] font-medium text-sky-700 dark:text-sky-400">Subscribe · Watch · Follow</p>
                  <p className="text-[9px] text-muted-foreground">Users get notifications and track events in their feed</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded border border-amber-500/30 bg-amber-500/5 p-2">
                <Share2 className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <div>
                  <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">Share · Comment · Evidence</p>
                  <p className="text-[9px] text-muted-foreground">Multi-platform sharing + evidence attachment + threaded comments</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function IntelKpi({
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
