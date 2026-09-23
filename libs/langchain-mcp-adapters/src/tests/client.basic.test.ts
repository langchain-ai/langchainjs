import {
  vi,
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import { ZodError } from "zod";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import {
  Client,
  SSEClientTransport,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { MCPAdapter, MultiServerMCPClient, MCPClientError } from "../client.js";
import { adapterConfigSchema, oAuthClientProviderSchema } from "../types.js";
import type { Connection } from "../types.js";
import { resetClientMock } from "./__mocks__/@modelcontextprotocol/client.js";

vi.mock(
  "@modelcontextprotocol/client",
  () => import("./__mocks__/@modelcontextprotocol/client.js")
);
vi.mock(
  "@modelcontextprotocol/client/stdio",
  () => import("./__mocks__/@modelcontextprotocol/client/stdio.js")
);

describe("MultiServerMCPClient", () => {
  // Setup and teardown
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("OAuth provider parsing", () => {
    class Provider {
      get redirectUrl(): undefined {
        throw new Error("Read redirectUrl only during authorization");
      }

      get clientMetadata(): never {
        throw new Error("Read clientMetadata only during authorization");
      }

      clientInformation() {
        return undefined;
      }
      tokens() {
        return undefined;
      }
      saveTokens() {}
      redirectToAuthorization() {}
      saveCodeVerifier() {}
      codeVerifier() {
        return "verifier";
      }
    }

    test("preserves provider identity, prototype methods, and lazy metadata", () => {
      const provider = new Provider();
      const parsed = oAuthClientProviderSchema.parse(provider);
      expect(parsed).toBe(provider);
      expect(parsed.tokens).toBe(provider.tokens);
    });

    test.each([
      "clientInformation",
      "tokens",
      "saveTokens",
      "redirectToAuthorization",
      "saveCodeVerifier",
      "codeVerifier",
    ])("rejects a non-callable %s before connecting", (method) => {
      const provider = Object.assign(new Provider(), { [method]: 42 });
      const result = oAuthClientProviderSchema.safeParse(provider);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues[0].path).toEqual([method]);
      }
    });

    test.each([null, undefined, "provider", {}])(
      "rejects invalid provider %j",
      (provider) => {
        expect(oAuthClientProviderSchema.safeParse(provider).success).toBe(
          false
        );
      }
    );
  });

  describe("HTTP error handling", () => {
    test("rejects unknown public options before opening a connection", async () => {
      const adapter = new MCPAdapter({
        servers: { modern: { url: "https://example.com/mcp" } },
      });
      const options = { headers: {}, cacheMdoe: "refresh" };
      await expect(adapter.listToolsets(options)).rejects.toThrow(ZodError);
      await expect(adapter.initializeConnections(options)).rejects.toThrow(
        ZodError
      );
      await expect(adapter.listTools([], options)).rejects.toThrow(ZodError);
      await expect(adapter.listResources([], options)).rejects.toThrow(
        ZodError
      );
      await expect(adapter.listResourceTemplates([], options)).rejects.toThrow(
        ZodError
      );
      await expect(adapter.getClient("modern", options)).rejects.toThrow(
        ZodError
      );
      await expect(
        adapter.readResource("modern", "file:///test", options)
      ).rejects.toThrow(ZodError);
      const discoveryOnly = {
        cacheMode: "refresh",
      } satisfies import("../index.js").ToolDiscoveryOptions;
      // @ts-expect-error Resource methods accept transport options, not discovery cache options.
      await expect(adapter.listResources([], discoveryOnly)).rejects.toThrow(
        ZodError
      );
      expect(Client.prototype.connect).not.toHaveBeenCalled();
    });
    test("falls back to SSE with the options that only apply to a modern server", async () => {
      vi.mocked(Client.prototype.connect).mockRejectedValueOnce({
        status: 404,
      });

      // Both meant "if the server is modern"; SSE settles it as legacy.
      const client = new MCPAdapter({
        servers: {
          remote: {
            url: "https://example.com/mcp",
            elicitation: true,
            logLevel: "info",
          },
        },
      });

      try {
        await expect(client.listTools()).resolves.toHaveLength(2);
        expect(SSEClientTransport).toHaveBeenCalledOnce();
      } finally {
        await client.close();
      }
    });

    test("does not fall back to SSE for an explicit modern connection", async () => {
      vi.mocked(Client.prototype.connect).mockRejectedValueOnce({
        status: 404,
      });

      const client = new MCPAdapter({
        servers: {
          remote: { mode: "modern", url: "https://example.com/mcp" },
        },
      });

      try {
        await expect(client.listTools()).rejects.toThrow(/in modern mode/);
        expect(SSEClientTransport).not.toHaveBeenCalled();
      } finally {
        await client.close();
      }
    });

    test.each([401, 403, 503])(
      "does not retry automatic negotiation over SSE after HTTP %s",
      async (status) => {
        vi.mocked(Client.prototype.connect).mockRejectedValueOnce({ status });
        const adapter = new MCPAdapter({
          servers: { remote: { url: "https://example.com/mcp" } },
        });
        try {
          await expect(adapter.listTools()).rejects.toThrow(
            // Only 401 is treated as an auth failure; 403 and 503 surface
            // as plain connect errors. All three skip the SSE retry, which
            // is what this asserts.
            status === 401 ? /Authentication failed/ : /in auto mode/
          );
          expect(SSEClientTransport).not.toHaveBeenCalled();
        } finally {
          await adapter.close();
        }
      }
    );

    test.each([
      [{ status: 404, code: "HTTP_ERROR" }, true],
      [{ code: 405 }, true],
      [{ status: 503, code: 404 }, false],
      [new Error("Connection failed (HTTP 404)"), true],
      [null, false],
      [undefined, false],
      ["failed", false],
      [{ code: "404" }, false],
      [{ code: -32000 }, false],
      [{ status: 600 }, false],
      [{ status: 401.5 }, false],
      [{ message: 404 }, false],
      [new Error("Failed (HTTP 999)"), false],
    ])(
      "handles %j without losing the original transport failure",
      async (error, fallsBack) => {
        vi.mocked(Client.prototype.connect).mockRejectedValueOnce(error);

        const client = new MultiServerMCPClient({
          remote: {
            mode: "legacy",
            transport: "http",
            url: "https://example.com/mcp",
          },
        });

        try {
          if (fallsBack) {
            await client.initializeConnections();

            // HTTP was attempted first, then retried once over SSE at the
            // same URL rather than the server being reported as unreachable.
            expect(StreamableHTTPClientTransport).toHaveBeenCalledTimes(1);
            expect(SSEClientTransport).toHaveBeenCalledTimes(1);
            expect(
              (SSEClientTransport as Mock).mock.calls[0][0].toString()
            ).toBe("https://example.com/mcp");
          } else {
            const failure = await client.initializeConnections().then(
              () => {
                throw new Error("initializeConnections should have rejected");
              },
              (thrown: unknown) => thrown
            );

            expect(SSEClientTransport).not.toHaveBeenCalled();
            expect(MCPClientError.isInstance(failure)).toBe(true);

            const clientError = failure as MCPClientError;

            // This row's transport failure survives verbatim as the cause...
            expect(Object.hasOwn(clientError, "cause")).toBe(true);
            expect(clientError.cause).toBe(error);

            // ...and is rendered into the message with the server context.
            expect(clientError.serverName).toBe("remote");
            expect(clientError.message).toBe(
              `Failed to connect to streamable HTTP server "remote, url: https://example.com/mcp" in legacy mode: ${error}`
            );
          }
        } finally {
          await client.close();
        }
      }
    );
  });

  // Constructor functionality tests
  describe("constructor", () => {
    test("should throw if initialized with empty connections", () => {
      expect(() => new MultiServerMCPClient({})).toThrow(ZodError);
    });

    test("should process valid stdio connection config", () => {
      const client = new MultiServerMCPClient({
        "test-server": {
          mode: "legacy",
          transport: "stdio",
          command: "python",
          args: ["./script.py"],
        },
      });

      // The flat config form is lifted under `servers` and stdio defaults applied.
      expect(client.config.servers["test-server"]).toEqual({
        mode: "legacy",
        transport: "stdio",
        command: "python",
        args: ["./script.py"],
        stderr: "inherit",
      });
    });

    test("should process valid SSE connection config", () => {
      const client = new MultiServerMCPClient({
        "test-server": {
          mode: "legacy",
          transport: "sse",
          url: "http://localhost:8000/sse",
          headers: { Authorization: "Bearer token" },
        },
      });

      expect(client.config.servers["test-server"]).toEqual({
        mode: "legacy",
        transport: "sse",
        url: "http://localhost:8000/sse",
        headers: { Authorization: "Bearer token" },
        automaticSSEFallback: true,
      });
    });

    test("should process valid streamable HTTP connection config", () => {
      const client = new MultiServerMCPClient({
        "test-server": {
          mode: "legacy",
          transport: "http",
          url: "http://localhost:8000/mcp",
        },
      });

      expect(client.config.servers["test-server"]).toEqual({
        mode: "legacy",
        transport: "http",
        url: "http://localhost:8000/mcp",
        automaticSSEFallback: true,
      });
    });

    test("should have a compile time error and a runtime error when the config is invalid", () => {
      expect(() => {
        new MultiServerMCPClient({
          "test-server": {
            // @ts-expect-error shouldn't match type constraints here
            transport: "invalid",
          },
        });
      }).toThrow(ZodError);
    });
  });

  // Connection Management tests
  describe("initializeConnections", () => {
    test("should initialize stdio connections correctly", async () => {
      const client = new MultiServerMCPClient({
        "test-server": {
          mode: "legacy",
          transport: "stdio",
          command: "python",
          args: ["./script.py"],
        },
      });

      await client.initializeConnections();

      expect(Client).toHaveBeenCalledWith(
        {
          name: "@langchain/mcp-adapters",
          version: expect.any(String),
        },
        { versionNegotiation: { mode: "legacy" } }
      );

      expect(StdioClientTransport).toHaveBeenCalledWith({
        command: "python",
        args: ["./script.py"],
        env: undefined,
        stderr: "inherit",
      });

      expect(Client).toHaveBeenCalled();
      expect(Client.prototype.connect).toHaveBeenCalled();
      expect(Client.prototype.listTools).toHaveBeenCalled();
    });

    test("should initialize SSE connections correctly", async () => {
      const client = new MultiServerMCPClient({
        "test-server": {
          mode: "legacy",
          transport: "sse",
          url: "http://localhost:8000/sse",
        },
      });

      await client.initializeConnections();

      expect(SSEClientTransport).toHaveBeenCalled();
      expect(Client).toHaveBeenCalled();
      expect(Client.prototype.connect).toHaveBeenCalled();
      expect(Client.prototype.listTools).toHaveBeenCalled();
    });

    test("should initialize streamable HTTP connections correctly", async () => {
      const client = new MultiServerMCPClient({
        "test-server": {
          mode: "legacy",
          transport: "http",
          url: "http://localhost:8000/mcp",
        },
      });

      await client.initializeConnections();

      expect(StreamableHTTPClientTransport).toHaveBeenCalledWith(
        new URL("http://localhost:8000/mcp"),
        {
          requestInit: {
            headers: {},
          },
        }
      );
      expect(Client).toHaveBeenCalled();
      expect(Client.prototype.connect).toHaveBeenCalled();
      expect(Client.prototype.listTools).toHaveBeenCalled();
    });

    test("should throw on connection failure", async () => {
      (Client as Mock).mockImplementationOnce(function mockClient() {
        return {
          ...Client.prototype,
          connect: vi
            .fn()
            .mockReturnValue(Promise.reject(new Error("Connection failed"))),
          listTools: vi.fn().mockReturnValue(Promise.resolve({ tools: [] })),
        };
      });

      const client = new MultiServerMCPClient({
        "test-server": {
          mode: "legacy",
          transport: "stdio",
          command: "python",
          args: ["./script.py"],
        },
      });

      await expect(client.initializeConnections()).rejects.toThrow(
        MCPClientError
      );
    });

    test("should throw on tool loading failures", async () => {
      (Client as Mock).mockImplementationOnce(function mockClient() {
        return {
          ...Client.prototype,
          connect: vi.fn().mockReturnValue(Promise.resolve()),
          setNotificationHandler: vi.fn().mockReturnValue(Promise.resolve()),
          listTools: vi
            .fn()
            .mockReturnValue(Promise.reject(new Error("Failed to list tools"))),
        };
      });

      const client = new MultiServerMCPClient({
        "test-server": {
          mode: "legacy",
          transport: "stdio",
          command: "python",
          args: ["./script.py"],
        },
      });

      await expect(client.initializeConnections()).rejects.toThrow(
        MCPClientError
      );
    });

    // Reconnection Logic tests
    describe("reconnection", () => {
      test("should attempt to reconnect stdio transport when enabled", async () => {
        const client = new MultiServerMCPClient({
          "test-server": {
            mode: "legacy",
            transport: "stdio",
            command: "python",
            args: ["./script.py"],
            restart: {
              enabled: true,
              maxAttempts: 3,
              delayMs: 100,
            },
          },
        });

        await client.initializeConnections();

        expect(StdioClientTransport).toHaveBeenCalledTimes(1);

        // Grab the created transport instance before clearing call counts
        const stdioInstance = (StdioClientTransport as Mock).mock.results[0]
          ?.value as { onclose?: () => Promise<void> | void };

        // Reset the call counts to focus on reconnection
        (StdioClientTransport as Mock).mockClear();

        expect(stdioInstance).toBeDefined();
        const { onclose } = stdioInstance;
        expect(onclose).toBeDefined();
        await onclose?.();

        // Expect a new transport to be created after a delay (for reconnection)
        await new Promise((resolve) => {
          setTimeout(resolve, 150);
        });

        // Verify reconnection was attempted by checking if the constructor was called again
        expect(StdioClientTransport).toHaveBeenCalledTimes(1);
      });

      test("should attempt to reconnect SSE transport when enabled", async () => {
        const client = new MultiServerMCPClient({
          "test-server": {
            mode: "legacy",
            transport: "sse",
            url: "http://localhost:8000/sse",
            reconnect: {
              enabled: true,
              maxAttempts: 3,
              delayMs: 100,
            },
          },
        });

        await client.initializeConnections();

        // Reset the call counts to focus on reconnection
        expect(SSEClientTransport).toHaveBeenCalledTimes(1);
        const sseInstance = (SSEClientTransport as Mock).mock.results[0]
          ?.value as { onclose?: () => Promise<void> | void };
        (SSEClientTransport as Mock).mockClear();

        expect(sseInstance).toBeDefined();
        const { onclose } = sseInstance;
        expect(onclose).toBeDefined();
        await onclose?.();

        // Expect a new transport to be created after a delay (for reconnection)
        await new Promise((resolve) => {
          setTimeout(resolve, 150);
        });

        // Verify reconnection was attempted by checking if the constructor was called again
        expect(SSEClientTransport).toHaveBeenCalledTimes(1);
      });

      test("should respect maxAttempts setting for reconnection", async () => {
        const client = new MultiServerMCPClient({
          "test-server": {
            mode: "legacy",
            transport: "stdio",
            command: "python",
            args: ["./script.py"],
            restart: {
              enabled: true,
              maxAttempts: 2,
              delayMs: 10,
            },
          },
        });

        await client.initializeConnections();

        // Get instance and then force subsequent reconnect attempts to fail
        const stdioInstance = (StdioClientTransport as Mock).mock.results[0]
          ?.value as { onclose?: () => Promise<void> | void };
        expect(stdioInstance).toBeDefined();

        // Clear counts so we only measure reconnection attempts
        (StdioClientTransport as Mock).mockClear();
        (Client.prototype.connect as Mock).mockImplementationOnce(() =>
          Promise.reject(new Error("reconnect fail 1"))
        );
        (Client.prototype.connect as Mock).mockImplementationOnce(() =>
          Promise.reject(new Error("reconnect fail 2"))
        );

        await stdioInstance.onclose?.();

        // Wait enough time for both attempts (2 * delayMs + buffer)
        await new Promise((resolve) => setTimeout(resolve, 80));

        // Should have attempted to create a new transport exactly maxAttempts times
        expect(StdioClientTransport).toHaveBeenCalledTimes(2);
      });

      test("should not attempt reconnection when not enabled", async () => {
        const client = new MultiServerMCPClient({
          "test-server": {
            mode: "legacy",
            transport: "sse",
            url: "http://localhost:8000/sse",
            // reconnect not provided -> disabled
          },
        });

        await client.initializeConnections();

        expect(SSEClientTransport).toHaveBeenCalledTimes(1);

        // Get transport instance and clear counts to observe reconnection attempts
        const sseInstance = (SSEClientTransport as Mock).mock.results[0]
          ?.value as { onclose?: () => Promise<void> | void };
        (SSEClientTransport as Mock).mockClear();

        // Trigger onclose if defined
        await sseInstance.onclose?.();

        // Wait some time to ensure no reconnection is attempted
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(SSEClientTransport).not.toHaveBeenCalled();
      });
    });
  });

  // Tool Management tests
  describe("listTools", () => {
    /**
     * Queue one mock MCP client per server, in the order the servers are
     * declared, each advertising its own tool list.
     */
    function mockClientsWithTools(
      ...toolsPerServer: {
        name: string;
        description: string;
        inputSchema: Record<string, unknown>;
      }[][]
    ) {
      for (const tools of toolsPerServer) {
        (Client as Mock).mockImplementationOnce(function mockClient() {
          return {
            ...Client.prototype,
            connect: vi.fn().mockReturnValue(Promise.resolve()),
            setNotificationHandler: vi.fn().mockReturnValue(Promise.resolve()),
            listTools: vi.fn().mockReturnValue(Promise.resolve({ tools })),
          };
        });
      }
    }

    test("should get all tools as a flattened array", async () => {
      // Mock tool response
      const mockTools = [
        { name: "tool1", description: "Tool 1", inputSchema: {} },
        { name: "tool2", description: "Tool 2", inputSchema: {} },
      ];

      (Client as Mock).mockImplementationOnce(function mockClient() {
        return {
          ...Client.prototype,
          connect: vi.fn().mockReturnValue(Promise.resolve()),
          setNotificationHandler: vi.fn().mockReturnValue(Promise.resolve()),
          listTools: vi
            .fn()
            .mockReturnValue(Promise.resolve({ tools: mockTools })),
        };
      });

      const client = new MultiServerMCPClient({
        server1: {
          mode: "legacy",
          transport: "stdio",
          command: "python",
          args: ["./script1.py"],
        },
        server2: {
          mode: "legacy",
          transport: "stdio",
          command: "python",
          args: ["./script2.py"],
        },
      });

      const tools = await client.listTools();

      // Expect tools from both servers in a flat array
      expect(tools.length).toBeGreaterThan(0);
    });

    test("should get tools from specific servers", async () => {
      mockClientsWithTools(
        [{ name: "alpha1", description: "Alpha 1", inputSchema: {} }],
        [
          { name: "beta1", description: "Beta 1", inputSchema: {} },
          { name: "beta2", description: "Beta 2", inputSchema: {} },
        ]
      );

      const client = new MultiServerMCPClient({
        alpha: {
          mode: "legacy",
          transport: "stdio",
          command: "python",
          args: ["./alpha.py"],
        },
        beta: {
          mode: "legacy",
          transport: "stdio",
          command: "python",
          args: ["./beta.py"],
        },
      });

      try {
        // A single server name keeps that server's tools and drops the rest.
        expect((await client.listTools("beta")).map((t) => t.name)).toEqual([
          "beta1",
          "beta2",
        ]);
        expect((await client.listTools("alpha")).map((t) => t.name)).toEqual([
          "alpha1",
        ]);

        // The array overload filters and preserves the requested order.
        expect(
          (await client.listTools(["beta", "alpha"])).map((t) => t.name)
        ).toEqual(["beta1", "beta2", "alpha1"]);

        // Unfiltered discovery still returns every server's tools.
        expect((await client.listTools()).map((t) => t.name)).toEqual([
          "alpha1",
          "beta1",
          "beta2",
        ]);

        // An unknown server name contributes nothing instead of throwing.
        expect(await client.listTools("missing")).toEqual([]);
      } finally {
        await client.close();
      }
    });

    test("should handle empty tool lists correctly", async () => {
      mockClientsWithTools(
        [],
        [{ name: "beta1", description: "Beta 1", inputSchema: {} }]
      );

      const client = new MultiServerMCPClient({
        empty: {
          mode: "legacy",
          transport: "stdio",
          command: "python",
          args: ["./empty.py"],
        },
        beta: {
          mode: "legacy",
          transport: "stdio",
          command: "python",
          args: ["./beta.py"],
        },
      });

      try {
        // A server advertising no tools is still listed, with an empty group.
        const toolsets = await client.listToolsets();
        expect(Object.keys(toolsets).sort()).toEqual(["beta", "empty"]);
        expect(toolsets.empty).toEqual([]);

        // It contributes no entries to the flattened list, and no holes either.
        expect((await client.listTools()).map((t) => t.name)).toEqual([
          "beta1",
        ]);
        expect(await client.listTools("empty")).toEqual([]);
        expect(
          (await client.listTools(["empty", "beta"])).map((t) => t.name)
        ).toEqual(["beta1"]);
      } finally {
        await client.close();
      }
    });

    describe("should apply tool name prefixes correctly", () => {
      test("when prefixToolNameWithServerName is true", async () => {
        const client = new MultiServerMCPClient({
          mcpServers: {
            "test-server": {
              mode: "legacy",
              transport: "stdio",
              command: "python",
              args: ["./script.py"],
            },
          },
          prefixToolNameWithServerName: true,
        });
        const tools = await client.listTools();

        expect(tools.length).toBe(2);
        expect(tools[0].name).toBe("test-server__tool1");
        expect(tools[1].name).toBe("test-server__tool2");
      });
      test("when additionalToolNamePrefix is set", async () => {
        const client = new MultiServerMCPClient({
          mcpServers: {
            "test-server": {
              mode: "legacy",
              transport: "stdio",
              command: "python",
              args: ["./script.py"],
            },
          },
          additionalToolNamePrefix: "mcp",
        });
        const tools = await client.listTools();

        expect(tools.length).toBe(2);
        expect(tools[0].name).toBe("mcp__tool1");
        expect(tools[1].name).toBe("mcp__tool2");
      });
      test("with both server name and additional prefix when set", async () => {
        const client = new MultiServerMCPClient({
          mcpServers: {
            "test-server": {
              mode: "legacy",
              transport: "stdio",
              command: "python",
              args: ["./script.py"],
            },
          },
          prefixToolNameWithServerName: true,
          additionalToolNamePrefix: "mcp",
        });
        const tools = await client.listTools();

        expect(tools.length).toBe(2);
        expect(tools[0].name).toBe("mcp__test-server__tool1");
        expect(tools[1].name).toBe("mcp__test-server__tool2");
      });
      test("shouldn't apply prefixes by default", async () => {
        const client = new MultiServerMCPClient({
          "test-server": {
            mode: "legacy",
            transport: "stdio",
            command: "python",
            args: ["./script.py"],
          },
        });
        const tools = await client.listTools();

        expect(tools.length).toBe(2);
        expect(tools[0].name).toBe("tool1");
        expect(tools[1].name).toBe("tool2");
      });
    });
  });

  // Cleanup Handling tests
  describe("close", () => {
    test("should close all connections properly", async () => {
      const client = new MultiServerMCPClient({
        server1: {
          mode: "legacy",
          transport: "stdio",
          command: "python",
          args: ["./script1.py"],
        },
        server2: {
          mode: "legacy",
          transport: "sse",
          url: "http://localhost:8000/sse",
        },
        server3: {
          mode: "legacy",
          transport: "http",
          url: "http://localhost:8000/mcp",
        },
      });

      await client.initializeConnections();
      await client.close();

      // ConnectionManager now closes the MCP client, which in real SDK closes transports.
      // Assert that all clients were closed.
      expect(Client.prototype.close).toHaveBeenCalledTimes(3);
    });

    test("should handle errors during cleanup gracefully", async () => {
      // Mock client.close to throw an error instead of transport.close
      (Client.prototype.close as Mock).mockImplementationOnce(() =>
        Promise.reject(new Error("Close failed"))
      );

      const client = new MultiServerMCPClient({
        "test-server": {
          mode: "legacy",
          transport: "stdio",
          command: "python",
          args: ["./script.py"],
        },
      });

      await client.initializeConnections();
      await expect(client.close()).rejects.toThrow(
        /Failed to close MCP connections/
      );

      expect(Client.prototype.close).toHaveBeenCalledOnce();
    });
  });

  // Streamable HTTP specific tests
  describe("streamable HTTP transport", () => {
    // These replace the Client constructor outright; without this every test
    // that runs afterwards inherits it.
    afterEach(() => {
      resetClientMock();
    });

    test("should throw when streamable HTTP config is missing required fields", () => {
      expect(() => {
        new MultiServerMCPClient({
          // @ts-expect-error missing url field
          "test-server": {
            mode: "legacy",
            transport: "http",
            // Missing url field
          },
        });
      }).toThrow(ZodError);
    });

    test("should throw when streamable HTTP URL is invalid", () => {
      expect(() => {
        new MultiServerMCPClient({
          "test-server": {
            mode: "legacy",
            transport: "http",
            url: "invalid-url", // Invalid URL format
          },
        });
      }).toThrow(ZodError);
    });

    test("should handle mixed transport types including streamable HTTP", async () => {
      const client = new MultiServerMCPClient({
        "stdio-server": {
          mode: "legacy",
          transport: "stdio",
          command: "python",
          args: ["./script.py"],
        },
        "sse-server": {
          mode: "legacy",
          transport: "sse",
          url: "http://localhost:8000/sse",
        },
        "streamable-server": {
          mode: "legacy",
          transport: "http",
          url: "http://localhost:8000/mcp",
        },
      });

      await client.initializeConnections();

      // Verify all transports were initialized
      expect(StreamableHTTPClientTransport).toHaveBeenCalled();
      expect(SSEClientTransport).toHaveBeenCalled();
      expect(StdioClientTransport).toHaveBeenCalled();

      // Get tools from all servers
      const tools = await client.listTools();
      expect(tools.length).toBeGreaterThan(0);
    });

    test("should throw on streamable HTTP connection failure", async () => {
      (Client as Mock).mockImplementationOnce(function mockClient() {
        return {
          ...Client.prototype,
          connect: vi
            .fn()
            .mockReturnValue(Promise.reject(new Error("Connection failed"))),
          listTools: vi.fn().mockReturnValue(Promise.resolve({ tools: [] })),
        };
      });

      const client = new MultiServerMCPClient({
        "test-server": {
          mode: "legacy",
          transport: "http",
          url: "http://localhost:8000/mcp",
        },
      });

      await expect(client.initializeConnections()).rejects.toThrow(
        MCPClientError
      );
    });

    test("should handle errors during streamable HTTP cleanup gracefully", async () => {
      // Mock client.close to throw an error instead of transport.close
      (Client.prototype.close as Mock).mockImplementationOnce(() =>
        Promise.reject(new Error("Close failed"))
      );

      const client = new MultiServerMCPClient({
        "test-server": {
          mode: "legacy",
          transport: "http",
          url: "http://localhost:8000/mcp",
        },
      });

      await client.initializeConnections();
      await expect(client.close()).rejects.toThrow(
        /Failed to close MCP connections/
      );

      expect(Client.prototype.close).toHaveBeenCalledOnce();
    });

    test("should ignore connection errors when onConnectionError is 'ignore'", async () => {
      // Mock one successful and one failing connection
      let clientCallCount = 0;
      (Client as Mock).mockImplementation(function mockClient() {
        clientCallCount += 1;
        if (clientCallCount === 1) {
          // First server fails
          return {
            ...Client.prototype,
            connect: vi
              .fn()
              .mockReturnValue(Promise.reject(new Error("Connection failed"))),
            listTools: vi.fn().mockReturnValue(Promise.resolve({ tools: [] })),
          };
        } else {
          // Second server succeeds
          return {
            ...Client.prototype,
            connect: vi.fn().mockReturnValue(Promise.resolve()),
            listTools: vi.fn().mockReturnValue(Promise.resolve({ tools: [] })),
          };
        }
      });

      const client = new MultiServerMCPClient({
        mcpServers: {
          "failing-server": {
            mode: "legacy",
            transport: "http",
            url: "http://localhost:8123/mcp",
          },
          "working-server": {
            mode: "legacy",
            transport: "http",
            url: "http://localhost:8001/mcp",
          },
        },
        onConnectionError: "ignore",
      });

      // Should not throw, even though one server fails
      const tools = await client.initializeConnections();

      // Should have tools from the working server only
      expect(tools).toBeDefined();

      // Working server should be accessible
      const workingClient = await client.getClient("working-server");
      expect(workingClient).toBeDefined();

      // Failing server should not be accessible
      const failingClient = await client.getClient("failing-server");
      expect(failingClient).toBeUndefined();
    });

    test("should throw on connection failure when onConnectionError is 'throw'", async () => {
      (Client as Mock).mockImplementationOnce(function mockClient() {
        return {
          ...Client.prototype,
          connect: vi
            .fn()
            .mockReturnValue(Promise.reject(new Error("Connection failed"))),
          listTools: vi.fn().mockReturnValue(Promise.resolve({ tools: [] })),
        };
      });

      const client = new MultiServerMCPClient({
        mcpServers: {
          "failing-server": {
            mode: "legacy",
            transport: "http",
            url: "http://localhost:8000/mcp",
          },
        },
        onConnectionError: "throw",
      });

      // Should throw when onConnectionError is 'throw' (default behavior)
      await expect(() => client.initializeConnections()).rejects.toThrow(
        MCPClientError
      );
    });

    test("should not throw when all servers fail and onConnectionError is 'ignore'", async () => {
      (Client as Mock).mockImplementation(function mockClient() {
        return {
          ...Client.prototype,
          connect: vi
            .fn()
            .mockReturnValue(Promise.reject(new Error("Connection failed"))),
          listTools: vi.fn().mockReturnValue(Promise.resolve({ tools: [] })),
        };
      });

      const client = new MultiServerMCPClient({
        mcpServers: {
          "server-1": {
            mode: "legacy",
            transport: "http",
            url: "http://localhost:8000/mcp",
          },
          "server-2": {
            mode: "legacy",
            transport: "http",
            url: "http://localhost:8001/mcp",
          },
        },
        onConnectionError: "ignore",
      });

      // Should not throw, even though all servers fail
      const tools = await client.listTools();
      expect(tools).toEqual([]);

      // Both servers should be inaccessible
      const client1 = await client.getClient("server-1");
      const client2 = await client.getClient("server-2");
      expect(client1).toBeUndefined();
      expect(client2).toBeUndefined();
    });

    test("validates custom error handler arguments and return values", () => {
      const errorHandler = vi.fn(() => "unexpected return");
      const adapter = new MCPAdapter({
        servers: { remote: { url: "https://example.com/mcp" } },
        onConnectionError: errorHandler,
      });
      const handler = adapter.config.onConnectionError;
      const error = new Error("Connection failed");

      if (typeof handler !== "function") throw new Error("Expected a handler");

      expect(() =>
        Reflect.apply(handler, undefined, [{ serverName: 123, error }])
      ).toThrow(/expected string/);
      expect(errorHandler).not.toHaveBeenCalled();

      expect(() => handler({ serverName: "remote", error })).toThrow(
        /expected void/
      );
      expect(errorHandler).toHaveBeenCalledExactlyOnceWith({
        serverName: "remote",
        error,
      });
    });

    test("should call custom error handler and ignore if handler doesn't throw", async () => {
      let clientCallCount = 0;
      const errorHandler = vi.fn(({ serverName, error }) => {
        // Handler doesn't throw, so server should be ignored
        expect(serverName).toBe("failing-server");
        expect(error).toBeInstanceOf(Error);
      });

      (Client as Mock).mockImplementation(function mockClient() {
        clientCallCount += 1;
        if (clientCallCount === 1) {
          // First server (failing-server) fails
          return {
            ...Client.prototype,
            connect: vi
              .fn()
              .mockReturnValue(Promise.reject(new Error("Connection failed"))),
            listTools: vi.fn().mockReturnValue(Promise.resolve({ tools: [] })),
          };
        } else {
          // Second server (working-server) succeeds
          return {
            ...Client.prototype,
            connect: vi.fn().mockReturnValue(Promise.resolve()),
            listTools: vi.fn().mockReturnValue(Promise.resolve({ tools: [] })),
          };
        }
      });

      const client = new MultiServerMCPClient({
        mcpServers: {
          "failing-server": {
            mode: "legacy",
            transport: "http",
            url: "http://localhost:8000/mcp",
          },
          "working-server": {
            mode: "legacy",
            transport: "http",
            url: "http://localhost:8001/mcp",
          },
        },
        onConnectionError: errorHandler,
      });

      // Should not throw, even though one server fails
      await client.initializeConnections();

      // Error handler should have been called
      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith({
        serverName: "failing-server",
        error: expect.any(Error),
      });

      // Failing server should not be accessible
      const failingClient = await client.getClient("failing-server");
      expect(failingClient).toBeUndefined();

      // Working server should be accessible
      const workingClient = await client.getClient("working-server");
      expect(workingClient).toBeDefined();
    });

    test("should throw if custom error handler throws", async () => {
      const customError = new Error("Custom error from handler");
      const errorHandler = vi.fn(() => {
        throw customError;
      });

      (Client as Mock).mockImplementation(function mockClient() {
        return {
          ...Client.prototype,
          connect: vi
            .fn()
            .mockReturnValue(Promise.reject(new Error("Connection failed"))),
          listTools: vi.fn().mockReturnValue(Promise.resolve({ tools: [] })),
        };
      });

      const client = new MultiServerMCPClient({
        mcpServers: {
          "failing-server": {
            mode: "legacy",
            transport: "http",
            url: "http://localhost:8000/mcp",
          },
        },
        onConnectionError: errorHandler,
      });

      // Should throw the error from the handler
      await expect(() => client.initializeConnections()).rejects.toThrow(
        customError
      );

      // Error handler should have been called
      expect(errorHandler).toHaveBeenCalledTimes(1);
    });

    test("should skip failed servers on subsequent calls when using custom error handler", async () => {
      const errorHandler = vi.fn(() => {
        // Handler doesn't throw, so server should be ignored
      });

      let clientCallCount = 0;
      (Client as Mock).mockImplementation(function mockClient() {
        clientCallCount += 1;
        if (clientCallCount === 1) {
          // First server fails
          return {
            ...Client.prototype,
            connect: vi
              .fn()
              .mockReturnValue(Promise.reject(new Error("Connection failed"))),
            listTools: vi.fn().mockReturnValue(Promise.resolve({ tools: [] })),
          };
        } else {
          // Second server succeeds
          return {
            ...Client.prototype,
            connect: vi.fn().mockReturnValue(Promise.resolve()),
            listTools: vi.fn().mockReturnValue(Promise.resolve({ tools: [] })),
          };
        }
      });

      const client = new MultiServerMCPClient({
        mcpServers: {
          "failing-server": {
            mode: "legacy",
            transport: "http",
            url: "http://localhost:8000/mcp",
          },
          "working-server": {
            mode: "legacy",
            transport: "http",
            url: "http://localhost:8001/mcp",
          },
        },
        onConnectionError: errorHandler,
      });

      // First call - failing server should trigger handler
      await client.initializeConnections();
      expect(errorHandler).toHaveBeenCalledTimes(1);

      // Second call - failing server should be skipped, handler shouldn't be called again
      await client.initializeConnections();
      expect(errorHandler).toHaveBeenCalledTimes(1); // Still only called once

      // Failing server should not be accessible
      const failingClient = await client.getClient("failing-server");
      expect(failingClient).toBeUndefined();
    });

    test("should be idempotent when initializeConnections is called multiple times with onConnectionError 'ignore'", async () => {
      let clientCallCount = 0;
      (Client as Mock).mockImplementation(function mockClient() {
        clientCallCount += 1;
        if (clientCallCount === 1) {
          // First server fails
          return {
            ...Client.prototype,
            connect: vi
              .fn()
              .mockReturnValue(Promise.reject(new Error("Connection failed"))),
            listTools: vi.fn().mockReturnValue(Promise.resolve({ tools: [] })),
          };
        } else {
          // Second server succeeds
          return {
            ...Client.prototype,
            connect: vi.fn().mockReturnValue(Promise.resolve()),
            listTools: vi.fn().mockReturnValue(Promise.resolve({ tools: [] })),
          };
        }
      });

      const client = new MultiServerMCPClient({
        mcpServers: {
          "failing-server": {
            mode: "legacy",
            transport: "http",
            url: "http://localhost:8000/mcp",
          },
          "working-server": {
            mode: "legacy",
            transport: "http",
            url: "http://localhost:8001/mcp",
          },
        },
        onConnectionError: "ignore",
      });

      // First call
      const tools1 = await client.initializeConnections();
      expect(tools1).toBeDefined();

      // Second call should not throw and should return the same result
      const tools2 = await client.initializeConnections();
      expect(tools2).toBeDefined();
      expect(Object.keys(tools2)).toEqual(Object.keys(tools1));

      // Both calls should result in the same accessible servers
      const workingClient1 = await client.getClient("working-server");
      const workingClient2 = await client.getClient("working-server");
      expect(workingClient1).toBeDefined();
      expect(workingClient2).toBeDefined();
    });
  });

  // ---- merged from client.comprehensive.test.ts ----
  describe("Constructor", () => {
    test("should throw when initialized with empty connections", async () => {
      expect(() => new MultiServerMCPClient({})).toThrow(ZodError);
    });

    test("should process valid stdio connection config", async () => {
      const config = {
        "test-server": {
          mode: "legacy",
          transport: "stdio" as const,
          command: "python",
          args: ["./script.py"],
        },
      } satisfies Record<string, Connection>;

      const client = new MultiServerMCPClient(config);
      expect(client).toBeDefined();

      // Initialize connections and verify
      await client.initializeConnections();
      expect(StdioClientTransport).toHaveBeenCalled();
      expect(Client).toHaveBeenCalled();
    });

    test("should process valid streamable HTTP connection config", async () => {
      const config = {
        "test-server": {
          mode: "legacy",
          transport: "http" as const,
          url: "http://localhost:8000/mcp",
        },
      } satisfies Record<string, Connection>;

      const client = new MultiServerMCPClient(config);
      expect(client).toBeDefined();

      // Initialize connections and verify
      await client.initializeConnections();
      expect(StreamableHTTPClientTransport).toHaveBeenCalled();
      expect(Client).toHaveBeenCalled();
    });

    test("should process valid SSE connection config", async () => {
      const config = {
        "test-server": {
          mode: "legacy",
          transport: "sse" as const,
          url: "http://localhost:8000/sse",
          headers: { Authorization: "Bearer token" },
        },
      } satisfies Record<string, Connection>;

      const client = new MultiServerMCPClient(config);
      expect(client).toBeDefined();

      // Initialize connections and verify
      await client.initializeConnections();
      expect(SSEClientTransport).toHaveBeenCalledWith(
        new URL(config["test-server"].url),
        expect.objectContaining({
          requestInit: {
            headers: Object.fromEntries(
              new Headers(config["test-server"].headers)
            ),
          },
        })
      );
      expect(Client).toHaveBeenCalled();
    });

    test("should throw if initialized with invalid connection type", async () => {
      const config: Record<string, Connection> = {
        "test-server": {
          // @ts-expect-error invalid transport type
          transport: "invalid" as const,
          url: "http://localhost:8000/invalid",
        },
      };

      // Should throw error during initialization
      expect(() => {
        new MultiServerMCPClient(config);
      }).toThrow(ZodError);
    });
  });

  describe("Connection Management", () => {
    test("should initialize stdio connections correctly", async () => {
      // Create a client instance with the config
      const client = new MultiServerMCPClient({
        "stdio-server": {
          mode: "legacy",
          transport: "stdio" as const,
          command: "python",
          args: ["./script.py"],
        },
      });

      // Reset mocks to ensure clean state
      vi.clearAllMocks();

      // Initialize connections
      await client.initializeConnections();

      // The StdioClientTransport should have been called at least once
      expect(StdioClientTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          command: "python",
          args: ["./script.py"],
        })
      );

      // Verify the client methods were called as expected
      expect(Client).toHaveBeenCalled();
      expect(Client.prototype.connect).toHaveBeenCalled();
    });

    test("should initialize SSE connections correctly", async () => {
      // Create a client instance with the config
      const client = new MultiServerMCPClient({
        "sse-server": {
          mode: "legacy",
          transport: "sse" as const,
          url: "http://example.com/sse",
        },
      });

      // Reset mocks to ensure clean state
      vi.clearAllMocks();

      // Initialize connections
      await client.initializeConnections();

      // The SSEClientTransport should have been called at least once
      expect(SSEClientTransport).toHaveBeenCalled();

      // Verify the client methods were called as expected
      expect(Client).toHaveBeenCalled();
      expect(Client.prototype.connect).toHaveBeenCalled();
    });

    test("should throw on connection failures", async () => {
      // Mock connection failure
      (Client.prototype.connect as Mock).mockImplementationOnce(() =>
        Promise.reject(new Error("Connection failed"))
      );

      const client = new MultiServerMCPClient({
        "test-server": {
          mode: "legacy",
          transport: "stdio" as const,
          command: "python",
          args: ["./script.py"],
        },
      });

      // Named, so this cannot pass on a failure from any other stage.
      await expect(client.initializeConnections()).rejects.toThrow(
        /Connection failed/
      );
    });

    test("should throw on tool loading failures", async () => {
      // Mock tool loading failure
      (Client.prototype.listTools as Mock).mockImplementationOnce(() =>
        Promise.reject(new Error("Failed to list tools"))
      );

      const client = new MultiServerMCPClient({
        "test-server": {
          mode: "legacy",
          transport: "stdio" as const,
          command: "python",
          args: ["./script.py"],
        },
      });

      await expect(client.initializeConnections()).rejects.toThrow(
        /Failed to list tools/
      );
    });
  });

  describe("Reconnection Logic", () => {
    test("should attempt to reconnect stdio transport when enabled", async () => {
      const client = new MultiServerMCPClient({
        "test-server": {
          mode: "legacy",
          transport: "stdio" as const,
          command: "python",
          args: ["./script.py"],
          restart: {
            enabled: true,
            maxAttempts: 3,
            delayMs: 100,
          },
        },
      });

      await client.initializeConnections();

      // Grab the created transport instance before clearing call counts
      const stdioInstance = (StdioClientTransport as Mock).mock.results[0]
        ?.value as { onclose?: () => Promise<void> | void };

      // Clear previous calls
      (StdioClientTransport as Mock).mockClear();
      (Client.prototype.connect as Mock).mockClear();

      // Trigger onclose handler
      expect(stdioInstance).toBeDefined();
      const { onclose } = stdioInstance;
      expect(onclose).toBeDefined();
      await onclose?.();

      // Wait for reconnection delay
      await new Promise((resolve) => {
        setTimeout(resolve, 150);
      });

      // Should attempt to create a new transport
      expect(StdioClientTransport).toHaveBeenCalledTimes(1);
      // And connect
      expect(Client.prototype.connect).toHaveBeenCalled();
    });

    test("a close during the reconnect backoff cancels the reconnect", async () => {
      const client = new MultiServerMCPClient({
        "test-server": {
          mode: "legacy",
          transport: "stdio" as const,
          command: "python",
          args: ["./script.py"],
          restart: {
            enabled: true,
            maxAttempts: 3,
            delayMs: 100,
          },
        },
      });

      await client.initializeConnections();

      const stdioInstance = (StdioClientTransport as Mock).mock.results[0]
        ?.value as { onclose?: () => Promise<void> | void };
      expect(stdioInstance).toBeDefined();

      (StdioClientTransport as Mock).mockClear();
      (Client.prototype.connect as Mock).mockClear();

      // Drop the transport so a reconnect is scheduled, let it reach its
      // backoff, then close while it is waiting there.
      const reconnecting = stdioInstance.onclose?.();
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });
      await client.close();
      await reconnecting;

      // Past the backoff window: the aborted epoch must have cancelled it, so
      // no connection is rebuilt behind a closed adapter.
      await new Promise((resolve) => {
        setTimeout(resolve, 200);
      });

      expect(StdioClientTransport as Mock).not.toHaveBeenCalled();
      expect(Client.prototype.connect as Mock).not.toHaveBeenCalled();
    });

    test("should attempt to reconnect SSE transport when enabled", async () => {
      const client = new MultiServerMCPClient({
        "test-server": {
          mode: "legacy",
          transport: "sse" as const,
          url: "http://localhost:8000/sse",
          reconnect: {
            enabled: true,
            maxAttempts: 3,
            delayMs: 100,
          },
        },
      });

      await client.initializeConnections();

      // Grab the created transport instance before clearing call counts
      const sseInstance = (SSEClientTransport as Mock).mock.results[0]
        ?.value as { onclose?: () => Promise<void> | void };

      // Clear previous calls
      (SSEClientTransport as Mock).mockClear();
      (Client.prototype.connect as Mock).mockClear();

      // Trigger onclose handler
      expect(sseInstance).toBeDefined();
      const { onclose } = sseInstance;
      expect(onclose).toBeDefined();
      await onclose?.();

      // Wait for reconnection delay
      await new Promise((resolve) => {
        setTimeout(resolve, 150);
      });

      // Should attempt to create a new transport
      expect(SSEClientTransport).toHaveBeenCalledTimes(1);
      // And connect
      expect(Client.prototype.connect).toHaveBeenCalled();
    });

    test("should respect maxAttempts setting for reconnection", async () => {
      // Set up the test
      const maxAttempts = 2;
      const client = new MultiServerMCPClient({
        "test-server": {
          mode: "legacy",
          transport: "stdio" as const,
          command: "python",
          args: ["./script.py"],
          restart: {
            enabled: true,
            maxAttempts,
          },
        },
      });

      await client.initializeConnections();

      // Grab instance created during initialization
      const stdioInstance = (StdioClientTransport as Mock).mock.results[0]
        ?.value as { onclose?: () => Promise<void> | void };

      // Reset counts to only measure reconnection attempts
      (StdioClientTransport as Mock).mockClear();
      (Client.prototype.connect as Mock).mockImplementationOnce(() =>
        Promise.reject(new Error("reconnect fail 1"))
      );
      (Client.prototype.connect as Mock).mockImplementationOnce(() =>
        Promise.reject(new Error("reconnect fail 2"))
      );

      // Simulate connection close to trigger reconnection
      expect(stdioInstance).toBeDefined();
      const { onclose } = stdioInstance;
      expect(onclose).toBeDefined();
      await onclose?.();

      // Wait for reconnection attempts to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should attempt to create a new transport exactly maxAttempts times
      expect(StdioClientTransport).toHaveBeenCalledTimes(maxAttempts);
    });
  });

  describe("Tool Management", () => {
    /**
     * Queue one mock MCP client per server, in the order the servers are
     * declared, each advertising its own tool list. Per-instance mocks (rather
     * than one queued `Client.prototype.listTools`) keep the tool list stable
     * across repeated discovery calls.
     */
    function mockClientsWithTools(
      ...toolsPerServer: {
        name: string;
        description: string;
        inputSchema: Record<string, unknown>;
      }[][]
    ) {
      for (const tools of toolsPerServer) {
        (Client as Mock).mockImplementationOnce(function mockClient() {
          return {
            ...Client.prototype,
            connect: vi.fn().mockReturnValue(Promise.resolve()),
            setNotificationHandler: vi.fn().mockReturnValue(Promise.resolve()),
            listTools: vi.fn().mockReturnValue(Promise.resolve({ tools })),
          };
        });
      }
    }

    test("should get all tools as a flattened array", async () => {
      // Mock tool response
      (Client.prototype.listTools as Mock).mockImplementationOnce(() =>
        Promise.resolve({
          tools: [
            { name: "tool1", description: "Tool 1", inputSchema: {} },
            { name: "tool2", description: "Tool 2", inputSchema: {} },
          ],
        })
      );

      const client = new MultiServerMCPClient({
        server1: {
          mode: "legacy",
          transport: "stdio" as const,
          command: "python",
          args: ["./script1.py"],
        },
      });

      const conf = client.config;
      expect(conf.additionalToolNamePrefix).toBe("");
      expect(conf.prefixToolNameWithServerName).toBe(false);

      await client.initializeConnections();
      const tools = await client.listTools();

      // Should have 2 tools
      expect(tools.length).toBe(2);
      expect(tools[0].name).toBe("tool1");
      expect(tools[1].name).toBe("tool2");
    });

    test("should get tools from a specific server", async () => {
      mockClientsWithTools(
        [{ name: "tool1", description: "Tool 1", inputSchema: {} }],
        [
          { name: "tool2", description: "Tool 2", inputSchema: {} },
          { name: "tool3", description: "Tool 3", inputSchema: {} },
        ]
      );

      const client = new MultiServerMCPClient({
        server1: {
          mode: "legacy",
          transport: "stdio" as const,
          command: "python",
          args: ["./script1.py"],
        },
        server2: {
          mode: "legacy",
          transport: "stdio" as const,
          command: "python",
          args: ["./script2.py"],
        },
      });

      await client.initializeConnections();

      // Naming a server keeps only that server's tools.
      const server2Tools = await client.listTools("server2");
      expect(server2Tools.map((tool) => tool.name)).toEqual(["tool2", "tool3"]);

      const server1Tools = await client.listTools("server1");
      expect(server1Tools.map((tool) => tool.name)).toEqual(["tool1"]);

      // The filtered result matches that server's group in the toolset map.
      const toolsets = await client.listToolsets();
      expect(toolsets.server2.map((tool) => tool.name)).toEqual([
        "tool2",
        "tool3",
      ]);

      // Unfiltered discovery still spans every server.
      expect((await client.listTools()).map((tool) => tool.name)).toEqual([
        "tool1",
        "tool2",
        "tool3",
      ]);
    });

    test("should handle empty tool lists correctly", async () => {
      mockClientsWithTools(
        [],
        [{ name: "tool1", description: "Tool 1", inputSchema: {} }]
      );

      const client = new MultiServerMCPClient({
        emptyServer: {
          mode: "legacy",
          transport: "stdio" as const,
          command: "python",
          args: ["./empty.py"],
        },
        server1: {
          mode: "legacy",
          transport: "stdio" as const,
          command: "python",
          args: ["./script1.py"],
        },
      });

      const toolsets = await client.initializeConnections();

      // A server that advertises no tools is still connected and listed.
      expect(Object.keys(toolsets).sort()).toEqual(["emptyServer", "server1"]);
      expect(toolsets.emptyServer).toEqual([]);

      // It contributes nothing to the flattened list, and no undefined holes.
      const tools = await client.listTools();
      expect(tools.map((tool) => tool.name)).toEqual(["tool1"]);
      expect(await client.listTools("emptyServer")).toEqual([]);
    });

    test("should get client for a specific server", async () => {
      const client = new MultiServerMCPClient({
        "test-server": {
          mode: "legacy",
          transport: "stdio" as const,
          command: "python",
          args: ["./script.py"],
        },
      });

      await client.initializeConnections();

      const serverClient = await client.getClient("test-server");
      expect(serverClient).toBeDefined();

      // Non-existent server should return undefined
      const nonExistentClient = await client.getClient("non-existent");
      expect(nonExistentClient).toBeUndefined();
    });
  });

  describe("Cleanup Handling", () => {
    test("should close all connections properly", async () => {
      const client = new MultiServerMCPClient({
        "stdio-server": {
          mode: "legacy",
          transport: "stdio" as const,
          command: "python",
          args: ["./script1.py"],
        },
        "sse-server": {
          mode: "legacy",
          transport: "sse" as const,
          url: "http://localhost:8000/sse",
        },
      });

      await client.initializeConnections();
      await client.close();

      // ConnectionManager now closes the MCP clients, which close transports internally
      expect(Client.prototype.close).toHaveBeenCalledTimes(2);
    });

    test("should handle errors during cleanup gracefully", async () => {
      // Mock client.close to throw error for the only stdio client
      (Client.prototype.close as Mock).mockImplementationOnce(() =>
        Promise.reject(new Error("Close failed"))
      );

      const client = new MultiServerMCPClient({
        "test-server": {
          mode: "legacy",
          transport: "stdio" as const,
          command: "python",
          args: ["./script.py"],
        },
      });

      await client.initializeConnections();

      // Should reject due to one close failing
      await expect(client.close()).rejects.toThrow(
        /Failed to close MCP connections/
      );

      // Should have attempted to close the client
      expect(Client.prototype.close).toHaveBeenCalled();
    });

    test("should clean up all resources even if some fail", async () => {
      // First client.close fails, second succeeds
      (Client.prototype.close as Mock)
        .mockImplementationOnce(() => Promise.reject(new Error("Close failed")))
        .mockImplementationOnce(() => Promise.resolve());

      const client = new MultiServerMCPClient({
        "stdio-server": {
          mode: "legacy",
          transport: "stdio" as const,
          command: "python",
          args: ["./script1.py"],
        },
        "sse-server": {
          mode: "legacy",
          transport: "sse" as const,
          url: "http://localhost:8000/sse",
        },
      });

      await client.initializeConnections();
      await expect(client.close()).rejects.toThrow(
        /Failed to close MCP connections/
      );

      // Both client.close methods should have been called
      expect(Client.prototype.close).toHaveBeenCalledTimes(2);
    });

    test("should clear internal state after close", async () => {
      const client = new MultiServerMCPClient({
        "test-server": {
          mode: "legacy",
          transport: "stdio" as const,
          command: "python",
          args: ["./script.py"],
        },
      });

      await client.initializeConnections();

      await client.close();

      // Internal state is private now; assert that the SDK client was closed
      expect(Client.prototype.close).toHaveBeenCalledTimes(1);
    });
  });

  describe("Error Cases", () => {
    test("should handle invalid server name when getting client", async () => {
      const client = new MultiServerMCPClient({
        "test-server": {
          mode: "legacy",
          transport: "stdio" as const,
          command: "python",
          args: ["./script.py"],
        },
      });
      const result = await client.getClient("non-existent");
      expect(result).toBeUndefined();
    });

    test("should handle invalid server name when getting tools", async () => {
      const client = new MultiServerMCPClient({
        "test-server": {
          mode: "legacy",
          transport: "stdio" as const,
          command: "python",
          args: ["./script.py"],
        },
      });

      // Get a client for a non-existent server (should be undefined)
      const serverClient = await client.getClient("non-existent");
      expect(serverClient).toBeUndefined();
    });

    test("should throw on transport creation errors", async () => {
      // Force an error when creating transport
      (StdioClientTransport as Mock).mockImplementationOnce(
        function mockStdioTransport() {
          throw new Error("Transport creation failed");
        }
      );

      const client = new MultiServerMCPClient({
        "test-server": {
          mode: "legacy",
          transport: "stdio" as const,
          command: "python",
          args: ["./script.py"],
        },
      });

      await expect(
        async () => await client.initializeConnections()
      ).rejects.toThrow(/Transport creation failed/);

      // Should have attempted to create transport
      expect(StdioClientTransport).toHaveBeenCalled();

      // Should not have created a client
      expect(Client).not.toHaveBeenCalled();
    });

    test("should throw on streamable HTTP transport creation errors", async () => {
      // Force an error when creating transport
      (StreamableHTTPClientTransport as Mock).mockImplementationOnce(
        function mockStreamableHTTPTransport() {
          throw new Error("Streamable HTTP transport creation failed");
        }
      );

      const client = new MultiServerMCPClient({
        "test-server": {
          mode: "legacy",
          transport: "http" as const,
          url: "http://localhost:8000/mcp",
        },
      });

      await expect(
        async () => await client.initializeConnections()
      ).rejects.toThrow(/Streamable HTTP transport creation failed/);

      // Should have attempted to create transport
      expect(StreamableHTTPClientTransport).toHaveBeenCalled();

      // Should not have created a client
      expect(Client).not.toHaveBeenCalled();
    });
  });
});

describe("MCPAdapter configuration boundary", () => {
  test.each([
    () =>
      new MCPAdapter({
        servers: { remote: { url: "https://example.com/mcp" } },
      }),
    () =>
      new MCPAdapter({
        mcpServers: { remote: { url: "https://example.com/mcp" } },
      }),
    () => new MCPAdapter({ remote: { url: "https://example.com/mcp" } }),
  ])(
    "exposes the same canonical snapshot for every input shape",
    (createAdapter) => {
      const adapter = createAdapter();
      expect(adapter.config.servers.remote.mode).toBe("auto");
      expect(adapter.config).not.toHaveProperty("mcpServers");
    }
  );

  test.each([
    { command: "node", args: [], encoding: "utf8" },
    { command: "node", args: [], restart: { maxAttempts: -1 } },
    { command: "node", args: [], restart: { maxAttempts: 0.5 } },
    { command: "node", args: [], restart: { delayMs: -1 } },
    {
      mode: "legacy",
      url: "https://example.com/mcp",
      reconnect: { maxAttempts: -1 },
    },
    {
      mode: "legacy",
      url: "https://example.com/mcp",
      reconnect: { maxAttempts: 0.5 },
    },
    {
      mode: "legacy",
      url: "https://example.com/mcp",
      reconnect: { delayMs: -1 },
    },
  ])(
    "rejects unsupported transport settings before connecting: %j",
    (server) => {
      vi.clearAllMocks();
      expect(() =>
        adapterConfigSchema.parse({ servers: { test: server } })
      ).toThrow(ZodError);
      expect(Client.prototype.connect).not.toHaveBeenCalled();
    }
  );

  test("allows zero retries and zero delay", () => {
    const adapter = new MCPAdapter({
      servers: {
        local: {
          command: "node",
          args: [],
          restart: { maxAttempts: 0, delayMs: 0 },
        },
        remote: {
          mode: "legacy",
          url: "https://example.com/mcp",
          reconnect: { maxAttempts: 0, delayMs: 0 },
        },
      },
    });
    expect(Object.keys(adapter.config.servers)).toEqual(["local", "remote"]);
  });

  test("shares the implementation and normalizes legacy transport names without connecting", () => {
    vi.clearAllMocks();
    expect(MCPAdapter).toBe(MultiServerMCPClient);

    const adapter = new MCPAdapter({
      servers: {
        remote: { mode: "legacy", type: "sse", url: "https://example.com/mcp" },
      },
    });

    expect(adapter.config.servers.remote).toMatchObject({
      mode: "legacy",
      transport: "sse",
    });
    expect(adapter.config.servers.remote).not.toHaveProperty("type");
    expect(Client.prototype.connect).not.toHaveBeenCalled();
  });

  test.each([
    { url: "https://example.com/mcp" },
    { command: "node", args: ["server.js"] },
  ])("accepts a legacy server named servers: %j", (connection) => {
    const adapter = new MultiServerMCPClient({
      servers: connection,
      other: { url: "https://example.com/other" },
    });

    expect(Object.keys(adapter.config.servers)).toEqual(["servers", "other"]);
    expect(adapter.config.servers.servers).toMatchObject(connection);
  });

  test("keeps canonical server names independent of connection field names", () => {
    const adapter = new MCPAdapter({
      servers: {
        url: { url: "https://example.com/mcp" },
        command: { command: "node", args: [] },
        servers: { url: "https://example.com/other" },
      },
    });

    expect(Object.keys(adapter.config.servers)).toEqual([
      "url",
      "command",
      "servers",
    ]);
  });

  test("accepts undefined output destinations at global and server scope", () => {
    const adapter = new MCPAdapter({
      servers: {
        remote: {
          url: "https://example.com/mcp",
          outputHandling: { image: undefined },
        },
      },
      outputHandling: { text: undefined, audio: "artifact" },
    });

    expect(adapter.config.outputHandling).toEqual({
      text: undefined,
      audio: "artifact",
    });
    expect(adapter.config.servers.remote.outputHandling).toEqual({
      image: undefined,
    });
  });

  test("rejects mixed configuration spellings and conflicting transport choices", () => {
    // @ts-expect-error Conflicting configuration keys must also fail at runtime.
    expect(() => new MCPAdapter({ servers: {}, mcpServers: {} })).toThrow(
      /not both/
    );
    expect(
      () =>
        new MCPAdapter({
          servers: {
            // @ts-expect-error Conflicting transport aliases are invalid input.
            remote: {
              mode: "legacy",
              transport: "http",
              type: "sse",
              url: "https://example.com/mcp",
            },
          },
        })
    ).toThrow(/conflicts with transport/);
  });

  test("rejects a connection that mixes a command and URL before dropping unknown keys", () => {
    const ambiguous = {
      servers: {
        remote: { command: "node", args: [], url: "https://example.com/mcp" },
      },
    };

    // @ts-expect-error A command and URL cannot belong to the same connection.
    expect(() => new MCPAdapter(ambiguous)).toThrow(/command or an HTTP URL/);
  });

  test("retains callback identity and isolates mutable configuration snapshots", () => {
    const onMessage = vi.fn();
    const beforeToolCall = vi.fn();

    const adapter = new MCPAdapter({
      servers: {
        local: {
          onMessage,
          command: "node",
          args: ["server.js"],
          env: { MODE: "test" },
          restart: { enabled: false },
        },
        remote: {
          mode: "legacy",
          url: "https://example.com/mcp",
          headers: { "X-Test": "original" },
          reconnect: { enabled: false },
        },
      },
      outputHandling: { text: "content" },
      beforeToolCall,
    });

    const snapshot = adapter.config;
    expect(snapshot.servers.local.onMessage).toBe(onMessage);
    expect(snapshot.beforeToolCall).toBe(beforeToolCall);
    const local = snapshot.servers.local;

    if (local.transport !== "stdio") throw new Error("Expected stdio config");
    local.args.push("changed");
    local.env!.MODE = "changed";
    local.restart!.enabled = true;
    const remote = snapshot.servers.remote;

    if (remote.transport !== "http") throw new Error("Expected HTTP config");
    remote.headers!["X-Test"] = "changed";
    remote.reconnect!.enabled = true;
    expect(adapter.config.servers.local).toMatchObject({
      args: ["server.js"],
      env: { MODE: "test" },
      restart: { enabled: false },
    });
    expect(adapter.config.servers.remote).toMatchObject({
      headers: { "X-Test": "original" },
      reconnect: { enabled: false },
    });
  });

  test("rejects invalid callbacks and unknown output destinations with Zod4", () => {
    expect(
      () =>
        new MCPAdapter(
          JSON.parse(
            '{"servers":{"remote":{"url":"https://example.com/mcp"}},"beforeToolCall":"invalid"}'
          )
        )
    ).toThrow(ZodError);
    expect(
      () =>
        new MCPAdapter(
          JSON.parse(
            '{"servers":{"remote":{"url":"https://example.com/mcp"}},"outputHandling":{"typo":"content"}}'
          )
        )
    ).toThrow(ZodError);
  });
});

describe("protocol-specific server configuration", () => {
  test("defaults each connection to auto without changing compatibility aliases", () => {
    for (const config of [
      { servers: { remote: { url: "https://example.com/mcp" } } },
      { mcpServers: { remote: { url: "https://example.com/mcp" } } },
      { remote: { url: "https://example.com/mcp" } },
    ]) {
      expect(adapterConfigSchema.parse(config).servers.remote.mode).toBe(
        "auto"
      );
    }
  });

  test("keeps callbacks on their owning server and preserves their identity", () => {
    const onMessage = vi.fn();
    const onInitialized = vi.fn();

    const client = new MCPAdapter({
      servers: {
        modern: { url: "https://example.com/mcp", onMessage },
        legacy: {
          mode: "legacy",
          url: "https://example.com/old",
          onInitialized,
        },
      },
    });

    expect(client.config.servers.modern.onMessage).toBe(onMessage);
    expect(client.config.servers.legacy.onMessage).toBeUndefined();
    expect(client.config.servers.legacy.onInitialized).toBe(onInitialized);
  });

  test.each([
    { automaticSSEFallback: true },
    { onInitialized: () => undefined },
    { onRootsListChanged: () => undefined },
    { unexpectedOption: true },
  ])(
    "rejects invalid modern fields in all constructor shapes: %j",
    (invalid) => {
      const remote = { url: "https://example.com/mcp", ...invalid };

      for (const config of [
        { servers: { remote } },
        { mcpServers: { remote } },
        { remote },
      ]) {
        expect(() => adapterConfigSchema.parse(config)).toThrow(ZodError);
      }
    }
  );

  test("rejects top-level protocol callbacks instead of silently dropping them", () => {
    const config = {
      servers: { remote: { url: "https://example.com/mcp" } },
      onMessage: () => undefined,
    };

    // @ts-expect-error Protocol callbacks belong to a server, even on predeclared configs.
    expect(() => new MCPAdapter(config)).toThrow(/onMessage/);
  });

  test("rejects interrupt elicitation on SSE instead of ignoring it", () => {
    expect(
      () =>
        new MCPAdapter({
          servers: {
            // @ts-expect-error SSE negotiates legacy, which cannot answer in band.
            remote: {
              transport: "sse",
              url: "https://example.com/sse",
              elicitation: true,
            },
          },
        })
    ).toThrow(/elicitation requires modern MCP, which SSE never speaks/);
  });

  test("rejects a per-request log level on SSE instead of ignoring it", () => {
    expect(
      () =>
        new MCPAdapter({
          servers: {
            // @ts-expect-error SSE negotiates legacy, which has no per-request level.
            remote: {
              transport: "sse",
              url: "https://example.com/sse",
              logLevel: "info",
            },
          },
        })
    ).toThrow(/logLevel requires modern MCP, which SSE never speaks/);
  });

  test("rejects explicit modern SSE at the configuration boundary", () => {
    expect(
      () =>
        new MCPAdapter({
          servers: {
            // @ts-expect-error SSE requires explicit legacy mode.
            remote: {
              mode: "modern",
              transport: "sse",
              url: "https://example.com/sse",
            },
          },
        })
    ).toThrow(ZodError);
  });
});
