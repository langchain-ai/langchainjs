import { once } from "node:events";
import { createServer } from "node:http";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  Client as SDKClient,
  StreamableHTTPClientTransport,
  type NotificationMethod,
  type NotificationTypeMap,
} from "@modelcontextprotocol/client";
import { ConnectionManager } from "../connection.js";
import { MCPAdapter } from "../client.js";
import type { SSEConnection } from "../types.js";

const connection = {
  mode: "legacy",
  transport: "http",
  url: "https://example.com/mcp",
} satisfies SSEConnection;

afterEach(() => vi.restoreAllMocks());

function mockConnect() {
  vi.spyOn(SDKClient.prototype, "close").mockResolvedValue();

  return vi.spyOn(SDKClient.prototype, "connect").mockResolvedValue();
}

describe("connection ownership", () => {
  test("deduplicates concurrent acquisitions and reuses matching forks", async () => {
    const connect = mockConnect();
    const manager = new ConnectionManager();

    const [first, second] = await Promise.all([
      manager.getOrCreateClient("test", connection),
      manager.getOrCreateClient("test", connection),
    ]);

    expect(first).toBe(second);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(await first.fork!({})).toBe(first);
    const fork = await first.fork!({ tenant: "one" });
    expect(await first.fork!({ Tenant: "one" })).toBe(fork);
    expect(await first.fork!({ tenant: "one" })).toBe(fork);
    expect(manager.get("test")).toBe(first);
    expect(
      manager.get({ serverName: "test", headers: { tenant: "two" } })
    ).toBeUndefined();
    await manager.delete();
    expect(SDKClient.prototype.close).toHaveBeenCalledTimes(2);
  });

  test("registers notification handlers before connect and cleans up failed handshakes", async () => {
    const connect = mockConnect();

    const transportClose = vi
      .spyOn(StreamableHTTPClientTransport.prototype, "close")
      .mockResolvedValue();

    const handler = vi.spyOn(SDKClient.prototype, "setNotificationHandler");
    const failure = new Error("handshake failed");
    connect.mockRejectedValueOnce(failure);
    const manager = new ConnectionManager();
    await expect(
      manager.getOrCreateClient("test", {
        ...connection,
        onMessage: () => {},
      })
    ).rejects.toBe(failure);
    expect(handler.mock.invocationCallOrder[0]).toBeLessThan(
      connect.mock.invocationCallOrder[0]
    );
    expect(SDKClient.prototype.close).toHaveBeenCalledTimes(1);
    expect(transportClose).toHaveBeenCalledTimes(1);
    expect(manager.getAllClients()).toEqual([]);
    await manager.getOrCreateClient("test", connection);
    expect(connect).toHaveBeenCalledTimes(2);
    await manager.delete();
  });

  test("settles all closes, clears ownership on failure, and tolerates repeated close", async () => {
    mockConnect();
    const manager = new ConnectionManager();
    const first = await manager.getOrCreateClient("one", connection);
    const second = await manager.getOrCreateClient("two", connection);

    const firstClose = vi
      .fn<SDKClient["close"]>()
      .mockRejectedValue(new Error("close failed"));

    const secondClose = vi.fn<SDKClient["close"]>().mockResolvedValue();
    first.close = firstClose;
    second.close = secondClose;
    await expect(manager.delete()).rejects.toThrow(AggregateError);
    expect(firstClose).toHaveBeenCalledTimes(1);
    expect(secondClose).toHaveBeenCalledTimes(1);
    expect(manager.getAllClients()).toEqual([]);
    await manager.delete();
    expect(firstClose).toHaveBeenCalledTimes(1);
  });

  test("close waits for an in-flight acquisition and prevents new acquisitions while draining", async () => {
    const connect = mockConnect();
    let release = () => {};

    connect.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );
    const manager = new ConnectionManager();
    const acquisition = manager.getOrCreateClient("test", connection);
    await vi.waitFor(() => expect(connect).toHaveBeenCalled());
    const closing = manager.delete();
    await expect(
      manager.getOrCreateClient("other", connection)
    ).rejects.toThrow(/closing/);
    release();
    await acquisition;
    await closing;
    expect(manager.getAllClients()).toEqual([]);
    expect(SDKClient.prototype.close).toHaveBeenCalledTimes(1);
  });

  test("discovery started mid-close waits for teardown, then runs", async () => {
    mockConnect();
    vi.spyOn(SDKClient.prototype, "listTools").mockResolvedValue({
      tools: [{ name: "echo", inputSchema: { type: "object" } }],
    });

    const adapter = new MCPAdapter({ servers: { test: connection } });
    await adapter.listTools(["test"]);

    let finishClose = () => {};
    vi.spyOn(ConnectionManager.prototype, "delete").mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishClose = resolve;
        })
    );
    const closing = adapter.close();

    let settled = false;
    const pending = adapter.listTools(["test"]).then((tools) => {
      settled = true;
      return tools;
    });

    // Given room to run, it must still be parked on the in-flight close rather
    // than serving tools out of the epoch being torn down.
    await new Promise((resolve) => {
      setTimeout(resolve, 25);
    });
    expect(settled).toBe(false);

    finishClose();
    await closing;
    await expect(pending).resolves.toHaveLength(1);
    await adapter.close();
  });

  test("a close during discovery cannot resolve as a partial catalog", async () => {
    mockConnect();

    let startList = () => {};
    const listing = new Promise<void>((resolve) => {
      startList = resolve;
    });
    let releaseList = () => {};
    const held = new Promise<void>((resolve) => {
      releaseList = resolve;
    });

    vi.spyOn(SDKClient.prototype, "listTools").mockImplementation(async () => {
      startList();
      await held;
      return { tools: [] };
    });

    // "ignore" is the policy that swallows a per-server failure, so an aborted
    // discovery must not be reported as a successful (empty) catalog.
    const adapter = new MCPAdapter({
      servers: { test: connection },
      onConnectionError: "ignore",
    });

    const discovery = adapter.listTools(["test"]);
    await listing;
    const closed = adapter.close();
    releaseList();

    await expect(discovery).rejects.toThrow(/clos/i);
    await closed;
  });

  test("a closed adapter is reusable and rebuilds its clients", async () => {
    const connect = mockConnect();
    vi.spyOn(SDKClient.prototype, "listTools").mockResolvedValue({
      tools: [{ name: "echo", inputSchema: { type: "object" } }],
    });

    const adapter = new MCPAdapter({ servers: { test: connection } });

    const [before] = await adapter.listTools(["test"]);
    const firstClient = await adapter.getClient("test");
    await adapter.close();

    // `close()` cancels the epoch and clears the caches but keeps the server
    // configuration, so discovery runs again against fresh clients rather than
    // restoring the old ones.
    const [after] = await adapter.listTools(["test"]);
    const secondClient = await adapter.getClient("test");

    expect(connect).toHaveBeenCalledTimes(2);
    expect(secondClient).not.toBe(firstClient);
    expect(after).not.toBe(before);
    await adapter.close();
  });
});

describe("catalog identity", () => {
  test("isolates same-server tools across concurrent contexts and preserves configured header precedence", async () => {
    mockConnect();

    const list = vi.spyOn(SDKClient.prototype, "listTools").mockResolvedValue({
      tools: [{ name: "echo", inputSchema: { type: "object" } }],
    });

    const call = vi
      .spyOn(SDKClient.prototype, "callTool")
      .mockResolvedValue({ content: [{ type: "text", text: "ok" }] });

    const adapter = new MCPAdapter({
      servers: { test: { ...connection, headers: { fixed: "configured" } } },
    });

    const [[first], [second]] = await Promise.all([
      adapter.listTools(["test"], {
        headers: { tenant: "one", fixed: "override" },
      }),
      adapter.listTools(["test"], { headers: { tenant: "two" } }),
    ]);

    expect(first).not.toBe(second);
    expect(
      (await adapter.listTools(["test"], { headers: { tenant: "one" } }))[0]
    ).toBe(first);
    expect(list).toHaveBeenCalledTimes(3);
    await first.invoke({});
    await second.invoke({});
    expect(call.mock.contexts[0]).not.toBe(call.mock.contexts[1]);
    const defaultClient = await adapter.getClient("test");
    expect(defaultClient).not.toBe(call.mock.contexts[0]);
    expect(defaultClient).not.toBe(call.mock.contexts[1]);
    await adapter.close();
  });

  test("a failed context does not suppress another identity on the same server", async () => {
    const connect = mockConnect();
    connect.mockRejectedValueOnce(new Error("unavailable"));
    vi.spyOn(SDKClient.prototype, "listTools").mockResolvedValue({
      tools: [{ name: "echo", inputSchema: { type: "object" } }],
    });

    const adapter = new MCPAdapter({
      servers: { test: connection },
      onConnectionError: "ignore",
    });

    expect(
      await adapter.listTools(["test"], { headers: { tenant: "failed" } })
    ).toEqual([]);
    expect(
      await adapter.listTools(["test"], { headers: { tenant: "working" } })
    ).toHaveLength(1);
    await adapter.close();
  });
});

test("partitions catalogs by OAuth provider identity even with identical headers", async () => {
  mockConnect();

  const list = vi.spyOn(SDKClient.prototype, "listTools").mockResolvedValue({
    tools: [{ name: "echo", inputSchema: { type: "object" } }],
  });

  const makeProvider = () => ({
    redirectUrl: "http://localhost/callback",
    clientMetadata: { redirect_uris: ["http://localhost/callback"] },
    clientInformation: () => undefined,
    tokens: () => undefined,
    saveTokens: () => {},
    redirectToAuthorization: () => {},
    saveCodeVerifier: () => {},
    codeVerifier: () => "test-verifier",
  });

  const firstProvider = makeProvider();
  const secondProvider = makeProvider();
  const adapter = new MCPAdapter({ servers: { test: connection } });

  const [first] = await adapter.listTools(["test"], {
    authProvider: firstProvider,
  });

  const [second] = await adapter.listTools(["test"], {
    authProvider: secondProvider,
  });

  expect(first).not.toBe(second);
  expect(
    (await adapter.listTools(["test"], { authProvider: firstProvider }))[0]
  ).toBe(first);
  expect(list).toHaveBeenCalledTimes(3);
  await adapter.close();
});

test("tool catalog notifications invalidate only their connection identity", async () => {
  mockConnect();
  vi.spyOn(SDKClient.prototype, "setNotificationHandler");

  const register: <M extends NotificationMethod>(
    method: M,
    handler: (notification: NotificationTypeMap[M]) => void | Promise<void>
  ) => void = SDKClient.prototype.setNotificationHandler;

  const list = vi.spyOn(SDKClient.prototype, "listTools").mockResolvedValue({
    tools: [{ name: "echo", inputSchema: { type: "object" } }],
  });

  const adapter = new MCPAdapter({ servers: { test: connection } });

  const [first] = await adapter.listTools(["test"], {
    headers: { tenant: "one" },
  });

  const [second] = await adapter.listTools(["test"], {
    headers: { tenant: "two" },
  });

  const handlers = vi
    .mocked(register<"notifications/tools/list_changed">)
    .mock.calls.filter(
      ([method]) => method === "notifications/tools/list_changed"
    );

  await handlers[0][1]({ method: "notifications/tools/list_changed" });
  expect(
    (await adapter.listTools(["test"], { headers: { tenant: "one" } }))[0]
  ).not.toBe(first);
  expect(
    (await adapter.listTools(["test"], { headers: { tenant: "two" } }))[0]
  ).toBe(second);
  expect(list).toHaveBeenCalledTimes(4);
  await adapter.close();
});

test("failed discovery releases its client and can be retried", async () => {
  const connect = mockConnect();
  vi.spyOn(SDKClient.prototype, "listTools")
    .mockRejectedValueOnce(new Error("discovery failed"))
    .mockResolvedValue({ tools: [] });
  const adapter = new MCPAdapter({ servers: { test: connection } });
  await expect(adapter.listTools()).rejects.toThrow(/discovery failed/);
  expect(SDKClient.prototype.close).toHaveBeenCalledTimes(1);
  expect(await adapter.listTools()).toEqual([]);
  expect(connect).toHaveBeenCalledTimes(2);
  await adapter.close();
});

test("resource discovery failure is not an empty catalog", async () => {
  mockConnect();
  vi.spyOn(SDKClient.prototype, "listTools").mockResolvedValue({ tools: [] });
  const error = new Error("discovery failed");
  vi.spyOn(SDKClient.prototype, "listResources").mockRejectedValue(error);
  const adapter = new MCPAdapter({ servers: { test: connection } });

  try {
    await expect(adapter.listResources()).rejects.toBe(error);
  } finally {
    await adapter.close();
  }
});

test("consults SDK discovery again and preserves already-issued tools", async () => {
  mockConnect();

  const list = vi.spyOn(SDKClient.prototype, "listTools").mockResolvedValue({
    tools: [{ name: "before", inputSchema: { type: "object" } }],
  });

  const adapter = new MCPAdapter({ servers: { test: connection } });

  try {
    const [before] = await adapter.listTools();
    list.mockResolvedValue({
      tools: [{ name: "after", inputSchema: { type: "object" } }],
    });
    const [after] = await adapter.listTools();
    expect(after.name).toContain("after");
    expect(before.name).toContain("before");
  } finally {
    await adapter.close();
  }
});

test.each(["cached", "bypass", "invalidated"])(
  "keeps a %s issued tool alive through failed refresh",
  async (discovery) => {
    vi.spyOn(SDKClient.prototype, "setNotificationHandler");
    const register: <M extends NotificationMethod>(
      method: M,
      handler: (notification: NotificationTypeMap[M]) => void | Promise<void>
    ) => void = SDKClient.prototype.setNotificationHandler;
    const connections = vi.spyOn(
      ConnectionManager.prototype,
      "getOrCreateClient"
    );
    let failRefresh = false;
    const handler = createMcpHandler(
      () => {
        const server = new McpServer({
          name: "refresh-lifecycle",
          version: "1",
        });

        server.registerTool(
          "echo",
          { inputSchema: z.object({ message: z.string() }) },
          ({ message }) => ({ content: [{ type: "text", text: message }] })
        );
        server.server.removeRequestHandler("tools/list");
        server.server.setRequestHandler("tools/list", () => {
          if (failRefresh) {
            throw new Error("transient catalog failure");
          }

          return {
            tools: [
              {
                name: "echo",
                inputSchema: {
                  type: "object",
                  properties: { message: { type: "string" } },
                  required: ["message"],
                },
              },
            ],
          };
        });

        return server;
      },
      { legacy: "reject" }
    );
    const http = createServer(toNodeHandler(handler));
    http.listen(0, "127.0.0.1");
    await once(http, "listening");
    const address = http.address();

    if (!address || typeof address === "string")
      throw new Error("Missing HTTP address");

    const adapter = new MCPAdapter({
      servers: {
        test: { transport: "http", url: `http://127.0.0.1:${address.port}` },
      },
    });

    try {
      const [issued] = await adapter.listTools([], {
        cacheMode: discovery === "bypass" ? "bypass" : "use",
      });
      const captured = await connections.mock.results[0].value;
      expect(captured?.transport).toBeDefined();
      if (discovery === "invalidated") {
        const handler = vi
          .mocked(register<"notifications/tools/list_changed">)
          .mock.calls.filter(
            ([method]) => method === "notifications/tools/list_changed"
          )
          .at(-1)?.[1];
        if (!handler) throw new Error("Missing tool invalidation handler");
        await handler({ method: "notifications/tools/list_changed" });
      }
      failRefresh = true;
      await expect(
        adapter.listTools([], { cacheMode: "refresh" })
      ).rejects.toThrow(/transient catalog failure/);
      expect(captured?.transport).toBeDefined();
      expect(await issued.invoke({ message: "still connected" })).toBe(
        "still connected"
      );
      failRefresh = false;
      expect(await adapter.getClient("test")).toBe(captured);
      if (discovery === "cached") {
        expect((await adapter.listTools())[0]).toBe(issued);
      }
    } finally {
      await adapter.close();
      await handler.close();
      const closed = once(http, "close");
      http.close();
      http.closeAllConnections();
      await closed;
    }
  }
);
test("preserves a concurrent cold catalog when another refresh fails", async () => {
  let catalogRequests = 0;
  let startFirstCatalog = () => {};
  const firstCatalogStarted = new Promise<void>((resolve) => {
    startFirstCatalog = resolve;
  });
  let releaseFirstCatalog = () => {};
  const firstCatalog = new Promise<void>((resolve) => {
    releaseFirstCatalog = resolve;
  });
  const handler = createMcpHandler(
    () => {
      const server = new McpServer({
        name: "concurrent-refresh-lifecycle",
        version: "1",
      });

      server.registerTool(
        "echo",
        { inputSchema: z.object({ message: z.string() }) },
        ({ message }) => ({ content: [{ type: "text", text: message }] })
      );
      server.server.removeRequestHandler("tools/list");
      server.server.setRequestHandler("tools/list", async () => {
        if (catalogRequests++ === 0) {
          startFirstCatalog();
          await firstCatalog;

          return {
            tools: [
              {
                name: "echo",
                inputSchema: {
                  type: "object",
                  properties: { message: { type: "string" } },
                  required: ["message"],
                },
              },
            ],
          };
        }

        throw new Error("concurrent catalog failure");
      });

      return server;
    },
    { legacy: "reject" }
  );
  const http = createServer(toNodeHandler(handler));
  http.listen(0, "127.0.0.1");
  await once(http, "listening");
  const address = http.address();

  if (!address || typeof address === "string")
    throw new Error("Missing HTTP address");

  const adapter = new MCPAdapter({
    servers: {
      test: { transport: "http", url: `http://127.0.0.1:${address.port}` },
    },
  });

  try {
    const first = adapter.listTools();
    await firstCatalogStarted;
    try {
      await expect(
        adapter.listTools([], { cacheMode: "refresh" })
      ).rejects.toThrow(/concurrent catalog failure/);
    } finally {
      releaseFirstCatalog();
    }
    const [issued] = await first;
    expect(await issued.invoke({ message: "concurrent success" })).toBe(
      "concurrent success"
    );
  } finally {
    releaseFirstCatalog();
    await adapter.close();
    await handler.close();
    const closed = once(http, "close");
    http.close();
    http.closeAllConnections();
    await closed;
  }
});

test.each([
  "use",
  "refresh",
  "bypass",
] satisfies import("@modelcontextprotocol/client").CacheMode[])(
  "forwards SDK cache policy %s",
  async (cacheMode) => {
    mockConnect();

    const list = vi
      .spyOn(SDKClient.prototype, "listTools")
      .mockResolvedValue({ tools: [] });

    const adapter = new MCPAdapter({ servers: { test: connection } });

    try {
      await adapter.listTools([], { cacheMode });
      expect(list).toHaveBeenCalledWith(undefined, {
        cacheMode,
        signal: expect.any(AbortSignal),
      });
    } finally {
      await adapter.close();
    }
  }
);
