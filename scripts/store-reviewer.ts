import { randomBytes, randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { pathToFileURL } from "node:url";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { createAuth, type IssopenAuth } from "../src/server/auth.js";
import { loadConfig } from "../src/server/config.js";
import { createDatabase, type Database } from "../src/server/db/client.js";
import {
  account,
  membershipEvent,
  projectMembership,
  user,
  workspace,
  workspaceMembership,
} from "../src/server/db/schema.js";
import { TrackerService } from "../src/server/domain/index.js";
import { InvitationService } from "../src/server/invitations.js";

export const reviewInputSchema = z
  .object({
    workspaceId: z.uuid(),
    ownerUserId: z.uuid(),
    userId: z.uuid(),
    email: z.email().toLowerCase(),
    password: z.string().min(24).max(128),
  })
  .strict();
export type ReviewInput = z.infer<typeof reviewInputSchema>;
const marker = "chrome.review.provisioned";

// Explicit operator exception, never imported by an HTTP/MCP route. Uses the
// normal Member policy and does not change signup, Google or existing accounts.
export async function provisionReviewDemo(
  db: Database,
  auth: IssopenAuth,
  raw: ReviewInput,
) {
  const input = reviewInputSchema.parse(raw);
  const { password } = await auth.$context;
  const hash = await password.hash(input.password);
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('issopen:chrome-review'))`,
    );
    const [owner] = await tx
      .select({ id: user.id, name: user.name })
      .from(workspace)
      .innerJoin(user, eq(user.id, workspace.ownerId))
      .innerJoin(
        workspaceMembership,
        and(
          eq(workspaceMembership.workspaceId, workspace.id),
          eq(workspaceMembership.userId, user.id),
        ),
      )
      .where(
        and(
          eq(workspace.id, input.workspaceId),
          eq(user.id, input.ownerUserId),
          eq(workspaceMembership.role, "owner"),
        ),
      );
    if (!owner)
      throw new Error("Review provisioning requires the exact workspace owner");

    const [existing] = await tx
      .select()
      .from(user)
      .where(eq(user.email, input.email));
    if (existing) {
      const [event] = await tx
        .select()
        .from(membershipEvent)
        .where(
          and(
            eq(membershipEvent.workspaceId, input.workspaceId),
            eq(membershipEvent.subjectUserId, input.userId),
            eq(membershipEvent.type, marker),
            eq(membershipEvent.actorUserId, input.ownerUserId),
          ),
        );
      const grants = await tx
        .select()
        .from(projectMembership)
        .where(eq(projectMembership.userId, input.userId));
      const [membership] = await tx
        .select()
        .from(workspaceMembership)
        .where(eq(workspaceMembership.userId, input.userId));
      const credentials = await tx
        .select()
        .from(account)
        .where(eq(account.userId, input.userId));
      const credential = credentials[0];
      if (
        existing.id !== input.userId ||
        !event?.projectId ||
        membership?.role !== "member" ||
        membership.workspaceId !== input.workspaceId ||
        grants.length !== 1 ||
        grants[0]?.projectId !== event.projectId ||
        credentials.length !== 1 ||
        credential?.providerId !== "credential" ||
        credential.issuer !== "local:credential" ||
        !credential.password ||
        !(await password.verify({
          hash: credential.password,
          password: input.password,
        }))
      ) {
        throw new Error(
          "Existing or revoked review identity cannot be adopted or changed",
        );
      }
      return {
        created: false,
        userId: input.userId,
        projectId: event.projectId,
      };
    }
    const now = new Date();
    await tx.insert(user).values({
      id: input.userId,
      name: "Chrome Web Store Reviewer",
      email: input.email,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(account).values({
      id: randomUUID(),
      issuer: "local:credential",
      providerId: "credential",
      accountId: input.userId,
      userId: input.userId,
      password: hash,
      createdAt: now,
      updatedAt: now,
    });
    const tracker = new TrackerService(tx);
    const context = {
      workspaceId: input.workspaceId,
      actor: { type: "human" as const, id: owner.id, displayName: owner.name },
      source: "rest" as const,
    };
    const demo = await tracker.createProject(context, {
      name: "Google Review Demo",
      key: "CWSREVIEW",
    });
    const epic = await tracker.createEpic(context, {
      projectId: demo.id,
      title: "Try Issopen for Chrome",
      description:
        "Synthetic review data only. Create tickets, attach a harmless image, add comments and change status. No customer data is available in this project.",
    });
    await tracker.createIssue(context, {
      projectId: demo.id,
      epicId: epic.id,
      title: "Welcome — create your first test ticket",
      description:
        "Open the Issopen Chrome side panel, connect with the supplied review account, choose Google Review Demo and this Epic, then enter a title and send a ticket. You can also create tickets from the web.",
    });
    await tracker.createIssue(context, {
      projectId: demo.id,
      epicId: epic.id,
      title: "Try image paste or upload",
      description:
        "Use a synthetic PNG/JPEG/WebP image. Paste with Ctrl+V or choose Upload images. Review the preview before sending. No page capture or DOM access is performed. Open the resulting ticket in Issopen to inspect the image.",
    });
    await tx.insert(workspaceMembership).values({
      workspaceId: input.workspaceId,
      userId: input.userId,
      role: "member",
    });
    await tx.insert(projectMembership).values({
      workspaceId: input.workspaceId,
      userId: input.userId,
      projectId: demo.id,
    });
    await tx.insert(membershipEvent).values([
      {
        id: randomUUID(),
        workspaceId: input.workspaceId,
        subjectUserId: input.userId,
        actorUserId: owner.id,
        type: marker,
        projectId: demo.id,
        nextRole: "member",
      },
      {
        id: randomUUID(),
        workspaceId: input.workspaceId,
        subjectUserId: input.userId,
        actorUserId: owner.id,
        type: "project.access_granted",
        projectId: demo.id,
        nextRole: "member",
      },
    ]);
    return { created: true, userId: input.userId, projectId: demo.id };
  });
}

export async function revokeReviewDemo(db: Database, raw: ReviewInput) {
  const input = reviewInputSchema.parse(raw);
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('issopen:chrome-review'))`,
    );
    const [owner] = await tx
      .select()
      .from(workspace)
      .where(
        and(
          eq(workspace.id, input.workspaceId),
          eq(workspace.ownerId, input.ownerUserId),
        ),
      );
    const [event] = await tx
      .select()
      .from(membershipEvent)
      .where(
        and(
          eq(membershipEvent.workspaceId, input.workspaceId),
          eq(membershipEvent.subjectUserId, input.userId),
          eq(membershipEvent.type, marker),
          eq(membershipEvent.actorUserId, input.ownerUserId),
        ),
      );
    if (!owner || !event)
      throw new Error("This is not the operator-provisioned review identity");
    const [membership] = await tx
      .select()
      .from(workspaceMembership)
      .where(eq(workspaceMembership.userId, input.userId));
    if (
      membership &&
      (membership.workspaceId !== input.workspaceId ||
        membership.role !== "member")
    )
      throw new Error("Refusing to revoke a different membership");
    if (membership)
      await new InvitationService(tx).removeMember(
        { workspaceId: input.workspaceId, userId: input.ownerUserId },
        input.userId,
      );
    // Removing membership is sufficient for access denial; also prevent password
    // login. Retain user/audit/tickets instead of deleting historical attribution.
    await tx
      .delete(account)
      .where(
        and(
          eq(account.userId, input.userId),
          eq(account.providerId, "credential"),
          eq(account.issuer, "local:credential"),
        ),
      );
    return { revoked: true, userId: input.userId };
  });
}

export function readReviewCredential(path: string): ReviewInput {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || (stat.mode & 0o777) !== 0o600)
      throw new Error("Review credential must be a regular 0600 file");
    return reviewInputSchema.parse(JSON.parse(readFileSync(fd, "utf8")));
  } finally {
    closeSync(fd);
  }
}

async function main() {
  const [operation, path] = process.argv.slice(2);
  if (!path)
    throw new Error(
      "Use store-reviewer prepare|provision|revoke /protected/credential.json",
    );
  if (operation === "prepare") {
    const input = reviewInputSchema.parse({
      workspaceId: process.env.ISSOPEN_REVIEW_WORKSPACE_ID,
      ownerUserId: process.env.ISSOPEN_REVIEW_OWNER_ID,
      userId: randomUUID(),
      email: process.env.ISSOPEN_REVIEW_EMAIL,
      password: randomBytes(32).toString("base64url"),
    });
    // Create before touching the DB so recovery never needs a plaintext dump.
    writeFileSync(path, `${JSON.stringify(input, null, 2)}\n`, {
      mode: 0o600,
      flag: "wx",
    });
    process.stdout.write(
      "Review credential prepared; contents not displayed.\n",
    );
    return;
  }
  if (operation !== "provision" && operation !== "revoke")
    throw new Error("Unknown review operation");
  const input = readReviewCredential(path);
  const config = loadConfig();
  const connection = createDatabase(config.databaseUrl);
  try {
    const result =
      operation === "provision"
        ? await provisionReviewDemo(
            connection.db,
            createAuth(connection.db, config),
            input,
          )
        : await revokeReviewDemo(connection.db, input);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await connection.close();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch(() => {
    process.stderr.write(
      "Review operation failed; no credentials printed. Check input, permissions and runbook.\n",
    );
    process.exitCode = 1;
  });
}
