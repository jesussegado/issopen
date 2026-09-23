import type { Context } from "hono";
import { z } from "zod";
import { DomainError } from "../domain/index.js";

type ValidationField = { field: string; message: string };

type ParseOptions = {
  message?: string;
  fields?: false | ValidationField[];
  fallbackField?: string;
};

type JsonBodyOptions = ParseOptions & {
  emptyValue?: unknown;
  malformedMessage?: string;
  malformedFields?: ValidationField[];
};

const identifierSchema = z.uuid();

export function fieldsFromZod(
  error: z.ZodError,
  fallbackField = "request",
): ValidationField[] {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || fallbackField,
    message: issue.message,
  }));
}

export function parseHttpInput<T>(
  schema: z.ZodType<T>,
  value: unknown,
  options: ParseOptions = {},
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const fields =
      options.fields === false
        ? undefined
        : (options.fields ??
          fieldsFromZod(parsed.error, options.fallbackField));
    throw new DomainError(
      "invalid",
      options.message ?? "Invalid request",
      fields,
    );
  }
  return parsed.data;
}

export async function readJsonInput<T = unknown>(
  context: Context,
  fallback: unknown = null,
): Promise<T> {
  return context.req.json<T>().catch(() => fallback as T);
}

export async function parseJsonBody<T>(
  context: Context,
  schema: z.ZodType<T>,
  options: JsonBodyOptions = {},
): Promise<T> {
  const rawText = await context.req.text();
  let value = options.emptyValue ?? null;
  if (rawText.trim() !== "") {
    try {
      value = JSON.parse(rawText);
    } catch {
      throw new DomainError(
        "invalid",
        options.malformedMessage ?? options.message ?? "Invalid request",
        options.malformedFields,
      );
    }
  }
  return parseHttpInput(schema, value, options);
}

export function parseIdentifier(
  value: string,
  field: string,
  options: Omit<ParseOptions, "fallbackField"> & {
    fieldMessage?: string;
  } = {},
) {
  return parseHttpInput(identifierSchema, value, {
    ...(options.message === undefined ? {} : { message: options.message }),
    fields:
      options.fields === false
        ? false
        : (options.fields ?? [
            {
              field,
              message: options.fieldMessage ?? "Must be a valid identifier",
            },
          ]),
  });
}
