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

// Test-server-only seed, never imported by the product or exposed via an endpoint.
export async function seedMultiworkspace(db: Database, auth: IssopenAuth) {
  const memberId = randomUUID();
  const ownerIds = [randomUUID(), randomUUID()];
  const workspaceIds = [randomUUID(), randomUUID()];
  const password = await (await auth.$context).password.hash(
    "synthetic-multiworkspace-e2e-password",
  );
  await db.insert(user).values([
    {
      id: memberId,
      name: "Two workspaces tester",
      email: "multiworkspace-e2e@example.test",
      emailVerified: true,
    },
    ...ownerIds.map((id) => ({
      id,
      name: "Synthetic owner",
      email: `${id}@example.test`,
      emailVerified: true,
    })),
  ]);
  await db.insert(account).values({
    id: randomUUID(),
    userId: memberId,
    accountId: memberId,
    providerId: "credential",
    issuer: "local:credential",
    password,
  });
  for (const [index, workspaceId] of workspaceIds.entries()) {
    const ownerId = ownerIds[index];
    if (!ownerId) throw new Error("Fixture owner missing");
    const projectId = randomUUID();
    const suffix = index === 0 ? "A" : "B";
    await db
      .insert(workspace)
      .values({ id: workspaceId, ownerId, name: `Team ${suffix}` });
    await db.insert(workspaceMembership).values([
      { workspaceId, userId: ownerId, role: "owner" },
      { workspaceId, userId: memberId, role: "member" },
    ]);
    await db.insert(project).values({
      id: projectId,
      workspaceId,
      name: `Team ${suffix} project`,
      key: `TEAM${suffix}`,
    });
    await db
      .insert(projectMembership)
      .values({ workspaceId, projectId, userId: memberId });
  }
}
