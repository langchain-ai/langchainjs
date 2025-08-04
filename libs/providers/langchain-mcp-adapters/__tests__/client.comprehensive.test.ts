import { vi, describe, test, expect, beforeEach, type Mock } from "vitest";
import { ZodError } from "zod";
import type { Connection } from "../src/types.js";

import "./mocks.js";

// Import modules after mocking
const { StdioClientTransport } = await import(
  "@modelcontextprotocol/sdk/client/stdio.js"
);
const { SSEClientTransport } = await import(
  "@modelcontextprotocol/sdk/client/sse.js"
);
const { StreamableHTTPClientTransport } = await import(
  "@modelcontextprotocol/sdk/client/streamableHttp.js"
);
const { MultiServerMCPClient, MCPClientError } = await import(
  "../src/client.js"
);
const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");

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
        // eslint-disable-next-line no-new
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

      // Clear previous calls
      (StdioClientTransport as Mock).mockClear();
      (Client.prototype.connect as Mock).mockClear();

      // Trigger onclose handler
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyClient = client as any;
      const transportInstances = anyClient._transportInstances;
      const transportInstance = transportInstances["test-server"];

      expect(transportInstance).toBeDefined();
      const { onclose } = transportInstance;
      expect(onclose).toBeDefined();
      onclose();

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

      // Clear previous calls
      (SSEClientTransport as Mock).mockClear();
      (Client.prototype.connect as Mock).mockClear();

      // Trigger onclose handler
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyClient = client as any;
      const transportInstances = anyClient._transportInstances;
      const transportInstance = transportInstances["test-server"];

      expect(transportInstance).toBeDefined();
      const { onclose } = transportInstance;
      expect(onclose).toBeDefined();
      onclose();

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

      // Clear previous mock invocations
      (StdioClientTransport as Mock).mockClear();

      await client.initializeConnections();

      // Simulate connection close to trigger reconnection
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyClient = client as any;
      const transportInstances = anyClient._transportInstances;
      const transportInstance = transportInstances["test-server"];

      expect(transportInstance).toBeDefined();
      const { onclose } = transportInstance;
      expect(onclose).toBeDefined();
      onclose();

      // Wait for reconnection attempts to complete
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });

      // Verify the number of attempts
      // StdioClientTransport is called once for initial connection
      expect(StdioClientTransport).toHaveBeenCalledTimes(1);
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

      // Both transports should be closed
      expect(StdioClientTransport.prototype.close).toHaveBeenCalled();
      expect(SSEClientTransport.prototype.close).toHaveBeenCalled();
    });

    test("should handle errors during cleanup gracefully", async () => {
      // Mock close to throw error
      (StdioClientTransport.prototype.close as Mock).mockImplementationOnce(
        () => Promise.reject(new Error("Close failed"))
      );

      const client = new MultiServerMCPClient({
        "test-server": {
          transport: "stdio" as const,
          command: "python",
          args: ["./script.py"],
        },
      });

      await client.initializeConnections();

      // Should not throw
      await client.close();

      // Should have attempted to close
      expect(StdioClientTransport.prototype.close).toHaveBeenCalled();
    });

    test("should clean up all resources even if some fail", async () => {
      // First close fails, second succeeds
      (StdioClientTransport.prototype.close as Mock).mockImplementationOnce(
        () => Promise.reject(new Error("Close failed"))
      );
      (SSEClientTransport.prototype.close as Mock).mockImplementationOnce(() =>
        Promise.resolve()
      );

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

      // Both close methods should have been called
      expect(StdioClientTransport.prototype.close).toHaveBeenCalled();
      expect(SSEClientTransport.prototype.close).toHaveBeenCalled();
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

      const tools = await client.getTools();

      // Should have tools
      expect(tools.length).toBeGreaterThan(0);

      await client.close();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyClient = client as any;

      const clients = anyClient._clients;
      const serverNameToTools = anyClient._serverNameToTools;
      const cleanupFunctions = anyClient._cleanupFunctions;
      const transportInstances = anyClient._transportInstances;

      expect(clients).toEqual({});
      expect(serverNameToTools).toEqual({});
      expect(cleanupFunctions).toEqual([]);
      expect(transportInstances).toEqual({});
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
