// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ConnectRoute,
  ConsentRoute,
} from "../../src/web/routes/ConnectRoute.js";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("MCP connection UI", () => {
  it("shows a copyable server-owned MCP URL and four explicit steps", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ resource: "https://issues.example.test/mcp" })),
    );
    render(<ConnectRoute />);

    expect(
      await screen.findByRole("heading", {
        name: "Connect ChatGPT to Issopen",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("MCP URL")).toHaveValue(
      "https://issues.example.test/mcp",
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByText(/choose OAuth, then click/)).toBeInTheDocument();
    expect(screen.getByText(/not an incorrect password/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Full agent connection guide" }),
    ).toHaveAttribute("href", "/agent-onboarding");
    await user.click(screen.getByRole("button", { name: "Copy MCP URL" }));
    expect(writeText).toHaveBeenCalledWith("https://issues.example.test/mcp");
    expect(screen.getByRole("status")).toHaveTextContent("MCP URL copied");
  });

  it("renders consent data as text and forwards the signed OAuth query", async () => {
    const signedQuery =
      "client_id=chatgpt-work&scope=issues%3Aread+issues%3Awrite+offline_access&sig=synthetic-signature";
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).startsWith("/api/auth/oauth2/public-client")) {
          return json({ name: "<img src=x onerror=alert(1)>" });
        }
        if (String(input).startsWith("/api/v1/oauth/workspace"))
          return json({ workspace: { name: "Private workspace" } });
        expect(String(input)).toBe("/api/auth/oauth2/consent");
        expect(JSON.parse(String(init?.body))).toEqual({
          accept: false,
          scope: "issues:read issues:write offline_access",
          oauth_query: signedQuery,
        });
        return json({});
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(
      <ConsentRoute
        search={`?${signedQuery}`}
        workspaceName="Private workspace"
      />,
    );

    expect(
      await screen.findByRole("heading", {
        name: "<img src=x onerror=alert(1)> wants to access Issopen",
      }),
    ).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText("Private workspace")).toBeInTheDocument();
    expect(screen.getByText("Read issues")).toBeInTheDocument();
    expect(screen.getByText("Edit issue fields")).toBeInTheDocument();
    expect(
      screen.getByText("Stay connected and refresh access until revoked"),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("synthetic-signature");
    await user.click(screen.getByRole("button", { name: "Deny access" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  });
});
