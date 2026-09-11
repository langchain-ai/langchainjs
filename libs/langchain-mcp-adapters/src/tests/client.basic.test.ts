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
import { oAuthClientProviderSchema } from "../types.js";

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
          remote: { transport: "http", url: "https://example.com/mcp" },
        });
        try {
          if (fallsBack) {
            await client.initializeConnections();
            expect(SSEClientTransport).toHaveBeenCalledTimes(1);
          } else {
            await expect(client.initializeConnections()).rejects.toThrow();
            expect(SSEClientTransport).not.toHaveBeenCalled();
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
      expect(() => new MultiServerMCPClient({})).toThrow(MCPClientError);
    });

    test("should process valid stdio connection config", () => {
      new MultiServerMCPClient({
        "test-server": {
          transport: "stdio",
          command: "python",
          args: ["./script.py"],
        },
      });
    });

    test("should process valid SSE connection config", () => {
      new MultiServerMCPClient({
        "test-server": {
          transport: "sse",
          url: "http://localhost:8000/sse",
          headers: { Authorization: "Bearer token" },
        },
      });
    });

    test("should process valid streamable HTTP connection config", () => {
      new MultiServerMCPClient({
        "test-server": {
          transport: "http",
          url: "http://localhost:8000/mcp",
        },
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
          transport: "stdio",
          command: "python",
          args: ["./script.py"],
        },
      });

      await client.initializeConnections();

      expect(Client).toHaveBeenCalledWith({
        name: "@langchain/mcp-adapters",
        version: expect.any(String),
      });

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
  describe("getTools", () => {
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
          transport: "stdio",
          command: "python",
          args: ["./script1.py"],
        },
        server2: {
          transport: "stdio",
          command: "python",
          args: ["./script2.py"],
        },
      });

      const tools = await client.getTools();

      // Expect tools from both servers in a flat array
      expect(tools.length).toBeGreaterThan(0);
    });

    test("should get tools from specific servers", async () => {
      // Mock implementation similar to above
    });

    test("should handle empty tool lists correctly", async () => {
      // Mock implementation similar to above
    });

    describe("should apply tool name prefixes correctly", () => {
      test("when prefixToolNameWithServerName is true", async () => {
        const client = new MultiServerMCPClient({
          mcpServers: {
            "test-server": {
              transport: "stdio",
              command: "python",
              args: ["./script.py"],
            },
          },
          prefixToolNameWithServerName: true,
        });
        const tools = await client.getTools();

        expect(tools.length).toBe(2);
        expect(tools[0].name).toBe("test-server__tool1");
        expect(tools[1].name).toBe("test-server__tool2");
      });
      test("when additionalToolNamePrefix is set", async () => {
        const client = new MultiServerMCPClient({
          mcpServers: {
            "test-server": {
              transport: "stdio",
              command: "python",
              args: ["./script.py"],
            },
          },
          additionalToolNamePrefix: "mcp",
        });
        const tools = await client.getTools();

        expect(tools.length).toBe(2);
        expect(tools[0].name).toBe("mcp__tool1");
        expect(tools[1].name).toBe("mcp__tool2");
      });
      test("with both server name and additional prefix when set", async () => {
        const client = new MultiServerMCPClient({
          mcpServers: {
            "test-server": {
              transport: "stdio",
              command: "python",
              args: ["./script.py"],
            },
          },
          prefixToolNameWithServerName: true,
          additionalToolNamePrefix: "mcp",
        });
        const tools = await client.getTools();

        expect(tools.length).toBe(2);
        expect(tools[0].name).toBe("mcp__test-server__tool1");
        expect(tools[1].name).toBe("mcp__test-server__tool2");
      });
      test("shouldn't apply prefixes by default", async () => {
        const client = new MultiServerMCPClient({
          "test-server": {
            transport: "stdio",
            command: "python",
            args: ["./script.py"],
          },
        });
        const tools = await client.getTools();

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
          transport: "stdio",
          command: "python",
          args: ["./script1.py"],
        },
        server2: {
          transport: "sse",
          url: "http://localhost:8000/sse",
        },
        server3: {
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
          transport: "stdio",
          command: "python",
          args: ["./script.py"],
        },
      });

      await client.initializeConnections();
      await expect(client.close()).rejects.toThrow();

      expect(Client.prototype.close).toHaveBeenCalledOnce();
    });
  });

  // Streamable HTTP specific tests
  describe("streamable HTTP transport", () => {
    test("should throw when streamable HTTP config is missing required fields", () => {
      expect(() => {
        new MultiServerMCPClient({
          // @ts-expect-error missing url field
          "test-server": {
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
            transport: "http",
            url: "invalid-url", // Invalid URL format
          },
        });
      }).toThrow(ZodError);
    });

    test("should handle mixed transport types including streamable HTTP", async () => {
      const client = new MultiServerMCPClient({
        "stdio-server": {
          transport: "stdio",
          command: "python",
          args: ["./script.py"],
        },
        "sse-server": {
          transport: "sse",
          url: "http://localhost:8000/sse",
        },
        "streamable-server": {
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
      const tools = await client.getTools();
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
          transport: "http",
          url: "http://localhost:8000/mcp",
        },
      });

      await client.initializeConnections();
      await expect(client.close()).rejects.toThrow();

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
            transport: "http",
            url: "http://localhost:8123/mcp",
          },
          "working-server": {
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
            transport: "http",
            url: "http://localhost:8000/mcp",
          },
          "server-2": {
            transport: "http",
            url: "http://localhost:8001/mcp",
          },
        },
        onConnectionError: "ignore",
      });

      // Should not throw, even though all servers fail
      const tools = await client.getTools();
      expect(tools).toEqual([]);

      // Both servers should be inaccessible
      const client1 = await client.getClient("server-1");
      const client2 = await client.getClient("server-2");
      expect(client1).toBeUndefined();
      expect(client2).toBeUndefined();
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
            transport: "http",
            url: "http://localhost:8000/mcp",
          },
          "working-server": {
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
            transport: "http",
            url: "http://localhost:8000/mcp",
          },
          "working-server": {
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
            transport: "http",
            url: "http://localhost:8000/mcp",
          },
          "working-server": {
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
});

describe("MCPAdapter configuration boundary", () => {
  test("shares the implementation and normalizes legacy transport names without connecting", () => {
    vi.clearAllMocks();
    expect(MCPAdapter).toBe(MultiServerMCPClient);
    const adapter = new MCPAdapter({
      servers: { remote: { type: "sse", url: "https://example.com/mcp" } },
    });
    expect(adapter.config.mcpServers.remote).toMatchObject({
      transport: "sse",
    });
    expect(adapter.config.mcpServers.remote).not.toHaveProperty("type");
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
    expect(Object.keys(adapter.config.mcpServers)).toEqual([
      "servers",
      "other",
    ]);
    expect(adapter.config.mcpServers.servers).toMatchObject(connection);
  });

  test("keeps canonical server names independent of connection field names", () => {
    const adapter = new MCPAdapter({
      servers: {
        url: { url: "https://example.com/mcp" },
        command: { command: "node", args: [] },
        servers: { url: "https://example.com/other" },
      },
    });
    expect(Object.keys(adapter.config.mcpServers)).toEqual([
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
    expect(adapter.config.mcpServers.remote.outputHandling).toEqual({
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
          command: "node",
          args: ["server.js"],
          env: { MODE: "test" },
          restart: { enabled: false },
        },
        remote: {
          url: "https://example.com/mcp",
          headers: { "X-Test": "original" },
          reconnect: { enabled: false },
        },
      },
      outputHandling: { text: "content" },
      onMessage,
      beforeToolCall,
    });
    const snapshot = adapter.config;
    expect(snapshot.onMessage).toBe(onMessage);
    expect(snapshot.beforeToolCall).toBe(beforeToolCall);
    const local = snapshot.mcpServers.local;
    if (local.transport !== "stdio") throw new Error("Expected stdio config");
    local.args.push("changed");
    local.env!.MODE = "changed";
    local.restart!.enabled = true;
    const remote = snapshot.mcpServers.remote;
    if (remote.transport !== "http") throw new Error("Expected HTTP config");
    remote.headers!["X-Test"] = "changed";
    remote.reconnect!.enabled = true;
    expect(adapter.config.mcpServers.local).toMatchObject({
      args: ["server.js"],
      env: { MODE: "test" },
      restart: { enabled: false },
    });
    expect(adapter.config.mcpServers.remote).toMatchObject({
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
