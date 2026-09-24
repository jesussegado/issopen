import { createHash } from "node:crypto";

export const workEpicScopeSets = Object.freeze({
  read: Object.freeze(["issues:read"]),
  plan: Object.freeze([
    "issues:read",
    "issues:create",
    "issues:write",
    "questions:write",
    "epics:write",
  ]),
  execute: Object.freeze([
    "issues:read",
    "issues:claim",
    "issues:write",
    "comments:write",
    "code:link",
  ]),
});

function requiredCompletionScope(project) {
  const workflow = project?.workflow;
  if (!workflow?.completionStatus) throw new Error("Project workflow required");
  if (workflow.completionStatus === "ready_for_review") return "issues:review";
  if (workflow.completionStatus === "done") return "issues:close";
  throw new Error("Unsupported project completion workflow");
}

function validVersion(value) {
  return /^\d+\.\d+\.\d+$/.test(value ?? "");
}

export function startWorkEpic({
  explicit,
  project,
  epic,
  agentContext,
  repositoryAssociation,
  skillVersion,
  capabilities = ["read", "plan", "execute"],
}) {
  if (explicit !== true)
    throw new Error("work-epic requires an explicit Epic reference");
  if (!project?.id || !epic?.id || epic.projectId !== project.id)
    throw new Error("Epic and project association is invalid");
  if (!Number.isInteger(epic.number) || !Number.isInteger(epic.version))
    throw new Error("Authoritative Epic number and version required");
  if (epic.archivedAt) throw new Error("Archived Epic cannot start work-epic");
  if (!validVersion(skillVersion))
    throw new Error("Published semantic skill version required");
  if (!agentContext?.projectIds?.includes(project.id))
    throw new Error("Project is outside the agent allowlist");
  if (
    repositoryAssociation?.projectId !== project.id ||
    !["matched", "confirmed"].includes(repositoryAssociation?.kind)
  )
    throw new Error("Repository association is missing or ambiguous");
  if (!Array.isArray(capabilities) || !capabilities.length)
    throw new Error("At least one work-epic capability is required");
  const unknown = capabilities.filter(
    (capability) => !Object.hasOwn(workEpicScopeSets, capability),
  );
  if (unknown.length)
    throw new Error(`Unknown work-epic capabilities: ${unknown.join(", ")}`);
  const requiredScopes = new Set(
    capabilities.flatMap((capability) => workEpicScopeSets[capability]),
  );
  if (capabilities.includes("execute"))
    requiredScopes.add(requiredCompletionScope(project));
  const actualScopes = new Set(agentContext.scopes ?? []);
  const missingScopes = [...requiredScopes]
    .filter((scope) => !actualScopes.has(scope))
    .sort();
  if (missingScopes.length)
    throw new Error(`Missing work-epic scopes: ${missingScopes.join(", ")}`);

  return {
    schemaVersion: 1,
    mode: "work-epic",
    projectId: project.id,
    epicId: epic.id,
    epicNumber: epic.number,
    epicVersion: epic.version,
    skillVersion,
    repositoryAssociation: repositoryAssociation.kind,
    capabilities: [...new Set(capabilities)].sort(),
    completionStatus: project.workflow.completionStatus,
  };
}

export function workEpicFingerprint(scope) {
  if (scope?.mode !== "work-epic" || !scope.projectId || !scope.epicId)
    throw new Error("Complete work-epic scope required");
  return createHash("sha256").update(JSON.stringify(scope)).digest("hex");
}

export function canContinueWorkEpic(previous, current) {
  if (!previous || !current) return false;
  return workEpicFingerprint(previous) === workEpicFingerprint(current);
}
