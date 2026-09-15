import { randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { afterEach, expect, it, vi } from "vitest";
import { smtpInvitationTransport } from "../../src/server/invitation-mail.js";
import { type MailConfig, mailConfig } from "../../src/server/mail-config.js";

afterEach(() => vi.restoreAllMocks());
it("defaults disabled and rejects partial config without printing secret values", () => {
  expect(mailConfig({})).toBeNull();
  expect(() =>
    mailConfig({
      ISSOPEN_MAIL_TRANSPORT: "smtp",
      ISSOPEN_SMTP_PASSWORD: "synthetic-sensitive-marker",
    }),
  ).toThrow(/Invalid invitation mail configuration/);
  try {
    mailConfig({
      ISSOPEN_MAIL_TRANSPORT: "smtp",
      ISSOPEN_SMTP_PASSWORD: "synthetic-sensitive-marker",
    });
  } catch (e) {
    expect(String(e)).not.toContain("synthetic-sensitive-marker");
  }
  expect(() => mailConfig({ ISSOPEN_MAIL_TRANSPORT: "other" })).toThrow();
});
it("adapter requires verified TLS, suppresses logs and forbids file/URL access; SMTP acceptance is not inbox delivery", async () => {
  const sendMail = vi.fn(async () => ({ accepted: ["pilot@example.test"] })),
    close = vi.fn();
  const mock = vi
    .spyOn(nodemailer, "createTransport")
    .mockReturnValue({ sendMail, close } as never);
  const config: MailConfig = {
    host: "smtp.example.test",
    port: 587,
    secure: false,
    user: "test",
    password: "synthetic-mail-password",
    key: randomBytes(32).toString("hex"),
    from: "invites@example.test",
  };
  const transport = smtpInvitationTransport(config);
  expect(mock).toHaveBeenCalledWith(
    expect.objectContaining({
      requireTLS: true,
      tls: { rejectUnauthorized: true },
      logger: false,
      debug: false,
      disableFileAccess: true,
      disableUrlAccess: true,
    }),
  );
  await transport.send({
    to: "pilot@example.test",
    url: "https://issopen.example.test/invite/synthetic",
    expiresAt: new Date(0),
    messageId: "<synthetic@example.test>",
  });
  expect(sendMail).toHaveBeenCalledWith(
    expect.objectContaining({
      from: config.from,
      to: "pilot@example.test",
      messageId: "<synthetic@example.test>",
      disableFileAccess: true,
      disableUrlAccess: true,
    }),
  );
  expect(JSON.stringify(sendMail.mock.calls)).not.toMatch(
    /password|attachments|html/,
  );
  sendMail.mockResolvedValueOnce({ accepted: [] });
  await expect(
    transport.send({
      to: "pilot@example.test",
      url: "https://issopen.example.test/invite/synthetic",
      expiresAt: new Date(0),
      messageId: "<synthetic@example.test>",
    }),
  ).rejects.toThrow();
  transport.close?.();
  expect(close).toHaveBeenCalledOnce();
});
