import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { installPackage, readPackage } from "../scripts/install-skill.mjs";

const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "issopen-install-test-"));
  return {
    skillsDir: join(root, "skills"),
    commit: "a".repeat(40),
    files: {
      "SKILL.md": Buffer.from("original"),
      "agents/openai.yaml": Buffer.from("interface: {}"),
    },
  };
};
describe("versioned skill installation", () => {
  it("installs a copy, is idempotent and preserves unrelated skills", () => {
    const input = fixture();
    mkdirSync(join(input.skillsDir, "other"), { recursive: true });
    writeFileSync(join(input.skillsDir, "other/SKILL.md"), "unrelated");
    expect(installPackage(input).status).toBe("installed");
    expect(installPackage(input).status).toBe("unchanged");
    input.files["SKILL.md"] = Buffer.from("source changed");
    expect(
      readFileSync(join(input.skillsDir, "issopen/SKILL.md"), "utf8"),
    ).toBe("original");
    expect(readFileSync(join(input.skillsDir, "other/SKILL.md"), "utf8")).toBe(
      "unrelated",
    );
  });
  it("updates and rolls back from pinned revisions, with recoverable backups outside discovery", () => {
    const input = fixture();
    installPackage(input);
    const updated = installPackage({
      ...input,
      commit: "b".repeat(40),
      files: { ...input.files, "SKILL.md": Buffer.from("new") },
    });
    expect(readFileSync(join(updated.backup, "SKILL.md"), "utf8")).toBe(
      "original",
    );
    expect(updated.backup.startsWith(`${input.skillsDir}/`)).toBe(false);
    installPackage(input);
    expect(
      readFileSync(join(input.skillsDir, "issopen/SKILL.md"), "utf8"),
    ).toBe("original");
  });
  it("refuses local edits, added files and unmanaged installations", () => {
    const input = fixture();
    installPackage(input);
    writeFileSync(join(input.skillsDir, "issopen/local.txt"), "keep");
    expect(() => installPackage({ ...input, commit: "b".repeat(40) })).toThrow(
      "Local modifications",
    );
    expect(() => installPackage({ ...input, remove: true })).toThrow(
      "Local modifications",
    );
    const unmanaged = fixture();
    mkdirSync(join(unmanaged.skillsDir, "issopen"), { recursive: true });
    expect(() => installPackage(unmanaged)).toThrow("Unmanaged");
  });
  it("refuses duplicate legacy discovery and target symlinks", () => {
    const input = fixture();
    const legacyDir = `${input.skillsDir}-legacy`;
    mkdirSync(join(legacyDir, "issopen"), { recursive: true });
    expect(() => installPackage({ ...input, legacyDir })).toThrow("Duplicate");
    mkdirSync(input.skillsDir, { recursive: true });
    symlinkSync(join(legacyDir, "issopen"), join(input.skillsDir, "issopen"));
    expect(() => installPackage(input)).toThrow("symlink");
  });
  it("uninstalls only its own clean package recoverably", () => {
    const input = fixture();
    installPackage(input);
    const removed = installPackage({ ...input, remove: true });
    expect(existsSync(join(input.skillsDir, "issopen"))).toBe(false);
    expect(readFileSync(join(removed.backup, "SKILL.md"), "utf8")).toBe(
      "original",
    );
    expect(installPackage({ ...input, remove: true }).status).toBe("absent");
  });
  it("rejects escaping paths without modifying the existing installation", () => {
    const input = fixture();
    installPackage(input);
    expect(() =>
      installPackage({ ...input, files: { "../outside": Buffer.from("bad") } }),
    ).toThrow("Unsafe");
    expect(
      readFileSync(join(input.skillsDir, "issopen/SKILL.md"), "utf8"),
    ).toBe("original");
  });
  it("loads immutable Git package contents, not working-tree edits", () => {
    const source = readPackage(process.cwd(), "HEAD");
    expect(source.commit).toMatch(/^[a-f0-9]{40}$/);
    expect(source.files["SKILL.md"].toString()).toContain("name: issopen");
    expect(() => readPackage(process.cwd(), "--help")).toThrow();
  });
});
