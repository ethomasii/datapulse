import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentDbUser, type UserWithSubscription } from "@/lib/auth/server";
import { getUserFromWorkspaceApiKey } from "@/lib/auth/workspace-api-key";

export const API_SCOPES = {
  PIPELINES_READ: "pipelines:read",
  PIPELINES_WRITE: "pipelines:write",
  RUNS_READ: "runs:read",
  RUNS_WRITE: "runs:write",
  CONNECTIONS_READ: "connections:read",
  CONNECTIONS_WRITE: "connections:write",
} as const;

export type ApiScope = (typeof API_SCOPES)[keyof typeof API_SCOPES];

export type ApiAuthContext = {
  user: UserWithSubscription;
  via: "session" | "api_key";
  scopes: string[];
  keyId?: string;
};

export function hasScope(ctx: ApiAuthContext, scope: ApiScope): boolean {
  if (ctx.via === "session") return true;
  return ctx.scopes.includes(scope);
}

export function scopeForbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "Insufficient API key scope" }, { status: 403 });
}

async function resolveFromAuthHeader(authHeader: string | null): Promise<ApiAuthContext | null> {
  const apiAuth = await getUserFromWorkspaceApiKey(authHeader);
  if (apiAuth) {
    return {
      user: apiAuth.user,
      via: "api_key",
      scopes: apiAuth.scopes,
      keyId: apiAuth.keyId,
    };
  }
  const user = await getCurrentDbUser();
  if (user) {
    return { user, via: "session", scopes: Object.values(API_SCOPES) };
  }
  return null;
}

/** Resolve user from a Request (preferred for route handlers). */
export async function resolveApiUser(req: Request): Promise<ApiAuthContext | null> {
  return resolveFromAuthHeader(req.headers.get("authorization"));
}

/** Resolve user from Next headers() when no Request is available. */
export async function resolveApiUserFromHeaders(): Promise<ApiAuthContext | null> {
  const headerStore = await headers();
  return resolveFromAuthHeader(headerStore.get("authorization"));
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
