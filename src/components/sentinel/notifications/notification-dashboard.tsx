"use client";

import * as React from "react";
import {
  Bell, Mail, MessageSquare, Inbox, MapPin, Clock, AlertTriangle,
  CheckCircle2, Loader2, Radio, Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const CHANNEL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  push: Bell, email: Mail, sms: MessageSquare, in_app: Inbox,
};
const CHANNEL_COLOR: Record<string, string> = {
  push: "#0ea5e9", email: "#22c55e", sms: "#f59e0b", in_app: "#8b5cf6",
};
const PRIORITY_COLOR: Record<number, string> = {
  0: "text-muted-foreground", 1: "text-sky-500", 2: "text-amber-500", 3: "text-destructive",
};
const PRIORITY_LABEL: Record<number, string> = { 0: "Low", 1: "Normal", 2: "High", 3: "Critical" };
const PRIORITY_DOT: Record<number, string> = { 0: "bg-muted-foreground", 1: "bg-sky-500", 2: "bg-amber-500", 3: "bg-destructive" };
const TYPE_COLOR: Record<string, string> = {
  intelligence_event: "#ef4444", evidence_verified: "#22c55e", corroboration: "#0ea5e9",
  trust_change: "#8b5cf6", fraud_alert: "#dc2626", system: "#64748b", digest: "#f59e0b", community_update: "#a78bfa",
};

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationDashboard({ initialSummary }: { initialSummary: any }) {
  const [summary, setSummary] = React.useState(initialSummary);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/v1/notifications/summary", { cache: "no-store" });
      if (res.ok) setSummary(await res.json());
    } catch {}
  }, []);
  React.useEffect(() => { const id = setInterval(refresh, 30000); return () => clearInterval(id); }, [refresh]);

  return (
    <div className="space-y-4 min-w-0 overflow-hidden">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <NotifKpi icon={Bell} label="Total" value={summary.total ?? 0} />
        <NotifKpi icon={Inbox} label="Unread" value={summary.unread ?? 0} hint="pending" />
        <NotifKpi icon={Radio} label="Channels" value={summary.channels?.total ?? 0} hint="registered" />
        <NotifKpi icon={Layers} label="Subscriptions" value={summary.subscriptions?.total ?? 0} hint="active" />
        <NotifKpi icon={MapPin} label="Geofences" value={summary.geofences?.total ?? 0} hint={`${summary.geofences?.active ?? 0} active`} />
        <NotifKpi icon={Clock} label="Digests" value={summary.digests?.total ?? 0} hint="compiled" />
        <NotifKpi icon={AlertTriangle} label="Critical" value={summary.byPriority?.find((p: any) => p.priority === 3)?.count ?? 0} hint="priority" />
        <NotifKpi icon={Bell} label="High Priority" value={summary.byPriority?.find((p: any) => p.priority === 2)?.count ?? 0} hint="priority" />
      </div>

      {/* Inbox + channels */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 min-w-0">
        {/* Inbox */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Inbox className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Notification Inbox</CardTitle></div>
              <Badge variant="outline" className="text-[10px]">{summary.unread ?? 0} unread</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] space-y-2 overflow-y-auto -mr-2 pr-2">
              {summary.recent?.map((n: any) => (
                <div key={n.id} className={cn("flex items-start gap-3 rounded-lg border p-3 transition-colors", n.isRead ? "border-border bg-card/30" : "border-primary/30 bg-primary/5")}>
                  <span className={cn("mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full", PRIORITY_DOT[n.priority] ?? "bg-muted")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: TYPE_COLOR[n.type] ?? "#6b7280" }} />
                      <p className={cn("truncate text-sm", !n.isRead && "font-semibold")}>{n.title}</p>
                      {!n.isRead && <span className="flex-shrink-0 rounded bg-primary px-1 text-[8px] font-bold text-primary-foreground">NEW</span>}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{n.body}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[9px] text-muted-foreground">
                      <span className={cn("font-medium", PRIORITY_COLOR[n.priority])}>{PRIORITY_LABEL[n.priority]}</span>
                      <span>·</span>
                      <span className="capitalize">{n.type.replace(/_/g, " ")}</span>
                      {n.matchedGeofence && <><span>·</span><span className="flex items-center gap-0.5"><MapPin className="h-2 w-2" />{n.matchedGeofence}</span></>}
                      <span>·</span>
                      <span>{timeAgo(n.createdAt)}</span>
                      <div className="ml-auto flex items-center gap-1">
                        {n.channels?.map((ch: string) => {
                          const Icon = CHANNEL_ICON[ch] ?? Bell;
                          return <Icon key={ch} className="h-2.5 w-2.5" style={{ color: CHANNEL_COLOR[ch] ?? "#6b7280" }} />;
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {(!summary.recent || summary.recent.length === 0) && <p className="py-8 text-center text-xs text-muted-foreground">No notifications yet.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Channels + subscriptions */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><div className="flex items-center gap-2"><Bell className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Channels</CardTitle></div></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {summary.channels?.byType?.map((c: any) => {
                  const Icon = CHANNEL_ICON[c.type] ?? Bell;
                  return (
                    <div key={c.type} className="flex items-center gap-2 rounded border border-border/60 bg-card/40 p-2">
                      <Icon className="h-3.5 w-3.5" style={{ color: CHANNEL_COLOR[c.type] ?? "#6b7280" }} />
                      <span className="text-[11px] font-medium capitalize flex-1">{c.type.replace(/_/g, " ")}</span>
                      <span className="text-[10px] font-bold tabular-nums">{c.count}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><div className="flex items-center gap-2"><Layers className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Subscriptions</CardTitle></div></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {summary.subscriptions?.byType?.map((s: any) => (
                  <div key={s.type} className="flex items-center gap-2 rounded border border-border/60 bg-card/40 p-2">
                    <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.type === "geofence" ? "#ef4444" : s.type === "interest" ? "#0ea5e9" : s.type === "event_type" ? "#f59e0b" : "#22c55e" }} />
                    <span className="text-[11px] font-medium capitalize flex-1">{s.type.replace(/_/g, " ")}</span>
                    <span className="text-[10px] font-bold tabular-nums">{s.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Geofences</CardTitle></div></CardHeader>
            <CardContent>
              <div className="text-center">
                <p className="text-2xl font-bold tabular-nums">{summary.geofences?.total ?? 0}</p>
                <p className="text-[9px] text-muted-foreground uppercase">{summary.geofences?.active ?? 0} active</p>
              </div>
              <Separator className="my-2" />
              <div className="text-center">
                <p className="text-2xl font-bold tabular-nums">{summary.digests?.total ?? 0}</p>
                <p className="text-[9px] text-muted-foreground uppercase">digests compiled</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Priority distribution + features */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 min-w-0">
        <Card>
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Priority Distribution</CardTitle></div></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[3, 2, 1, 0].map((p) => {
                const count = summary.byPriority?.find((bp: any) => bp.priority === p)?.count ?? 0;
                const total = summary.total ?? 1;
                const pct = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={p} className="flex items-center gap-2">
                    <span className={cn("w-20 text-[10px] font-medium", PRIORITY_COLOR[p])}>{PRIORITY_LABEL[p]}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full" style={{ width: `${pct}%`, backgroundColor: p === 3 ? "#ef4444" : p === 2 ? "#f59e0b" : p === 1 ? "#0ea5e9" : "#64748b" }} />
                    </div>
                    <span className="w-8 text-right text-[10px] font-bold tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>
            <Separator className="my-3" />
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="text-lg font-bold tabular-nums">{summary.total ?? 0}</p><p className="text-[9px] text-muted-foreground uppercase">Total</p></div>
              <div><p className="text-lg font-bold tabular-nums text-amber-500">{summary.unread ?? 0}</p><p className="text-[9px] text-muted-foreground uppercase">Unread</p></div>
              <div><p className="text-lg font-bold tabular-nums text-destructive">{summary.byPriority?.find((p: any) => p.priority === 3)?.count ?? 0}</p><p className="text-[9px] text-muted-foreground uppercase">Critical</p></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><div className="flex items-center gap-2"><Radio className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Platform Features</CardTitle></div></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { icon: Bell, label: "Push Notifications", desc: "Real-time device push (FCM/APNs)", color: "#0ea5e9" },
                { icon: Mail, label: "Email", desc: "SMTP email delivery with templates", color: "#22c55e" },
                { icon: MessageSquare, label: "SMS", desc: "Twilio/Africa's Talking integration", color: "#f59e0b" },
                { icon: Inbox, label: "In-App", desc: "Instant in-app notification inbox", color: "#8b5cf6" },
                { icon: MapPin, label: "Geofenced Subscriptions", desc: "Notify when events occur within a boundary", color: "#ef4444" },
                { icon: Layers, label: "Interest Subscriptions", desc: "Subscribe to topics (water, mining, forest)", color: "#0ea5e9" },
                { icon: Clock, label: "Digest Mode", desc: "Hourly, daily, or weekly batched delivery", color: "#f59e0b" },
                { icon: AlertTriangle, label: "Priority Notifications", desc: "4-level priority (low → critical)", color: "#dc2626" },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-2 rounded border border-border/40 bg-card/30 p-2">
                  <f.icon className="h-4 w-4 flex-shrink-0" style={{ color: f.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium">{f.label}</p>
                    <p className="text-[9px] text-muted-foreground">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function NotifKpi({ icon: Icon, label, value, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; hint?: string }) {
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
