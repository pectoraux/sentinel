"use client";

/**
 * Sentinel — Premium Sign-In Page
 * =============================================================================
 * Email + password sign-in backed by NextAuth credentials provider.
 * Includes 4 one-click demo account buttons (one per role) so reviewers and
 * stakeholders can explore the platform without manual account creation.
 *
 * On success the user is redirected to `/` (the platform dashboard).
 * =============================================================================
 */

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Image from "next/image";
import {
  ShieldCheck,
  Mail,
  Lock,
  Loader2,
  ArrowRight,
  AlertCircle,
  Users,
  Compass,
  Landmark,
  Crown,
  Eye,
  EyeOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

type DemoAccount = {
  label: string;
  email: string;
  password: string;
  icon: React.ComponentType<{ className?: string }>;
  tint: string;
  description: string;
};

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    label: "Citizen Reporter",
    email: "citizen@sentinel.africa",
    password: "SentinelDemo2024!",
    icon: Users,
    tint:
      "from-emerald-500/15 to-emerald-500/5 text-emerald-700 dark:text-emerald-300 ring-emerald-500/25",
    description: "Report incidents, earn rewards, build trust",
  },
  {
    label: "Field Inspector",
    email: "inspector@sentinel.africa",
    password: "SentinelDemo2024!",
    icon: Compass,
    tint:
      "from-teal-500/15 to-teal-500/5 text-teal-700 dark:text-teal-300 ring-teal-500/25",
    description: "Verify reports, collect evidence on the ground",
  },
  {
    label: "Government Official",
    email: "gov@sentinel.africa",
    password: "SentinelDemo2024!",
    icon: Landmark,
    tint:
      "from-amber-500/15 to-amber-500/5 text-amber-700 dark:text-amber-300 ring-amber-500/25",
    description: "National dashboard, cases, investigations",
  },
  {
    label: "Platform Admin",
    email: "admin@sentinel.africa",
    password: "SentinelAdmin2024!",
    icon: Crown,
    tint:
      "from-rose-500/15 to-rose-500/5 text-rose-700 dark:text-rose-300 ring-rose-500/25",
    description: "Full platform administration & security",
  },
];

function callbackError(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case "CredentialsSignin":
      return "Invalid email or password. Please try again.";
    case "AccessDenied":
      return "Your account is not authorized. Please contact an administrator.";
    case "Verification":
      return "Your sign-in link has expired. Please request a new one.";
    default:
      return "Sign-in failed. Please try again.";
  }
}

export default function SignInPage() {
  return (
    <React.Suspense fallback={<SignInLoading />}>
      <SignInContent />
    </React.Suspense>
  );
}

function SignInLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
    </div>
  );
}

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [demoLoading, setDemoLoading] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(
    callbackError(searchParams.get("error")),
  );

  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });
    setSubmitting(false);
    if (res?.error) {
      setError("Invalid email or password. Please try again.");
      return;
    }
    if (res?.ok) {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  async function handleDemo(account: DemoAccount) {
    if (demoLoading) return;
    setDemoLoading(account.email);
    setError(null);
    setEmail(account.email);
    setPassword(account.password);
    const res = await signIn("credentials", {
      email: account.email,
      password: account.password,
      redirect: false,
      callbackUrl,
    });
    setDemoLoading(null);
    if (res?.error) {
      setError(
        `Could not sign in as ${account.label}. The demo accounts may not be seeded yet.`,
      );
      return;
    }
    if (res?.ok) {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <main className="min-h-screen w-full bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
        {/* ------------------------------------------------------------------ */}
        {/* Brand / value panel                                                */}
        {/* ------------------------------------------------------------------ */}
        <section
          aria-hidden="true"
          className="relative hidden overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 lg:flex lg:flex-col lg:justify-between lg:p-12 lg:text-emerald-50"
        >
          {/* Decorative glow + grid */}
          <div className="pointer-events-none absolute inset-0 opacity-60">
            <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-emerald-500/30 blur-3xl" />
            <div className="absolute bottom-[-8rem] right-[-6rem] h-[28rem] w-[28rem] rounded-full bg-teal-400/20 blur-3xl" />
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
              Detect, verify &amp; predict environmental crimes — together.
            </h1>
            <p className="mt-4 text-pretty text-sm leading-relaxed text-emerald-100/80">
              Sentinel unifies citizen reports, satellite imagery, and AI
              investigations into a single command center for protecting
              Africa&apos;s rivers, forests, and communities.
            </p>

            <ul className="mt-8 space-y-3 text-sm text-emerald-100/90">
              {[
                "Tamper-evident evidence with cryptographic hashing",
                "Bayesian confidence scoring on every incident",
                "Real-time digital twin of affected ecosystems",
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
              All systems operational
            </span>
            <span>·</span>
            <span>SOC 2 Type II in progress</span>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* Form panel                                                         */}
        {/* ------------------------------------------------------------------ */}
        <section className="flex flex-col justify-center px-5 py-10 sm:px-8 lg:px-16">
          <div className="mx-auto w-full max-w-md">
            {/* Mobile brand */}
            <div className="mb-8 flex items-center gap-3 lg:hidden">
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
                Welcome back
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Sign in to your Sentinel account to continue.
              </p>
            </header>

            {/* Error banner */}
            {error && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {/* Sign-in form */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 pl-10"
                    disabled={submitting || !!demoLoading}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    className="text-xs font-medium text-primary/80 transition-colors hover:text-primary"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 pl-10 pr-10"
                    disabled={submitting || !!demoLoading}
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
              </div>

              <Button
                type="submit"
                size="lg"
                className="h-11 w-full text-sm font-semibold"
                disabled={
                  submitting || !!demoLoading || !email || !password
                }
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="my-7 flex items-center gap-4">
              <Separator className="flex-1" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Or try a demo account
              </span>
              <Separator className="flex-1" />
            </div>

            {/* Demo accounts */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {DEMO_ACCOUNTS.map((acct) => {
                const Icon = acct.icon;
                const loading = demoLoading === acct.email;
                return (
                  <button
                    key={acct.email}
                    type="button"
                    onClick={() => handleDemo(acct)}
                    disabled={submitting || !!demoLoading}
                    className={`group relative flex items-start gap-3 rounded-xl border border-border bg-gradient-to-br p-3 text-left ring-1 ring-inset ring-transparent transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 ${acct.tint}`}
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background/70 ring-1 ring-border/60">
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground">
                        {acct.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                        {acct.description}
                      </span>
                      <span className="mt-1 block truncate font-mono text-[10px] text-muted-foreground/80">
                        {acct.email}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Footer / sign-up link */}
            <p className="mt-8 text-center text-sm text-muted-foreground">
              New to Sentinel?{" "}
              <Link
                href="/auth/signup"
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                Join the waitlist
              </Link>
            </p>

            <p className="mt-3 text-center text-xs text-muted-foreground/70">
              By signing in you agree to the Sentinel Terms of Service and
              acknowledge our Privacy Policy.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
