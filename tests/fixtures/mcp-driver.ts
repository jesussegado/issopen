import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { expect } from "vitest";
import type { createApp } from "../../src/server/app.js";

export async function createMcpTestClient(options: {
  app: ReturnType<typeof createApp>;
  resource: string;
  token: string;
}) {
  const client = new Client(
    { name: "issopen-integration", version: "1.0.0" },
    { versionNegotiation: { mode: "auto" } },
  );
  const transport = new StreamableHTTPClientTransport(
    new URL(options.resource),
    {
      fetch: async (input, init) => {
        const request =
          input instanceof Request ? input : new Request(input, init);
        return await options.app.request(request);
      },
      authProvider: { token: async () => options.token },
    },
  );
  await client.connect(transport);
  return client;
}

export async function expectIdempotentReplay(
  client: Client,
  name: string,
  arguments_: Record<string, unknown>,
) {
  const first = await client.callTool({ name, arguments: arguments_ });
  expect(first.isError).not.toBe(true);
  const replay = await client.callTool({ name, arguments: arguments_ });
  expect(replay.isError).not.toBe(true);
  expect(replay.structuredContent).toEqual(first.structuredContent);
  return first;
}
