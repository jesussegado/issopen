import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  protect: vi.fn(),
  launch: vi.fn(),
}));
vi.mock("wxt/browser", () => ({
  browser: {
    runtime: { id: "abcdefghijklmnopabcdefghijklmnop" },
    storage: {
      local: {
        get: mocks.get,
        set: mocks.set,
        remove: mocks.remove,
        setAccessLevel: mocks.protect,
      },
    },
    identity: {
      getRedirectURL: () =>
        "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/oauth",
      launchWebAuthFlow: mocks.launch,
    },
  },
}));

import {
  accountResponseSchema,
  handleAccount,
  parseCallback,
  pkceChallenge,
  randomProof,
} from "../../lib/account";

const redirect =
  "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/oauth";
beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  mocks.get.mockResolvedValue({});
  mocks.protect.mockResolvedValue(undefined);
});
describe("extension account boundary", () => {
  it("uses S256 and high-entropy URL-safe state/verifier", async () => {
    const a = randomProof();
    expect(a).toMatch(/^[a-zA-Z0-9_-]{43}$/);
    expect(a).not.toBe(randomProof());
    expect(
      await pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    ).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
  it("requires the exact callback, one matching state and exactly one code", () => {
    expect(
      parseCallback(
        `${redirect}?state=expected&code=synthetic`,
        redirect,
        "expected",
      ),
    ).toBe("synthetic");
    for (const callback of [
      "https://attacker.test/oauth?state=expected&code=x",
      `${redirect}/other?state=expected&code=x`,
      `${redirect}?state=wrong&code=x`,
      `${redirect}?code=x`,
      `${redirect}?state=expected&code=x&state=expected`,
      `${redirect}?state=expected&code=x&code=y`,
      `${redirect}?state=expected&error=access_denied`,
      `${redirect}?state=expected&code=x#secret`,
    ])
      expect(() => parseCallback(callback, redirect, "expected")).toThrow();
  });
  it("returns no credentials to the panel and restricts persistent storage before reading", async () => {
    expect(await handleAccount("account-status")).toEqual({
      ok: true,
      connected: false,
    });
    expect(mocks.protect).toHaveBeenCalledWith({
      accessLevel: "TRUSTED_CONTEXTS",
    });
    expect(
      accountResponseSchema.safeParse({
        ok: true,
        connected: false,
        accessToken: "synthetic",
      }).success,
    ).toBe(false);
  });
  it("never stores a cancelled or forged callback and does not disclose raw errors", async () => {
    mocks.launch.mockRejectedValue(new Error("SECRET-PROVIDER-URL"));
    const result = await handleAccount("account-connect");
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("SECRET-PROVIDER-URL");
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it("drops absolutely expired credentials without a network request", async () => {
    mocks.get.mockResolvedValue({
      "issopen-account-v1": {
        clientId: "synthetic",
        accessToken: "synthetic",
        refreshToken: "synthetic",
        accessExpiresAt: Date.now() + 300000,
        expiresAt: Date.now() - 1,
      },
    });
    const fetch = vi.spyOn(globalThis, "fetch");
    expect(await handleAccount("account-status")).toEqual({
      ok: true,
      connected: false,
    });
    expect(mocks.remove).toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
