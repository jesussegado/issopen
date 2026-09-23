import type { Context } from "hono";
import type { DomainError } from "../domain/index.js";

export function domainErrorResponse(context: Context, error: DomainError) {
  switch (error.code) {
    case "invalid":
      return context.json(
        {
          error: error.message,
          fields: error.fields ?? [],
        },
        400,
      );
    case "forbidden":
      return context.json({ error: "Action is not allowed" }, 403);
    case "not_found":
      return context.json({ error: "This page isn't available" }, 404);
    case "conflict":
      return context.json({ error: error.message }, 409);
  }
}
