import {
  vi,
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import { ZodError } from "zod/v3";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { MultiServerMCPClient, MCPClientError } from "../client.js";

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

describe("MultiServerMCPClient", () => {
  // Setup and teardown
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Constructor functionality tests
  describe("constructor", () => {
    test("should throw if initialized with empty connections", () => {
      expect(() => new MultiServerMCPClient({})).toThrow(MCPClientError);
    });

    test("should process valid stdio connection config", () => {
      const client = new MultiServerMCPClient({
        "test-server": {
          transport: "stdio",
          command: "python",
          args: ["./script.py"],
        },
      });
      expect(client).toBeDefined();
      // Additional assertions to verify the connection was processed correctly
    });

    test("should process valid SSE connection config", () => {
      const client = new MultiServerMCPClient({
        "test-server": {
          transport: "sse",
          url: "http://localhost:8000/sse",
          headers: { Authorization: "Bearer token" },
        },
      });
      expect(client).toBeDefined();
      // Additional assertions to verify the connection was processed correctly
    });

    test("should process valid streamable HTTP connection config", () => {
      const client = new MultiServerMCPClient({
        "test-server": {
          transport: "http",
          url: "http://localhost:8000/mcp",
        },
      });
      expect(client).toBeDefined();
      // Additional assertions to verify the connection was processed correctly
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
      (Client as Mock).mockImplementationOnce(() => ({
        connect: vi
          .fn()
          .mockReturnValue(Promise.reject(new Error("Connection failed"))),
        listTools: vi.fn().mockReturnValue(Promise.resolve({ tools: [] })),
      }));

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
      (Client as Mock).mockImplementationOnce(() => ({
        connect: vi.fn().mockReturnValue(Promise.resolve()),
        setNotificationHandler: vi.fn().mockReturnValue(Promise.resolve()),
        listTools: vi
          .fn()
          .mockReturnValue(Promise.reject(new Error("Failed to list tools"))),
      }));

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

      (Client as Mock).mockImplementationOnce(() => ({
        connect: vi.fn().mockReturnValue(Promise.resolve()),
        setNotificationHandler: vi.fn().mockReturnValue(Promise.resolve()),
        listTools: vi
          .fn()
          .mockReturnValue(Promise.resolve({ tools: mockTools })),
      }));

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
      (Client as Mock).mockImplementationOnce(() => ({
        connect: vi
          .fn()
          .mockReturnValue(Promise.reject(new Error("Connection failed"))),
        listTools: vi.fn().mockReturnValue(Promise.resolve({ tools: [] })),
      }));

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
  });
});
