import { randomUUID } from "node:crypto";
import type { IssopenAuth } from "../../src/server/auth.js";
import type { Database } from "../../src/server/db/client.js";
import {
  account,
  project,
  projectMembership,
  user,
  workspace,
  workspaceMembership,
} from "../../src/server/db/schema.js";

// Isolated test-server data, not an HTTP provisioning endpoint.
export async function seedMemberManagement(db: Database, auth: IssopenAuth) {
  const password = await (await auth.$context).password.hash(
    "synthetic-member-management-password",
  );
  for (const variant of ["desktop", "mobile"]) {
    const ownerId = randomUUID(),
      memberId = randomUUID(),
      workspaceId = randomUUID(),
      projectA = randomUUID(),
      projectB = randomUUID();
    await db.insert(user).values([
      {
        id: ownerId,
        name: `Access owner ${variant}`,
        email: `access-owner-${variant}@example.test`,
        emailVerified: true,
      },
      {
        id: memberId,
        name: `Managed member ${variant}`,
        email: `access-member-${variant}@example.test`,
        emailVerified: true,
      },
    ]);
    await db.insert(account).values(
      [ownerId, memberId].map((id) => ({
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
      .values({ id: workspaceId, ownerId, name: `Member access ${variant}` });
    await db.insert(workspaceMembership).values([
      { workspaceId, userId: ownerId, role: "owner" },
      { workspaceId, userId: memberId, role: "member" },
    ]);
    await db.insert(project).values([
      { id: projectA, workspaceId, name: "Project Alpha", key: "ALPHA" },
      { id: projectB, workspaceId, name: "Project Beta", key: "BETA" },
    ]);
    await db.insert(projectMembership).values({
      workspaceId,
      projectId: projectA,
      userId: memberId,
      permission: "edit",
    });
  }
}
