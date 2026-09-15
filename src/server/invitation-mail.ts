import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import nodemailer from "nodemailer";
import type { Database } from "./db/client.js";
import {
  invitationDelivery as delivery,
  workspaceInvitation as invitation,
  workspaceInvitationEvent,
} from "./db/schema.js";
import { DomainError } from "./domain/index.js";
import type { MailConfig } from "./mail-config.js";

type Job = typeof delivery.$inferSelect;
function aad(
  job: Pick<Job, "id" | "workspaceId" | "invitationId" | "tokenHash">,
) {
  return Buffer.from(
    JSON.stringify([job.id, job.workspaceId, job.invitationId, job.tokenHash]),
  );
}
export function encryptInvitationToken(
  token: string,
  key: string,
  job: Parameters<typeof aad>[0],
) {
  const nonce = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), nonce);
  cipher.setAAD(aad(job));
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), data]).toString(
    "base64url",
  );
}
function decrypt(job: Job, key: string) {
  const encrypted = Buffer.from(job.ciphertext ?? "", "base64url"),
    cipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(key, "hex"),
      encrypted.subarray(0, 12),
    );
  cipher.setAAD(aad(job));
  cipher.setAuthTag(encrypted.subarray(12, 28));
  const token = Buffer.concat([
    cipher.update(encrypted.subarray(28)),
    cipher.final(),
  ]).toString("utf8");
  if (
    !/^[A-Za-z0-9_-]{43}$/.test(token) ||
    createHash("sha256").update(token).digest("hex") !== job.tokenHash
  )
    throw Error("Invalid mail payload");
  return token;
}
async function event(
  db: Database,
  job: Pick<Job, "workspaceId" | "invitationId" | "requestedByUserId">,
  type: string,
) {
  await db.insert(workspaceInvitationEvent).values({
    id: randomUUID(),
    workspaceId: job.workspaceId,
    invitationId: job.invitationId,
    actorUserId: job.requestedByUserId,
    type,
  });
}
export async function cancelInvitationMail(db: Database, invitationId: string) {
  const jobs = await db
    .update(delivery)
    .set({
      status: "cancelled",
      ciphertext: null,
      leaseId: null,
      leaseUntil: null,
    })
    .where(
      and(
        eq(delivery.invitationId, invitationId),
        inArray(delivery.status, ["queued", "sending"]),
      ),
    )
    .returning();
  for (const job of jobs) await event(db, job, "invitation.delivery_cancelled");
}
export async function queueInvitationMail(
  db: Database,
  row: typeof invitation.$inferSelect,
  token: string,
  requestedByUserId: string,
  key: string,
) {
  const recent = await db
    .select({
      invitationId: delivery.invitationId,
      createdAt: delivery.createdAt,
    })
    .from(delivery)
    .where(
      and(
        eq(delivery.workspaceId, row.workspaceId),
        gte(delivery.createdAt, new Date(Date.now() - 3600000)),
      ),
    );
  if (
    recent.length >= 20 ||
    recent.some(
      (j) =>
        j.invitationId === row.id && j.createdAt.getTime() > Date.now() - 60000,
    )
  )
    throw new DomainError(
      "conflict",
      "Email limit reached. Wait a minute before renewing this invitation; at most 20 emails per workspace per hour.",
    );
  const job = {
    id: randomUUID(),
    workspaceId: row.workspaceId,
    invitationId: row.id,
    tokenHash: row.tokenHash,
    requestedByUserId,
  };
  await db
    .insert(delivery)
    .values({ ...job, ciphertext: encryptInvitationToken(token, key, job) });
  await event(db, job, "invitation.delivery_queued");
}
export async function invitationMailSummaries(
  db: Database,
  workspaceId: string,
) {
  const rows = await db
    .select({
      invitationId: delivery.invitationId,
      status: delivery.status,
      attempts: delivery.attempts,
      createdAt: delivery.createdAt,
      nextAttemptAt: delivery.nextAttemptAt,
      sentAt: delivery.sentAt,
      lastErrorCode: delivery.lastErrorCode,
    })
    .from(delivery)
    .where(eq(delivery.workspaceId, workspaceId))
    .orderBy(desc(delivery.createdAt), desc(delivery.id));
  const result = new Map<string, Omit<(typeof rows)[number], "invitationId">>();
  for (const { invitationId, ...safe } of rows)
    if (!result.has(invitationId)) result.set(invitationId, safe);
  return result;
}
export type InvitationTransport = {
  send(input: {
    to: string;
    url: string;
    expiresAt: Date;
    messageId: string;
  }): Promise<void>;
  close?(): void;
};
export function smtpInvitationTransport(
  config: MailConfig,
): InvitationTransport {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: true,
    tls: { rejectUnauthorized: true },
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    dnsTimeout: 10000,
    logger: false,
    debug: false,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return {
    async send(input) {
      const result = await transport.sendMail({
        from: config.from,
        to: input.to,
        subject: "Your private Issopen invitation",
        messageId: input.messageId,
        text: `You have been invited to Issopen. Open this private link to review the invitation and sign in with the invited Google account:\n\n${input.url}\n\nExpires: ${input.expiresAt.toISOString()}. If you did not expect this invitation, ignore this email. Do not forward the link.`,
        disableFileAccess: true,
        disableUrlAccess: true,
      });
      if (result.accepted.length !== 1)
        throw Error("SMTP did not accept recipient");
    },
    close: () => transport.close(),
  };
}

/** Bounded at-least-once transport; never creates invitations or reminders. */
export class InvitationMailWorker {
  constructor(
    private db: Database,
    private config: MailConfig | null,
    private baseUrl: string,
    private transport: InvitationTransport | null,
  ) {}
  async runOnce() {
    // Cleanup also runs with sending disabled; expired links must not retain payloads.
    await this.db.transaction(async (tx) => {
      const stale = await tx
        .select({ id: delivery.id })
        .from(delivery)
        .innerJoin(
          invitation,
          and(
            eq(invitation.id, delivery.invitationId),
            eq(invitation.workspaceId, delivery.workspaceId),
          ),
        )
        .where(
          and(
            inArray(delivery.status, ["queued", "sending"]),
            sql`(${invitation.tokenHash} <> ${delivery.tokenHash} or ${invitation.expiresAt} <= now() or ${invitation.revokedAt} is not null or ${invitation.claimedAt} is not null or ${invitation.acceptedAt} is not null)`,
          ),
        );
      if (stale.length) {
        const jobs = await tx
          .update(delivery)
          .set({
            status: "cancelled",
            ciphertext: null,
            leaseId: null,
            leaseUntil: null,
          })
          .where(
            and(
              inArray(
                delivery.id,
                stale.map((x) => x.id),
              ),
              inArray(delivery.status, ["queued", "sending"]),
            ),
          )
          .returning();
        for (const job of jobs)
          await event(tx, job, "invitation.delivery_cancelled");
      }
    });
    if (!this.config || !this.transport) return false;
    const job = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(delivery)
        .where(
          sql`(${delivery.status} = 'queued' and ${delivery.nextAttemptAt} <= now()) or (${delivery.status} = 'sending' and ${delivery.leaseUntil} <= now())`,
        )
        .orderBy(delivery.nextAttemptAt, delivery.id)
        .limit(1)
        .for("update", { skipLocked: true });
      if (!row) return null;
      if (row.attempts >= 3) {
        await tx
          .update(delivery)
          .set({
            status: "failed",
            ciphertext: null,
            leaseId: null,
            leaseUntil: null,
            lastErrorCode: "delivery_uncertain",
          })
          .where(eq(delivery.id, row.id));
        await event(tx, row, "invitation.delivery_failed");
        return null;
      }
      const [leased] = await tx
        .update(delivery)
        .set({
          status: "sending",
          attempts: row.attempts + 1,
          leaseId: randomUUID(),
          leaseUntil: new Date(Date.now() + 120000),
        })
        .where(eq(delivery.id, row.id))
        .returning();
      return leased ?? null;
    });
    if (!job) return false;
    const [current] = await this.db
      .select()
      .from(invitation)
      .where(
        and(
          eq(invitation.id, job.invitationId),
          eq(invitation.workspaceId, job.workspaceId),
        ),
      );
    if (
      !current ||
      current.tokenHash !== job.tokenHash ||
      current.claimedAt ||
      current.acceptedAt ||
      current.revokedAt ||
      current.expiresAt.getTime() <= Date.now()
    ) {
      await this.finish(job, "cancelled", null);
      return true;
    }
    let token: string;
    try {
      token = decrypt(job, this.config.key);
    } catch {
      await this.finish(job, "failed", "encryption_unavailable");
      return true;
    }
    try {
      await this.transport.send({
        to: current.email,
        url: new URL(`/invite/${token}`, this.baseUrl).toString(),
        expiresAt: current.expiresAt,
        messageId: `<issopen-invite-${job.id}@${new URL(this.baseUrl).hostname}>`,
      });
      await this.finish(job, "sent", null);
    } catch {
      await this.finish(
        job,
        job.attempts >= 3 ? "failed" : "queued",
        "smtp_unavailable",
      );
    }
    return true;
  }
  private async finish(job: Job, status: string, lastErrorCode: string | null) {
    await this.db.transaction(async (tx) => {
      const updated = await tx
        .update(delivery)
        .set({
          status,
          lastErrorCode,
          ciphertext: status === "queued" ? job.ciphertext : null,
          leaseId: null,
          leaseUntil: null,
          nextAttemptAt: new Date(
            Date.now() + (job.attempts === 1 ? 30000 : 120000),
          ),
          sentAt: status === "sent" ? new Date() : null,
        })
        .where(
          and(
            eq(delivery.id, job.id),
            eq(delivery.status, "sending"),
            eq(delivery.leaseId, job.leaseId ?? ""),
          ),
        )
        .returning();
      if (updated.length && status !== "queued")
        await event(tx, job, `invitation.delivery_${status}`);
    });
  }
}
