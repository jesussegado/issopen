import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { mcp } from "@better-auth/mcp";
import type { BetterAuthPlugin } from "better-auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins";
import type { AppConfig } from "./config.js";
import type { Database } from "./db/client.js";
import * as schema from "./db/schema.js";
import { agentScopeValues } from "./db/schema.js";

export function createAuth(db: Database, config: AppConfig) {
  const oauthScopes = [...agentScopeValues, "offline_access"];
  const oauthMcp = mcp({
    loginPage: "/sign-in",
    consentPage: "/consent",
    resource: new URL("/mcp", config.baseUrl).toString(),
    scopes: oauthScopes,
    clientRegistrationDefaultScopes: ["issues:read"],
    clientRegistrationAllowedScopes: oauthScopes,
    clientRegistrationRequirePKCE: true,
    codeExpiresIn: 300,
  }) as unknown as BetterAuthPlugin;

  return betterAuth({
    appName: "Issopen",
    baseURL: config.baseUrl.origin,
    basePath: "/api/auth",
    secret: config.authSecret,
    trustedOrigins: config.trustedOrigins,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
    },
    disabledPaths: ["/sign-up/email"],
    plugins: [
      jwt(),
      // @better-auth/mcp 1.7.2's published OpenAPI declaration is narrower
      // than Better Auth's plugin slot; the runtime packages are version-aligned.
      oauthMcp,
      cimd({
        fetchClientMetadataResource,
        metadataProfile: "mcp-2026-07-28",
      }),
    ],
    advanced: {
      cookiePrefix: "issopen",
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: config.secureCookies,
        path: "/",
      },
    },
  });
}

export type IssopenAuth = ReturnType<typeof createAuth>;
export type OwnerSession = NonNullable<
  Awaited<ReturnType<IssopenAuth["api"]["getSession"]>>
>;
