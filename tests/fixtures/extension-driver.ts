import { expect } from "vitest";
import type { createApp } from "../../src/server/app.js";

export type ExtensionTokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

export class ExtensionTestDriver {
  readonly resource: string;
  readonly redirect: string;

  constructor(
    private readonly options: {
      app: ReturnType<typeof createApp>;
      baseUrl: string;
      origin: string;
      ownerCookie: string;
      extensionId: string;
      verifier: string;
      challenge: string;
      state: string;
    },
  ) {
    this.resource = `${options.baseUrl}/api/extension/v1`;
    this.redirect = `https://${options.extensionId}.chromiumapp.org/oauth`;
  }

  headers(sessionCookie = this.options.ownerCookie) {
    return {
      Cookie: sessionCookie,
      Origin: this.options.baseUrl,
      "Content-Type": "application/json",
    };
  }

  async link(sessionCookie = this.options.ownerCookie, workspaceId?: string) {
    const installationId = crypto.randomUUID();
    const response = await this.options.app.request("/api/v1/extensions/link", {
      method: "POST",
      headers: {
        ...this.headers(sessionCookie),
        ...(workspaceId ? { "X-Issopen-Workspace": workspaceId } : {}),
      },
      body: JSON.stringify({
        installationId,
        extensionId: this.options.extensionId,
        name: "Test Chrome",
        challenge: this.options.challenge,
        state: this.options.state,
      }),
    });
    expect(response.status).toBe(200);
    return {
      clientId: `issopen-chrome-${installationId}`,
      authorizeUrl: ((await response.json()) as { authorizeUrl: string })
        .authorizeUrl,
    };
  }

  async grant(
    accept = true,
    write = false,
    sessionCookie = this.options.ownerCookie,
    workspaceId?: string,
  ) {
    const linked = await this.link(sessionCookie, workspaceId);
    const authorization = await this.options.app.request(linked.authorizeUrl, {
      headers: { Cookie: sessionCookie },
    });
    expect(authorization.status).toBe(302);
    const consentUrl = new URL(
      authorization.headers.get("location") ?? "",
      this.options.baseUrl,
    );
    expect(consentUrl.pathname).toBe("/consent");
    const response = await this.options.app.request(
      "/api/auth/oauth2/consent",
      {
        method: "POST",
        headers: this.headers(sessionCookie),
        body: JSON.stringify({
          accept,
          scope: write
            ? "extension:read extension:write offline_access"
            : "extension:read offline_access",
          oauth_query: consentUrl.search.slice(1),
        }),
      },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      url?: string;
      redirect_uri?: string;
    };
    const callback = new URL(body.url ?? body.redirect_uri ?? "");
    expect(callback.origin + callback.pathname).toBe(this.redirect);
    expect(callback.searchParams.get("state")).toBe(this.options.state);
    return { ...linked, callback };
  }

  token(params: Record<string, string>) {
    return this.options.app.request("/api/auth/oauth2/token", {
      method: "POST",
      headers: {
        Origin: this.options.origin,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ ...params, resource: this.resource }),
    });
  }

  async connect(
    write = false,
    sessionCookie = this.options.ownerCookie,
    workspaceId?: string,
  ) {
    const grant = await this.grant(true, write, sessionCookie, workspaceId);
    const response = await this.token({
      grant_type: "authorization_code",
      client_id: grant.clientId,
      redirect_uri: this.redirect,
      code: grant.callback.searchParams.get("code") ?? "",
      code_verifier: this.options.verifier,
    });
    expect(response.status).toBe(200);
    return {
      clientId: grant.clientId,
      tokens: (await response.json()) as ExtensionTokens,
    };
  }

  readSession(tokens: ExtensionTokens) {
    return this.options.app.request("/api/extension/v1/session", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        Origin: this.options.origin,
      },
    });
  }
}
