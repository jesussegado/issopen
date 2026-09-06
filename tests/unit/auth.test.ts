import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../../src/server/config.js";

const validEnvironment = {
  NODE_ENV: "test",
  PORT: "8080",
  DATABASE_URL: "postgresql://issopen:test@127.0.0.1:5432/issopen_test",
  ISSOPEN_BASE_URL: "http://localhost:8080",
  BETTER_AUTH_SECRET: "synthetic-test-secret-with-32-characters",
};

describe("authentication configuration", () => {
  it("keeps secret values out of actionable validation errors", () => {
    const secret = "synthetic-secret-that-must-never-appear";

    expect(() =>
      loadConfig({
        ...validEnvironment,
        DATABASE_URL: "not-a-postgres-url",
        BETTER_AUTH_SECRET: secret,
      }),
    ).toThrow(ConfigError);

    try {
      loadConfig({
        ...validEnvironment,
        DATABASE_URL: "not-a-postgres-url",
        BETTER_AUTH_SECRET: secret,
      });
    } catch (error) {
      expect(String(error)).not.toContain(secret);
      expect(String(error)).toContain("DATABASE_URL");
    }
  });

  it("requires HTTPS for production sessions", () => {
    expect(() =>
      loadConfig({ ...validEnvironment, NODE_ENV: "production" }),
    ).toThrow(/production requires HTTPS/);
  });

  it("marks cookies secure when the configured origin uses HTTPS", () => {
    const config = loadConfig({
      ...validEnvironment,
      NODE_ENV: "production",
      ISSOPEN_BASE_URL: "https://issopen.example.test",
    });

    expect(config.secureCookies).toBe(true);
    expect(config.trustedOrigins).toEqual(["https://issopen.example.test"]);
  });
});
