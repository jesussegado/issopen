import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DomainError } from "../../src/server/domain/index.js";
import { domainErrorResponse } from "../../src/server/http/errors.js";
import {
  parseHttpInput,
  parseIdentifier,
  parseJsonBody,
} from "../../src/server/http/validation.js";

function validationApp() {
  const app = new Hono();
  app.post("/body", async (context) =>
    context.json(
      await parseJsonBody(
        context,
        z.object({ name: z.string().min(2) }).strict(),
        {
          emptyValue: {},
          malformedMessage: "Request body must be valid JSON",
          malformedFields: [
            {
              field: "request",
              message: "Request body must be valid JSON",
            },
          ],
        },
      ),
    ),
  );
  app.get("/identifier/:id", (context) =>
    context.json({ id: parseIdentifier(context.req.param("id"), "issueId") }),
  );
  app.get("/domain/:code", (context) => {
    const code = context.req.param("code") as
      | "invalid"
      | "forbidden"
      | "not_found"
      | "conflict";
    throw new DomainError(code, "Specific message", [
      { field: "title", message: "Required" },
    ]);
  });
  app.onError((error, context) => {
    if (error instanceof DomainError)
      return domainErrorResponse(context, error);
    throw error;
  });
  return app;
}

describe("HTTP validation contract", () => {
  it("uses one exact field projection for Zod transport failures", () => {
    expect(() =>
      parseHttpInput(z.object({ title: z.string().min(1) }), {}),
    ).toThrowError(
      expect.objectContaining({
        code: "invalid",
        message: "Invalid request",
        fields: expect.arrayContaining([
          expect.objectContaining({ field: "title" }),
        ]),
      }),
    );
  });

  it("preserves malformed JSON and identifier responses", async () => {
    const app = validationApp();
    const malformed = await app.request("/body", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({
      error: "Request body must be valid JSON",
      fields: [
        {
          field: "request",
          message: "Request body must be valid JSON",
        },
      ],
    });

    const identifier = await app.request("/identifier/not-a-uuid");
    expect(identifier.status).toBe(400);
    expect(await identifier.json()).toEqual({
      error: "Invalid request",
      fields: [{ field: "issueId", message: "Must be a valid identifier" }],
    });
  });

  it.each([
    [
      "invalid",
      400,
      {
        error: "Specific message",
        fields: [{ field: "title", message: "Required" }],
      },
    ],
    ["forbidden", 403, { error: "Action is not allowed" }],
    ["not_found", 404, { error: "This page isn't available" }],
    ["conflict", 409, { error: "Specific message" }],
  ])(
    "serializes %s through the shared error boundary",
    async (code, status, body) => {
      const response = await validationApp().request(`/domain/${code}`);
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual(body);
    },
  );
});
