import { z } from "zod";

const postgresUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => {
      if (!URL.canParse(value)) {
        return false;
      }
      const protocol = new URL(value).protocol;
      return protocol === "postgres:" || protocol === "postgresql:";
    },
    { message: "must be a PostgreSQL URL" },
  );

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(8080),
  DATABASE_URL: postgresUrlSchema,
  ISSOPEN_BASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32, "must contain at least 32 characters"),
  ISSOPEN_TRUSTED_ORIGINS: z.string().optional(),
});

export type AppConfig = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  databaseUrl: string;
  baseUrl: URL;
  authSecret: string;
  trustedOrigins: string[];
  secureCookies: boolean;
};

export class ConfigError extends Error {
  override readonly name = "ConfigError";
}

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const parsed = environmentSchema.safeParse(environment);

  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => {
      const field = issue.path.join(".") || "configuration";
      return `${field}: ${issue.message}`;
    });
    throw new ConfigError(
      `Invalid Issopen configuration (${errors.join("; ")})`,
    );
  }

  const baseUrl = new URL(parsed.data.ISSOPEN_BASE_URL);
  const configuredOrigins = parsed.data.ISSOPEN_TRUSTED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const trustedOrigins = Array.from(
    new Set([baseUrl.origin, ...(configuredOrigins ?? [])]),
  );

  for (const origin of trustedOrigins) {
    const parsedOrigin = new URL(origin);
    if (parsedOrigin.origin !== origin) {
      throw new ConfigError(
        "Invalid Issopen configuration (ISSOPEN_TRUSTED_ORIGINS: entries must be origins without paths)",
      );
    }
  }

  if (parsed.data.NODE_ENV === "production" && baseUrl.protocol !== "https:") {
    throw new ConfigError(
      "Invalid Issopen configuration (ISSOPEN_BASE_URL: production requires HTTPS)",
    );
  }

  return {
    nodeEnv: parsed.data.NODE_ENV,
    port: parsed.data.PORT,
    databaseUrl: parsed.data.DATABASE_URL,
    baseUrl,
    authSecret: parsed.data.BETTER_AUTH_SECRET,
    trustedOrigins,
    secureCookies: baseUrl.protocol === "https:",
  };
}
