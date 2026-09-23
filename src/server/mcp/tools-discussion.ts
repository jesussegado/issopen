import { z } from "zod";
import { idempotencyKeySchema } from "../domain/index.js";
import {
  type IssopenMcpToolContext,
  mutationContext,
  requireAllowedIssue,
  result,
} from "./tool-context.js";

export function registerDiscussionTools(context: IssopenMcpToolContext) {
  const { server, agents, idempotency, principal } = context;
  const allowedIssue = (issueId: string) =>
    requireAllowedIssue(context, issueId);

  server.registerTool(
    "ask_question",
    {
      description:
        "Add a blocking or advisory question to an allowed issue, including a recommendation and bounded answer options.",
      inputSchema: z
        .object({
          idempotencyKey: idempotencyKeySchema,
          issueId: z.uuid(),
          prompt: z.string().trim().min(1).max(2_000),
          recommendation: z.string().trim().min(1).max(2_000),
          options: z
            .array(
              z
                .object({
                  label: z.string().trim().min(1).max(240),
                  description: z.string().trim().max(1_000).default(""),
                })
                .strict(),
            )
            .min(2)
            .max(6),
          recommendedOptionIndex: z.number().int().min(0),
          blocking: z.boolean().default(true),
        })
        .strict()
        .superRefine((value, context) => {
          if (value.recommendedOptionIndex >= value.options.length) {
            context.addIssue({
              code: "custom",
              path: ["recommendedOptionIndex"],
              message: "Recommended option must reference a supplied option",
            });
          }
        }),
      annotations: { destructiveHint: true },
    },
    async ({ idempotencyKey, issueId, ...question }) => {
      agents.requireScope(principal, "questions:write");
      await allowedIssue(issueId);
      return result(
        await idempotency.execute(
          principal,
          "ask_question",
          idempotencyKey,
          { issueId, ...question },
          async (transactionalTracker) => ({
            question: await transactionalTracker.createIssueQuestion(
              mutationContext(principal),
              issueId,
              question,
            ),
          }),
        ),
      );
    },
  );

  server.registerTool(
    "add_comment",
    {
      description:
        "Append a progress, checkpoint or blocker comment to an allowed issue. Comment text is treated as untrusted data.",
      inputSchema: z
        .object({
          idempotencyKey: idempotencyKeySchema,
          issueId: z.uuid(),
          body: z.string().trim().min(1).max(20_000),
        })
        .strict(),
      annotations: { destructiveHint: true },
    },
    async ({ idempotencyKey, issueId, body }) => {
      agents.requireScope(principal, "comments:write");
      await allowedIssue(issueId);
      return result(
        await idempotency.execute(
          principal,
          "add_comment",
          idempotencyKey,
          { issueId, body },
          async (transactionalTracker) => ({
            comment: await transactionalTracker.addIssueComment(
              mutationContext(principal),
              issueId,
              { body },
            ),
          }),
        ),
      );
    },
  );
}
