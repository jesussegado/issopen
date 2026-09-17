// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { oauthSignInQuery } from "../../src/web/lib/oauth-sign-in.js";
import { SignInRoute } from "../../src/web/routes/PublicRoutes.js";

const query =
  "client_id=fixture&scope=issues%3Aread&ba_param=client_id&ba_param=scope&sig=synthetic";
const json = (body: unknown) => Response.json(body);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("forwards signed fields without adding Google error parameters or trusting unsigned queries", () => {
  expect(
    oauthSignInQuery(
      `?${query}&error=access_denied&returnTo=https://evil.test`,
    ),
  ).toBe(query);
  expect(
    oauthSignInQuery("?client_id=fixture&redirect_uri=https://evil.test"),
  ).toBeUndefined();
});

it("continues password OAuth sign-in to the server's consent page, not the board", async () => {
  window.history.replaceState({}, "", `/sign-in?${query}`);
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/public/auth-providers")
        return json({ google: true });
      if (String(input) === "/api/auth/sign-in/email") {
        expect(JSON.parse(String(init?.body)).oauth_query).toBe(query);
        return json({
          url: `${window.location.origin}/consent?${query}`,
          redirect: true,
        });
      }
      return json({ user: { id: "owner" }, workspace: { id: "space" } });
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  const signedIn = vi.fn();
  const user = userEvent.setup();
  render(<SignInRoute onSignedIn={signedIn} />);
  await user.type(screen.getByLabelText(/Email/), "owner@example.test");
  await user.type(screen.getByLabelText(/Password/), "synthetic-password-only");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  await waitFor(() => expect(window.location.pathname).toBe("/consent"));
  expect(signedIn).toHaveBeenCalledTimes(1);
});

it("carries the signed OAuth context and retry URL into Google sign-in", async () => {
  window.history.replaceState({}, "", `/sign-in?${query}`);
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/public/auth-providers")
        return json({ google: true });
      expect(String(input)).toBe("/api/auth/sign-in/social");
      expect(JSON.parse(String(init?.body))).toMatchObject({
        provider: "google",
        oauth_query: query,
        errorCallbackURL: `/sign-in?${query}`,
      });
      return new Response(null, { status: 503 });
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  render(<SignInRoute onSignedIn={vi.fn()} />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Continue with Google" }),
  );
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
});
