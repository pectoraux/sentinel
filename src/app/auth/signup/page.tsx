"use client";

/**
 * Sentinel — Premium Waitlist Sign-Up Page
 * =============================================================================
 * Collects a community member's interest in joining Sentinel. The submission
 * creates a `WaitlistEntry` (NOT a User account) — an admin later reviews and
 * approves entries from `/auth/waitlist`, at which point a real User account
 * is provisioned with a temporary password.
 *
 * Collected: full name, email, password (≥ 12 chars), organization (optional),
 * role interest (dropdown).
 * =============================================================================
 */

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ShieldCheck,
  Mail,
  Lock,
  Loader2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  User as UserIcon,
  Building2,
  Briefcase,
  Eye,
  EyeOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RoleInterest = {
  value: string;
  label: string;
  description: string;
};

const ROLE_INTERESTS: RoleInterest[] = [
  {
    value: "citizen_reporter",
    label: "Citizen Reporter",
    description: "Report incidents & earn rewards",
  },
  {
    value: "field_inspector",
    label: "Field Inspector",
    description: "Verify reports on the ground",
  },
  {
    value: "government_official",
    label: "Government Official",
    description: "National dashboard & cases",
  },
  {
    value: "researcher",
    label: "Researcher",
    description: "Academic / scientific analysis",
  },
  {
    value: "ngo",
    label: "NGO",
    description: "Community advocacy organization",
  },
  {
    value: "other",
    label: "Other",
    description: "Something else entirely",
  },
];

interface FormState {
  name: string;
  email: string;
  password: string;
  organization: string;
  roleInterest: string;
}

const INITIAL_FORM: FormState = {
  name: "",
  email: "",
  password: "",
  organization: "",
  roleInterest: "citizen_reporter",
};

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  organization?: string;
}

export default function SignUpPage() {
  const [form, setForm] = React.useState<FormState>(INITIAL_FORM);
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [success, setSuccess] = React.useState<{
    name: string;
    email: string;
  } | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key as keyof FieldErrors]) {
      setFieldErrors((prev) => ({ ...prev, [key as keyof FieldErrors]: undefined }));
    }
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (form.name.trim().length < 2) {
      next.name = "Please enter your full name (min 2 characters).";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = "Please enter a valid email address.";
    }
    if (form.password.length < 12) {
      next.password = "Password must be at least 12 characters.";
    }
    if (form.organization && form.organization.length > 160) {
      next.organization = "Organization name is too long.";
    }
    return next;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/auth/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          organization: form.organization.trim() || undefined,
          roleInterest: form.roleInterest,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        issues?: Array<{ path: string[]; message: string }>;
      };

      if (!res.ok) {
        if (res.status === 422 && data.issues?.length) {
          const fe: FieldErrors = {};
          for (const issue of data.issues) {
            const key = issue.path[0] as keyof FieldErrors;
            if (key) fe[key] = issue.message;
          }
          setFieldErrors(fe);
          setError("Please correct the highlighted fields.");
        } else if (res.status === 409) {
          setError(
            data.error ??
              "This email is already on the waitlist or registered.",
          );
        } else {
          setError(data.error ?? "Failed to join the waitlist. Please try again.");
        }
        return;
      }

      setSuccess({ name: form.name.trim(), email: form.email.trim().toLowerCase() });
      setForm(INITIAL_FORM);
    } catch {
      setError(
        "Network error — please check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // -------------------------------------------------------------------------
  // Success state
  // -------------------------------------------------------------------------
  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12 text-foreground">
        <div className="w-full max-w-lg">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-sm sm:p-10">
            <div className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-teal-500/10 blur-3xl" />

            <div className="relative">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
                <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              </div>

              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                You&apos;re on the waitlist!
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Thanks, <span className="font-medium text-foreground">{success.name}</span>.
                We&apos;ve received your request to join Sentinel. Our team
                reviews every application personally and will reach out to{" "}
                <span className="font-medium text-foreground">{success.email}</span>{" "}
                with next steps.
              </p>

              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "We review applications within 2 business days.",
                  "Approved accounts get a temporary password by email.",
                  "Need help? Reach out to support@sentinel.africa.",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-muted-foreground">{line}</span>
                  </li>
                ))}
              </ul>

              <Separator className="my-7" />

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-11 flex-1 text-sm font-semibold">
                  <Link href="/auth/signin">
                    Back to sign in
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-11 flex-1 text-sm font-semibold"
                >
                  <Link href="/">Explore the demo</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // -------------------------------------------------------------------------
  // Form state
  // -------------------------------------------------------------------------
  return (
    <main className="min-h-screen w-full bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
        {/* ---------------------------------------------------------------- */}
        {/* Form panel                                                       */}
        {/* ---------------------------------------------------------------- */}
        <section className="flex flex-col justify-center px-5 py-10 sm:px-8 lg:px-16">
          <div className="mx-auto w-full max-w-md">
            <Link
              href="/auth/signin"
              className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to sign in
            </Link>

            {/* Mobile brand */}
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <Image
                src="/sentinel-logo.png"
                alt="Sentinel logo"
                width={36}
                height={36}
                className="rounded-md ring-1 ring-border"
              />
              <div className="leading-tight">
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                  Sentinel
                </div>
                <div className="text-xs text-muted-foreground">
                  Community Intelligence Platform
                </div>
              </div>
            </div>

            <header className="mb-8">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Join the Sentinel waitlist
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                We onboard new community members in batches. Tell us about you
                and we&apos;ll be in touch within 2 business days.
              </p>
            </header>

            {error && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Full name */}
              <div className="space-y-1.5">
                <label
                  htmlFor="name"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Full name
                </label>
                <div className="relative">
                  <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="name"
                    name="name"
                    autoComplete="name"
                    required
                    placeholder="Ama Osei"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    className="h-11 pl-10"
                    aria-invalid={!!fieldErrors.name}
                    disabled={submitting}
                  />
                </div>
                {fieldErrors.name && (
                  <p className="text-xs text-destructive">{fieldErrors.name}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Email address
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    className="h-11 pl-10"
                    aria-invalid={!!fieldErrors.email}
                    disabled={submitting}
                  />
                </div>
                {fieldErrors.email && (
                  <p className="text-xs text-destructive">{fieldErrors.email}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={12}
                    placeholder="At least 12 characters"
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    className="h-11 pl-10 pr-10"
                    aria-invalid={!!fieldErrors.password}
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {fieldErrors.password ? (
                  <p className="text-xs text-destructive">{fieldErrors.password}</p>
                ) : (
                  <p className="text-xs text-muted-foreground/80">
                    Choose a strong password — it will be activated when your
                    account is approved.
                  </p>
                )}
              </div>

              {/* Organization (optional) */}
              <div className="space-y-1.5">
                <label
                  htmlFor="organization"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Organization{" "}
                  <span className="font-normal normal-case text-muted-foreground/70">
                    (optional)
                  </span>
                </label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="organization"
                    name="organization"
                    autoComplete="organization"
                    placeholder="EPA Ghana, WACAM, KNUST…"
                    value={form.organization}
                    onChange={(e) => update("organization", e.target.value)}
                    className="h-11 pl-10"
                    aria-invalid={!!fieldErrors.organization}
                    disabled={submitting}
                  />
                </div>
                {fieldErrors.organization && (
                  <p className="text-xs text-destructive">
                    {fieldErrors.organization}
                  </p>
                )}
              </div>

              {/* Role interest */}
              <div className="space-y-1.5">
                <label
                  htmlFor="roleInterest"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  I&apos;m interested in joining as…
                </label>
                <Select
                  value={form.roleInterest}
                  onValueChange={(v) => update("roleInterest", v)}
                  disabled={submitting}
                >
                  <SelectTrigger
                    id="roleInterest"
                    className="h-11 w-full"
                    aria-label="Role interest"
                  >
                    <span className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <SelectValue />
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_INTERESTS.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <div className="flex flex-col">
                          <span className="font-medium">{role.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {role.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                size="lg"
                className="mt-2 h-11 w-full text-sm font-semibold"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    Join the waitlist
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-muted-foreground/70">
              By submitting you agree to the Sentinel Terms of Service and
              acknowledge our Privacy Policy. We review every application
              personally.
            </p>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Brand / value panel                                              */}
        {/* ---------------------------------------------------------------- */}
        <section
          aria-hidden="true"
          className="relative hidden overflow-hidden bg-gradient-to-br from-teal-950 via-emerald-950 to-emerald-900 lg:flex lg:flex-col lg:justify-between lg:p-12 lg:text-emerald-50"
        >
          <div className="pointer-events-none absolute inset-0 opacity-60">
            <div className="absolute -top-32 -right-24 h-96 w-96 rounded-full bg-teal-500/25 blur-3xl" />
            <div className="absolute bottom-[-8rem] left-[-6rem] h-[28rem] w-[28rem] rounded-full bg-emerald-400/20 blur-3xl" />
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
                backgroundSize: "48px 48px",
              }}
            />
          </div>

          <div className="relative z-10 flex items-center gap-3">
            <Image
              src="/sentinel-logo.png"
              alt=""
              width={40}
              height={40}
              className="rounded-md ring-1 ring-white/20"
            />
            <div className="leading-tight">
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-200/90">
                Sentinel
              </div>
              <div className="text-xs text-emerald-300/70">
                Community Intelligence Platform
              </div>
            </div>
          </div>

          <div className="relative z-10 max-w-md">
            <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
              Be part of Africa&apos;s largest community intelligence network.
            </h1>
            <p className="mt-4 text-pretty text-sm leading-relaxed text-emerald-100/80">
              Sentinel unifies citizens, inspectors, NGOs, and government
              agencies around a shared mission: protecting rivers, forests, and
              communities from environmental crimes.
            </p>

            <ul className="mt-8 space-y-3 text-sm text-emerald-100/90">
              {[
                "Citizen reports with tamper-evident evidence",
                "Bayesian confidence scoring on every incident",
                "Real-time digital twin of affected ecosystems",
                "AI copilot & autonomous investigation engine",
              ].map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative z-10 flex items-center gap-4 text-xs text-emerald-200/70">
            <span className="inline-flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
              </span>
              Trusted by 12+ agencies across 4 countries
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
