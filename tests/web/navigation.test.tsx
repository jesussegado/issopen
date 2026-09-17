// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { AuthenticatedShell } from "../../src/web/components/Shell.js";

afterEach(cleanup);
const session = {
  user: { id: "person", name: "Person", email: "person@example.test" },
  workspace: {
    id: "workspace",
    name: "Workspace",
    version: 1,
    role: "member" as const,
  },
};
const shell = (pathname: string, userId = "person") => (
  <AuthenticatedShell
    session={{ ...session, user: { ...session.user, id: userId } }}
    projects={[]}
    pathname={pathname}
    onSignedOut={() => {}}
  >
    <h1>Page</h1>
  </AuthenticatedShell>
);

it("shows Owner provisioning only to the instance administrator", () => {
  const ownerSession = {
    ...session,
    platformAdmin: true,
    workspace: { ...session.workspace, role: "owner" as const },
  };
  const view = render(
    <AuthenticatedShell
      session={ownerSession}
      projects={[]}
      pathname="/"
      onSignedOut={() => {}}
    >
      <h1>Page</h1>
    </AuthenticatedShell>,
  );
  expect(
    screen.getAllByRole("link", { name: "Owner workspaces" }),
  ).not.toHaveLength(0);
  view.rerender(shell("/"));
  expect(
    screen.queryByRole("link", { name: "Owner workspaces" }),
  ).not.toBeInTheDocument();
});

it("collapses and restores the desktop sidebar from Menu", async () => {
  const user = userEvent.setup();
  const result = render(shell("/projects/one"));
  const trigger = screen.getByRole("button", {
    name: "Hide desktop navigation",
  });
  const sidebar = result.container.querySelector("#workspace-sidebar");

  expect(trigger).toHaveAttribute("aria-expanded", "true");
  expect(sidebar).not.toHaveClass("sidebar-hidden");

  await user.click(trigger);

  expect(
    screen.getByRole("button", { name: "Show desktop navigation" }),
  ).toHaveAttribute("aria-expanded", "false");
  expect(sidebar).toHaveClass("sidebar-hidden");
  expect(result.container.querySelector(".authenticated-layout")).toHaveClass(
    "sidebar-collapsed",
  );

  await user.click(
    screen.getByRole("button", { name: "Show desktop navigation" }),
  );
  expect(
    screen.getByRole("button", { name: "Hide desktop navigation" }),
  ).toHaveFocus();
  expect(sidebar).not.toHaveClass("sidebar-hidden");
});

it("closes the mobile overlay on route or identity change", async () => {
  const user = userEvent.setup();
  const result = render(shell("/projects/one"));
  await user.click(screen.getByRole("button", { name: "Open navigation" }));
  expect(
    screen.getByRole("button", { name: "Close navigation" }),
  ).toHaveAttribute("aria-expanded", "true");
  result.rerender(shell("/projects/two"));
  expect(
    screen.getByRole("button", { name: "Open navigation" }),
  ).toHaveAttribute("aria-expanded", "false");
  await user.click(screen.getByRole("button", { name: "Open navigation" }));
  result.rerender(shell("/projects/two", "another"));
  expect(
    screen.getByRole("button", { name: "Open navigation" }),
  ).toHaveAttribute("aria-expanded", "false");
});

it("keeps Escape keyboard closure and restores trigger focus", async () => {
  const user = userEvent.setup();
  const result = render(shell("/projects/one"));
  await user.click(screen.getByRole("button", { name: "Open navigation" }));
  const navigation = result.container.querySelector(".mobile-navigation.open");
  expect(navigation).not.toBeNull();
  within(navigation as HTMLElement)
    .getByRole("link", { name: "Privacy and data" })
    .focus();
  await user.keyboard("{Escape}");
  expect(screen.getByRole("button", { name: "Open navigation" })).toHaveFocus();
});
