import { createHash, randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import {
  type CaptureMetadata,
  captureSubmissionSchema,
  imagesSchema,
  maximumPngBytes,
  maximumRequestBytes,
} from "../shared/capture-contract.js";
import type { OwnerSession } from "./auth.js";
import {
  CaptureError,
  type CaptureStorage,
  normalizePng,
} from "./capture-storage.js";
import type { Database } from "./db/client.js";
import { captureEvidence, extensionReceipt, issue, user } from "./db/schema.js";
import {
  DomainError,
  type MutationContext,
  TrackerService,
} from "./domain/index.js";
import {
  type HumanAccess,
  requireHumanAccess,
  requireProjectAccess,
  requireWorkspaceOwner,
} from "./human-access.js";

export type ExtensionBindings = {
  Variables: {
    ownerId: string;
    clientId: string;
    expiresAt: string;
    workspaceId: string;
    canWrite: boolean;
    workspaceRole: "owner" | "member";
    projectIds: string[] | null;
  };
};
const projectInput = z
  .object({ idempotencyKey: z.uuid(), name: z.string().trim().min(1).max(120) })
  .strict();
const epicInput = z
  .object({
    idempotencyKey: z.uuid(),
    title: z.string().trim().min(1).max(240),
  })
  .strict();
const webCaptureInput = z
  .object({
    idempotencyKey: z.uuid(),
    projectId: z.uuid(),
    epicId: z.uuid().nullable(),
    title: z.string().trim().min(1).max(240),
    description: z.string().trim().max(50000),
    priority: z.enum(["low", "medium", "high", "urgent"]),
    status: z.enum([
      "backlog",
      "ready",
      "in_progress",
      "ready_for_review",
      "done",
    ]),
    images: imagesSchema,
  })
  .strict();
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export async function boundedJson(
  request: Request,
  limit = maximumRequestBytes,
): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new CaptureError("validation");
  const reader = request.body?.getReader();
  if (!reader) throw new CaptureError("validation");
  const chunks: Uint8Array[] = [];
  let size = 0;
  const deadline = setTimeout(() => {
    void reader.cancel();
  }, 15000);
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > limit) {
        await reader.cancel();
        throw new CaptureError("size", 413);
      }
      chunks.push(part.value);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new CaptureError("validation");
    }
  } finally {
    clearTimeout(deadline);
    reader.releaseLock();
  }
}
async function context(
  db: Database,
  workspaceId: string,
  ownerId: string,
  source: MutationContext["source"] = "chrome_extension",
): Promise<MutationContext> {
  const [person] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, ownerId));
  return {
    workspaceId,
    actor: { type: "human", id: ownerId, displayName: person?.name ?? "Owner" },
    source,
  };
}
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function storeImages(
  tx: Transaction,
  storage: CaptureStorage | undefined,
  ctx: MutationContext,
  issueId: string,
  images: string[],
  metadata: CaptureMetadata | null,
  uploadedImages: boolean,
) {
  if (images.length === 0) return;
  if (!storage) throw new CaptureError("storage", 503);
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended('chrome-attachment-storage', 0))`,
  );
  const normalized: Buffer[] = [];
  let bytes = 0;
  for (const image of images) {
    const png = await normalizePng(image);
    bytes += png.length;
    if (bytes > maximumPngBytes) throw new CaptureError("size", 413);
    normalized.push(png);
  }
  for (const [index, image] of normalized.entries()) {
    const file = await storage.write(image);
    await tx.insert(captureEvidence).values({
      id: randomUUID(),
      workspaceId: ctx.workspaceId,
      ownerId: ctx.actor.id,
      issueId,
      metadata: uploadedImages
        ? {
            ...(index === 0 && metadata ? metadata : {}),
            mode: "upload",
            attachmentIndex: index,
          }
        : metadata,
      ...file,
    });
  }
  // Never remove on uncertain commit: aged unreferenced files are GC'd by the
  // operator, so a successfully committed receipt cannot lose pixels.
}

type CapturedIssueInput = z.infer<typeof webCaptureInput> & {
  metadata: CaptureMetadata | null;
};

async function createCapturedIssue(
  db: Database,
  storage: CaptureStorage | undefined,
  ctx: MutationContext,
  operation: "capture" | "web_capture",
  input: CapturedIssueInput,
  base: string,
  uploadedImages: boolean,
  receiptPayload: unknown = input,
) {
  return once(
    db,
    ctx,
    operation,
    input.idempotencyKey,
    receiptPayload,
    async (tx, tracker) => {
      const created = await tracker.createIssue(ctx, {
        projectId: input.projectId,
        epicId: input.epicId,
        title: input.title,
        description: input.description,
        priority: input.priority,
        status: input.status,
      });
      await storeImages(
        tx,
        storage,
        ctx,
        created.id,
        input.images,
        input.metadata,
        uploadedImages,
      );
      if (input.metadata && input.images.length === 0)
        await tx.insert(captureEvidence).values({
          id: randomUUID(),
          workspaceId: ctx.workspaceId,
          ownerId: ctx.actor.id,
          issueId: created.id,
          metadata: input.metadata,
        });
      return {
        issue: {
          id: created.id,
          key: created.key,
          number: created.number,
          title: created.title,
          url: new URL(`/issues/${created.id}`, base).toString(),
        },
      };
    },
  );
}

async function once(
  db: Database,
  ctx: MutationContext,
  operation: string,
  key: string,
  payload: unknown,
  execute: (
    tx: Transaction,
    tracker: TrackerService,
  ) => Promise<Record<string, unknown>>,
) {
  const hash = createHash("sha256").update(canonical(payload)).digest("hex");
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`chrome:${ctx.workspaceId}:${ctx.actor.id}:${operation}:${key}`}, 0))`,
    );
    const [receipt] = await tx
      .select()
      .from(extensionReceipt)
      .where(
        and(
          eq(extensionReceipt.workspaceId, ctx.workspaceId),
          eq(extensionReceipt.ownerId, ctx.actor.id),
          eq(extensionReceipt.operation, operation),
          eq(extensionReceipt.key, key),
        ),
      );
    if (receipt) {
      if (receipt.requestHash !== hash) throw new CaptureError("conflict", 409);
      const previous = z
        .object({ issue: z.object({ id: z.uuid() }) })
        .safeParse(receipt.response);
      if (previous.success)
        await new TrackerService(tx).getIssue(
          ctx.workspaceId,
          previous.data.issue.id,
        );
      return receipt.response;
    }
    const response = JSON.parse(
      JSON.stringify(await execute(tx, new TrackerService(tx))),
    );
    await tx.insert(extensionReceipt).values({
      id: randomUUID(),
      workspaceId: ctx.workspaceId,
      ownerId: ctx.actor.id,
      operation,
      key,
      requestHash: hash,
      response,
    });
    return response;
  });
}
// Deliberately constant messages: no SQL, submitted DOM, URL, image or token in logs.
function errorResult(error: Error) {
  if (error instanceof CaptureError)
    return Response.json(
      {
        code: error.code,
        error:
          error.code === "validation"
            ? "One or more image attachments are invalid"
            : error.code === "size"
              ? "The image attachments exceed the allowed limits"
              : error.code === "quota"
                ? "Private image storage has no available capacity"
                : error.code === "storage"
                  ? "Private image storage is temporarily unavailable"
                  : error.code === "conflict"
                    ? "This request key was already used with different content"
                    : "Image processing is busy; retry manually",
      },
      { status: error.status },
    );
  if (error instanceof z.ZodError)
    return Response.json(
      { code: "validation", error: "Invalid capture fields" },
      { status: 400 },
    );
  if (error instanceof DomainError)
    return Response.json(
      { code: error.code, error: "Target unavailable or invalid" },
      {
        status:
          error.code === "not_found"
            ? 404
            : error.code === "forbidden"
              ? 403
              : error.code === "conflict"
                ? 409
                : 400,
      },
    );
  return Response.json(
    {
      code: "storage",
      error: "Operation unavailable; retry with the same key",
    },
    { status: 503 },
  );
}
export function createCaptureRouter(
  db: Database,
  storage: CaptureStorage | undefined,
  base: string,
) {
  const router = new Hono<ExtensionBindings>();
  let active = 0;
  const requireExtensionProject = (
    projectIds: string[] | null,
    projectId: string,
  ) => {
    if (projectIds !== null && !projectIds.includes(projectId)) {
      throw new DomainError("not_found", "Project not found");
    }
  };
  router.onError(errorResult);
  router.use("*", async (c, next) => {
    if (c.req.method === "POST" && !c.get("canWrite"))
      return c.json(
        {
          code: "permission",
          error: "Reconnect Issopen to authorize ticket creation",
        },
        403,
      );
    if (active >= 2)
      return c.json({ code: "busy", error: "Retry manually" }, 429);
    active++;
    try {
      await next();
    } finally {
      active--;
    }
  });
  router.get("/projects/:id/epics", async (c) => {
    const id = z.uuid().parse(c.req.param("id"));
    requireExtensionProject(c.get("projectIds"), id);
    const tracker = new TrackerService(db);
    await tracker.getProject(c.get("workspaceId"), id);
    return c.json({
      epics: (await tracker.listEpics(c.get("workspaceId"), id)).map(
        ({ id, number, title }) => ({ id, number, title }),
      ),
    });
  });
  router.post("/projects", async (c) => {
    if (c.get("workspaceRole") !== "owner") {
      throw new DomainError("forbidden", "Only an owner can create projects");
    }
    const input = projectInput.parse(await boundedJson(c.req.raw, 4096));
    const ctx = await context(db, c.get("workspaceId"), c.get("ownerId"));
    return c.json(
      await once(
        db,
        ctx,
        "project",
        input.idempotencyKey,
        input,
        async (_tx, tracker) => {
          const p = await tracker.createProject(ctx, {
            name: input.name,
            key: `P${randomUUID().replaceAll("-", "").slice(0, 9).toUpperCase()}`,
          });
          return { project: { id: p.id, name: p.name } };
        },
      ),
      201,
    );
  });
  router.post("/projects/:id/epics", async (c) => {
    const projectId = z.uuid().parse(c.req.param("id"));
    requireExtensionProject(c.get("projectIds"), projectId);
    const input = epicInput.parse(await boundedJson(c.req.raw, 4096));
    const ctx = await context(db, c.get("workspaceId"), c.get("ownerId"));
    return c.json(
      await once(
        db,
        ctx,
        "epic",
        input.idempotencyKey,
        { ...input, projectId },
        async (_tx, tracker) => {
          const e = await tracker.createEpic(ctx, {
            projectId,
            title: input.title,
          });
          return { epic: { id: e.id, number: e.number, title: e.title } };
        },
      ),
      201,
    );
  });
  router.post("/captures", async (c) => {
    const input = captureSubmissionSchema.parse(await boundedJson(c.req.raw));
    requireExtensionProject(c.get("projectIds"), input.projectId);
    const ctx = await context(db, c.get("workspaceId"), c.get("ownerId"));
    const images = input.images ?? (input.image ? [input.image] : []);
    return c.json(
      await createCapturedIssue(
        db,
        storage,
        ctx,
        "capture",
        { ...input, images, metadata: input.metadata },
        base,
        input.images !== undefined,
        input,
      ),
      201,
    );
  });
  return router;
}

export function createEvidenceRouter(db: Database, storage?: CaptureStorage) {
  const router = new Hono<{
    Variables: {
      ownerSession: OwnerSession;
      humanAccess: HumanAccess | null;
    };
  }>();
  router.onError(errorResult);
  router.post("/captures", async (c) => {
    const input = webCaptureInput.parse(await boundedJson(c.req.raw));
    const access = requireHumanAccess(c.get("humanAccess"));
    requireProjectAccess(access, input.projectId);
    const ctx = await context(db, access.workspaceId, access.user.id, "rest");
    return c.json(
      await createCapturedIssue(
        db,
        storage,
        ctx,
        "web_capture",
        { ...input, metadata: null },
        new URL(c.req.url).origin,
        true,
      ),
      201,
    );
  });
  router.get("/extensions/storage", async (c) => {
    requireWorkspaceOwner(requireHumanAccess(c.get("humanAccess")));
    if (!storage) throw new CaptureError("storage", 503);
    c.header("Cache-Control", "private, no-store");
    return c.json(await storage.usage());
  });
  router.get("/issues/:id/evidence", async (c) => {
    const issueId = z.uuid().parse(c.req.param("id"));
    const access = requireHumanAccess(c.get("humanAccess"));
    const foundIssue = await new TrackerService(db).getIssue(
      access.workspaceId,
      issueId,
    );
    requireProjectAccess(access, foundIssue.projectId);
    const rows = await db
      .select()
      .from(captureEvidence)
      .where(
        and(
          eq(captureEvidence.issueId, issueId),
          eq(captureEvidence.workspaceId, access.workspaceId),
        ),
      )
      .orderBy(
        sql`coalesce(${captureEvidence.metadata}->>'attachmentIndex', '0')`,
        captureEvidence.createdAt,
        captureEvidence.id,
      );
    c.header("Cache-Control", "private, no-store");
    return c.json({
      evidence: rows.map(
        ({ id, metadata, mime, bytes, sha256, createdAt, fileKey }) => ({
          id,
          metadata,
          mime,
          bytes,
          sha256,
          createdAt,
          imageUrl: fileKey ? `/api/v1/evidence/${id}/image` : null,
        }),
      ),
    });
  });
  router.get("/evidence/:id/image", async (c) => {
    const id = z.uuid().parse(c.req.param("id"));
    const access = requireHumanAccess(c.get("humanAccess"));
    const [row] = await db
      .select({ evidence: captureEvidence, projectId: issue.projectId })
      .from(captureEvidence)
      .innerJoin(
        issue,
        and(
          eq(issue.id, captureEvidence.issueId),
          eq(issue.workspaceId, captureEvidence.workspaceId),
        ),
      )
      .where(
        and(
          eq(captureEvidence.id, id),
          isNull(issue.deletedAt),
          eq(captureEvidence.workspaceId, access.workspaceId),
        ),
      );
    const data = row?.evidence;
    const projectId = row?.projectId;
    if (!projectId || !data?.fileKey || !data.sha256)
      return c.json({ error: "Not found" }, 404);
    const fileKey = data.fileKey;
    const sha256 = data.sha256;
    requireProjectAccess(access, projectId);
    if (!storage) throw new CaptureError("storage", 503);
    const png = await storage.read(fileKey, sha256, data.bytes);
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(png.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Referrer-Policy": "no-referrer",
        "Content-Disposition": `${c.req.query("download") === "1" ? "attachment" : "inline"}; filename="capture-${id}.png"`,
      },
    });
  });
  return router;
}
