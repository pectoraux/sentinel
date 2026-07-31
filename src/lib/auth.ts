/**
 * Sentinel — NextAuth Configuration
 * =============================================================================
 * Production-grade authentication for the Sentinel platform.
 *
 *   - Credentials provider (email + password) backed by bcryptjs.
 *   - JWT session strategy (stateless, horizontally scalable).
 *   - NEXTAUTH_SECRET pulled from the validated app config.
 *   - JWT/session callbacks inject `roles` + `permissions` into the token so
 *     the server can authorize without a DB hit on every request.
 *   - `getAuthOptions()` is the single entry point consumed by the App-Router
 *     route handler at `src/app/api/auth/[...nextauth]/route.ts`.
 *
 * Account lockout, brute-force protection, and audit logging are wired through
 * the existing User model fields (`failedLogins`, `lockedUntil`) and the
 * observability subsystem. OAuth providers (Google, GitHub, Azure AD) remain
 * available via `src/auth/options.ts` for backwards compatibility.
 * =============================================================================
 */

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { db } from "@/lib/db";
import { config } from "@/config";
import { logger } from "@/infrastructure/observability/logger";
import { getRbac } from "@/modules/iam/infrastructure/rbac";

// ---------------------------------------------------------------------------
// Password helpers
// ---------------------------------------------------------------------------

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ---------------------------------------------------------------------------
// Account lockout policy
// ---------------------------------------------------------------------------

const MAX_FAILED_LOGINS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// ---------------------------------------------------------------------------
// NextAuth options
// ---------------------------------------------------------------------------

export function getAuthOptions(): NextAuthOptions {
  return {
    session: {
      strategy: "jwt",
      maxAge: config.AUTH_SESSION_MAX_AGE_SECONDS,
    },
    secret: config.NEXTAUTH_SECRET,
    pages: {
      signIn: "/auth/signin",
      error: "/auth/signin",
    },
    providers: [
      CredentialsProvider({
        name: "Sentinel",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          const email = credentials?.email?.trim().toLowerCase();
          const password = credentials?.password;
          if (!email || !password) return null;

          const user = await db.user.findUnique({ where: { email } });
          if (!user || !user.passwordHash) {
            logger.warn("auth.login.unknown_user", { email });
            return null;
          }

          // Account lockout check
          if (user.lockedUntil && user.lockedUntil > new Date()) {
            logger.warn("auth.login.locked", {
              userId: user.id,
              lockedUntil: user.lockedUntil,
            });
            return null;
          }

          if (user.status !== "active") {
            logger.warn("auth.login.disabled", { userId: user.id, status: user.status });
            return null;
          }

          const valid = await verifyPassword(password, user.passwordHash);
          if (!valid) {
            const failedLogins = user.failedLogins + 1;
            const shouldLock = failedLogins >= MAX_FAILED_LOGINS;
            await db.user.update({
              where: { id: user.id },
              data: {
                failedLogins,
                lockedUntil: shouldLock ? new Date(Date.now() + LOCK_DURATION_MS) : null,
              },
            });
            logger.warn("auth.login.bad_password", {
              userId: user.id,
              failedLogins,
              locked: shouldLock,
            });
            return null;
          }

          // Successful login — reset counters + record last login
          await db.user.update({
            where: { id: user.id },
            data: {
              lastLoginAt: new Date(),
              failedLogins: 0,
              lockedUntil: null,
            },
          });

          logger.info("auth.login.success", { userId: user.id, email: user.email });

          return {
            id: user.id,
            email: user.email,
            name: user.name ?? undefined,
            image: user.image ?? undefined,
          };
        },
      }),
    ],
    callbacks: {
      async jwt({ token, user }) {
        // `user` is only present on the very first sign-in call.
        if (user?.id) {
          token.uid = user.id;
          try {
            const { roles, keys } = await getRbac().getPermissions(user.id);
            token.roles = roles;
            token.permissions = keys;
          } catch (err) {
            logger.error("auth.jwt.permissions_failed", {
              userId: user.id,
              error: err instanceof Error ? err.message : String(err),
            });
            token.roles = [];
            token.permissions = [];
          }
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user && token.uid) {
          (session.user as { id?: string }).id = token.uid as string;
          (session.user as { roles?: string[] }).roles =
            (token.roles as string[] | undefined) ?? [];
          (session.user as { permissions?: string[] }).permissions =
            (token.permissions as string[] | undefined) ?? [];
        }
        return session;
      },
    },
    events: {
      async signIn(message) {
        const uid = (message.user as { id?: string }).id;
        if (uid) logger.info("auth.event.signin", { userId: uid });
      },
      async signOut(message) {
        const token = (message as { token?: { uid?: string } }).token;
        if (token?.uid) logger.info("auth.event.signout", { userId: token.uid });
      },
    },
  };
}

// Backwards-compatible singleton export — modules that import `authOptions`
// from `@/auth` continue to work unchanged.
export const authOptions: NextAuthOptions = getAuthOptions();
