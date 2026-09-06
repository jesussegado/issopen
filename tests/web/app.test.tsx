// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/web/App.js";

const ownerSession = {
  user: { id: "owner-1", name: "Owner", email: "owner@example.test" },
  workspace: { id: "workspace-1", name: "My workspace", version: 1 },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  window.history.replaceState({}, "", "/sign-in");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("owner web entry", () => {
  it("renders the private sign-in and clears only the password after invalid credentials", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/v1/session")
        return json({ error: "Authentication required" }, 401);
      if (path === "/api/auth/sign-in/email")
        return json({ error: "Invalid" }, 401);
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Sign in to Issopen" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("This is a private Issopen instance."),
    ).toBeInTheDocument();
    await user.type(
      screen.getByLabelText("Email (required)"),
      "owner@example.test",
    );
    await user.type(
      screen.getByLabelText("Password (required)"),
      "wrong-password",
    );
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't sign you in",
    );
    expect(screen.getByLabelText("Email (required)")).toHaveValue(
      "owner@example.test",
    );
    expect(screen.getByLabelText("Password (required)")).toHaveValue("");
    await waitFor(() =>
      expect(screen.getByLabelText("Password (required)")).toHaveFocus(),
    );
  });

  it("routes an owner without a workspace to the named first-entry form", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ ...ownerSession, workspace: null })),
    );
    window.history.replaceState({}, "", "/");
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Name your workspace" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Workspace name (required)")).toHaveValue(
      "My workspace",
    );
    expect(
      screen.getByRole("button", { name: "Create workspace" }),
    ).toBeEnabled();
  });

  it("shows the authenticated empty state and semantic project form", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/v1/session") return json(ownerSession);
      if (path === "/api/v1/projects") return json({ projects: [] });
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState({}, "", "/");
    const user = userEvent.setup();
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "No projects yet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Create a project to start a private backlog."),
    ).toBeInTheDocument();
    await user.click(
      within(screen.getByRole("main")).getByRole("link", {
        name: "Create project",
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "Create project" }),
    ).toHaveFocus();
    const labels = screen.getAllByText(
      /Project name|Project key|Description|Repository URL|Default branch|Repository subdirectory/,
    );
    expect(labels.length).toBeGreaterThanOrEqual(6);
    expect(
      screen.getByText(
        "Plain reference data only. Issopen does not access or clone the repository.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps protected content out of an anonymous response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ error: "Authentication required" }, 401)),
    );
    window.history.replaceState({}, "", "/projects/private-id");
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Sign in to Issopen" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("private-id")).not.toBeInTheDocument();
  });
});
