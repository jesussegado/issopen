import { contextFingerprint, contextStamp } from "./context.mjs";

export function renderCheckpoint({
  milestone,
  scope,
  detail,
  epic,
  completed,
  verification,
  pending,
  nextStep,
  codeReferences = [],
}) {
  if (!["start", "decision", "blocked", "pause", "review"].includes(milestone))
    throw new Error("Checkpoint must describe a meaningful milestone");
  for (const value of [scope, completed, verification, pending, nextStep])
    if (typeof value !== "string" || !value.trim())
      throw new Error(
        "Checkpoint needs scope, result, verification, pending work and next step",
      );
  for (const reference of codeReferences) {
    const url = new URL(reference);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error("Only real, credential-free code URLs are accepted");
  }
  const stamp = contextStamp(detail, epic);
  const body = [
    `Hito: ${milestone}`,
    `Alcance autorizado: ${scope}`,
    `Proyecto: ${stamp.projectId}; Epic: ${stamp.epicId ?? "ninguno"}; ticket: ${stamp.issueId}`,
    `Estado: ${detail.issue.status}; claim: ${detail.issue.claimedByAgentId ?? "libre"}`,
    `Hecho: ${completed}`,
    `Verificación y resultado: ${verification}`,
    `Pendiente: ${pending}`,
    `Siguiente paso: ${nextStep}`,
    `Referencias reales: ${codeReferences.length ? codeReferences.join("\n") : "Resultado local; sin URL de código publicada"}`,
    `Contexto de origen ${contextFingerprint(stamp)}:\n${JSON.stringify(stamp)}`,
  ].join("\n\n");
  if (
    /issopen_pat_[A-Za-z0-9_-]+|authorization\s*:\s*bearer|cookie\s*:/i.test(
      body,
    )
  )
    throw new Error("Possible secret in checkpoint; redact before publishing");
  if (body.length > 20000)
    throw new Error(
      "Checkpoint exceeds comment limit; summarize the milestone without dumping logs",
    );
  return body;
}

export function recentFirst(items) {
  return [...items].sort(
    (a, b) =>
      Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
      String(b.id).localeCompare(String(a.id)),
  );
}
