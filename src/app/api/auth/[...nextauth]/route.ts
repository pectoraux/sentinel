/**
 * Sentinel — NextAuth App-Router route handler.
 * Mounts the standard NextAuth v4 GET/POST handlers using the centralized
 * auth options defined in `src/lib/auth.ts`.
 */

import NextAuth from "next-auth";
import { getAuthOptions } from "@/lib/auth";

const handler = NextAuth(getAuthOptions());

export { handler as GET, handler as POST };
