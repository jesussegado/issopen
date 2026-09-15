import { z } from "zod";

const smtpSchema = z.object({
  host: z
    .string()
    .trim()
    .min(1)
    .max(253)
    .regex(/^[a-zA-Z0-9.-]+$/),
  port: z.coerce.number().int().min(1).max(65535).default(587),
  secure: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  user: z.string().min(1).max(320),
  password: z.string().min(1).max(1024),
  from: z.email().max(320),
  key: z.string().regex(/^[a-fA-F0-9]{64}$/),
});
export type MailConfig = z.infer<typeof smtpSchema>;
export function mailConfig(environment: NodeJS.ProcessEnv): MailConfig | null {
  const mode = environment.ISSOPEN_MAIL_TRANSPORT ?? "disabled";
  if (mode === "disabled") return null;
  if (mode !== "smtp")
    throw Error("ISSOPEN_MAIL_TRANSPORT must be disabled or smtp");
  const parsed = smtpSchema.safeParse({
    host: environment.ISSOPEN_SMTP_HOST,
    port: environment.ISSOPEN_SMTP_PORT,
    secure: environment.ISSOPEN_SMTP_SECURE,
    user: environment.ISSOPEN_SMTP_USER,
    password: environment.ISSOPEN_SMTP_PASSWORD,
    from: environment.ISSOPEN_MAIL_FROM,
    key: environment.ISSOPEN_MAIL_ENCRYPTION_KEY,
  });
  if (!parsed.success)
    throw Error(
      `Invalid invitation mail configuration: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}. SMTP and an independent 32-byte hex encryption key must be configured together.`,
    );
  return parsed.data;
}
