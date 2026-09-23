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
  workspace: {
    id: "workspace-1",
    name: "My workspace",
    version: 1,
    role: "owner" as const,
  },
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
  it.each([
    ["/chrome", "Issopen para Chrome"],
    ["/support", "Ayuda para la extensión de Chrome"],
  ])(
    "publishes %s without reading a private session",
    async (path, heading) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      window.history.replaceState({}, "", path);
      render(<App />);

      expect(
        await screen.findByRole("heading", { name: heading }),
      ).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("publishes the privacy inventory without reading a private session", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState({}, "", "/privacy");
    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "Privacidad y datos de Issopen",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Limited Use/)).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: "serviciosegado@gmail.com" }),
    ).toHaveAttribute("href", "mailto:serviciosegado@gmail.com");
    expect(screen.getByText(/máximo de 24 horas/)).toBeInTheDocument();
    expect(screen.getByText(/Versión 1.2/)).toBeInTheDocument();
    expect(
      screen.getByRole("rowheader", { name: "Invitaciones por correo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Google Gmail como proveedor SMTP/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/revocar el enlace no borra esos mensajes/),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("discovers Google sign-in without exposing configuration", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/v1/session")
        return json({ error: "Authentication required" }, 401);
      if (path === "/api/public/auth-providers") return json({ google: true });
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    expect(
      await screen.findByRole("button", { name: "Continue with Google" }),
    ).toBeEnabled();
    expect(
      screen.getByText("Use the Google account from your Issopen invitation."),
    ).toBeInTheDocument();
  });

  it("explains a cancelled Google sign-in and keeps password access", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === "/api/v1/session")
          return json({ error: "Authentication required" }, 401);
        if (String(input) === "/api/public/auth-providers")
          return json({ google: true });
        throw new Error(`Unexpected request: ${String(input)}`);
      }),
    );
    window.history.replaceState({}, "", "/sign-in?error=access_denied");
    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Google sign-in was cancelled",
    );
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("directs an unlinked Google account back to its resumable invitation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === "/api/v1/session")
          return json({ error: "Authentication required" }, 401);
        if (String(input) === "/api/public/auth-providers")
          return json({ google: true });
        throw new Error(`Unexpected request: ${String(input)}`);
      }),
    );
    window.history.replaceState({}, "", "/sign-in?error=account_not_linked");
    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Open its private invitation link and choose Resume verification",
    );
  });

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
    expect(screen.getByLabelText("Password (required)")).toHaveAttribute(
      "aria-describedby",
      "sign-in-error",
    );
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
      /Project name|Description|Repository URL|Default branch|Repository subdirectory/,
    );
    expect(labels.length).toBeGreaterThanOrEqual(5);
    expect(screen.queryByLabelText(/Project key/)).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Plain reference data only. Issopen does not access or clone the repository.",
      ),
    ).toBeInTheDocument();
  });

  it("shows a member role without owner-only navigation or project creation", async () => {
    const memberSession = {
      ...ownerSession,
      user: {
        id: "member-1",
        name: "Member",
        email: "member@example.test",
      },
      workspace: { ...ownerSession.workspace, role: "member" as const },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = String(input);
        if (path === "/api/v1/session") return json(memberSession);
        if (path === "/api/v1/projects") return json({ projects: [] });
        throw new Error(`Unexpected request: ${path}`);
      }),
    );
    window.history.replaceState({}, "", "/");
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "No projects yet" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No projects assigned")).toBeInTheDocument();
    expect(screen.getAllByText("Member").length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("link", { name: "Create project" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Agents" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Connect ChatGPT" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Members" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Extensiones Chrome" }).length,
    ).toBeGreaterThan(0);
  });

  it("signs out with the JSON request required by Better Auth", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/v1/session") return json(ownerSession);
      if (path === "/api/v1/projects") return json({ projects: [] });
      if (path === "/api/auth/sign-out") return json({});
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState({}, "", "/");
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: "No projects yet" });
    await user.click(screen.getByText("Owner", { selector: "summary" }));
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/sign-out",
        expect.objectContaining({
          method: "POST",
          body: "{}",
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
  });

  it("lets the owner create project-scoped invitations and manage members", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = String(input);
        if (path === "/api/v1/session") return json(ownerSession);
        if (path === "/api/v1/projects")
          return json({
            projects: [
              {
                id: "project-1",
                workspaceId: "workspace-1",
                name: "Issopen",
                key: "ISSOPEN",
                description: "",
                repositoryUrl: null,
                defaultBranch: null,
                repositorySubdirectory: null,
                showReviewColumn: true,
                showDoneColumn: true,
                version: 1,
                createdAt: "2026-09-13T10:00:00.000Z",
                updatedAt: "2026-09-13T10:00:00.000Z",
              },
            ],
          });
        if (path === "/api/v1/members")
          return json({
            invitations: [],
            members: [
              {
                userId: "owner-1",
                name: "Owner",
                email: "owner@example.test",
                role: "owner",
                projectIds: null,
                createdAt: "2026-09-13T10:00:00.000Z",
              },
            ],
          });
        throw new Error(`Unexpected request: ${path}`);
      }),
    );
    window.history.replaceState({}, "", "/members");
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Members and invitations" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Google account email (required)"),
    ).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: /Issopen/ })).toBeEnabled();
    expect(await screen.findByText("owner@example.test")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Members" }).length,
    ).toBeGreaterThan(0);
  });

  it("redeems a private invitation before asking for explicit Google verification", async () => {
    let sessionReads = 0;
    const provisionalSession = {
      user: {
        id: "invited-1",
        name: "Invited",
        email: "member@example.test",
      },
      workspace: null,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = String(input);
        if (path === "/api/v1/session") {
          sessionReads += 1;
          return sessionReads === 1
            ? json({ error: "Authentication required" }, 401)
            : json(provisionalSession);
        }
        if (path.startsWith("/api/public/invitations/"))
          return json({
            invitation: {
              id: "11111111-1111-4111-8111-111111111111",
              workspaceName: "My workspace",
              email: "me****@example.test",
              state: "pending",
              expiresAt: "2026-09-20T10:00:00.000Z",
            },
          });
        if (path === "/api/auth/invitations/redeem")
          return json({
            invitationId: "11111111-1111-4111-8111-111111111111",
            requiresGoogleVerification: true,
          });
        if (path === "/api/public/auth-providers")
          return json({ google: true });
        throw new Error(`Unexpected request: ${path}`);
      }),
    );
    window.history.replaceState(
      {},
      "",
      "/invite/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ",
    );
    const user = userEvent.setup();
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Join My workspace" }),
    ).toBeInTheDocument();
    expect(screen.getByText("me****@example.test")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue securely" }));
    expect(
      await screen.findByRole("heading", {
        name: "Verify your Google account",
      }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Verify with Google" }),
      ).toBeEnabled(),
    );
    expect(window.location.pathname).toBe(
      "/invitations/11111111-1111-4111-8111-111111111111/link",
    );
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
