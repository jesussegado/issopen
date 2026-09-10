// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ProjectFormRoute } from "../../src/web/routes/TrackerForms.js";

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("creates projects with an automatic internal key even when the name is not Latin", async () => {
  const changed = vi.fn(async () => undefined);
  let internalKey = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      const body = JSON.parse(String(init?.body));
      expect(body.name).toBe("家");
      expect(body.key).toMatch(/^P[A-F0-9]{9}$/);
      expect(body).toMatchObject({
        showReviewColumn: true,
        showDoneColumn: true,
      });
      internalKey = body.key;
      return json({ project: { id: "new-project", ...body } });
    }),
  );
  const user = userEvent.setup();
  render(<ProjectFormRoute onProjectsChanged={changed} />);
  expect(screen.queryByLabelText(/Project key/)).not.toBeInTheDocument();
  await user.type(screen.getByLabelText("Project name (required)"), "家");
  await user.click(screen.getByRole("button", { name: "Create project" }));
  expect(changed).toHaveBeenCalledOnce();
  expect(document.body).not.toHaveTextContent(internalKey);
  expect(window.location.pathname).toBe("/projects/new-project");
});

it("hides existing project keys and never changes them when editing settings", async () => {
  const changed = vi.fn(async () => undefined);
  const project = {
    id: "existing-project",
    name: "Existing",
    key: "STABLE",
    description: "",
    repositoryUrl: null,
    defaultBranch: null,
    repositorySubdirectory: null,
    showReviewColumn: true,
    showDoneColumn: true,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        const body = JSON.parse(String(init.body));
        expect(body.name).toBe("Renamed");
        expect(body).toMatchObject({
          showReviewColumn: false,
          showDoneColumn: false,
        });
        expect(body).not.toHaveProperty("key");
      }
      return json({ project });
    }),
  );
  const user = userEvent.setup();
  render(
    <ProjectFormRoute projectId={project.id} onProjectsChanged={changed} />,
  );
  const name = await screen.findByLabelText("Project name (required)");
  expect(name).toHaveValue("Existing");
  expect(screen.queryByLabelText(/Project key/)).not.toBeInTheDocument();
  expect(document.body).not.toHaveTextContent(project.key);
  const reviewColumn = screen.getByRole("checkbox", {
    name: /Show Ready for Human Review/,
  });
  const doneColumn = screen.getByRole("checkbox", { name: /Show Done/ });
  expect(reviewColumn).toBeChecked();
  expect(doneColumn).toBeChecked();
  await user.click(reviewColumn);
  await user.click(doneColumn);
  await user.clear(name);
  await user.type(name, "Renamed");
  await user.click(screen.getByRole("button", { name: "Save project" }));
  expect(changed).toHaveBeenCalledOnce();
});
