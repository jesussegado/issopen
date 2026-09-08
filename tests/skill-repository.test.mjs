import { describe, expect, it } from "vitest";
import {
  matchingProjects,
  repositoryIdentity,
} from "../skills/issopen/scripts/repository.mjs";

describe("repository association without guessing", () => {
  it("normalizes known syntax but preserves SSH ports, transport, host and path", () => {
    expect(repositoryIdentity("git@Git.Example.test:team/app.git")).toBe(
      repositoryIdentity("ssh://git@git.example.test/team/app"),
    );
    expect(
      repositoryIdentity("ssh://git@git.example.test:2222/team/app.git"),
    ).not.toBe(repositoryIdentity("https://git.example.test/team/app.git"));
    expect(
      repositoryIdentity("https://git.example.test/team/App.git"),
    ).not.toBe(repositoryIdentity("https://git.example.test/team/app.git"));
    for (const invalid of [
      null,
      "",
      "file:///tmp/repo",
      new URL("repo", "https://host").href.replace(
        "//",
        `//${"synthetic-user"}:${"synthetic-password"}@`,
      ),
      "https://host/repo?token=x",
      "git@host:bad path",
    ])
      expect(repositoryIdentity(invalid)).toBeNull();
  });
  it("honors subdirectories and leaves ambiguity visible instead of choosing a project", () => {
    const projects = [
      {
        id: "one",
        repositoryUrl: "https://host/team/repo.git",
        repositorySubdirectory: "apps/web",
      },
      {
        id: "two",
        repositoryUrl: "https://host/team/repo",
        repositorySubdirectory: "apps/api",
      },
    ];
    expect(
      matchingProjects("https://host/team/repo", "apps/web/src", projects).map(
        (p) => p.id,
      ),
    ).toEqual(["one"]);
    expect(
      matchingProjects("https://host/team/repo", "apps/web-other", projects),
    ).toEqual([]);
    expect(
      matchingProjects("https://host/team/repo", "../apps/web", projects),
    ).toEqual([]);
    expect(
      matchingProjects("https://host/team/repo", "apps/web", [
        projects[0],
        { ...projects[0], id: "duplicate" },
      ]),
    ).toHaveLength(2);
  });
});
