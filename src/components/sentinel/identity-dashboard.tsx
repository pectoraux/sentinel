"use client";

import * as React from "react";
import {
  Building2,
  Users,
  Smartphone,
  ShieldCheck,
  Trophy,
  Fingerprint,
  Crown,
  CheckCircle2,
  Clock,
  XCircle,
  Globe2,
  MapPin,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface IdentitySummary {
  organizations: {
    byType: { type: string; count: number }[];
    byStatus: { status: string; count: number }[];
    total: number;
  };
  members: { total: number };
  devices: { total: number; trusted: number; untrusted: number };
  verifications: {
    byStatus: { status: string; count: number }[];
    byType: { type: string; count: number }[];
    total: number;
  };
  trust: {
    byTier: { tier: string; count: number }[];
    topProfiles: Array<{
      userId: string;
      score: number;
      tier: string;
      badges: string[];
      user: { id: string; email: string; name: string | null; image: string | null };
    }>;
  };
  recent: {
    verifications: Array<{
      id: string;
      type: string;
      status: string;
      submittedAt: string;
      user: { id: string; email: string; name: string | null };
    }>;
    organizations: Array<{
      id: string;
      key: string;
      name: string;
      type: string;
      status: string;
      country: string | null;
      memberCount: number;
      createdAt: string;
    }>;
  };
}

const ORG_TYPE_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  government_agency: { label: "Government Agency", icon: Building2, color: "text-chart-3" },
  regulator: { label: "Regulator", icon: ShieldCheck, color: "text-chart-1" },
  ngo: { label: "NGO", icon: Users, color: "text-chart-2" },
  researcher: { label: "Researcher", icon: Trophy, color: "text-chart-5" },
  community: { label: "Community", icon: Globe2, color: "text-chart-4" },
};

const TIER_META: Record<string, { color: string; bg: string; label: string }> = {
  elite: { color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/15", label: "Elite" },
  trusted: { color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/15", label: "Trusted" },
  verified: { color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/15", label: "Verified" },
  basic: { color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/15", label: "Basic" },
  unverified: { color: "text-muted-foreground", bg: "bg-muted", label: "Unverified" },
};

const STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  active: { label: "Active", color: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  pending_verification: { label: "Pending", color: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  suspended: { label: "Suspended", color: "text-orange-600 dark:text-orange-400", dot: "bg-orange-500" },
  dissolved: { label: "Dissolved", color: "text-destructive", dot: "bg-destructive" },
  pending: { label: "Pending", color: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  approved: { label: "Approved", color: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  rejected: { label: "Rejected", color: "text-destructive", dot: "bg-destructive" },
  under_review: { label: "Under Review", color: "text-sky-600 dark:text-sky-400", dot: "bg-sky-500" },
  trusted: { label: "Trusted", color: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  revoked: { label: "Revoked", color: "text-destructive", dot: "bg-destructive" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function IdentityDashboard({ initial }: { initial: IdentitySummary }) {
  const [data, setData] = React.useState(initial);
  const [loading, setLoading] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/identity-summary", { cache: "no-store" });
      if (res.ok) setData((await res.json()) as IdentitySummary);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [refresh]);

  const totalOrgs = data.organizations.total;
  const verifiedOrgs = data.organizations.byStatus.find((s) => s.status === "active")?.count ?? 0;
  const pendingOrgs = data.organizations.byStatus.find((s) => s.status === "pending_verification")?.count ?? 0;
  const approvedVerifs = data.verifications.byStatus.find((s) => s.status === "approved")?.count ?? 0;
  const pendingVerifs = data.verifications.byStatus.find((s) => s.status === "pending")?.count ?? 0;
  const eliteCount = data.trust.byTier.find((t) => t.tier === "elite")?.count ?? 0;
  const trustedCount = data.trust.byTier.find((t) => t.tier === "trusted")?.count ?? 0;

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <IdentityKpi icon={Building2} label="Organizations" value={totalOrgs} hint={`${verifiedOrgs} verified`} />
        <IdentityKpi icon={Users} label="Members" value={data.members.total} hint="active" />
        <IdentityKpi icon={Smartphone} label="Devices" value={data.devices.total} hint={`${data.devices.trusted} trusted`} />
        <IdentityKpi icon={ShieldCheck} label="Verifications" value={data.verifications.total} hint={`${approvedVerifs} approved`} />
        <IdentityKpi icon={Trophy} label="Trust Elite" value={eliteCount} hint="tier" />
        <IdentityKpi icon={Clock} label="Pending" value={pendingOrgs + pendingVerifs} hint="orgs + verifs" />
      </div>

      {/* Two-column: Organizations + Trust leaderboard */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Organizations */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <CardTitle>Organizations</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                <Badge variant="outline" className="text-[10px]">{totalOrgs} total</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap gap-2">
              {data.organizations.byType.map((t) => {
                const meta = ORG_TYPE_META[t.type] ?? { label: t.type, color: "text-muted-foreground" };
                const Icon = meta.icon ?? Building2;
                return (
                  <div key={t.type} className={cn("flex items-center gap-1.5 rounded-md border border-border bg-card/50 px-2.5 py-1.5", meta.color)}>
                    <Icon className="h-3 w-3" />
                    <span className="text-xs font-medium">{meta.label}</span>
                    <span className="text-xs font-bold tabular-nums">{t.count}</span>
                  </div>
                );
              })}
            </div>
            <div className="max-h-96 space-y-2 overflow-y-auto -mr-2 pr-2">
              {data.recent.organizations.map((org) => {
                const meta = ORG_TYPE_META[org.type] ?? { label: org.type, color: "text-muted-foreground" };
                const status = STATUS_META[org.status] ?? { label: org.status, color: "text-muted-foreground", dot: "bg-muted" };
                return (
                  <div key={org.id} className="rounded-lg border border-border bg-card/50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn("h-2 w-2 flex-shrink-0 rounded-full", status.dot)} />
                          <p className="truncate text-sm font-medium">{org.name}</p>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                          <span className={meta.color}>{meta.label}</span>
                          {org.country && (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="h-2.5 w-2.5" />
                              {org.country}
                            </span>
                          )}
                          <span>{org.memberCount} members</span>
                          <span>{timeAgo(org.createdAt)}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className={cn("text-[9px] flex-shrink-0", status.color)}>
                        {status.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Trust leaderboard */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <CardTitle>Trust Leaderboard</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap gap-2">
              {data.trust.byTier.map((t) => {
                const meta = TIER_META[t.tier] ?? TIER_META.unverified;
                return (
                  <div key={t.tier} className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5", meta.bg)}>
                    <span className={cn("text-xs font-medium", meta.color)}>{meta.label}</span>
                    <span className={cn("text-xs font-bold tabular-nums", meta.color)}>{t.count}</span>
                  </div>
                );
              })}
            </div>
            <div className="space-y-2">
              {data.trust.topProfiles.map((profile, idx) => {
                const meta = TIER_META[profile.tier] ?? TIER_META.unverified;
                return (
                  <div key={profile.userId} className="flex items-center gap-3 rounded-lg border border-border bg-card/50 p-3">
                    <div className={cn("flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold", meta.bg, meta.color)}>
                      {idx === 0 ? <Crown className="h-4 w-4" /> : idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{profile.user.name ?? profile.user.email}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {profile.badges.slice(0, 3).map((badge) => (
                          <span key={badge} className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[9px] font-mono">
                            {badge}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-lg font-bold tabular-nums leading-none", meta.color)}>{profile.score}</p>
                      <p className={cn("text-[10px] uppercase tracking-wide", meta.color)}>{meta.label}</p>
                    </div>
                  </div>
                );
              })}
              {data.trust.topProfiles.length === 0 && (
                <p className="py-8 text-center text-xs text-muted-foreground">No trust profiles yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two-column: Verifications + Devices/Trust distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent verifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Fingerprint className="h-4 w-4 text-primary" />
                <CardTitle>Identity Verifications</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {data.verifications.byStatus.map((s) => {
                  const meta = STATUS_META[s.status] ?? { label: s.status, color: "text-muted-foreground", dot: "bg-muted" };
                  return (
                    <div key={s.status} className="flex items-center gap-1 text-[10px]">
                      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                      <span className={meta.color}>{s.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-3 grid grid-cols-3 gap-2">
              {data.verifications.byType.map((t) => (
                <div key={t.type} className="rounded-md border border-border bg-card/40 p-2 text-center">
                  <p className="text-base font-bold tabular-nums">{t.count}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t.type.replace(/_/g, " ")}</p>
                </div>
              ))}
            </div>
            <Separator className="mb-3" />
            <div className="max-h-72 space-y-1.5 overflow-y-auto -mr-2 pr-2">
              {data.recent.verifications.map((v) => {
                const meta = STATUS_META[v.status] ?? { label: v.status, color: "text-muted-foreground", dot: "bg-muted" };
                const Icon = v.status === "approved" ? CheckCircle2 : v.status === "rejected" ? XCircle : Clock;
                return (
                  <div key={v.id} className="flex items-center gap-2.5 rounded-md border border-border/60 bg-card/40 p-2.5">
                    <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", meta.color)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{v.user.name ?? v.user.email}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {v.type.replace(/_/g, " ")} · {timeAgo(v.submittedAt)}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn("text-[9px] flex-shrink-0", meta.color)}>
                      {meta.label}
                    </Badge>
                  </div>
                );
              })}
              {data.recent.verifications.length === 0 && (
                <p className="py-8 text-center text-xs text-muted-foreground">No verifications submitted yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Device + trust stats */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-primary" />
              <CardTitle>Devices & Sessions</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-card/50 p-4">
                <div className="flex items-center justify-between">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground uppercase">Total</span>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums">{data.devices.total}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                      <span className="text-emerald-600 dark:text-emerald-400">Trusted</span>
                      <span className="tabular-nums">{data.devices.trusted}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${data.devices.total ? (data.devices.trusted / data.devices.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card/50 p-4">
                <div className="flex items-center justify-between">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground uppercase">Members</span>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums">{data.members.total}</p>
                <p className="mt-2 text-[10px] text-muted-foreground">across {totalOrgs} organizations</p>
              </div>
            </div>

            <Separator className="my-4" />

            <div>
              <p className="mb-2 text-[10px] text-muted-foreground uppercase tracking-wide">Trust Tier Distribution</p>
              <div className="space-y-2">
                {["elite", "trusted", "verified", "basic", "unverified"].map((tierKey) => {
                  const count = data.trust.byTier.find((t) => t.tier === tierKey)?.count ?? 0;
                  const meta = TIER_META[tierKey] ?? TIER_META.unverified;
                  const total = data.trust.byTier.reduce((s, t) => s + t.count, 0) || 1;
                  return (
                    <div key={tierKey} className="flex items-center gap-2">
                      <span className={cn("w-16 text-[10px] font-medium", meta.color)}>{meta.label}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full", meta.bg.replace("/15", ""))}
                          style={{ width: `${(count / total) * 100}%`, backgroundColor: "currentColor" }}
                        />
                      </div>
                      <span className="w-6 text-right text-[10px] font-bold tabular-nums">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function IdentityKpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {hint && (
          <span className="text-[9px] text-muted-foreground uppercase tracking-wide">{hint}</span>
        )}
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
    </div>
  );
}
