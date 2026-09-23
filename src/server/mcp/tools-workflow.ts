import { z } from "zod";
import { issueStatusValues } from "../db/schema.js";
import {
  idempotencyKeySchema,
  questionVersionsSchema,
} from "../domain/index.js";
import {
  type IssopenMcpToolContext,
  mutationContext,
  requireAllowedIssue,
  result,
} from "./tool-context.js";

export function registerWorkflowTools(context: IssopenMcpToolContext) {
  const { server, agents, idempotency, principal } = context;
  const allowedIssue = (issueId: string) =>
    requireAllowedIssue(context, issueId);

  server.registerTool(
    "claim_issue",
    {
      description: "Claim an allowed issue for this agent identity.",
      inputSchema: z
        .object({ idempotencyKey: idempotencyKeySchema, issueId: z.uuid() })
        .strict(),
    },
    async ({ idempotencyKey, issueId }) => {
      agents.requireScope(principal, "issues:claim");
      await allowedIssue(issueId);
      return result(
        await idempotency.execute(
          principal,
          "claim_issue",
          idempotencyKey,
          { issueId },
          async (transactionalTracker) => ({
            issue: await transactionalTracker.claimIssue(
              mutationContext(principal),
              issueId,
              principal.agent.id,
            ),
          }),
        ),
      );
    },
  );

  server.registerTool(
    "release_issue",
    {
      description: "Release this identity's claim on an allowed issue.",
      inputSchema: z
        .object({ idempotencyKey: idempotencyKeySchema, issueId: z.uuid() })
        .strict(),
    },
    async ({ idempotencyKey, issueId }) => {
      agents.requireScope(principal, "issues:claim");
      await allowedIssue(issueId);
      return result(
        await idempotency.execute(
          principal,
          "release_issue",
          idempotencyKey,
          { issueId },
          async (transactionalTracker) => ({
            issue: await transactionalTracker.releaseIssue(
              mutationContext(principal),
              issueId,
            ),
          }),
        ),
      );
    },
  );

  server.registerTool(
    "link_code_result",
    {
      description: "Link an HTTP(S) branch, commit or pull request result.",
      inputSchema: z
        .object({
          idempotencyKey: idempotencyKeySchema,
          issueId: z.uuid(),
          type: z.enum(["branch", "commit", "pull_request"]),
          url: z.url().max(2_048),
        })
        .strict(),
    },
    async ({ idempotencyKey, issueId, type, url }) => {
      agents.requireScope(principal, "code:link");
      await allowedIssue(issueId);
      return result(
        await idempotency.execute(
          principal,
          "link_code_result",
          idempotencyKey,
          { issueId, type, url },
          (transactionalTracker) =>
            transactionalTracker.addCodeLink(
              mutationContext(principal),
              issueId,
              { type, url },
            ),
        ),
      );
    },
  );

  server.registerTool(
    "move_issue",
    {
      description:
        "Move an allowed issue through its project workflow. Read get_project.workflow first: projects that skip human review finish at Done, which requires issues:close.",
      inputSchema: z
        .object({
          idempotencyKey: idempotencyKeySchema,
          issueId: z.uuid(),
          status: z.enum(issueStatusValues),
          expectedVersion: z.number().int().positive().optional(),
          questionVersions: questionVersionsSchema.optional(),
        })
        .strict(),
      annotations: { destructiveHint: true },
    },
    async ({
      idempotencyKey,
      issueId,
      status,
      expectedVersion,
      questionVersions,
    }) => {
      agents.requireScope(principal, "issues:review");
      if (status === "done") agents.requireScope(principal, "issues:close");
      await allowedIssue(issueId);
      return result(
        await idempotency.execute(
          principal,
          "move_issue",
          idempotencyKey,
          {
            issueId,
            status,
            ...(expectedVersion !== undefined ? { expectedVersion } : {}),
            ...(questionVersions ? { questionVersions } : {}),
          },
          async (transactionalTracker) => ({
            issue: await transactionalTracker.updateIssue(
              mutationContext(principal),
              issueId,
              {
                status,
                ...(expectedVersion !== undefined ? { expectedVersion } : {}),
                ...(questionVersions ? { questionVersions } : {}),
              },
            ),
          }),
        ),
      );
    },
  );
}
