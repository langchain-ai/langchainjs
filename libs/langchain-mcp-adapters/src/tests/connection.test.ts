import { describe, test, expect, beforeEach, vi, type Mock } from "vitest";

import { Client as SDKClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { ConnectionManager, type Client } from "../connection.js";

vi.mock(
  "@modelcontextprotocol/sdk/client/index.js",
  () => import("./__mocks__/@modelcontextprotocol/sdk/client/index.js")
);
vi.mock(
  "@modelcontextprotocol/sdk/client/stdio.js",
  () => import("./__mocks__/@modelcontextprotocol/sdk/client/stdio.js")
);
vi.mock(
  "@modelcontextprotocol/sdk/client/sse.js",
  () => import("./__mocks__/@modelcontextprotocol/sdk/client/sse.js")
);
vi.mock(
  "@modelcontextprotocol/sdk/client/streamableHttp.js",
  () => import("./__mocks__/@modelcontextprotocol/sdk/client/streamableHttp.js")
);

describe("ConnectionManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createClient", () => {
    test("creates stdio client and connects", async () => {
      const mgr = new ConnectionManager();

      const client = await mgr.createClient("stdio", "stdio-server", {
        transport: "stdio",
        command: "python",
        args: ["./script.py"],
        stderr: "inherit",
      });

      expect(client).toBeDefined();
      expect(StdioClientTransport).toHaveBeenCalledWith(
        expect.objectContaining({ command: "python", args: ["./script.py"] })
      );
      expect(SDKClient).toHaveBeenCalled();
    });

    test("creates stdio client with cwd option passed correctly", async () => {
      const mgr = new ConnectionManager();

      const client = await mgr.createClient("stdio", "stdio-server", {
        transport: "stdio",
        command: "node",
        args: ["./server.js"],
        stderr: "inherit",
        cwd: "/custom/working/directory",
      });

      expect(client).toBeDefined();
      expect(StdioClientTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          command: "node",
          args: ["./server.js"],
          cwd: "/custom/working/directory",
        })
      );
    });

    test("creates HTTP client and maps reconnect options", async () => {
      const mgr = new ConnectionManager();

      await mgr.createClient("http", "http-server", {
        transport: "http",
        url: "http://localhost:8000/mcp",
        automaticSSEFallback: true,
        reconnect: { enabled: true, maxAttempts: 5, delayMs: 250 },
      });

      expect(StreamableHTTPClientTransport).toHaveBeenCalled();
      const [url, options] = (StreamableHTTPClientTransport as Mock).mock
        .calls[0];
      expect(url).toEqual(new URL("http://localhost:8000/mcp"));
      expect(options).toEqual(
        expect.objectContaining({
          reconnectionOptions: expect.objectContaining({
            initialReconnectionDelay: 250,
            maxReconnectionDelay: 250,
            maxRetries: 5,
          }),
        })
      );
    });

    test("creates SSE client with headers and auth provider", async () => {
      const mgr = new ConnectionManager();
      const headers = { Authorization: "Bearer token", "X-Test": "1" };
      // minimal authProvider mock
      const authProvider = {
        tokens: vi.fn().mockResolvedValue({ access_token: "abc" }),
      } as never;

      await mgr.createClient("sse", "sse-server", {
        transport: "sse",
        url: "http://localhost:8000/sse",
        automaticSSEFallback: true,
        headers,
        authProvider,
      });

      expect(SSEClientTransport).toHaveBeenCalled();
      const sseCall = (SSEClientTransport as Mock).mock.calls[0];
      expect(sseCall[0]).toEqual(new URL("http://localhost:8000/sse"));
      expect(sseCall[1]).toEqual(
        expect.objectContaining({
          requestInit: { headers },
          authProvider,
        })
      );
    });
  });

  describe("get / has / getAllClients", () => {
    test("manages multiple distinct connections keyed by headers/auth", async () => {
      const mgr = new ConnectionManager();

      const c1 = await mgr.createClient("http", "svc", {
        transport: "http",
        url: "http://localhost:8000/mcp",
        automaticSSEFallback: true,
        headers: { A: "1" },
      });
      const c2 = await mgr.createClient("http", "svc", {
        transport: "http",
        url: "http://localhost:8000/mcp",
        automaticSSEFallback: true,
        headers: { A: "2" },
      });

      expect(c1).not.toBe(c2);
      expect(mgr.getAllClients().length).toBe(2);
      expect(mgr.has({ serverName: "svc", headers: { A: "1" } })).toBe(true);
      expect(mgr.has({ serverName: "svc", headers: { A: "2" } })).toBe(true);
      expect(mgr.has({ serverName: "svc", headers: { A: "3" } })).toBe(false);

      expect(mgr.get({ serverName: "svc", headers: { A: "1" } })).toBeDefined();
      expect(mgr.get("svc")).toBeDefined(); // ambiguous but returns one
    });

    test("getTransport returns the underlying transport", async () => {
      const mgr = new ConnectionManager();
      const config = {
        command: "node",
        args: ["-e", "console.log('ok')"],
        stderr: "inherit" as const,
      };
      const client = await mgr.createClient("stdio", "s", {
        ...config,
        transport: "stdio",
      });

      const t1 = mgr.getTransport({ serverName: "s" });
      const t2 = mgr.getTransport(client as Client);
      expect(t1).toBeDefined();
      expect(t2).toBeDefined();
      expect(t1).toBe(t2);
      // @ts-expect-error testing mock
      expect((t1 as StdioClientTransport).config).toEqual(config);
    });
  });

  describe("delete", () => {
    test("deletes specific connection and all connections", async () => {
      const mgr = new ConnectionManager();
      await mgr.createClient("http", "svc", {
        transport: "http",
        url: "http://localhost:8000/mcp",
        automaticSSEFallback: true,
        headers: { A: "1" },
      });
      await mgr.createClient("sse", "svc", {
        transport: "sse",
        url: "http://localhost:8000/sse",
        automaticSSEFallback: true,
      });

      expect(mgr.getAllClients().length).toBe(2);

      await mgr.delete({ serverName: "svc", headers: { A: "1" } });
      expect(mgr.getAllClients().length).toBe(1);

      await mgr.delete();
      expect(mgr.getAllClients().length).toBe(0);
    });
  });

  describe("fork", () => {
    test("forks HTTP client with new headers and creates a new connection", async () => {
      const mgr = new ConnectionManager();
      const base = await mgr.createClient("http", "svc", {
        transport: "http",
        url: "http://localhost:8000/mcp",
        automaticSSEFallback: true,
        headers: { A: "1" },
      });

      const forked = await (base as Client).fork({ A: "2" });
      expect(forked).toBeDefined();
      expect(StreamableHTTPClientTransport).toHaveBeenCalledTimes(2);
      expect(mgr.getAllClients().length).toBe(2);
    });

    test("forking stdio client is not supported", async () => {
      const mgr = new ConnectionManager();
      const stdio = await mgr.createClient("stdio", "svc", {
        transport: "stdio",
        command: "python",
        args: ["./script.py"],
        stderr: "inherit",
      });

      expect(() => (stdio as Client).fork({ A: "2" })).toThrow(
        /Forking stdio transport is not supported/
      );
    });
  });
});
