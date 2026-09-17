import dns from "node:dns/promises";
import { EventEmitter } from "node:events";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const network = { lookup: vi.fn(), request: vi.fn() };

import { fetchClientMetadataResource } from "@better-auth/cimd/node";

const publicAddress = { address: "104.18.32.47", family: 4 };
const url = "https://chatgpt.com/oauth/client.json";

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(dns, "lookup").mockImplementation(network.lookup);
  vi.spyOn(https, "request").mockImplementation(network.request);
  // The dependency is native ESM, outside Vitest's transformed module graph.
  syncBuiltinESMExports();
  network.lookup.mockResolvedValue([publicAddress]);
  network.request.mockImplementation((_url, _options, receive) => {
    const request = new EventEmitter();
    return Object.assign(request, {
      end() {
        receive(
          Object.assign(Readable.from([Buffer.from("{}")]), {
            statusCode: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      },
    });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  syncBuiltinESMExports();
});

describe("CIMD Node transport", () => {
  it("returns a pinned address array when Node's autoSelectFamily requests all:true", async () => {
    const response = await fetchClientMetadataResource(url);
    expect(await response.json()).toEqual({});
    const options = network.request.mock.calls[0]?.[1];
    const callback = vi.fn();
    options.lookup("chatgpt.com", { all: true }, callback);
    expect(callback).toHaveBeenCalledWith(null, [publicAddress]);
    expect(network.lookup).toHaveBeenCalledExactlyOnceWith("chatgpt.com", {
      all: true,
      verbatim: true,
    });
    expect(options).toMatchObject({
      agent: false,
      servername: "chatgpt.com",
      headers: { host: "chatgpt.com" },
    });
    expect(options.rejectUnauthorized).not.toBe(false);
  });

  it("also supports scalar lookup without resolving the hostname again", async () => {
    await fetchClientMetadataResource(url);
    const callback = vi.fn();
    network.request.mock.calls[0]?.[1].lookup(
      "chatgpt.com",
      { all: false },
      callback,
    );
    expect(callback).toHaveBeenCalledWith(null, publicAddress.address, 4);
    expect(network.lookup).toHaveBeenCalledTimes(1);
  });

  it.each(["127.0.0.1", "10.0.0.1", "169.254.169.254", "::1"])(
    "rejects a private DNS answer (%s) even alongside a public answer",
    async (address) => {
      network.lookup.mockResolvedValue([
        publicAddress,
        { address, family: address.includes(":") ? 6 : 4 },
      ]);
      await expect(fetchClientMetadataResource(url)).rejects.toThrow(
        "public-routable",
      );
      expect(network.request).not.toHaveBeenCalled();
    },
  );

  it("rejects non-HTTPS and non-read requests before connecting", async () => {
    await expect(
      fetchClientMetadataResource("http://chatgpt.com/oauth/client.json"),
    ).rejects.toThrow("HTTPS");
    await expect(
      fetchClientMetadataResource(url, { method: "POST" }),
    ).rejects.toThrow("GET and HEAD");
    expect(network.request).not.toHaveBeenCalled();
  });

  it("passes cancellation to HTTPS and returns redirects without following them", async () => {
    const controller = new AbortController();
    network.request.mockImplementation((_url, _options, receive) =>
      Object.assign(new EventEmitter(), {
        end() {
          receive(
            Object.assign(Readable.from([]), {
              statusCode: 302,
              headers: { location: "https://127.0.0.1/private" },
            }),
          );
        },
      }),
    );
    const response = await fetchClientMetadataResource(url, {
      signal: controller.signal,
    });
    expect(response.status).toBe(302);
    expect(network.request).toHaveBeenCalledTimes(1);
    expect(network.request.mock.calls[0]?.[1].signal).toBe(controller.signal);
  });
});
