import { browser } from "wxt/browser";
import { z } from "zod";
import { extensionResource, instanceUrl } from "./instance";

export const accountRequestSchema = z
  .object({
    version: z.literal(1),
    type: z.enum(["account-status", "account-connect", "account-disconnect"]),
  })
  .strict();
export const accountResponseSchema = z.union([
  z.object({ ok: z.literal(true), connected: z.literal(false) }).strict(),
  z
    .object({
      ok: z.literal(true),
      connected: z.literal(true),
      name: z.string().max(120),
      expiresAt: z.iso.datetime(),
      projects: z.array(z.object({ id: z.uuid(), name: z.string().max(120) })),
    })
    .strict(),
  z.object({ ok: z.literal(false), message: z.string().max(240) }).strict(),
]);
export type AccountResponse = z.infer<typeof accountResponseSchema>;
const credentialSchema = z
  .object({
    clientId: z.string(),
    accessToken: z.string(),
    refreshToken: z.string(),
    accessExpiresAt: z.number(),
    expiresAt: z.number(),
  })
  .strict();
type Credential = z.infer<typeof credentialSchema>;
const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  token_type: z.literal("Bearer"),
  expires_in: z.number().positive().max(3600),
});
const sessionSchema = z.object({
  name: z.string().max(120),
  expiresAt: z.iso.datetime(),
});
const projectsSchema = z.object({
  projects: z.array(z.object({ id: z.uuid(), name: z.string().max(120) })),
});
const storageKey = "issopen-account-v1";
let operation: Promise<AccountResponse> | null = null;

export function randomProof() {
  return btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
  )
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
export async function pkceChallenge(verifier: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
export function parseCallback(
  callback: string,
  redirect: string,
  state: string,
) {
  const url = new URL(callback);
  if (
    url.origin + url.pathname !== redirect ||
    url.hash ||
    url.searchParams.getAll("state").length !== 1 ||
    url.searchParams.get("state") !== state ||
    url.searchParams.has("error") ||
    url.searchParams.getAll("code").length !== 1
  )
    throw new Error("Invalid OAuth callback");
  const code = url.searchParams.get("code");
  if (!code || code.length > 2048) throw new Error("Invalid OAuth code");
  return code;
}
async function protectStorage() {
  await browser.storage.local.setAccessLevel({
    accessLevel: "TRUSTED_CONTEXTS",
  });
}
async function readCredential() {
  await protectStorage();
  return credentialSchema.safeParse(
    (await browser.storage.local.get(storageKey))[storageKey],
  ).data;
}
async function storeCredential(value: Credential) {
  await protectStorage();
  await browser.storage.local.set({ [storageKey]: value });
}
async function tokenRequest(params: Record<string, string>) {
  const response = await fetch(`${instanceUrl}/api/auth/oauth2/token`, {
    method: "POST",
    credentials: "omit",
    redirect: "error",
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...params, resource: extensionResource }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Token request failed");
  return tokenSchema.parse(await response.json());
}
async function usableCredential() {
  let value = await readCredential();
  if (!value) return null;
  if (value.expiresAt <= Date.now()) {
    await browser.storage.local.remove(storageKey);
    return null;
  }
  if (value.accessExpiresAt <= Date.now() + 30000) {
    const tokens = await tokenRequest({
      grant_type: "refresh_token",
      client_id: value.clientId,
      refresh_token: value.refreshToken,
    });
    value = {
      ...value,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessExpiresAt: Date.now() + tokens.expires_in * 1000,
    };
    await storeCredential(value);
  }
  return value;
}
async function authorizedFetch(
  path: string,
  value: Credential,
  method = "GET",
) {
  const response = await fetch(`${extensionResource}${path}`, {
    method,
    credentials: "omit",
    redirect: "error",
    cache: "no-store",
    headers: { Authorization: `Bearer ${value.accessToken}` },
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 401) {
    await browser.storage.local.remove(storageKey);
    throw new Error("Connection revoked");
  }
  if (!response.ok) throw new Error("Request failed");
  return response;
}
async function status(): Promise<AccountResponse> {
  const value = await usableCredential();
  if (!value) return { ok: true, connected: false };
  const account = sessionSchema.parse(
    await (await authorizedFetch("/session", value)).json(),
  );
  const { projects } = projectsSchema.parse(
    await (await authorizedFetch("/projects", value)).json(),
  );
  return { ok: true, connected: true, ...account, projects };
}
async function connect(): Promise<AccountResponse> {
  // A fresh public client identifies this installation; no reusable client secret.
  const installationId = crypto.randomUUID();
  const state = randomProof();
  const verifier = randomProof();
  const redirect = browser.identity.getRedirectURL("oauth");
  const url = new URL("/extensions/link", instanceUrl);
  url.search = new URLSearchParams({
    installationId,
    extensionId: browser.runtime.id,
    state,
    challenge: await pkceChallenge(verifier),
  }).toString();
  const callback = await browser.identity.launchWebAuthFlow({
    url: url.toString(),
    interactive: true,
  });
  if (!callback) throw new Error("Connection cancelled");
  const code = parseCallback(callback, redirect, state);
  const clientId = `issopen-chrome-${installationId}`;
  const tokens = await tokenRequest({
    grant_type: "authorization_code",
    client_id: clientId,
    redirect_uri: redirect,
    code,
    code_verifier: verifier,
  });
  await storeCredential({
    clientId,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    accessExpiresAt: Date.now() + tokens.expires_in * 1000,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  });
  return status();
}
async function disconnect(): Promise<AccountResponse> {
  const value = await usableCredential();
  if (value) await authorizedFetch("/disconnect", value, "POST");
  await browser.storage.local.remove(storageKey);
  return { ok: true, connected: false };
}
export async function handleAccount(
  type: z.infer<typeof accountRequestSchema>["type"],
): Promise<AccountResponse> {
  if (operation)
    return {
      ok: false,
      message:
        "Hay una conexión en curso. Termina o cierra la ventana de acceso antes de continuar.",
    };
  operation = (async () => {
    try {
      return await (type === "account-connect"
        ? connect()
        : type === "account-disconnect"
          ? disconnect()
          : status());
    } catch {
      return {
        ok: false,
        message:
          "No se pudo completar la conexión. Si cerraste el acceso, puedes volver a conectar. Si ha caducado o se revocó, vincula Issopen de nuevo.",
      } as AccountResponse;
    }
  })();
  try {
    return await operation;
  } finally {
    operation = null;
  }
}
