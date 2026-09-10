import { z } from "zod";
import {
  activitySourceValues,
  actorTypeValues,
  codeLinkTypeValues,
  issuePriorityValues,
  issueStatusValues,
} from "../db/schema.js";

const optionalBoundedText = (maximum: number) =>
  z.string().trim().max(maximum).nullable().optional();

const externalUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine((value) => URL.canParse(value), "Must be a valid URL")
  .refine((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  }, "Only HTTP and HTTPS URLs are allowed")
  .refine((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return url.username === "" && url.password === "";
  }, "URLs must not contain credentials");

export const projectKeySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z][A-Z0-9]{1,9}$/,
    "Use 2-10 uppercase letters or digits, starting with a letter",
  );

export const repositoryUrlSchema = externalUrlSchema;
export const codeResultUrlSchema = externalUrlSchema;

export const repositorySubdirectorySchema = z
  .string()
  .trim()
  .max(512)
  .refine((value) => !value.startsWith("/"), "Must be repository-relative")
  .refine(
    (value) => !value.split("/").includes(".."),
    "Must not traverse outside the repository",
  );

export const issueStatusSchema = z.enum(issueStatusValues);
export const issuePrioritySchema = z.enum(issuePriorityValues);
export const actorTypeSchema = z.enum(actorTypeValues);
export const activitySourceSchema = z.enum(activitySourceValues);
export const codeLinkTypeSchema = z.enum(codeLinkTypeValues);

export const mutationContextSchema = z.object({
  workspaceId: z.uuid(),
  actor: z.object({
    type: actorTypeSchema,
    id: z.string().trim().min(1).max(128),
    displayName: z.string().trim().min(1).max(120),
  }),
  source: activitySourceSchema,
  authorization: z
    .object({
      canCloseIssues: z.boolean().default(false),
    })
    .optional(),
});

export const createProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    key: projectKeySchema,
    description: z.string().trim().max(10_000).default(""),
    repositoryUrl: repositoryUrlSchema.nullable().optional(),
    defaultBranch: optionalBoundedText(255),
    repositorySubdirectory: repositorySubdirectorySchema.nullable().optional(),
  })
  .strict();

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(10_000).optional(),
    repositoryUrl: repositoryUrlSchema.nullable().optional(),
    defaultBranch: optionalBoundedText(255),
    repositorySubdirectory: repositorySubdirectorySchema.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "No changes supplied");

export const createEpicSchema = z
  .object({
    projectId: z.uuid(),
    title: z.string().trim().min(1).max(240),
    description: z.string().trim().max(20_000).default(""),
  })
  .strict();

export const updateEpicSchema = z
  .object({
    title: z.string().trim().min(1).max(240).optional(),
    description: z.string().trim().max(20_000).optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict()
  .refine(
    (value) => value.title !== undefined || value.description !== undefined,
    "No changes supplied",
  );

export const createIssueSchema = z
  .object({
    projectId: z.uuid(),
    epicId: z.uuid().nullable().optional(),
    title: z.string().trim().min(1).max(240),
    description: z.string().trim().max(50_000).default(""),
    priority: issuePrioritySchema.default("medium"),
    status: issueStatusSchema.default("backlog"),
  })
  .strict();

export const questionVersionsSchema = z
  .array(
    z.object({ id: z.uuid(), version: z.number().int().positive() }).strict(),
  )
  .max(1000)
  .refine(
    (values) => new Set(values.map((item) => item.id)).size === values.length,
    "Question IDs must be unique",
  );

export const updateIssueSchema = z
  .object({
    title: z.string().trim().min(1).max(240).optional(),
    description: z.string().trim().max(50_000).optional(),
    priority: issuePrioritySchema.optional(),
    status: issueStatusSchema.optional(),
    epicId: z.uuid().nullable().optional(),
    expectedVersion: z.number().int().positive().optional(),
    questionVersions: questionVersionsSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      Object.keys(value).some(
        (key) => key !== "expectedVersion" && key !== "questionVersions",
      ),
    "No changes supplied",
  );

export const deleteIssueSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    questionVersions: questionVersionsSchema,
  })
  .strict();

export const addCodeLinkSchema = z
  .object({
    type: codeLinkTypeSchema,
    url: codeResultUrlSchema,
  })
  .strict();

export const addIssueCommentSchema = z
  .object({ body: z.string().trim().min(1).max(20_000) })
  .strict();

const issueQuestionOptionInputSchema = z
  .object({
    label: z.string().trim().min(1).max(240),
    description: z.string().trim().max(1_000).default(""),
  })
  .strict();

export const createIssueQuestionSchema = z
  .object({
    prompt: z.string().trim().min(1).max(2_000),
    recommendation: z.string().trim().min(1).max(2_000),
    options: z.array(issueQuestionOptionInputSchema).min(2).max(6),
    recommendedOptionIndex: z.number().int().min(0),
    blocking: z.boolean().default(true),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.recommendedOptionIndex >= value.options.length) {
      context.addIssue({
        code: "custom",
        path: ["recommendedOptionIndex"],
        message:
          "Recommended option must reference one of the supplied options",
      });
    }
  });

export const answerIssueQuestionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("option"), optionId: z.uuid() }).strict(),
  z
    .object({
      kind: z.literal("other"),
      text: z.string().trim().min(1).max(5_000),
    })
    .strict(),
]);

export const requestChangesSchema = z
  .object({ reason: z.string().trim().min(1).max(1_000) })
  .strict();

export type MutationContext = z.infer<typeof mutationContextSchema>;
export type CreateProjectInput = z.input<typeof createProjectSchema>;
export type UpdateProjectInput = z.input<typeof updateProjectSchema>;
export type CreateEpicInput = z.input<typeof createEpicSchema>;
export type UpdateEpicInput = z.input<typeof updateEpicSchema>;
export type CreateIssueInput = z.input<typeof createIssueSchema>;
export type UpdateIssueInput = z.input<typeof updateIssueSchema>;
export type DeleteIssueInput = z.input<typeof deleteIssueSchema>;
export type AddCodeLinkInput = z.infer<typeof addCodeLinkSchema>;
export type AddIssueCommentInput = z.infer<typeof addIssueCommentSchema>;
export type CreateIssueQuestionInput = z.input<
  typeof createIssueQuestionSchema
>;
export type AnswerIssueQuestionInput = z.infer<
  typeof answerIssueQuestionSchema
>;
