import { z } from "zod";

export const captureApiVersion = 1;
export const maximumPngBytes = 8 * 1024 * 1024;
export const maximumRequestBytes = 12 * 1024 * 1024;
export const captureModeSchema = z.enum([
  "crop",
  "viewport",
  "full",
  "element",
]);
export const safeTags = [
  "html",
  "body",
  "main",
  "header",
  "footer",
  "nav",
  "aside",
  "section",
  "article",
  "div",
  "span",
  "p",
  "a",
  "button",
  "form",
  "label",
  "input",
  "textarea",
  "select",
  "option",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "caption",
  "img",
  "picture",
  "figure",
  "figcaption",
  "details",
  "summary",
  "dialog",
  "strong",
  "em",
  "small",
  "code",
  "pre",
  "br",
  "hr",
  "dl",
  "dt",
  "dd",
  "fieldset",
  "legend",
  "video",
  "audio",
  "canvas",
] as const;
export const safeTagSchema = z.enum(safeTags);
export const safeAttributesSchema = z
  .object({
    role: z
      .enum([
        "button",
        "link",
        "dialog",
        "alert",
        "status",
        "navigation",
        "main",
        "complementary",
        "region",
        "tab",
        "tabpanel",
        "tablist",
        "list",
        "listitem",
        "heading",
        "img",
        "table",
        "row",
        "cell",
        "grid",
        "checkbox",
        "radio",
        "switch",
        "textbox",
        "combobox",
        "menu",
        "menuitem",
        "presentation",
        "none",
      ])
      .optional(),
    expanded: z.boolean().optional(),
    hidden: z.boolean().optional(),
    disabled: z.boolean().optional(),
  })
  .strict();
const nodeSummarySchema = z
  .object({
    tag: safeTagSchema,
    attributes: safeAttributesSchema,
    omitted: z.boolean(),
    textOmitted: z.boolean(),
  })
  .strict();
export const domSnapshotSchema = z
  .object({
    version: z.literal(1),
    nodes: z
      .array(
        nodeSummarySchema
          .extend({ parent: z.number().int().min(0).max(59).nullable() })
          .strict(),
      )
      .min(1)
      .max(60),
    ancestors: z.array(nodeSummarySchema).max(3),
    truncated: z.boolean(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const depths: number[] = [];
    value.nodes.forEach((node, index) => {
      const depth = node.parent === null ? 0 : (depths[node.parent] ?? 99) + 1;
      depths.push(depth);
      if (
        (index === 0
          ? node.parent !== null
          : node.parent === null || node.parent >= index) ||
        depth > 4
      )
        ctx.addIssue({
          code: "custom",
          message: "Invalid bounded DOM structure",
          path: ["nodes", index],
        });
    });
  });
export type DomSnapshot = z.infer<typeof domSnapshotSchema>;
export const boundsSchema = z
  .object({
    x: z.number().finite().min(-100000).max(100000),
    y: z.number().finite().min(-100000).max(100000),
    width: z.number().positive().max(100000),
    height: z.number().positive().max(100000),
  })
  .strict();
export const elementDescriptorSchema = z
  .object({
    tag: safeTagSchema,
    path: z
      .array(
        z
          .object({
            tag: z.union([safeTagSchema, z.literal("*")]),
            child: z.number().int().positive().max(100000),
          })
          .strict(),
      )
      .min(1)
      .max(8),
    bounds: boundsSchema,
  })
  .strict();
export type ElementDescriptor = z.infer<typeof elementDescriptorSchema>;
export const selectedElementSchema = z
  .object({ element: elementDescriptorSchema, dom: domSnapshotSchema })
  .strict();

// URL paths can contain identifiers. Strip query/hash and obvious credentials;
// the resulting URL is still shown for human review and can be excluded entirely.
export function safePageUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password)
      return null;
    let sensitive = false;
    const parts = url.pathname.split("/").map((part) => {
      let text: string;
      try {
        text = decodeURIComponent(part);
      } catch {
        return "redacted";
      }
      const hide =
        sensitive ||
        /@|[A-Za-z0-9_-]{32,}|(?:token|secret|password|session|authorization|credential|api.key|reset)/i.test(
          text,
        );
      if (hide) sensitive = true;
      return hide ? "redacted" : part;
    });
    const result = `${url.origin}${parts.join("/")}`;
    return result.length <= 2048 ? result : url.origin;
  } catch {
    return null;
  }
}
export const viewportSchema = z
  .object({
    width: z.number().int().positive().max(100000),
    height: z.number().int().positive().max(100000),
    devicePixelRatio: z.number().positive().max(20),
  })
  .strict();
export const captureMetadataSchema = z
  .object({
    mode: captureModeSchema,
    url: z
      .string()
      .max(2048)
      .refine(
        (v) => safePageUrl(v) === v,
        "Use a reviewed HTTP(S) URL without credentials, query or fragment",
      )
      .optional(),
    viewport: viewportSchema.optional(),
    capturedAt: z.iso.datetime().optional(),
    element: elementDescriptorSchema.optional(),
    dom: domSnapshotSchema.optional(),
  })
  .strict();
export type CaptureMetadata = z.infer<typeof captureMetadataSchema>;
export const pngDataUrlSchema = z
  .string()
  .max(Math.ceil(maximumPngBytes / 3) * 4 + 22)
  .regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/);
export const captureSubmissionSchema = z
  .object({
    version: z.literal(1),
    idempotencyKey: z.uuid(),
    projectId: z.uuid(),
    epicId: z.uuid().nullable(),
    title: z.string().trim().min(1).max(240),
    description: z.string().trim().max(50000),
    priority: z.enum(["low", "medium", "high", "urgent"]),
    status: z.enum([
      "backlog",
      "ready",
      "in_progress",
      "ready_for_review",
      "done",
    ]),
    metadata: captureMetadataSchema.nullable(),
    image: pngDataUrlSchema.nullable(),
  })
  .strict();
export type CaptureSubmission = z.infer<typeof captureSubmissionSchema>;
export function structuralSelector(element: ElementDescriptor) {
  return element.path
    .map((step) => `${step.tag}:nth-child(${step.child})`)
    .join(" > ");
}
export function formatDom(snapshot: DomSnapshot) {
  const lines: string[] = [];
  const summary = (
    node: DomSnapshot["nodes"][number] | DomSnapshot["ancestors"][number],
  ) => {
    const attrs = Object.entries(node.attributes)
      .map(
        ([key, value]) => ` ${key === "role" ? key : `aria-${key}`}="${value}"`,
      )
      .join("");
    return `<${node.tag}${attrs}>${node.omitted ? "[contenido omitido]" : node.textOmitted ? "[texto omitido]" : ""}`;
  };
  if (snapshot.ancestors.length)
    lines.push(
      "Ancestros (sin hermanos ni contenido):",
      ...snapshot.ancestors.map((node) => summary(node)),
      "Elemento:",
    );
  const depths: number[] = [];
  snapshot.nodes.forEach((node) => {
    const depth = node.parent === null ? 0 : (depths[node.parent] ?? 0) + 1;
    depths.push(depth);
    lines.push(`${"  ".repeat(depth)}${summary(node)}`);
  });
  if (snapshot.truncated) lines.push("[estructura truncada por límites]");
  return lines.join("\n");
}
