import { createHash } from "node:crypto";

import { renderPlan } from "./plans.mjs";

const priorities = new Set(["low", "medium", "high", "urgent"]);
const intentPattern = /^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/;
const markerPattern =
  /<!-- issopen-intent:([a-z0-9._:-]+) plan:([a-f0-9]{64}) -->/g;

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function marker(intentKey, renderedPlan) {
  return `<!-- issopen-intent:${intentKey} plan:${hash(renderedPlan)} -->`;
}

function operationKey(epicId, action, intentKey, payload) {
  return `work-epic:${hash(`${epicId}:${action}:${intentKey}:${hash(payload)}`).slice(0, 48)}`;
}

function embeddedIntents(description) {
  return [...(description ?? "").matchAll(markerPattern)].map((match) => ({
    intentKey: match[1],
    planHash: match[2],
  }));
}

function assertIntentKey(intentKey) {
  if (!intentPattern.test(intentKey ?? ""))
    throw new Error(`Invalid semantic intent key: ${intentKey}`);
}

function assertAcyclic(desired) {
  const graph = new Map(
    desired.map((result) => [
      result.intentKey,
      result.dependencyIntentKeys ?? [],
    ]),
  );
  const visiting = [];
  const visited = new Set();
  function visit(key) {
    const index = visiting.indexOf(key);
    if (index >= 0)
      throw new Error(
        `Planned dependency cycle: ${visiting.slice(index).join(" -> ")} -> ${key}`,
      );
    if (visited.has(key) || !graph.has(key)) return;
    visiting.push(key);
    for (const dependency of graph.get(key)) visit(dependency);
    visiting.pop();
    visited.add(key);
  }
  for (const key of [...graph.keys()].sort()) visit(key);
}

export function planEpicReconciliation({
  scope,
  epic,
  inventory,
  existing,
  desired,
}) {
  if (
    scope?.mode !== "work-epic" ||
    scope.projectId !== epic?.projectId ||
    scope.epicId !== epic?.id ||
    inventory?.projectId !== scope.projectId ||
    inventory?.epicId !== scope.epicId ||
    inventory?.epicVersion !== epic.version ||
    !inventory?.fingerprint
  )
    throw new Error("Planning inputs do not match the active inventory");
  if (!Array.isArray(existing) || !Array.isArray(desired))
    throw new Error("Existing and desired results are required");

  const inventoryVersions = new Map(
    inventory.records.map((record) => [record.id, record.version]),
  );
  const existingByIntent = new Map();
  const existingByIssue = new Set();
  for (const entry of existing) {
    const issue = entry?.issue;
    if (
      !issue?.id ||
      issue.projectId !== scope.projectId ||
      issue.epicId !== scope.epicId ||
      inventoryVersions.get(issue.id) !== issue.version ||
      existingByIssue.has(issue.id)
    )
      throw new Error(
        `Existing result is stale, duplicated or out of scope: ${issue?.id}`,
      );
    existingByIssue.add(issue.id);
    const markers = embeddedIntents(issue.description);
    const keys = new Set([
      ...markers.map(({ intentKey }) => intentKey),
      ...(entry.intentKey ? [entry.intentKey] : []),
    ]);
    if (keys.size !== 1)
      throw new Error(
        `Existing result needs one unambiguous semantic intent: ${issue.id}`,
      );
    const intentKey = [...keys][0];
    assertIntentKey(intentKey);
    if (existingByIntent.has(intentKey))
      throw new Error(`Semantic intent has multiple tickets: ${intentKey}`);
    if (!new Set(["complete", "partial"]).has(entry.coverage))
      throw new Error(`Coverage must be complete or partial: ${intentKey}`);
    existingByIntent.set(intentKey, {
      ...entry,
      intentKey,
      markers,
    });
  }

  const desiredByIntent = new Map();
  const prepared = desired.map((result) => {
    assertIntentKey(result?.intentKey);
    if (desiredByIntent.has(result.intentKey))
      throw new Error(`Duplicate desired semantic intent: ${result.intentKey}`);
    if (!result.title?.trim() || !priorities.has(result.priority))
      throw new Error(
        `Desired result needs title and priority: ${result.intentKey}`,
      );
    const renderedPlan = renderPlan(result.plan);
    const preparedResult = {
      ...result,
      title: result.title.trim(),
      renderedPlan,
      planMarker: marker(result.intentKey, renderedPlan),
      dependencyIntentKeys: [
        ...new Set(result.dependencyIntentKeys ?? []),
      ].sort(),
    };
    desiredByIntent.set(result.intentKey, preparedResult);
    return preparedResult;
  });

  const knownIntents = new Set([
    ...existingByIntent.keys(),
    ...desiredByIntent.keys(),
  ]);
  for (const result of prepared)
    for (const dependency of result.dependencyIntentKeys) {
      assertIntentKey(dependency);
      if (!knownIntents.has(dependency))
        throw new Error(`Unknown dependency intent: ${dependency}`);
    }
  assertAcyclic(prepared);

  const actions = [];
  for (const result of prepared.toSorted((a, b) =>
    a.intentKey.localeCompare(b.intentKey),
  )) {
    const current = existingByIntent.get(result.intentKey);
    const exactMarker = current?.markers.some(
      ({ intentKey, planHash }) =>
        intentKey === result.intentKey &&
        planHash === hash(result.renderedPlan),
    );
    if (current?.coverage === "complete" || exactMarker) {
      actions.push({
        kind: "reuse",
        intentKey: result.intentKey,
        issueId: current.issue.id,
        expectedVersion: current.issue.version,
      });
      continue;
    }

    if (current) {
      const addition = `${result.planMarker}\n\n${result.renderedPlan}`;
      const description = `${current.issue.description.trim()}\n\n## Ampliación reconciliada\n\n${addition}`;
      actions.push({
        kind: "update",
        intentKey: result.intentKey,
        issueId: current.issue.id,
        expectedVersion: current.issue.version,
        questionVersions: (current.questions ?? [])
          .map(({ id, version }) => ({ id, version }))
          .sort((a, b) => a.id.localeCompare(b.id)),
        changes: {
          description,
          priority: result.priority,
        },
        idempotencyKey: operationKey(
          epic.id,
          "update",
          result.intentKey,
          description,
        ),
      });
      continue;
    }

    const description = `${result.planMarker}\n\n${result.renderedPlan}`;
    actions.push({
      kind: "create",
      intentKey: result.intentKey,
      expectedStatus: "backlog",
      input: {
        projectId: scope.projectId,
        epicId: scope.epicId,
        title: result.title,
        description,
        priority: result.priority,
      },
      idempotencyKey: operationKey(
        epic.id,
        "create",
        result.intentKey,
        description,
      ),
    });
  }

  return {
    schemaVersion: 1,
    projectId: scope.projectId,
    epicId: scope.epicId,
    epicVersion: epic.version,
    inventoryFingerprint: inventory.fingerprint,
    actions,
  };
}

export function assertReconciliationCurrent(plan, inventory) {
  if (
    plan?.projectId !== inventory?.projectId ||
    plan?.epicId !== inventory?.epicId ||
    plan?.epicVersion !== inventory?.epicVersion ||
    plan?.inventoryFingerprint !== inventory?.fingerprint
  )
    throw new Error(
      "Epic changed after planning; preserve the draft, reread and reconcile before writing",
    );
}
