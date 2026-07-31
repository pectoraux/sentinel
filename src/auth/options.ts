/**
 * Sentinel — Authentication architecture (NextAuth.js v4)
 * =============================================================================
 * - Session strategy: JWT (stateless, horizontally scalable). Database strategy
 *   available for revocable sessions via AUTH_SESSION_STRATEGY.
 * - Credentials provider (email/password) for the foundation milestone. OAuth
 *   providers (Google, GitHub, Azure AD) are wired conditionally from config.
 * - The JWT callback injects role + permission keys into the token so the
 *   server can authorize without a DB hit on every request.
 * - Password hashing uses bcryptjs. In production, rotate NEXTAUTH_SECRET.
 * =============================================================================
 */

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import AzureADProvider from "next-auth/providers/azure-ad";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { config } from "@/config";
import { logger } from "@/infrastructure/observability/logger";
import { getRbac } from "@/modules/iam/infrastructure/rbac";

async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

function buildOAuthProviders(): NonNullable<NextAuthOptions["providers"]> {
  const providers: NonNullable<NextAuthOptions["providers"]> = [];
  if (config.AUTH_PROVIDERS.includes("google") && config.GOOGLE_CLIENT_ID) {
    providers.push(
      GoogleProvider({
        clientId: config.GOOGLE_CLIENT_ID!,
        clientSecret: config.GOOGLE_CLIENT_SECRET!,
      }),
    );
  }
  if (config.AUTH_PROVIDERS.includes("github") && config.GITHUB_CLIENT_ID) {
    providers.push(
      GitHubProvider({
        clientId: config.GITHUB_CLIENT_ID!,
        clientSecret: config.GITHUB_CLIENT_SECRET!,
      }),
    );
  }
  if (config.AUTH_PROVIDERS.includes("azure-ad") && config.AZURE_AD_CLIENT_ID) {
    providers.push(
      AzureADProvider({
        clientId: config.AZURE_AD_CLIENT_ID!,
        clientSecret: config.AZURE_AD_CLIENT_SECRET!,
        tenantId: config.AZURE_AD_TENANT_ID,
      }),
    );
  }
  return providers;
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: config.AUTH_SESSION_STRATEGY as "jwt" | "database",
    maxAge: config.AUTH_SESSION_MAX_AGE_SECONDS,
  },
  secret: config.NEXTAUTH_SECRET,
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  providers: [
    CredentialsProvider({
      name: "Sentinel",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });
        if (!user || !user.passwordHash) return null;
        if (user.status !== "active") {
          logger.warn("auth.login.blocked", { userId: user.id, status: user.status });
          return null;
        }
        const valid = await verifyPassword(credentials.password, user.passwordHash);
        if (!valid) return null;
        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date(), failedLogins: 0 },
        });
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          image: user.image ?? undefined,
        };
      },
    }),
    ...buildOAuthProviders(),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.uid = user.id;
        const { roles, keys } = await getRbac().getPermissions(user.id);
        token.roles = roles;
        token.permissions = keys;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        (session.user as { id?: string }).id = token.uid as string;
        (session.user as { roles?: string[] }).roles = token.roles as string[];
        (session.user as { permissions?: string[] }).permissions =
          token.permissions as string[];
      }
      return session;
    },
  },
  events: {
    async signIn(message) {
      logger.info("auth.signin", { userId: (message.user as { id?: string }).id });
    },
    async signOut(message) {
      logger.info("auth.signout", {
        token: (message as { token?: { uid?: string } }).token?.uid,
      });
    },
  },
};

export { hashPassword, verifyPassword };
