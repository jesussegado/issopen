import { createHash, randomUUID } from "node:crypto";
import type { IssopenAuth } from "../../src/server/auth.js";
import type { Database } from "../../src/server/db/client.js";
import {
  account,
  project,
  projectMembership,
  user,
  workspace,
  workspaceInvitation,
  workspaceInvitationProject,
  workspaceMembership,
} from "../../src/server/db/schema.js";

// Synthetic fixture tokens only, inserted by the isolated test server. No seed endpoint.
export const onboardingToken = (state: string, variant: string) =>
  `${state}-${variant}`.padEnd(43, "x");
export const onboardingPassword = "synthetic-onboarding-password";
export async function seedOnboarding(db: Database, auth: IssopenAuth) {
  const password = await (await auth.$context).password.hash(
    onboardingPassword,
  );
  for (const variant of ["desktop", "mobile"]) {
    const ownerId = randomUUID(),
      workspaceId = randomUUID();
    const members = ["existing", "multiple", "zero"].map((kind) => ({
      id: randomUUID(),
      kind,
    }));
    await db.insert(user).values([
      {
        id: ownerId,
        name: "Onboarding owner",
        email: `onboarding-owner-${variant}@example.test`,
        emailVerified: true,
      },
      ...members.map(({ id, kind }) => ({
        id,
        name: `Onboarding ${kind}`,
        email: `onboarding-${kind}-${variant}@example.test`,
        emailVerified: true,
      })),
    ]);
    await db.insert(account).values(
      members.map(({ id }) => ({
        id: randomUUID(),
        userId: id,
        accountId: id,
        providerId: "credential",
        issuer: "local:credential",
        password,
      })),
    );
    await db
      .insert(workspace)
      .values({ id: workspaceId, ownerId, name: `Onboarding ${variant}` });
    await db.insert(workspaceMembership).values([
      { workspaceId, userId: ownerId, role: "owner" },
      ...members
        .filter(({ kind }) => kind !== "existing")
        .map(({ id }) => ({
          workspaceId,
          userId: id,
          role: "member" as const,
        })),
    ]);
    for (const suffix of ["A", "B"]) {
      const projectId = randomUUID();
      await db.insert(project).values({
        id: projectId,
        workspaceId,
        name: `Onboarding project ${suffix}`,
        key: `ONB${suffix}`,
      });
      const member = members.find(({ kind }) => kind === "multiple");
      if (!member) throw new Error("Fixture member missing");
      await db.insert(projectMembership).values({
        workspaceId,
        projectId,
        userId: member.id,
        permission: suffix === "A" ? "read" : "edit",
      });
      if (suffix !== "A") continue;
      for (const state of [
        "new",
        "existing",
        "expired",
        "revoked",
        "mismatch",
      ]) {
        const id = randomUUID();
        await db.insert(workspaceInvitation).values({
          id,
          workspaceId,
          email: `onboarding-${state}-${variant}@example.test`,
          role: "member",
          tokenHash: createHash("sha256")
            .update(onboardingToken(state, variant))
            .digest("hex"),
          createdByUserId: ownerId,
          expiresAt: new Date(
            Date.now() + (state === "expired" ? -1 : 1) * 3_600_000,
          ),
          revokedAt: state === "revoked" ? new Date() : null,
        });
        await db
          .insert(workspaceInvitationProject)
          .values({ invitationId: id, workspaceId, projectId });
      }
    }
  }
}
