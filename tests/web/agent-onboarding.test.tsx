// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "../../src/web/App.js";

const manifest = {
  schemaVersion: 1,
  name: "issopen",
  version: "0.2.0",
  archive: "/downloads/issopen-skill-0.2.0.zip",
  sha256: "a".repeat(64),
  files: 17,
  installDirectory: "~/.agents/skills/issopen",
  entrypoint: "SKILL.md",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

it("publishes a session-free agent guide with a verified skill release", async () => {
  const user = userEvent.setup();
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    expect(String(input)).toBe("/downloads/issopen-skill-manifest.json");
    return new Response(JSON.stringify(manifest), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState({}, "", "/agent-onboarding");
  render(<App />);

  expect(
    screen.getByRole("heading", { name: "De un enlace a trabajo trazable" }),
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      (_text, element) =>
        element?.tagName === "P" &&
        element.textContent?.includes("Skill publicada: 0.2.0") === true,
    ),
  ).toBeInTheDocument();
  expect(screen.getByText(/SHA-256:/)).toHaveTextContent("a".repeat(64));
  expect(
    screen.getByRole("link", { name: "Descargar skill 0.2.0" }),
  ).toHaveAttribute(
    "href",
    "http://localhost:3000/downloads/issopen-skill-0.2.0.zip",
  );
  expect(screen.getByText(/Un enlace de Epic o ticket/)).toBeInTheDocument();
  expect(
    screen.getByRole("heading", {
      name: "Una identidad, una clave por consumidor",
    }),
  ).toBeInTheDocument();
  expect(screen.getByText(/hasta 10 claves activas/)).toBeInTheDocument();
  expect(screen.getByText(/Primary/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Copiar instalación" }));
  expect(writeText).toHaveBeenCalledWith(expect.stringContaining("sha256sum"));
  expect(writeText.mock.calls.at(-1)?.[0]).not.toMatch(/issopen_pat_/);
  await user.click(
    screen.getByRole("button", { name: "Copiar prompt inicial" }),
  );
  expect(writeText).toHaveBeenCalledWith(
    expect.stringContaining("get_agent_context"),
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(
    fetchMock.mock.calls.some(([input]) => String(input) === "/api/v1/session"),
  ).toBe(false);
});
