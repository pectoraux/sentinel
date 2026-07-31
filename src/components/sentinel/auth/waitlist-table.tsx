"use client";

/**
 * Sentinel — Waitlist Admin Table (client component)
 * ============================================================================
 * Renders the waitlist entries as a premium table with per-row Approve / Reject
 * actions. After a successful action the parent route is refreshed so the
 * server component re-queries the latest state.
 *
 * Approval opens a modal dialog showing the freshly generated temporary
 * password for the new user — the admin copies it and shares it with the
 * applicant via a secure channel.
 * ============================================================================
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  Check,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  Mail,
  Building2,
  Calendar,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface WaitlistEntryDto {
  id: string;
  email: string;
  name: string;
  organization: string | null;
  roleInterest: string;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
}

const ROLE_INTEREST_LABELS: Record<string, string> = {
  citizen_reporter: "Citizen Reporter",
  field_inspector: "Field Inspector",
  government_official: "Government Official",
  researcher: "Researcher",
  ngo: "NGO",
  other: "Other",
};

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 ring-1 ring-inset ring-emerald-500/25 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3" />
        Approved
      </Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge className="bg-rose-500/15 text-rose-700 ring-1 ring-inset ring-rose-500/25 dark:text-rose-300">
        <XCircle className="h-3 w-3" />
        Rejected
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="bg-amber-500/15 text-amber-700 ring-1 ring-inset ring-amber-500/25 dark:text-amber-300"
    >
      <Calendar className="h-3 w-3" />
      Pending
    </Badge>
  );
}

interface ApprovalResult {
  email: string;
  temporaryPassword: string | null;
  roleKey: string | null;
  message?: string;
}

export function WaitlistTable({ entries }: { entries: WaitlistEntryDto[] }) {
  const router = useRouter();
  const [actioningId, setActioningId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [approval, setApproval] = React.useState<ApprovalResult | null>(null);
  const [copied, setCopied] = React.useState(false);

  async function approve(entry: WaitlistEntryDto) {
    setError(null);
    setActioningId(entry.id);
    try {
      const res = await fetch(
        `/api/v1/auth/waitlist/${entry.id}/approve`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        email?: string;
        temporaryPassword?: string | null;
        roleKey?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Failed to approve entry.");
        return;
      }
      setApproval({
        email: data.email ?? entry.email,
        temporaryPassword: data.temporaryPassword ?? null,
        roleKey: data.roleKey ?? null,
        message: data.message,
      });
      router.refresh();
    } catch {
      setError("Network error while approving. Please try again.");
    } finally {
      setActioningId(null);
    }
  }

  async function reject(entry: WaitlistEntryDto) {
    setError(null);
    setActioningId(entry.id);
    try {
      const res = await fetch(
        `/api/v1/auth/waitlist/${entry.id}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to reject entry.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error while rejecting. Please try again.");
    } finally {
      setActioningId(null);
    }
  }

  async function copyPassword(pw: string) {
    try {
      await navigator.clipboard.writeText(pw);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't access clipboard. Please copy manually.");
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-base font-semibold">No waitlist entries</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            When community members sign up at{" "}
            <span className="font-mono text-foreground">/auth/signup</span>,
            their requests will appear here for review.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-4">Applicant</TableHead>
                <TableHead>Role interest</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const isPending = entry.status === "pending";
                const isActioning = actioningId === entry.id;
                return (
                  <TableRow key={entry.id} className="text-sm">
                    <TableCell className="pl-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {entry.name}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {entry.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-foreground">
                        {ROLE_INTEREST_LABELS[entry.roleInterest] ??
                          entry.roleInterest}
                      </span>
                    </TableCell>
                    <TableCell>
                      {entry.organization ? (
                        <span className="inline-flex items-center gap-1.5 text-foreground">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          {entry.organization}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={entry.status} />
                      {entry.reviewedAt && (
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {formatDate(entry.reviewedAt)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">
                        {formatDate(entry.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="h-8 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                          disabled={!isPending || isActioning}
                          onClick={() => approve(entry)}
                        >
                          {isActioning ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 border-rose-300 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-500/40 dark:text-rose-400 dark:hover:bg-rose-500/10"
                          disabled={!isPending || isActioning}
                          onClick={() => reject(entry)}
                        >
                          {isActioning ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Approval result modal */}
      <Dialog
        open={!!approval}
        onOpenChange={(open) => {
          if (!open) {
            setApproval(null);
            setCopied(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Account approved
            </DialogTitle>
            <DialogDescription>
              A new user account has been created. Share the temporary password
              below with the applicant through a secure channel — they will be
              prompted to change it after their first sign-in.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                Email
              </div>
              <div className="mt-1 font-mono text-sm text-foreground">
                {approval?.email}
              </div>
            </div>

            {approval?.temporaryPassword ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                    <KeyRound className="h-3.5 w-3.5" />
                    Temporary password
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 px-2 text-xs"
                    onClick={() => copyPassword(approval.temporaryPassword!)}
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <div className="mt-2 break-all rounded bg-background/80 px-3 py-2 font-mono text-sm tracking-wider text-foreground ring-1 ring-border">
                  {approval.temporaryPassword}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-300">
                {approval?.message ??
                  "A pre-existing user account was linked. No new password was generated."}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Role assigned:{" "}
              <span className="font-medium text-foreground">
                {ROLE_INTEREST_LABELS[approval?.roleKey ?? ""] ??
                  approval?.roleKey ??
                  "—"}
              </span>
            </p>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setApproval(null);
                setCopied(false);
              }}
              className="h-10"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
