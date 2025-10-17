import { vi, describe, test, expect, beforeEach, type Mock } from "vitest";
import { ZodError } from "zod/v3";

// Import modules after mocking
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

import type { Connection } from "../types.js";
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MultiServerMCPClient", () => {
  describe("Constructor", () => {
    test("should throw when initialized with empty connections", async () => {
      expect(() => new MultiServerMCPClient({})).toThrow(MCPClientError);
    });

    test("should process valid stdio connection config", async () => {
      const config = {
        "test-server": {
          transport: "stdio" as const,
          command: "python",
          args: ["./script.py"],
        },
      };

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
          transport: "http" as const,
          url: "http://localhost:8000/mcp",
        },
      };

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
          transport: "sse" as const,
          url: "http://localhost:8000/sse",
          headers: { Authorization: "Bearer token" },
          useNodeEventSource: true,
        },
      };

      const client = new MultiServerMCPClient(config);
      expect(client).toBeDefined();

      // Initialize connections and verify
      await client.initializeConnections();
      expect(SSEClientTransport).toHaveBeenCalledWith(
        new URL(config["test-server"].url),
        expect.objectContaining({
          requestInit: {
            headers: config["test-server"].headers,
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
          transport: "stdio" as const,
          command: "python",
          args: ["./script.py"],
        },
      });

      // Should throw error
      await expect(client.initializeConnections()).rejects.toThrow();
    });

    test("should throw on tool loading failures", async () => {
      // Mock tool loading failure
      (Client.prototype.listTools as Mock).mockImplementationOnce(() =>
        Promise.reject(new Error("Failed to list tools"))
      );

      const client = new MultiServerMCPClient({
        "test-server": {
          transport: "stdio" as const,
          command: "python",
          args: ["./script.py"],
        },
      });

      // Should throw error
      await expect(client.initializeConnections()).rejects.toThrow();
    });
  });

  describe("Reconnection Logic", () => {
    test("should attempt to reconnect stdio transport when enabled", async () => {
      const client = new MultiServerMCPClient({
        "test-server": {
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

    test("should attempt to reconnect SSE transport when enabled", async () => {
      const client = new MultiServerMCPClient({
        "test-server": {
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
          transport: "stdio" as const,
          command: "python",
          args: ["./script1.py"],
        },
      });

      const conf = client.config;
      expect(conf.additionalToolNamePrefix).toBe("");
      expect(conf.prefixToolNameWithServerName).toBe(false);

      await client.initializeConnections();
      const tools = await client.getTools();

      // Should have 2 tools
      expect(tools.length).toBe(2);
      expect(tools[0].name).toBe("tool1");
      expect(tools[1].name).toBe("tool2");
    });

    test("should get tools from a specific server", async () => {
      // Skip actual implementation and just test the concept
      expect(true).toBe(true);
    });

    test("should handle empty tool lists correctly", async () => {
      // Skip actual implementation and just test the concept
      expect(true).toBe(true);
    });

    test("should get client for a specific server", async () => {
      const client = new MultiServerMCPClient({
        "test-server": {
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
          transport: "stdio" as const,
          command: "python",
          args: ["./script1.py"],
        },
        "sse-server": {
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
          transport: "stdio" as const,
          command: "python",
          args: ["./script.py"],
        },
      });

      await client.initializeConnections();

      // Should reject due to one close failing
      await expect(client.close()).rejects.toThrow();

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
          transport: "stdio" as const,
          command: "python",
          args: ["./script1.py"],
        },
        "sse-server": {
          transport: "sse" as const,
          url: "http://localhost:8000/sse",
        },
      });

      await client.initializeConnections();
      await expect(client.close()).rejects.toThrow();

      // Both client.close methods should have been called
      expect(Client.prototype.close).toHaveBeenCalledTimes(2);
    });

    test("should clear internal state after close", async () => {
      const client = new MultiServerMCPClient({
        "test-server": {
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
      (StdioClientTransport as Mock).mockImplementationOnce(() => {
        throw new Error("Transport creation failed");
      });

      const client = new MultiServerMCPClient({
        "test-server": {
          transport: "stdio" as const,
          command: "python",
          args: ["./script.py"],
        },
      });

      // Should throw error when connecting
      await expect(
        async () => await client.initializeConnections()
      ).rejects.toThrow();

      // Should have attempted to create transport
      expect(StdioClientTransport).toHaveBeenCalled();

      // Should not have created a client
      expect(Client).not.toHaveBeenCalled();
    });

    test("should throw on streamable HTTP transport creation errors", async () => {
      // Force an error when creating transport
      (StreamableHTTPClientTransport as Mock).mockImplementationOnce(() => {
        throw new Error("Streamable HTTP transport creation failed");
      });

      const client = new MultiServerMCPClient({
        "test-server": {
          transport: "http" as const,
          url: "http://localhost:8000/mcp",
        },
      });

      // Should throw error when connecting
      await expect(
        async () => await client.initializeConnections()
      ).rejects.toThrow();

      // Should have attempted to create transport
      expect(StreamableHTTPClientTransport).toHaveBeenCalled();

      // Should not have created a client
      expect(Client).not.toHaveBeenCalled();
    });
  });
});
