import { afterEach, describe, expect, test, vi } from "vitest";
import {
  Client as SDKClient,
  StreamableHTTPClientTransport,
  type NotificationMethod,
  type NotificationTypeMap,
} from "@modelcontextprotocol/client";
import { ConnectionManager } from "../connection.js";
import { MCPAdapter } from "../client.js";
import type { ResolvedStreamableHTTPConnection } from "../types.js";

const connection = {
  transport: "http",
  url: "https://example.com/mcp",
  automaticSSEFallback: false,
} satisfies ResolvedStreamableHTTPConnection;

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
      manager.createClient("http", "test", connection),
      manager.createClient("http", "test", connection),
    ]);
    expect(first).toBe(second);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(await first.fork({})).toBe(first);
    const fork = await first.fork({ tenant: "one" });
    expect(await first.fork({ Tenant: "one" })).toBe(fork);
    expect(await first.fork({ tenant: "one" })).toBe(fork);
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
    const manager = new ConnectionManager({ onMessage: () => {} });
    await expect(manager.createClient("http", "test", connection)).rejects.toBe(
      failure
    );
    expect(handler.mock.invocationCallOrder[0]).toBeLessThan(
      connect.mock.invocationCallOrder[0]
    );
    expect(SDKClient.prototype.close).toHaveBeenCalledTimes(1);
    expect(transportClose).toHaveBeenCalledTimes(1);
    expect(manager.getAllClients()).toEqual([]);
    await manager.createClient("http", "test", connection);
    expect(connect).toHaveBeenCalledTimes(2);
    await manager.delete();
  });

  test("settles all closes, clears ownership on failure, and tolerates repeated close", async () => {
    mockConnect();
    const manager = new ConnectionManager();
    const first = await manager.createClient("http", "one", connection);
    const second = await manager.createClient("http", "two", connection);
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
    const acquisition = manager.createClient("http", "test", connection);
    await vi.waitFor(() => expect(connect).toHaveBeenCalled());
    const closing = manager.delete();
    await expect(
      manager.createClient("http", "other", connection)
    ).rejects.toThrow(/closing/);
    release();
    await acquisition;
    await closing;
    expect(manager.getAllClients()).toEqual([]);
    expect(SDKClient.prototype.close).toHaveBeenCalledTimes(1);
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
      adapter.getTools(["test"], {
        headers: { tenant: "one", fixed: "override" },
      }),
      adapter.getTools(["test"], { headers: { tenant: "two" } }),
    ]);
    expect(first).not.toBe(second);
    expect(
      (await adapter.getTools(["test"], { headers: { tenant: "one" } }))[0]
    ).toBe(first);
    expect(list).toHaveBeenCalledTimes(2);
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
      await adapter.getTools(["test"], { headers: { tenant: "failed" } })
    ).toEqual([]);
    expect(
      await adapter.getTools(["test"], { headers: { tenant: "working" } })
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
  const [first] = await adapter.getTools(["test"], {
    authProvider: firstProvider,
  });
  const [second] = await adapter.getTools(["test"], {
    authProvider: secondProvider,
  });
  expect(first).not.toBe(second);
  expect(
    (await adapter.getTools(["test"], { authProvider: firstProvider }))[0]
  ).toBe(first);
  expect(list).toHaveBeenCalledTimes(2);
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
  const [first] = await adapter.getTools(["test"], {
    headers: { tenant: "one" },
  });
  const [second] = await adapter.getTools(["test"], {
    headers: { tenant: "two" },
  });
  const handlers = vi
    .mocked(register<"notifications/tools/list_changed">)
    .mock.calls.filter(
      ([method]) => method === "notifications/tools/list_changed"
    );
  await handlers[0][1]({ method: "notifications/tools/list_changed" });
  expect(
    (await adapter.getTools(["test"], { headers: { tenant: "one" } }))[0]
  ).not.toBe(first);
  expect(
    (await adapter.getTools(["test"], { headers: { tenant: "two" } }))[0]
  ).toBe(second);
  expect(list).toHaveBeenCalledTimes(3);
  await adapter.close();
});

test("failed discovery releases its client and can be retried", async () => {
  const connect = mockConnect();
  vi.spyOn(SDKClient.prototype, "listTools")
    .mockRejectedValueOnce(new Error("discovery failed"))
    .mockResolvedValue({ tools: [] });
  const adapter = new MCPAdapter({ servers: { test: connection } });
  await expect(adapter.getTools()).rejects.toThrow(/discovery failed/);
  expect(SDKClient.prototype.close).toHaveBeenCalledTimes(1);
  expect(await adapter.getTools()).toEqual([]);
  expect(connect).toHaveBeenCalledTimes(2);
  await adapter.close();
});
