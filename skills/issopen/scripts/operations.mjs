import { createHash, randomUUID } from "node:crypto";

const fingerprint = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function prepareOperation(tool, args, now = Date.now()) {
  const arguments_ = structuredClone({
    ...args,
    idempotencyKey: args.idempotencyKey ?? `issopen-${randomUUID()}`,
  });
  return {
    tool,
    arguments: arguments_,
    createdAt: now,
    fingerprint: fingerprint({ tool, arguments: arguments_ }),
  };
}

export async function runOperation(
  call,
  operation,
  {
    now = Date.now,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = {},
) {
  if (
    fingerprint({ tool: operation.tool, arguments: operation.arguments }) !==
    operation.fingerprint
  )
    throw new Error(
      "Operation changed: reconcile before creating a new logical operation",
    );
  for (let attempt = 0; attempt < 3; attempt++) {
    const age = now() - operation.createdAt;
    if (age < 0 || age >= 24 * 60 * 60 * 1000)
      throw new Error(
        "Idempotency retention elapsed: read current state before any new write",
      );
    try {
      return await call(operation.tool, structuredClone(operation.arguments));
    } catch (error) {
      const transient =
        [429, 500, 502, 503, 504].includes(error.status) ||
        ["ETIMEDOUT", "ECONNRESET"].includes(error.code);
      if (!transient || attempt === 2) throw error;
      await sleep(250 * 2 ** attempt);
    }
  }
}
