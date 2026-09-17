// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentsRoute } from "../../src/web/routes/AgentsRoute.js";

const project = {
  id: "11111111-1111-4111-8111-111111111111",
  workspaceId: "22222222-2222-4222-8222-222222222222",
  name: "Issopen",
  key: "ISS",
  description: "",
  repositoryUrl: null,
  defaultBranch: null,
  repositorySubdirectory: null,
  showReviewColumn: true,
  showDoneColumn: true,
  version: 1,
  createdAt: "2026-08-31T12:00:00.000Z",
  updatedAt: "2026-08-31T12:00:00.000Z",
};

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("agent management", () => {
  it("defaults to review-ready scopes, reveals the token once and uses a safe revoke confirmation", async () => {
    const token = `issopen_pat_${"a".repeat(43)}`;
    const agent = {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Codex",
      description: "Dogfood",
      projects: [{ id: project.id, name: project.name, key: project.key }],
      projectIds: [project.id],
      scopes: [
        "issues:read",
        "issues:create",
        "questions:write",
        "comments:write",
        "issues:claim",
        "issues:write",
        "code:link",
        "issues:review",
      ],
      credential: {
        id: "credential-1",
        fingerprint: "abcdef0123456789",
        expiresAt: null,
        revokedAt: null,
        lastUsedAt: null,
        createdAt: project.createdAt,
      },
      access: {
        kind: "pat",
        expiresAt: null,
        revokedAt: null,
        lastUsedAt: null,
      },
      createdAt: project.createdAt,
    };
    let created = false;
    let edited = false;
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (String(_input) === "/api/v1/mcp/config")
          return json({ resource: "https://issues.example.test/mcp" });
        if (String(_input) === "/downloads/issopen-skill-manifest.json")
          return json({
            schemaVersion: 1,
            name: "issopen",
            version: "0.2.0",
            archive: "/downloads/issopen-skill-0.2.0.zip",
            sha256: "b".repeat(64),
            files: 17,
            installDirectory: "~/.agents/skills/issopen",
            entrypoint: "SKILL.md",
          });
        if (init?.method === "POST" && String(_input) === "/api/v1/agents") {
          created = true;
          const submitted = JSON.parse(String(init.body));
          expect(submitted.scopes).toContain("issues:create");
          expect(submitted.scopes).toContain("questions:write");
          expect(submitted.scopes).toContain("comments:write");
          expect(submitted.scopes).not.toContain("issues:close");
          expect(submitted.scopes).not.toContain("epics:create");
          expect(submitted.scopes).not.toContain("epics:write");
          return json({ agent, token });
        }
        if (init?.method === "PATCH" && String(_input).endsWith("/access")) {
          const submitted = JSON.parse(String(init.body));
          expect(submitted.projectIds).toEqual([project.id]);
          expect(submitted.scopes).not.toContain("issues:create");
          expect(submitted.scopes).toContain("issues:read");
          edited = true;
          return json({
            agent: {
              ...agent,
              scopes: submitted.scopes,
            },
          });
        }
        if (String(_input).endsWith("/revoke"))
          return json({
            credential: {
              ...agent.credential,
              revokedAt: new Date().toISOString(),
            },
          });
        return json({
          agents: created
            ? [
                edited
                  ? {
                      ...agent,
                      scopes: agent.scopes.filter(
                        (scope) => scope !== "issues:create",
                      ),
                    }
                  : agent,
              ]
            : [],
        });
      }),
    );

    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<AgentsRoute projects={[project]} />);
    expect(await screen.findByText("No agents yet")).toBeInTheDocument();
    const submit = screen
      .getAllByRole("button", { name: "Create agent" })
      .at(-1);
    if (!submit) throw new Error("Expected create agent submit button");
    await user.click(submit);
    expect(
      screen.getByRole("checkbox", { name: /Close issues/ }),
    ).not.toBeChecked();
    await user.type(screen.getByLabelText("Name (required)"), "Codex");
    await user.click(screen.getByLabelText("Issopen"));
    const create = screen
      .getAllByRole("button", { name: "Create agent" })
      .at(-1);
    if (!create) throw new Error("Expected create agent submit button");
    await user.click(create);
    expect(
      await screen.findByText(
        "Copy this token now. You won't be able to see it again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Personal access token")).toHaveValue(token);
    await user.click(
      screen.getByRole("button", { name: "Finish agent setup" }),
    );
    expect(screen.queryByText(token)).not.toBeInTheDocument();
    expect(screen.getByText("PAT")).toBeInTheDocument();
    expect(screen.getByText("Never")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Setup guide" }));
    expect(
      await screen.findByRole("heading", { name: "Onboard Codex" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Allowed projects: Issopen/)).toBeInTheDocument();
    expect(screen.getByText(/Skill release: 0.2.0/)).toBeInTheDocument();
    expect(screen.getByText(/get_agent_context/)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(token);
    await user.click(
      screen.getByRole("button", { name: "Copy full onboarding" }),
    );
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("https://issues.example.test/mcp"),
    );
    expect(writeText.mock.calls.at(-1)?.[0]).not.toContain(token);
    await user.click(screen.getByRole("button", { name: "Close guide" }));
    await user.click(screen.getByRole("button", { name: "Edit permissions" }));
    expect(
      screen.getByText(/Permissions can only be reduced/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Create issues" }));
    await user.click(
      screen.getByRole("button", { name: "Save reduced access" }),
    );
    expect(edited).toBe(true);
    await user.click(screen.getByRole("button", { name: "Revoke access" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "will lose access immediately",
    );
    expect(
      screen.getByRole("button", { name: "Keep agent access" }),
    ).toBeInTheDocument();
  });
});
