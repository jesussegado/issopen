import { describe, expect, it, vi } from "vitest";
import {
  checkForUpdate,
  publishedRelease,
  readPublishedRelease,
} from "../skills/issopen/scripts/updates.mjs";

describe("notify-only release checks", () => {
  const installed = "a".repeat(40);
  it("detects a newer release without installing or changing the active revision", async () => {
    const published = "b".repeat(40);
    const read = vi
      .fn()
      .mockResolvedValue({ commit: published, version: "0.2.1" });
    expect(await checkForUpdate(installed, read, 8000, "0.1.0")).toEqual({
      status: "update_available",
      installedCommit: installed,
      publishedCommit: published,
      version: "0.2.1",
      automaticUpdate: false,
    });
    expect(read).toHaveBeenCalledTimes(1);
    expect(
      (
        await checkForUpdate(installed, async () => ({
          commit: installed,
          version: "0.1.0",
        }))
      ).status,
    ).toBe("current");
  });
  it("does not present an older tag, equal-version candidate or unknown revision as newer", async () => {
    const read = async () => ({ commit: "b".repeat(40), version: "0.1.0" });
    expect((await checkForUpdate(installed, read, 8000, "0.2.1")).status).toBe(
      "installed_ahead",
    );
    expect((await checkForUpdate(installed, read, 8000, "0.1.0")).status).toBe(
      "revision_mismatch",
    );
    expect((await checkForUpdate(installed, read)).status).toBe(
      "different_release",
    );
  });
  it("times out or fails without blocking work or exposing remote error text", async () => {
    expect(
      (await checkForUpdate(installed, () => new Promise(() => {}), 5)).status,
    ).toBe("unavailable");
    const result = await checkForUpdate(installed, async () => {
      throw new Error("private diagnostic must not escape");
    });
    expect(result.status).toBe("unavailable");
    expect(JSON.stringify(result)).not.toContain("private diagnostic");
  });
  it("sorts release versions numerically and uses annotated tag commit targets", () => {
    expect(
      publishedRelease(
        `${installed}\trefs/tags/issopen-skill-v0.9.0\n${"b".repeat(40)}\trefs/tags/issopen-skill-v0.10.0\n${"c".repeat(40)}\trefs/tags/issopen-skill-v0.10.0^{}`,
      ),
    ).toEqual({ commit: "c".repeat(40), version: "0.10.0" });
    expect(publishedRelease("not a release")).toBeNull();
  });
  it("rejects executable Git helpers and untrusted URL schemes before starting Git", async () => {
    for (const source of [
      "ext::command",
      "file:///tmp/repo",
      "http://host/repo",
      "https://host/repo?token=x",
    ])
      await expect(readPublishedRelease(source)).rejects.toThrow();
  });
});
