import { randomBytes, randomUUID } from "node:crypto";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
import pino from "pino";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { createApp } from "../../src/server/app.js";
import { createAuth } from "../../src/server/auth.js";
import { loadConfig } from "../../src/server/config.js";
import {
  createDatabase,
  type DatabaseConnection,
} from "../../src/server/db/client.js";
import { migrateDatabase } from "../../src/server/db/migrate.js";
import {
  account,
  invitationDelivery,
  project,
  user,
  workspace,
  workspaceInvitation,
  workspaceMembership,
} from "../../src/server/db/schema.js";
import { InvitationMailWorker } from "../../src/server/invitation-mail.js";
import { InvitationService } from "../../src/server/invitations.js";
import type { MailConfig } from "../../src/server/mail-config.js";

let container: StartedPostgreSqlContainer,
  connection: DatabaseConnection,
  service: InvitationService;
let actor: { userId: string; workspaceId: string },
  projectId: string,
  memberId: string;
const config: MailConfig = {
  host: "smtp.example.test",
  port: 587,
  secure: false,
  user: "synthetic",
  password: "synthetic-mail-password",
  from: "invites@example.test",
  key: randomBytes(32).toString("hex"),
};
const send = vi.fn(
  async (_message: {
    to: string;
    url: string;
    messageId: string;
    expiresAt: Date;
  }) => {},
);
const worker = () =>
  new InvitationMailWorker(
    connection.db,
    config,
    "https://issopen.example.test",
    { send },
  );
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18.6-alpine").start();
  await migrateDatabase(container.getConnectionUri());
  connection = createDatabase(container.getConnectionUri());
}, 60000);
afterAll(async () => {
  await connection?.close();
  await container?.stop();
});
beforeEach(async () => {
  await connection.client.unsafe('TRUNCATE "user" CASCADE');
  send.mockReset();
  send.mockResolvedValue();
  actor = { userId: randomUUID(), workspaceId: randomUUID() };
  projectId = randomUUID();
  memberId = randomUUID();
  await connection.db.insert(user).values(
    [actor.userId, memberId].map((id) => ({
      id,
      name: "Synthetic person",
      email: `${id}@example.test`,
      emailVerified: true,
    })),
  );
  await connection.db.insert(workspace).values({
    id: actor.workspaceId,
    ownerId: actor.userId,
    name: "Mail tests",
  });
  await connection.db.insert(workspaceMembership).values([
    { workspaceId: actor.workspaceId, userId: actor.userId, role: "owner" },
    { workspaceId: actor.workspaceId, userId: memberId, role: "member" },
  ]);
  await connection.db.insert(project).values({
    id: projectId,
    workspaceId: actor.workspaceId,
    key: "MAIL",
    name: "Private test project",
  });
  service = new InvitationService(connection.db, config);
});
const create = (email = `${randomUUID()}@example.test`) =>
  service.create(actor, { email, projectIds: [projectId], delivery: "email" });
async function jobs() {
  return connection.db.select().from(invitationDelivery);
}
async function ready() {
  await connection.client.unsafe(
    "update invitation_delivery set next_attempt_at=now()-interval '1 second', lease_until=now()-interval '1 second'",
  );
}
it("web API exposes email capability safely, validates requests and denies Member, foreign context and CSRF", async () => {
  const base = "http://localhost:8080",
    password = "synthetic-mail-web-password";
  const appConfig = loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: container.getConnectionUri(),
    ISSOPEN_BASE_URL: base,
    BETTER_AUTH_SECRET: "synthetic-mail-auth-secret-for-tests",
  });
  const auth = createAuth(connection.db, appConfig);
  const hash = await (await auth.$context).password.hash(password);
  await connection.db.insert(account).values(
    [actor.userId, memberId].map((id) => ({
      id: randomUUID(),
      userId: id,
      accountId: id,
      providerId: "credential",
      issuer: "local:credential",
      password: hash,
    })),
  );
  const app = createApp({
    db: connection.db,
    auth,
    logger: pino({ level: "silent" }),
    trustedOrigins: [base],
    mail: config,
  });
  const cookies = [];
  for (const id of [actor.userId, memberId]) {
    const r = await app.request(`${base}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({ email: `${id}@example.test`, password }),
    });
    expect(r.status).toBe(200);
    cookies.push(r.headers.get("set-cookie")?.split(";")[0] ?? "");
  }
  const headers = {
    Cookie: cookies[0] ?? "",
    Origin: base,
    "Content-Type": "application/json",
    "X-Issopen-Workspace": actor.workspaceId,
  };
  const r = await app.request(`${base}/api/v1/invitations`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: "http-pilot@example.test",
      projectIds: [projectId],
      delivery: "email",
    }),
  });
  expect(r.status).toBe(201);
  expect(r.headers.get("cache-control")).toBe("no-store");
  const body = await r.json();
  expect(body.inviteUrl).toContain("/invite/");
  const list = await app.request(`${base}/api/v1/members`, { headers });
  expect(list.headers.get("cache-control")).toBe("no-store");
  expect(await list.json()).toMatchObject({
    emailEnabled: true,
    invitations: [{ delivery: { status: "queued" } }],
  });
  for (const bad of [
    "{",
    JSON.stringify({ delivery: "unknown" }),
    JSON.stringify({ delivery: "email", recipient: "stranger@example.test" }),
  ])
    expect(
      (
        await app.request(
          `${base}/api/v1/invitations/${body.invitation.id}/resend`,
          { method: "POST", headers, body: bad },
        )
      ).status,
    ).toBe(400);
  for (const altered of [
    { ...headers, Cookie: cookies[1] ?? "" },
    { ...headers, Origin: "https://evil.example.test" },
    { ...headers, "X-Issopen-Workspace": randomUUID() },
  ]) {
    const denied = await app.request(
      `${base}/api/v1/invitations/${body.invitation.id}/resend`,
      {
        method: "POST",
        headers: altered,
        body: JSON.stringify({ delivery: "email" }),
      },
    );
    expect([403, 404]).toContain(denied.status);
    expect(denied.headers.get("cache-control")).toBe("no-store");
  }
  expect(await jobs()).toHaveLength(1);
  expect(send).not.toHaveBeenCalled();
});
it("queues encrypted tokens, returns only safe status, sends once and purges without changing grants or expiry", async () => {
  const result = await create();
  const [job] = await jobs();
  expect(job?.ciphertext).not.toContain(result.token);
  expect(job?.status).toBe("queued");
  const list = await service.list(actor);
  expect(list.emailEnabled).toBe(true);
  expect(list.invitations[0]?.delivery?.status).toBe("queued");
  expect(JSON.stringify(list)).not.toMatch(
    /ciphertext|tokenHash|requestedByUserId/,
  );
  expect(JSON.stringify(list)).not.toContain(result.token);
  await Promise.all([worker().runOnce(), worker().runOnce()]);
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0]?.[0]).toMatchObject({
    to: result.invitation.email,
    url: `https://issopen.example.test/invite/${result.token}`,
    expiresAt: result.invitation.expiresAt,
  });
  expect((await jobs())[0]).toMatchObject({
    status: "sent",
    attempts: 1,
    ciphertext: null,
  });
  expect(await service.inspect(result.token)).toMatchObject({
    state: "pending",
    expiresAt: result.invitation.expiresAt,
  });
  expect(
    result.invitation.expiresAt.getTime() -
      result.invitation.createdAt.getTime(),
  ).toBe(7 * 86400000);
  await worker().runOnce();
  expect(send).toHaveBeenCalledTimes(1);
});
it("bounds retries and preserves Message-ID; raw provider errors and bearer links are never persisted", async () => {
  const result = await create();
  send.mockRejectedValue(
    new Error(`private SMTP failure ${result.token} ${config.password}`),
  );
  await worker().runOnce();
  expect((await jobs())[0]).toMatchObject({
    status: "queued",
    attempts: 1,
    lastErrorCode: "smtp_unavailable",
  });
  await worker().runOnce();
  expect(send).toHaveBeenCalledTimes(1);
  await ready();
  await worker().runOnce();
  await ready();
  await worker().runOnce();
  await ready();
  await worker().runOnce();
  expect(send).toHaveBeenCalledTimes(3);
  expect((await jobs())[0]).toMatchObject({
    status: "failed",
    attempts: 3,
    ciphertext: null,
  });
  expect(new Set(send.mock.calls.map((c) => c[0].messageId)).size).toBe(1);
  expect(JSON.stringify(await jobs())).not.toContain(result.token);
  expect(JSON.stringify(await jobs())).not.toContain(config.password);
  expect(await service.inspect(result.token)).toMatchObject({
    state: "pending",
  });
});
it("cancels pending sends on rotation, revocation, acceptance or expiry, even with mail disabled", async () => {
  const original = await create();
  const rotated = await service.resend(actor, original.invitation.id);
  expect(await service.inspect(original.token)).toBeNull();
  expect((await jobs())[0]).toMatchObject({
    status: "cancelled",
    ciphertext: null,
  });
  expect(await service.inspect(rotated.token)).toMatchObject({
    state: "pending",
  });
  const revoked = await create();
  await service.revoke(actor, revoked.invitation.id);
  const expired = await create();
  await connection.db
    .update(workspaceInvitation)
    .set({ expiresAt: new Date(0) })
    .where(eq(workspaceInvitation.id, expired.invitation.id));
  const accepted = await create();
  await connection.db
    .update(workspaceInvitation)
    .set({ acceptedAt: new Date() })
    .where(eq(workspaceInvitation.id, accepted.invitation.id));
  await new InvitationMailWorker(
    connection.db,
    null,
    "https://issopen.example.test",
    null,
  ).runOnce();
  expect(
    (await jobs()).every(
      (j) => j.status === "cancelled" && j.ciphertext === null,
    ),
  ).toBe(true);
  expect(send).not.toHaveBeenCalled();
});
it("does not resurrect an in-flight revoked job, and its link remains unusable even if SMTP already accepted it", async () => {
  const result = await create();
  send.mockImplementationOnce(async () => {
    await service.revoke(actor, result.invitation.id);
  });
  await worker().runOnce();
  expect((await jobs())[0]).toMatchObject({
    status: "cancelled",
    ciphertext: null,
    sentAt: null,
  });
  expect(await service.inspect(result.token)).toMatchObject({
    state: "revoked",
  });
});
it("recovers abandoned leases, bounds crashes and fails closed for a wrong encryption key", async () => {
  const result = await create();
  await connection.client.unsafe(
    "update invitation_delivery set status='sending',attempts=2,lease_id=$1,lease_until=now()-interval '1 second'",
    [randomUUID()],
  );
  await worker().runOnce();
  expect((await jobs())[0]).toMatchObject({
    status: "sent",
    attempts: 3,
    ciphertext: null,
  });
  const abandoned = await create();
  await connection.client.unsafe(
    "update invitation_delivery set status='sending',attempts=3,lease_id=$1,lease_until=now()-interval '1 second' where invitation_id=$2",
    [randomUUID(), abandoned.invitation.id],
  );
  await worker().runOnce();
  expect(
    (await jobs()).find((j) => j.invitationId === abandoned.invitation.id),
  ).toMatchObject({
    status: "failed",
    lastErrorCode: "delivery_uncertain",
    ciphertext: null,
  });
  await create();
  await new InvitationMailWorker(
    connection.db,
    { ...config, key: randomBytes(32).toString("hex") },
    "https://issopen.example.test",
    { send },
  ).runOnce();
  expect(send).toHaveBeenCalledTimes(1);
  expect(
    (await jobs()).find(
      (j) =>
        j.status === "failed" && j.lastErrorCode === "encryption_unavailable",
    )?.ciphertext,
  ).toBeNull();
  expect(await service.inspect(result.token)).toMatchObject({
    state: "pending",
  });
});
it("binds ciphertext to each generation and invitation, detects tampering without sending", async () => {
  await create();
  await create();
  const rows = await jobs();
  await connection.db
    .update(invitationDelivery)
    .set({ ciphertext: rows[0]?.ciphertext ?? null })
    .where(eq(invitationDelivery.id, rows[1]?.id ?? ""));
  await worker().runOnce();
  await worker().runOnce();
  expect(send).toHaveBeenCalledTimes(1);
  expect((await jobs()).filter((j) => j.status === "failed")).toHaveLength(1);
});
it("disabled sending is explicit, stale Owners and Members cannot list or mutate invites", async () => {
  const disabled = new InvitationService(connection.db);
  await expect(
    disabled.create(actor, {
      email: "disabled@example.test",
      projectIds: [projectId],
      delivery: "email",
    }),
  ).rejects.toMatchObject({ code: "invalid" });
  expect(await jobs()).toHaveLength(0);
  const result = await create();
  const member = { ...actor, userId: memberId };
  for (const target of [member]) {
    await expect(service.list(target)).rejects.toMatchObject({
      code: "forbidden",
    });
    await expect(
      service.revoke(target, result.invitation.id),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      service.resend(target, result.invitation.id),
    ).rejects.toMatchObject({ code: "forbidden" });
  }
  await connection.db
    .update(workspace)
    .set({ ownerId: memberId })
    .where(eq(workspace.id, actor.workspaceId));
  await expect(service.list(actor)).rejects.toMatchObject({
    code: "forbidden",
  });
  await expect(
    service.revoke(actor, result.invitation.id),
  ).rejects.toMatchObject({ code: "forbidden" });
  await expect(
    service.resend(actor, result.invitation.id),
  ).rejects.toMatchObject({ code: "forbidden" });
  await expect(create()).rejects.toMatchObject({ code: "forbidden" });
});
it("limits explicit email requests and rolls back a denied rotation; manual fallback stays usable", async () => {
  const first = await create();
  await expect(
    service.resend(actor, first.invitation.id, "email"),
  ).rejects.toMatchObject({ code: "conflict" });
  expect(await service.inspect(first.token)).toMatchObject({
    state: "pending",
  });
  expect(await jobs()).toHaveLength(1);
  for (let i = 1; i < 20; i++) await create();
  await expect(create()).rejects.toMatchObject({ code: "conflict" });
  expect(await jobs()).toHaveLength(20);
  await expect(
    service.resend(actor, first.invitation.id),
  ).resolves.toHaveProperty("token");
});
