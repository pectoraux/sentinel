/**
 * Sentinel — Waitlist Admin Page
 * =============================================================================
 * Admin-only dashboard for reviewing community waitlist submissions. Lists
 * every entry with its role interest, organization, status, and submitted
 * date. Admins can approve (which provisions a real User + TrustProfile and
 * returns a temporary password) or reject each entry.
 *
 * Access control:
 *   - Requires an authenticated session with `admin` or `super_admin` role.
 *   - Unauthenticated visitors are redirected to /auth/signin.
 *   - Authenticated non-admins see a 403 card.
 * =============================================================================
 */

import Link from "next/link";
import Image from "next/image";
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  ClipboardList,
  Clock,
  CheckCircle2,
  Hourglass,
} from "lucide-react";

import { db } from "@/lib/db";
import { getSession } from "@/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  WaitlistTable,
  type WaitlistEntryDto,
} from "@/components/sentinel/auth/waitlist-table";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function StatCard({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tint: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center gap-4 p-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${tint}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-semibold tracking-tight">{value}</div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function WaitlistAdminPage() {
  const session = await getSession();

  // Unauthenticated → send to sign-in.
  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12 text-foreground">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Authentication required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You need to sign in with an admin account to view the waitlist.
            </p>
            <Button asChild className="w-full">
              <Link href="/auth/signin?callbackUrl=/auth/waitlist">
                Sign in
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const isAdmin =
    session.roles.includes("super_admin") || session.roles.includes("admin");

  // Authenticated but not an admin.
  if (!isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12 text-foreground">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-destructive" />
              Forbidden
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your account (<span className="font-mono">{session.email}</span>)
              does not have permission to view the waitlist. This area is
              restricted to platform administrators.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">Back to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  // Load all waitlist entries (newest first).
  const rows = await db.waitlistEntry.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      email: true,
      name: true,
      organization: true,
      roleInterest: true,
      status: true,
      createdAt: true,
      reviewedAt: true,
      reviewNotes: true,
    },
  });

  const entries: WaitlistEntryDto[] = rows.map((r) => ({
    ...r,
    organization: r.organization ?? null,
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    reviewNotes: r.reviewNotes ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  const total = entries.length;
  const pending = entries.filter((e) => e.status === "pending").length;
  const approved = entries.filter((e) => e.status === "approved").length;
  const rejected = entries.filter((e) => e.status === "rejected").length;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/sentinel-logo.png"
              alt="Sentinel logo"
              width={40}
              height={40}
              className="rounded-md ring-1 ring-border"
            />
            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  Waitlist Admin
                </h1>
                <Badge
                  variant="secondary"
                  className="bg-emerald-500/15 text-emerald-700 ring-1 ring-inset ring-emerald-500/25 dark:text-emerald-300"
                >
                  <ShieldCheck className="h-3 w-3" />
                  Admin
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Review and approve community signup requests
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/">
                Back to dashboard
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </header>

        {/* Stats */}
        <section
          aria-label="Waitlist statistics"
          className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
        >
          <StatCard
            icon={ClipboardList}
            label="Total requests"
            value={total}
            tint="bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300"
          />
          <StatCard
            icon={Clock}
            label="Pending"
            value={pending}
            tint="bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300"
          />
          <StatCard
            icon={CheckCircle2}
            label="Approved"
            value={approved}
            tint="bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300"
          />
          <StatCard
            icon={Hourglass}
            label="Rejected"
            value={rejected}
            tint="bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-300"
          />
        </section>

        <Separator className="mb-6" />

        {/* Table */}
        <section aria-label="Waitlist entries">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight">
              All entries
            </h2>
            <span className="text-xs text-muted-foreground">
              Showing {entries.length}{" "}
              {entries.length === 1 ? "entry" : "entries"}
            </span>
          </div>
          <WaitlistTable entries={entries} />
        </section>

        <footer className="mt-12 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          Sentinel Platform · Waitlist Admin · Signed in as{" "}
          <span className="font-mono text-foreground">{session.email}</span>
        </footer>
      </div>
    </main>
  );
}
