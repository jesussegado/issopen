import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, ilike, isNotNull, or } from "drizzle-orm";
import { z } from "zod";
import { imageDimensions } from "../shared/image-validation.js";
import {
  avatarMaximumBytes,
  avatarSide,
  type PersonalProfile,
  type updateProfileSchema,
} from "../shared/profile-contract.js";
import { normalizePng } from "./capture-storage.js";
import type { Database } from "./db/client.js";
import {
  project,
  projectMembership,
  user,
  userProfile,
  workspace,
  workspaceMembership,
} from "./db/schema.js";
import { DomainError } from "./domain/errors.js";
import { type HumanAccess, requireProjectAccess } from "./human-access.js";

export async function normalizeAvatar(
  value: string | null,
): Promise<string | null> {
  if (value === null) return null;
  try {
    if (value.length > 131094 || !value.startsWith("data:image/png;base64,"))
      throw new Error();
    const bytes = Buffer.from(value.slice(22), "base64");
    if (bytes.length > avatarMaximumBytes) throw new Error();
    const { width, height, type } = imageDimensions(bytes);
    if (type !== "image/png" || width > avatarSide || height > avatarSide)
      throw new Error();
    // Bound dimensions BEFORE normalizePng inflates scanlines; strips all metadata.
    const normalized = await normalizePng(value);
    if (normalized.length > avatarMaximumBytes) throw new Error();
    return `data:image/png;base64,${normalized.toString("base64")}`;
  } catch {
    throw new DomainError(
      "invalid",
      "Choose a valid local PNG avatar, at most 128×128 pixels and 96 KiB. The web uploader prepares JPEG/WebP images for you.",
    );
  }
}

export class ProfileService {
  constructor(private readonly db: Database) {}
  async get(userId: string): Promise<PersonalProfile> {
    const [row] = await this.db
      .select({
        name: user.name,
        version: userProfile.version,
        avatarPng: userProfile.avatarPng,
      })
      .from(user)
      .leftJoin(userProfile, eq(userProfile.userId, user.id))
      .where(eq(user.id, userId));
    if (!row) throw new DomainError("not_found", "Account not found");
    return row;
  }
  async update(userId: string, input: z.infer<typeof updateProfileSchema>) {
    const avatarPng = await normalizeAvatar(input.avatarPng);
    return this.db.transaction(async (tx) => {
      const [identity] = await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, userId))
        .for("update");
      if (!identity) throw new DomainError("not_found", "Account not found");
      const previous = await new ProfileService(tx).get(userId);
      if (previous.version !== input.expectedVersion)
        throw new DomainError(
          "conflict",
          "Your profile changed in another session. Reload the current profile and compare before saving again.",
        );
      if (previous.name === input.name && previous.avatarPng === avatarPng)
        return previous;
      const version = randomUUID(),
        updatedAt = new Date();
      await tx
        .update(user)
        .set({ name: input.name, updatedAt })
        .where(eq(user.id, userId));
      await tx
        .insert(userProfile)
        .values({ userId, version, avatarPng, updatedAt })
        .onConflictDoUpdate({
          target: userProfile.userId,
          set: { version, avatarPng, updatedAt },
        });
      // Auth identity/email/provider and historical actor snapshots are untouched.
      return { name: input.name, version, avatarPng };
    });
  }
}

const directoryQuery = z.object({
  q: z.string().trim().max(80).default(""),
  cursor: z.string().max(1024).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});
const cursorSchema = z
  .object({
    projectId: z.uuid(),
    q: z.string().max(80),
    after: z.string().min(1).max(256),
  })
  .strict();
export class CollaboratorService {
  constructor(private readonly db: Database) {}
  private async scope(access: HumanAccess, projectId: string) {
    if (!z.uuid().safeParse(projectId).success)
      throw new DomainError("invalid", "Invalid project identifier");
    requireProjectAccess(access, projectId);
    const [row] = await this.db
      .select({ ownerId: workspace.ownerId })
      .from(project)
      .innerJoin(workspace, eq(workspace.id, project.workspaceId))
      .where(
        and(
          eq(project.id, projectId),
          eq(project.workspaceId, access.workspaceId),
        ),
      );
    if (!row) throw new DomainError("not_found", "Project not found");
    return and(
      eq(workspaceMembership.workspaceId, access.workspaceId),
      or(
        and(
          eq(workspaceMembership.role, "owner"),
          eq(workspaceMembership.userId, row.ownerId),
        ),
        and(
          eq(workspaceMembership.role, "member"),
          isNotNull(projectMembership.projectId),
        ),
      ),
    );
  }
  private members(projectId: string) {
    return this.db
      .select({
        id: user.id,
        name: user.name,
        role: workspaceMembership.role,
        permission: projectMembership.permission,
        avatarVersion: userProfile.version,
        hasAvatar: isNotNull(userProfile.avatarPng),
      })
      .from(workspaceMembership)
      .innerJoin(user, eq(user.id, workspaceMembership.userId))
      .leftJoin(
        projectMembership,
        and(
          eq(projectMembership.userId, user.id),
          eq(projectMembership.workspaceId, workspaceMembership.workspaceId),
          eq(projectMembership.projectId, projectId),
        ),
      )
      .leftJoin(userProfile, eq(userProfile.userId, user.id));
  }
  async list(access: HumanAccess, projectId: string, input: unknown) {
    const scope = await this.scope(access, projectId);
    const parsed = directoryQuery.safeParse(input);
    if (!parsed.success)
      throw new DomainError(
        "invalid",
        "Invalid collaborator filter or page size",
      );
    const { q, limit, cursor } = parsed.data;
    let after: string | undefined;
    if (cursor) {
      try {
        const decoded = cursorSchema.parse(
          JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")),
        );
        if (decoded.projectId !== projectId || decoded.q !== q)
          throw new Error();
        after = decoded.after;
      } catch {
        throw new DomainError(
          "invalid",
          "This collaborator page does not match the project or search. Start a new search.",
        );
      }
    }
    const rows = await this.members(projectId)
      .where(
        and(
          scope,
          q ? ilike(user.name, `%${q.replace(/[\\%_]/g, "\\$&")}%`) : undefined,
          after ? gt(user.id, after) : undefined,
        ),
      )
      .orderBy(asc(user.id))
      .limit(limit + 1);
    const page = rows.slice(0, limit),
      last = page.at(-1);
    return {
      collaborators: page.map(
        ({ hasAvatar, avatarVersion, permission, ...person }) => ({
          ...person,
          permission:
            person.role === "owner"
              ? ("edit" as const)
              : (permission ?? ("read" as const)),
          avatarUrl:
            hasAvatar && avatarVersion
              ? `/api/v1/projects/${projectId}/collaborators/${encodeURIComponent(person.id)}/avatar?workspace=${access.workspaceId}&v=${avatarVersion}`
              : null,
        }),
      ),
      nextCursor:
        rows.length > limit && last
          ? Buffer.from(
              JSON.stringify({ projectId, q, after: last.id }),
            ).toString("base64url")
          : null,
    };
  }
  async avatar(access: HumanAccess, projectId: string, userId: string) {
    const scope = await this.scope(access, projectId);
    const [person] = await this.members(projectId).where(
      and(scope, eq(user.id, userId)),
    );
    if (!person) throw new DomainError("not_found", "Collaborator not found");
    const profile = await new ProfileService(this.db).get(userId);
    if (!profile.avatarPng)
      throw new DomainError("not_found", "Avatar not found");
    return Buffer.from(profile.avatarPng.slice(22), "base64");
  }
  async get(
    access: HumanAccess,
    projectId: string,
    userId: string,
    requireEdit = false,
  ) {
    const scope = await this.scope(access, projectId);
    const [person] = await this.members(projectId).where(
      and(scope, eq(user.id, userId)),
    );
    if (!person)
      throw new DomainError(
        "invalid",
        "Choose someone who currently has access to this project.",
      );
    if (requireEdit && person.role !== "owner" && person.permission !== "edit")
      throw new DomainError(
        "invalid",
        "Choose someone with edit access who can answer questions in this project.",
      );
    return { id: person.id, name: person.name };
  }
}
