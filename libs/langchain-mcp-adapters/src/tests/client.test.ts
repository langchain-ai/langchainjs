import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Server } from "node:http";
import { join } from "node:path";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type { OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import type { ContentBlock } from "@langchain/core/messages";
import type { ToolCall } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";

import { createDummyHttpServer } from "./fixtures/dummy-http-server.js";
import { MultiServerMCPClient } from "../client.js";
import { type ClientConfig } from "../types.js";

// Manages dummy MCP servers for testing
class TestMCPServers {
  private _httpServers: Server[] = [];

  createStdioServer(name: string): { command: string; args: string[] } {
    // Use the fixture file instead of inline server code
    const fixturePath = join(__dirname, "fixtures", "dummy-stdio-server.ts");

    return {
      command: "node",
      args: ["--loader", "tsx", "--no-warnings", fixturePath, name],
    };
  }

  async createHTTPServer(
    name: string,
    options: {
      testHeaders?: boolean;
      requireAuth?: boolean;
      supportSSEFallback?: boolean;
      disableStreamableHttp?: boolean;
    } = {}
  ): Promise<{ baseUrl: string }> {
    return new Promise((resolve, reject) => {
      const app = createDummyHttpServer(name, options);
      const httpServer = app.listen(0, "127.0.0.1", (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          this._httpServers.push(httpServer);
          const { port } = httpServer.address() as { port: number };
          resolve({
            baseUrl: `http://127.0.0.1:${port}`,
          });
        }
      });
    });
  }

  async cleanup(): Promise<void> {
    // Close HTTP servers
    await Promise.all(
      this._httpServers.map(
        (server) =>
          new Promise<void>((resolve) => {
            server.close(() => resolve());
          })
      )
    );
    this._httpServers = [];
  }
}

describe("MultiServerMCPClient Integration Tests", () => {
  let testServers: TestMCPServers;

  beforeEach(() => {
    testServers = new TestMCPServers();
  });

  afterEach(async () => {
    await testServers.cleanup();
  });

  describe("Stdio Transport", () => {
    it.skip("should connect to and communicate with a stdio MCP server", async () => {
      const { command, args } = testServers.createStdioServer("stdio-test");

      const client = new MultiServerMCPClient({
        "stdio-server": {
          command,
          args,
          env: { TEST_VAR: "test-value" },
        },
      });

      try {
        const tools = await client.getTools();
        expect(tools.length).toBeGreaterThan(0);

        const testTool = tools.find((t) => t.name.includes("test_tool"));
        expect(testTool).toBeDefined();

        const result = await testTool!.invoke({ input: "test input" });
        expect(result).toContain("test input");
        expect(result).toContain("stdio-test");

        const envTool = tools.find((t) => t.name.includes("check_env"));
        expect(envTool).toBeDefined();

        const envResult = await envTool!.invoke({ varName: "TEST_VAR" });
        expect(envResult).toBe("test-value");
      } finally {
        await client.close();
      }
    });

    it.skip("should handle stdio server restart configuration", async () => {
      const { command, args } = testServers.createStdioServer("stdio-restart");

      const client = new MultiServerMCPClient({
        "stdio-server": {
          command,
          args,
          restart: {
            enabled: true,
            maxAttempts: 2,
            delayMs: 100,
          },
        },
      });

      try {
        const tools = await client.getTools();
        expect(tools.length).toBeGreaterThan(0);
      } finally {
        await client.close();
      }
    });
  });

  describe("HTTP Transport", () => {
    it("should connect to and communicate with an HTTP MCP server", async () => {
      const { baseUrl } = await testServers.createHTTPServer("http-test");

      const client = new MultiServerMCPClient({
        "http-server": {
          url: `${baseUrl}/mcp`,
        },
      });

      try {
        const tools = await client.getTools();
        expect(tools.length).toBeGreaterThan(0);

        const testTool = tools.find((t) => t.name.includes("test_tool"));
        expect(testTool).toBeDefined();

        const result = await testTool!.invoke({ input: "http test" });
        expect(result).toContain("http test");
        expect(result).toContain("http-test");
      } finally {
        await client.close();
      }
    });

    it("should handle authentication headers", async () => {
      const { baseUrl } = await testServers.createHTTPServer("http-auth", {
        requireAuth: true,
      });

      const client = new MultiServerMCPClient({
        "http-server": {
          url: `${baseUrl}/mcp`,
          headers: {
            Authorization: "Bearer test-token",
          },
        },
      });

      try {
        const tools = await client.getTools();
        expect(tools.length).toBeGreaterThan(0);
      } finally {
        await client.close();
      }
    });

    it("should fail gracefully with invalid authentication", async () => {
      const { baseUrl } = await testServers.createHTTPServer("http-auth-fail", {
        requireAuth: true,
      });

      const client = new MultiServerMCPClient({
        "http-server": {
          url: `${baseUrl}/mcp`,
          headers: {
            Authorization: "Bearer invalid-token",
          },
        },
      });

      try {
        try {
          await client.getTools();
          expect.fail("Expected authentication error but got success");
        } catch (error) {
          expect(error).toEqual(
            expect.objectContaining({
              name: "MCPClientError",
              message: expect.stringMatching(
                /Authentication failed.*HTTP.*server.*http-server/i
              ),
            })
          );
        }
      } finally {
        await client.close();
      }
    });

    it("should set authorization headers for streamableHttp transport - success case", async () => {
      const { baseUrl } = await testServers.createHTTPServer(
        "streamable-auth-success",
        {
          requireAuth: true,
          testHeaders: true, // Enable header inspection
        }
      );

      const client = new MultiServerMCPClient({
        "streamable-server": {
          url: `${baseUrl}/mcp`,
          headers: {
            Authorization: "Bearer test-token",
            "X-API-Key": "my-api-key",
          },
        },
      });

      try {
        const tools = await client.getTools();
        expect(tools.length).toBeGreaterThan(0);

        const testTool = tools.find((t) => t.name.includes("test_tool"));
        expect(testTool).toBeDefined();

        const result = await testTool!.invoke({
          input: "streamable auth test",
        });
        expect(result).toContain("streamable auth test");
        expect(result).toContain("streamable-auth-success");

        // Actually test that X-API-Key was received
        const headerTool = tools.find((t) => t.name.includes("check_headers"));
        const headerResult = await headerTool!.invoke({
          headerName: "X-API-Key",
        });
        expect(headerResult).toBe("my-api-key");
      } finally {
        await client.close();
      }
    });

    it("should set authorization headers for streamableHttp transport - failure case", async () => {
      const { baseUrl } = await testServers.createHTTPServer(
        "streamable-auth-fail",
        {
          requireAuth: true,
        }
      );

      const client = new MultiServerMCPClient({
        "streamable-server": {
          url: `${baseUrl}/mcp`,
          headers: {
            Authorization: "Bearer wrong-token",
          },
        },
      });

      try {
        await expect(client.getTools()).rejects.toThrow(
          expect.objectContaining({
            name: "MCPClientError",
            message: expect.stringMatching(
              /Authentication failed.*HTTP.*server.*streamable-server/i
            ),
          })
        );
      } finally {
        await client.close();
      }
    });

    it("should automatically fallback to SSE when streamable HTTP fails", async () => {
      const { baseUrl } = await testServers.createHTTPServer(
        "http-sse-fallback",
        {
          disableStreamableHttp: true,
          supportSSEFallback: true,
        }
      );

      // Configure client to connect to a non-existent streamable HTTP endpoint
      // but with SSE fallback available
      const client = new MultiServerMCPClient({
        "http-server": {
          url: `${baseUrl}/mcp`,
        },
      });

      try {
        // This should fail on streamable HTTP and fallback to SSE
        const tools = await client.getTools();
        expect(tools.length).toBeGreaterThan(0);
      } finally {
        await client.close();
      }
    });
  });

  describe("SSE Transport", () => {
    it("should connect to SSE MCP server when explicitly configured", async () => {
      const { baseUrl } = await testServers.createHTTPServer("sse-explicit", {
        supportSSEFallback: true,
      });

      const client = new MultiServerMCPClient({
        "sse-server": {
          transport: "sse",
          url: `${baseUrl}/sse`,
        },
      });

      try {
        const tools = await client.getTools();
        expect(tools.length).toBeGreaterThan(0);

        const testTool = tools.find((t) => t.name.includes("test_tool"));
        expect(testTool).toBeDefined();

        const result = await testTool!.invoke({ input: "sse test" });
        expect(result).toContain("sse test");
      } finally {
        await client.close();
      }
    });

    it("should set authorization headers for SSE transport - success case", async () => {
      const { baseUrl } = await testServers.createHTTPServer(
        "sse-auth-success",
        {
          requireAuth: true,
          testHeaders: true,
          supportSSEFallback: true,
        }
      );

      const client = new MultiServerMCPClient({
        "sse-server": {
          transport: "sse",
          url: `${baseUrl}/sse`,
          headers: {
            Authorization: "Bearer test-token",
            "X-Custom-Header": "sse-value",
          },
        },
      });

      try {
        const tools = await client.getTools();
        expect(tools.length).toBeGreaterThan(0);

        const headerTool = tools.find((t) => t.name.includes("check_headers"));
        const headerResult = await headerTool!.invoke({
          headerName: "X-Custom-Header",
        });
        expect(headerResult).toBe("sse-value");

        const testTool = tools.find((t) => t.name.includes("test_tool"));
        expect(testTool).toBeDefined();

        const result = await testTool!.invoke({ input: "sse auth test" });
        expect(result).toContain("sse auth test");
        expect(result).toContain("sse-auth-success");
      } finally {
        await client.close();
      }
    });

    it("should set authorization headers for SSE transport - failure case", async () => {
      const { baseUrl } = await testServers.createHTTPServer("sse-auth-fail", {
        requireAuth: true,
        supportSSEFallback: true,
      });

      const client = new MultiServerMCPClient({
        "sse-server": {
          transport: "sse",
          url: `${baseUrl}/sse`,
          headers: {
            Authorization: "Bearer invalid-token",
          },
        },
      });

      try {
        await expect(client.getTools()).rejects.toThrow(
          expect.objectContaining({
            name: "MCPClientError",
            message: expect.stringMatching(
              /Authentication failed.*SSE.*server.*sse-server/i
            ),
          })
        );
      } finally {
        await client.close();
      }
    });

    it("should handle SSE transport without authorization when not required", async () => {
      const { baseUrl } = await testServers.createHTTPServer("sse-no-auth", {
        supportSSEFallback: true,
      });

      const client = new MultiServerMCPClient({
        "sse-server": {
          transport: "sse",
          url: `${baseUrl}/sse`,
          // No headers provided - should still work
        },
      });

      try {
        const tools = await client.getTools();
        expect(tools.length).toBeGreaterThan(0);

        const testTool = tools.find((t) => t.name.includes("test_tool"));
        expect(testTool).toBeDefined();

        const result = await testTool!.invoke({ input: "sse no auth test" });
        expect(result).toContain("sse no auth test");
        expect(result).toContain("sse-no-auth");
      } finally {
        await client.close();
      }
    });
  });

  describe("Multiple Servers", () => {
    it.skip("should connect to multiple servers of different transport types", async () => {
      const { command, args } = testServers.createStdioServer("multi-stdio");
      const { baseUrl: streamableHttpBaseUrl } =
        await testServers.createHTTPServer("multi-http");
      const { baseUrl: sseBaseUrl } = await testServers.createHTTPServer(
        "multi-sse",
        {
          supportSSEFallback: true,
        }
      );

      const client = new MultiServerMCPClient({
        mcpServers: {
          "stdio-server": {
            command,
            args,
          },
          "http-server": {
            url: `${streamableHttpBaseUrl}/mcp`,
          },
          "sse-server": {
            url: `${sseBaseUrl}/sse`,
            transport: "sse",
          },
        },
        prefixToolNameWithServerName: true,
      });

      try {
        const tools = await client.getTools();
        // Check tools from each server
        const stdioTools = tools.filter((t) => t.name.includes("stdio-server"));
        const httpTools = tools.filter((t) => t.name.includes("http-server"));
        const sseTools = tools.filter((t) => t.name.includes("sse-server"));

        expect(stdioTools.length).toBe(2);
        expect(httpTools.length).toBe(5);
        expect(sseTools.length).toBe(5);

        expect(tools.length).toBe(12);

        // Test tool from each server
        const stdioTestTool = tools.find(
          (t) => t.name.includes("stdio-server") && t.name.includes("test_tool")
        );
        const result = await stdioTestTool!.invoke({
          input: "multi-server test",
        });
        expect(result).toContain("multi-stdio");
      } finally {
        await client.close();
      }
    });

    it.skip("should filter tools by server name", async () => {
      const { command, args } = testServers.createStdioServer("filter-stdio");
      const { baseUrl: streamableHttpBaseUrl } =
        await testServers.createHTTPServer("filter-http");

      const client = new MultiServerMCPClient({
        mcpServers: {
          "stdio-server": {
            command,
            args,
          },
          "http-server": {
            url: `${streamableHttpBaseUrl}/mcp`,
          },
        },
        prefixToolNameWithServerName: true,
      });

      try {
        const allTools = await client.getTools();
        const stdioTools = await client.getTools("stdio-server");
        const httpTools = await client.getTools("http-server");

        expect(allTools.length).toBe(stdioTools.length + httpTools.length);
        expect(stdioTools.every((t) => t.name.includes("stdio-server"))).toBe(
          true
        );
        expect(httpTools.every((t) => t.name.includes("http-server"))).toBe(
          true
        );
      } finally {
        await client.close();
      }
    });

    it("should provide access to individual server clients", async () => {
      const { baseUrl } = await testServers.createHTTPServer("client-access");

      const client = new MultiServerMCPClient({
        "test-server": {
          url: `${baseUrl}/mcp`,
        },
      });

      try {
        await client.initializeConnections();
        const serverClient = await client.getClient("test-server");
        expect(serverClient).toBeDefined();

        const nonExistentClient = await client.getClient("nonexistent");
        expect(nonExistentClient).toBeUndefined();
      } finally {
        await client.close();
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle connection failures gracefully", async () => {
      const client = new MultiServerMCPClient({
        "failing-server": {
          url: "http://totally-not-a-server.fakeurl.example.com:9999/mcp", // Non-existent server
        },
      });

      try {
        await expect(client.getTools()).rejects.toThrow(
          expect.objectContaining({
            name: "MCPClientError",
            message: expect.stringMatching(
              /Failed to connect to.*server.*failing-server/i
            ),
          })
        );
      } finally {
        await client.close();
      }
    });

    it("should handle invalid stdio command", async () => {
      const client = new MultiServerMCPClient({
        "failing-stdio": {
          command: "nonexistent-command",
          args: [],
        },
      });

      try {
        await expect(client.getTools()).rejects.toThrow(
          expect.objectContaining({
            name: "MCPClientError",
            message: expect.stringMatching(
              /Failed to connect to stdio server.*failing-stdio/i
            ),
          })
        );
      } finally {
        await client.close();
      }
    });
  });

  describe("Configuration", () => {
    it("should respect tool name prefixing configuration", async () => {
      const { baseUrl } = await testServers.createHTTPServer("prefix-test");

      const clientWithPrefix = new MultiServerMCPClient({
        mcpServers: {
          "test-server": {
            url: `${baseUrl}/mcp`,
          },
        },
        prefixToolNameWithServerName: true,
        additionalToolNamePrefix: "custom",
      });

      const clientWithoutPrefix = new MultiServerMCPClient({
        mcpServers: {
          "test-server": {
            url: `${baseUrl}/mcp`,
          },
        },
        prefixToolNameWithServerName: false,
        additionalToolNamePrefix: "",
      });

      try {
        const toolsWithPrefix = await clientWithPrefix.getTools();
        const toolsWithoutPrefix = await clientWithoutPrefix.getTools();

        const prefixedTool = toolsWithPrefix.find((t) =>
          t.name.includes("custom__test-server__")
        );
        const unprefixedTool = toolsWithoutPrefix.find(
          (t) => t.name === "test_tool"
        );

        expect(prefixedTool).toBeDefined();
        expect(unprefixedTool).toBeDefined();
      } finally {
        await clientWithPrefix.close();
        await clientWithoutPrefix.close();
      }
    });

    it("should allow config inspection", async () => {
      const config = {
        mcpServers: {
          "test-server": {
            url: "http://example.com/mcp",
          },
        },
        throwOnLoadError: false,
        prefixToolNameWithServerName: true,
      };

      const client = new MultiServerMCPClient(config);

      const inspectedConfig = client.config;
      expect(inspectedConfig.mcpServers["test-server"]).toBeDefined();
      expect(inspectedConfig.throwOnLoadError).toBe(false);
      expect(inspectedConfig.prefixToolNameWithServerName).toBe(true);

      // Ensure config is cloned (not a reference)
      config.throwOnLoadError = true;
      expect(client.config.throwOnLoadError).toBe(false);

      await client.close();
    });
  });

  describe("OAuth Authentication", () => {
    it("should use OAuth provider for HTTP transport authentication", async () => {
      const { baseUrl } = await testServers.createHTTPServer("http-oauth", {
        requireAuth: true,
      });

      // Create a mock OAuth provider
      const mockAuthProvider: OAuthClientProvider = {
        redirectUrl: "unused",
        clientMetadata: {
          client_name: "Test MCP Client",
          redirect_uris: [],
          scope: "read write",
        },
        async clientInformation() {
          return {
            client_id: "test-client-id",
            redirect_uri: this.redirectUrl,
          };
        },
        async tokens() {
          return {
            access_token: "test-token",
            token_type: "Bearer",
            expires_in: 3600,
          };
        },
        async saveTokens(_tokens: OAuthTokens) {
          // Mock implementation
        },
        async saveCodeVerifier(_codeVerifier: string) {
          // Mock implementation
        },
        async codeVerifier() {
          return "mock-code-verifier";
        },
        async redirectToAuthorization() {
          throw new Error(
            "Mock OAuth provider - authorization redirect not implemented"
          );
        },
      };

      const client = new MultiServerMCPClient({
        "oauth-server": {
          url: `${baseUrl}/mcp`,
          authProvider: mockAuthProvider,
        },
      });

      try {
        const tools = await client.getTools();
        expect(tools.length).toBeGreaterThan(0);

        const testTool = tools.find((t) => t.name.includes("test_tool"));
        expect(testTool).toBeDefined();

        const result = await testTool!.invoke({ input: "oauth test" });
        expect(result).toContain("oauth test");
        expect(result).toContain("http-oauth");
      } finally {
        await client.close();
      }
    });

    it("should use OAuth provider for SSE transport authentication", async () => {
      const { baseUrl } = await testServers.createHTTPServer("sse-oauth", {
        requireAuth: true,
        supportSSEFallback: true,
      });

      // Create a mock OAuth provider
      const mockAuthProvider: OAuthClientProvider = {
        redirectUrl: "unused",
        clientMetadata: {
          redirect_uris: [],
          scope: "read write",
        },
        async clientInformation() {
          return {
            client_id: "test-client-id",
            redirect_uri: this.redirectUrl,
          };
        },
        async tokens() {
          return {
            access_token: "test-token",
            token_type: "Bearer",
            expires_in: 3600,
          };
        },
        async saveTokens(_tokens: OAuthTokens) {
          // Mock implementation
        },
        async saveCodeVerifier(_codeVerifier: string) {
          // Mock implementation
        },
        async codeVerifier() {
          return "mock-code-verifier";
        },
        async redirectToAuthorization() {
          throw new Error(
            "Mock OAuth provider - authorization redirect not implemented"
          );
        },
      };

      const client = new MultiServerMCPClient({
        "sse-oauth-server": {
          transport: "sse",
          url: `${baseUrl}/sse`,
          authProvider: mockAuthProvider,
        },
      });

      try {
        const tools = await client.getTools();
        expect(tools.length).toBeGreaterThan(0);

        const testTool = tools.find((t) => t.name.includes("test_tool"));
        expect(testTool).toBeDefined();

        const result = await testTool!.invoke({ input: "sse oauth test" });
        expect(result).toContain("sse oauth test");
        expect(result).toContain("sse-oauth");
      } finally {
        await client.close();
      }
    });

    it("should fail gracefully when OAuth provider returns invalid tokens for HTTP transport", async () => {
      const { baseUrl } = await testServers.createHTTPServer(
        "http-oauth-invalid",
        {
          requireAuth: true,
        }
      );

      // Create a mock OAuth provider that returns invalid tokens
      const mockAuthProvider: OAuthClientProvider = {
        redirectUrl: "unused",
        clientMetadata: {
          client_name: "Test MCP Client",
          redirect_uris: [],
          scope: "read write",
        },
        async clientInformation() {
          return {
            client_id: "test-client-id",
            redirect_uri: this.redirectUrl,
          };
        },
        async tokens() {
          return {
            access_token: "invalid-token",
            token_type: "Bearer",
            expires_in: 3600,
          };
        },
        async saveTokens(_tokens: OAuthTokens) {
          // Mock implementation
        },
        async saveCodeVerifier(_codeVerifier: string) {
          // Mock implementation
        },
        async codeVerifier() {
          return "mock-code-verifier";
        },
        async redirectToAuthorization() {
          throw new Error(
            "Mock OAuth provider - authorization redirect not implemented"
          );
        },
      };

      const client = new MultiServerMCPClient({
        "oauth-invalid-server": {
          url: `${baseUrl}/mcp`,
          authProvider: mockAuthProvider,
        },
      });

      try {
        await expect(client.getTools()).rejects.toThrow(
          expect.objectContaining({
            name: "MCPClientError",
            message: expect.stringMatching(
              /Failed to connect to.*server.*oauth-invalid-server/i
            ),
          })
        );
      } finally {
        await client.close();
      }
    });

    it("should fail gracefully when OAuth provider returns no tokens for HTTP transport", async () => {
      const { baseUrl } = await testServers.createHTTPServer(
        "http-oauth-no-tokens",
        {
          requireAuth: true,
        }
      );

      // Create a mock OAuth provider that returns no tokens
      const mockAuthProvider: OAuthClientProvider = {
        redirectUrl: "unused",
        clientMetadata: {
          client_name: "Test MCP Client",
          redirect_uris: [],
          scope: "read write",
        },
        async clientInformation() {
          return {
            client_id: "test-client-id",
            redirect_uri: this.redirectUrl,
          };
        },
        async tokens() {
          return undefined; // No tokens available
        },
        async saveTokens(_tokens: OAuthTokens) {
          // Mock implementation
        },
        async saveCodeVerifier(_codeVerifier: string) {
          // Mock implementation
        },
        async codeVerifier() {
          return "mock-code-verifier";
        },
        async redirectToAuthorization() {
          throw new Error(
            "Mock OAuth provider - authorization redirect not implemented"
          );
        },
      };

      const client = new MultiServerMCPClient({
        "oauth-no-tokens-server": {
          url: `${baseUrl}/mcp`,
          authProvider: mockAuthProvider,
        },
      });

      try {
        await expect(client.getTools()).rejects.toThrow(
          expect.objectContaining({
            name: "MCPClientError",
            message: expect.stringMatching(
              /Failed to connect to.*server.*oauth-no-tokens-server/i
            ),
          })
        );
      } finally {
        await client.close();
      }
    });

    it("should fail gracefully when OAuth provider throws errors for SSE transport", async () => {
      const { baseUrl } = await testServers.createHTTPServer(
        "sse-oauth-error",
        {
          requireAuth: true,
          supportSSEFallback: true,
        }
      );

      // Create a mock OAuth provider that throws errors
      const mockAuthProvider: OAuthClientProvider = {
        redirectUrl: "unused",
        clientMetadata: {
          client_name: "Test MCP Client",
          redirect_uris: [],
          scope: "read write",
        },
        async clientInformation() {
          return {
            client_id: "test-client-id",
            redirect_uri: this.redirectUrl,
          };
        },
        async tokens() {
          throw new Error("OAuth provider error: Failed to retrieve tokens");
        },
        async saveTokens(_tokens: OAuthTokens) {
          // Mock implementation
        },
        async saveCodeVerifier(_codeVerifier: string) {
          // Mock implementation
        },
        async codeVerifier() {
          return "mock-code-verifier";
        },
        async redirectToAuthorization() {
          throw new Error(
            "Mock OAuth provider - authorization redirect not implemented"
          );
        },
      };

      const client = new MultiServerMCPClient({
        "sse-oauth-error-server": {
          transport: "sse",
          url: `${baseUrl}/sse`,
          authProvider: mockAuthProvider,
        },
      });

      try {
        await expect(client.getTools()).rejects.toThrow(
          expect.objectContaining({
            name: "MCPClientError",
            message: expect.stringMatching(
              /Failed to (connect to|create).*server.*sse-oauth-error-server/i
            ),
          })
        );
      } finally {
        await client.close();
      }
    });

    it("should use OAuth provider with additional custom headers for HTTP transport", async () => {
      const { baseUrl } = await testServers.createHTTPServer(
        "http-oauth-headers",
        {
          requireAuth: true,
          testHeaders: true,
        }
      );

      // Create a mock OAuth provider
      const mockAuthProvider: OAuthClientProvider = {
        redirectUrl: "unused",
        clientMetadata: {
          client_name: "Test MCP Client",
          redirect_uris: [],
          scope: "read write",
        },
        async clientInformation() {
          return {
            client_id: "test-client-id",
            redirect_uri: this.redirectUrl,
          };
        },
        async tokens() {
          return {
            access_token: "test-token",
            token_type: "Bearer",
            expires_in: 3600,
          };
        },
        async saveTokens(_tokens: OAuthTokens) {
          // Mock implementation
        },
        async saveCodeVerifier(_codeVerifier: string) {
          // Mock implementation
        },
        async codeVerifier() {
          return "mock-code-verifier";
        },
        async redirectToAuthorization() {
          throw new Error(
            "Mock OAuth provider - authorization redirect not implemented"
          );
        },
      };

      const client = new MultiServerMCPClient({
        "oauth-headers-server": {
          url: `${baseUrl}/mcp`,
          authProvider: mockAuthProvider,
          headers: {
            "X-Custom-API-Key": "custom-api-key-123",
            "X-Request-ID": "req-oauth-headers-456",
          },
        },
      });

      try {
        const tools = await client.getTools();
        expect(tools.length).toBeGreaterThan(0);

        const testTool = tools.find((t) => t.name.includes("test_tool"));
        expect(testTool).toBeDefined();

        const result = await testTool!.invoke({ input: "oauth with headers" });
        expect(result).toContain("oauth with headers");
        expect(result).toContain("http-oauth-headers");

        // Test that custom headers were received
        const headerTool = tools.find((t) => t.name.includes("check_headers"));
        expect(headerTool).toBeDefined();

        const apiKeyResult = await headerTool!.invoke({
          headerName: "X-Custom-API-Key",
        });
        expect(apiKeyResult).toBe("custom-api-key-123");

        const requestIdResult = await headerTool!.invoke({
          headerName: "X-Request-ID",
        });
        expect(requestIdResult).toBe("req-oauth-headers-456");

        // Verify OAuth authorization header is also present
        const authHeaderResult = await headerTool!.invoke({
          headerName: "Authorization",
        });
        expect(authHeaderResult).toBe("Bearer test-token");
      } finally {
        await client.close();
      }
    });

    it("should use OAuth provider with additional custom headers for SSE transport", async () => {
      const { baseUrl } = await testServers.createHTTPServer(
        "sse-oauth-headers",
        {
          requireAuth: true,
          testHeaders: true,
          supportSSEFallback: true,
        }
      );

      // Create a mock OAuth provider
      const mockAuthProvider: OAuthClientProvider = {
        redirectUrl: "unused",
        clientMetadata: {
          client_name: "Test MCP Client",
          redirect_uris: [],
          scope: "read write",
        },
        async clientInformation() {
          return {
            client_id: "test-client-id",
            redirect_uri: this.redirectUrl,
          };
        },
        async tokens() {
          return {
            access_token: "test-token",
            token_type: "Bearer",
            expires_in: 3600,
          };
        },
        async saveTokens(_tokens: OAuthTokens) {
          // Mock implementation
        },
        async saveCodeVerifier(_codeVerifier: string) {
          // Mock implementation
        },
        async codeVerifier() {
          return "mock-code-verifier";
        },
        async redirectToAuthorization() {
          throw new Error(
            "Mock OAuth provider - authorization redirect not implemented"
          );
        },
      };

      const client = new MultiServerMCPClient({
        "sse-oauth-headers-server": {
          transport: "sse",
          url: `${baseUrl}/sse`,
          authProvider: mockAuthProvider,
          headers: {
            "X-SSE-Custom-Header": "sse-custom-value-789",
            "X-Correlation-ID": "corr-sse-oauth-101112",
          },
        },
      });

      try {
        const tools = await client.getTools();
        expect(tools.length).toBeGreaterThan(0);

        const testTool = tools.find((t) => t.name.includes("test_tool"));
        expect(testTool).toBeDefined();

        const result = await testTool!.invoke({
          input: "sse oauth with headers",
        });
        expect(result).toContain("sse oauth with headers");
        expect(result).toContain("sse-oauth-headers");

        // Test that custom headers were received
        const headerTool = tools.find((t) => t.name.includes("check_headers"));
        expect(headerTool).toBeDefined();

        const customHeaderResult = await headerTool!.invoke({
          headerName: "X-SSE-Custom-Header",
        });
        expect(customHeaderResult).toBe("sse-custom-value-789");

        const correlationIdResult = await headerTool!.invoke({
          headerName: "X-Correlation-ID",
        });
        expect(correlationIdResult).toBe("corr-sse-oauth-101112");

        // Verify OAuth authorization header is also present
        const authHeaderResult = await headerTool!.invoke({
          headerName: "Authorization",
        });
        expect(authHeaderResult).toBe("Bearer test-token");
      } finally {
        await client.close();
      }
    });

    it("should fail gracefully when OAuth provider returns invalid tokens for SSE transport", async () => {
      const { baseUrl } = await testServers.createHTTPServer(
        "sse-oauth-invalid",
        {
          requireAuth: true,
          supportSSEFallback: true,
        }
      );

      // Create a mock OAuth provider that returns invalid tokens
      const mockAuthProvider: OAuthClientProvider = {
        redirectUrl: "unused",
        clientMetadata: {
          client_name: "Test MCP Client",
          redirect_uris: [],
          scope: "read write",
        },
        async clientInformation() {
          return {
            client_id: "test-client-id",
            redirect_uri: this.redirectUrl,
          };
        },
        async tokens() {
          return {
            access_token: "invalid-token",
            token_type: "Bearer",
            expires_in: 3600,
          };
        },
        async saveTokens(_tokens: OAuthTokens) {
          // Mock implementation
        },
        async saveCodeVerifier(_codeVerifier: string) {
          // Mock implementation
        },
        async codeVerifier() {
          return "mock-code-verifier";
        },
        async redirectToAuthorization() {
          throw new Error(
            "Mock OAuth provider - authorization redirect not implemented"
          );
        },
      };

      const client = new MultiServerMCPClient({
        "sse-oauth-invalid-server": {
          transport: "sse",
          url: `${baseUrl}/sse`,
          authProvider: mockAuthProvider,
        },
      });

      try {
        await expect(client.getTools()).rejects.toThrow(
          expect.objectContaining({
            name: "MCPClientError",
            message: expect.stringMatching(
              /Failed to (connect to|create).*server.*sse-oauth-invalid-server/i
            ),
          })
        );
      } finally {
        await client.close();
      }
    });
  });

  describe("Timeout Configuration", () => {
    it("http smoke test: should honor timeout when shorter than sleepMsec", async () => {
      const { baseUrl } = await testServers.createHTTPServer(
        "timeout-smoke-test",
        {
          disableStreamableHttp: false,
          supportSSEFallback: false,
        }
      );

      const client = new MultiServerMCPClient({
        "timeout-server": {
          transport: "http",
          url: `${baseUrl}/mcp`,
        },
      });

      try {
        const tools = await client.getTools();
        const testTool = tools.find((t) => t.name.includes("sleep_tool"));
        expect(testTool).toBeDefined();

        // Set a timeout that is lower than the sleep duration and ensure it is honored.
        await expect(
          testTool!.invoke(
            { sleepMsec: 500 },
            {
              timeout: 10,
            }
          )
        ).rejects.toThrowError(
          /TimeoutError: The operation was aborted due to timeout/
        );
      } finally {
        await client.close();
      }
    });

    it.each(["http", "sse"] as const)(
      "%s should respect RunnableConfig timeout for tool calls",
      async (transport: "http" | "sse") => {
        const { baseUrl } = await testServers.createHTTPServer("timeout-test", {
          disableStreamableHttp: transport === "sse",
          supportSSEFallback: transport === "sse",
        });

        const client = new MultiServerMCPClient({
          "timeout-server": {
            transport,
            url: `${baseUrl}/${transport === "http" ? "mcp" : "sse"}`,
          },
        });

        try {
          const tools = await client.getTools();
          const testTool = tools.find((t) => t.name.includes("sleep_tool"));
          expect(testTool).toBeDefined();

          // Test with a reasonable timeout (should succeed)
          const result = await testTool!.invoke(
            { sleepMsec: 100 },
            { timeout: 1000 } // 1 second
          );
          expect(result).toContain("done");
        } finally {
          await client.close();
        }
      }
    );

    it.each(["http", "sse"] as const)(
      "%s should throw timeout error when tool call exceeds configured timeout",
      async (transport) => {
        const { baseUrl } = await testServers.createHTTPServer(
          "timeout-error-test",
          {
            disableStreamableHttp: transport === "sse",
            supportSSEFallback: transport === "sse",
          }
        );

        const client = new MultiServerMCPClient({
          "timeout-server": {
            transport,
            url: `${baseUrl}/${transport === "http" ? "mcp" : "sse"}`,
          },
        });

        try {
          const tools = await client.getTools();
          const testTool = tools.find((t) => t.name.includes("sleep_tool"));
          expect(testTool).toBeDefined();

          await expect(
            testTool!.invoke(
              { sleepMsec: 1000 },
              { timeout: 5 } // 5 milliseconds
            )
          ).rejects.toThrowError(
            /TimeoutError: The operation was aborted due to timeout/
          );
        } finally {
          await client.close();
        }
      }
    );

    it.each(["http", "sse"] as const)(
      "%s should respect defaultToolTimeout for tool calls",
      async (transport) => {
        const { baseUrl } = await testServers.createHTTPServer("timeout-test", {
          disableStreamableHttp: transport === "sse",
          supportSSEFallback: transport === "sse",
        });

        const client = new MultiServerMCPClient({
          "timeout-server": {
            transport,
            url: `${baseUrl}/${transport === "http" ? "mcp" : "sse"}`,
            defaultToolTimeout: 1000,
          },
        });

        try {
          const tools = await client.getTools();
          const testTool = tools.find((t) => t.name.includes("sleep_tool"));
          expect(testTool).toBeDefined();

          // Test with a timeout less than the server's configured timeout (should succeed)
          const result = await testTool!.invoke({ sleepMsec: 100 });
          expect(result).toContain("done");
        } finally {
          await client.close();
        }
      }
    );

    it.each(["http", "sse"] as const)(
      "%s should throw timeout error when tool call exceeds configured timeout from server options",
      async (transport) => {
        const { baseUrl } = await testServers.createHTTPServer("timeout-test", {
          disableStreamableHttp: transport === "sse",
          supportSSEFallback: transport === "sse",
        });

        const client = new MultiServerMCPClient({
          "timeout-server": {
            transport,
            url: `${baseUrl}/${transport === "http" ? "mcp" : "sse"}`,
            defaultToolTimeout: 5, // 5 milliseconds
          },
        });

        try {
          const tools = await client.getTools();
          const testTool = tools.find((t) => t.name.includes("sleep_tool"));
          expect(testTool).toBeDefined();

          await expect(
            testTool!.invoke({ sleepMsec: 1000 })
          ).rejects.toThrowError(
            /TimeoutError: The operation was aborted due to timeout/
          );
        } finally {
          await client.close();
        }
      }
    );

    it.each(["http", "sse"] as const)(
      "%s should pass explicit per-call timeout through RunnableConfig",
      async (transport) => {
        const { baseUrl } = await testServers.createHTTPServer("timeout-test", {
          disableStreamableHttp: transport === "sse",
          supportSSEFallback: transport === "sse",
        });

        const client = new MultiServerMCPClient({
          "timeout-server": {
            transport,
            url: `${baseUrl}/${transport === "http" ? "mcp" : "sse"}`,
          },
        });

        try {
          const tools = await client.getTools();
          const testTool = tools.find((t) => t.name.includes("sleep_tool"));
          expect(testTool).toBeDefined();

          // Set a per-call timeout longer than the server default to ensure it is honored
          // The server sleep is 1500ms; we set timeout to 2000ms so it should succeed
          const result = await testTool!.invoke(
            { sleepMsec: 1500 },
            { timeout: 2000 }
          );
          expect(result).toContain("done");
        } finally {
          await client.close();
        }
      }
    );

    it.each(["http", "sse"] as const)(
      "%s should throw timeout error when tool call exceeds configured timeout from constructor options",
      async (transport) => {
        const { baseUrl } = await testServers.createHTTPServer("timeout-test", {
          disableStreamableHttp: transport === "sse",
          supportSSEFallback: transport === "sse",
        });

        const client = new MultiServerMCPClient({
          mcpServers: {
            "timeout-server": {
              transport,
              url: `${baseUrl}/${transport === "http" ? "mcp" : "sse"}`,
            },
          },
          defaultToolTimeout: 5, // 5 milliseconds
        });

        try {
          const tools = await client.getTools();
          const testTool = tools.find((t) => t.name.includes("sleep_tool"));
          expect(testTool).toBeDefined();

          await expect(
            testTool!.invoke({ sleepMsec: 100 })
          ).rejects.toThrowError(
            /TimeoutError: The operation was aborted due to timeout/
          );
        } finally {
          await client.close();
        }
      }
    );
  });

  describe("Multimodal Content Handling (including Audio)", () => {
    it.each(["http", "sse"])(
      "should correctly handle tools returning audio content (%s)",
      async (transport) => {
        const { baseUrl } = await testServers.createHTTPServer(
          "http-audio-test",
          {
            disableStreamableHttp: transport === "sse",
            supportSSEFallback: transport === "sse",
          }
        );

        const client = new MultiServerMCPClient({
          mcpServers: {
            "audio-server": {
              transport: transport as "http" | "sse",
              url: `${baseUrl}/${transport === "http" ? "mcp" : "sse"}`,
            },
          },
          // Ensure we test with standard content blocks as per README recommendation for new apps
          useStandardContentBlocks: true,
        });

        try {
          const tools = await client.getTools();
          const audioTool = tools.find((t) => t.name.includes("audio_tool"));
          expect(audioTool).toBeDefined();
          const fakeToolCall: ToolCall = {
            name: audioTool!.name,
            args: {
              input: "test audio input",
            },
            id: "fake-tool-call-id",
            type: "tool_call",
          };

          const { content, artifact } = await audioTool!.invoke(fakeToolCall);

          expect(artifact).toEqual([]);

          // Expect content to be an array of MessageContentComplex or DataContentBlock
          expect(Array.isArray(content)).toBe(true);
          const contentArray = content as ContentBlock[];

          const textBlock = contentArray.find(
            (c) => c.type === "text"
          ) as ContentBlock.Text;
          expect(textBlock).toBeDefined();
          expect(textBlock.text).toContain("Audio input was: test audio input");
          expect(textBlock.text).toContain("http-audio-test");

          const audioBlock = contentArray.find(
            (c) => c.type === "audio"
          ) as ContentBlock.Multimodal.Audio;
          expect(audioBlock).toBeDefined();
          expect(audioBlock.source_type).toBe("base64");
          expect(audioBlock.mime_type).toBe("audio/wav");
          expect(typeof audioBlock.data).toBe("string");
          expect(audioBlock.data?.length).toBeGreaterThan(10);
        } finally {
          await client.close();
        }
      }
    );
  });

  describe("useStandardContentBlocks Configuration", () => {
    const serverName = "content-block-test-server";
    const toolInput = { input: "test standard blocks" };
    const fakeToolCallBase = {
      id: "fake-tool-id-standard-blocks",
      type: "tool_call" as const,
    };

    it.each(["http", "sse"] as const)(
      "should use Standard Content Blocks when useStandardContentBlocks is true (%s)",
      async (transport) => {
        const { baseUrl } = await testServers.createHTTPServer(
          "http-std-true",
          {
            disableStreamableHttp: transport === "sse",
            supportSSEFallback: transport === "sse",
          }
        );
        const client = new MultiServerMCPClient({
          mcpServers: {
            [serverName]: {
              transport: transport as "http" | "sse",
              url: `${baseUrl}/${transport === "http" ? "mcp" : "sse"}`,
            },
          },
          useStandardContentBlocks: true,
        });

        try {
          const tools = await client.getTools();
          const imageTool = tools.find((t) => t.name.includes("image_tool"));
          const audioTool = tools.find((t) => t.name.includes("audio_tool"));
          expect(imageTool).toBeDefined();
          expect(audioTool).toBeDefined();

          // Test Image Tool
          const { content: imgContent, artifact: imgArtifact } =
            await imageTool!.invoke({
              ...fakeToolCallBase,
              name: imageTool!.name,
              args: toolInput,
            });
          expect(imgArtifact).toEqual([]);
          const imgContentArray = imgContent as ContentBlock[];

          const imgTextBlock = imgContentArray.find(
            (c) => c.type === "text"
          ) as ContentBlock.Text;
          expect(imgTextBlock.text).toContain(
            "Image input was: test standard blocks"
          );
          const imgBlock = imgContentArray.find(
            (c) => c.type === "image"
          ) as ContentBlock.Multimodal.Data;
          expect(imgBlock.source_type).toBe("base64");
          expect(imgBlock.mime_type).toBe("image/png");
          expect(typeof imgBlock.data).toBe("string");

          // Test Audio Tool (should always use StandardAudioBlock)
          const { content: audioContent, artifact: audioArtifact } =
            await audioTool!.invoke({
              ...fakeToolCallBase,
              name: audioTool!.name,
              args: toolInput,
            });
          expect(audioArtifact).toEqual([]);
          const audioContentArray = audioContent as ContentBlock[];

          const audioTextBlock = audioContentArray.find(
            (c) => c.type === "text"
          ) as ContentBlock.Text;
          expect(audioTextBlock.text).toContain(
            "Audio input was: test standard blocks"
          );
          const audioBlock = audioContentArray.find(
            (c) => c.type === "audio"
          ) as ContentBlock.Multimodal.Audio;
          expect(audioBlock.source_type).toBe("base64");
          expect(audioBlock.mime_type).toBe("audio/wav");
        } finally {
          await client.close();
        }
      }
    );

    it.each(["http", "sse"] as const)(
      "should use legacy ImageUrl when useStandardContentBlocks is false (%s)",
      async (transport) => {
        const { baseUrl } = await testServers.createHTTPServer(
          "http-std-false",
          {
            disableStreamableHttp: transport === "sse",
            supportSSEFallback: transport === "sse",
          }
        );
        const client = new MultiServerMCPClient({
          mcpServers: {
            [serverName]: {
              url: `${baseUrl}/${transport === "http" ? "mcp" : "sse"}`,
            },
          },
          /* useStandardContentBlocks: false */ // defaults to false
        });

        try {
          const tools = await client.getTools();
          const imageTool = tools.find((t) => t.name.includes("image_tool"));
          expect(imageTool).toBeDefined();

          const { content: imgContent, artifact: imgArtifact } =
            await imageTool!.invoke({
              ...fakeToolCallBase,
              name: imageTool!.name,
              args: toolInput,
            });
          expect(imgArtifact).toEqual([]);
          const imgContentArray = imgContent as ContentBlock[];

          const imgTextBlock = imgContentArray.find(
            (c) => c.type === "text"
          ) as ContentBlock.Text;
          expect(imgTextBlock.text).toContain(
            "Image input was: test standard blocks"
          );
          // Check for legacy image_url format
          const imgUrlBlock = imgContentArray.find(
            (c) => c.type === "image_url"
          ) as ContentBlock.Multimodal.Data;
          expect(imgUrlBlock).toBeDefined();
          // @ts-expect-error image_url is unknown
          const imageUrl = imgUrlBlock.image_url?.url;
          expect(imageUrl).toMatch(/^data:image\/png;base64,/);

          // Audio should still use StandardAudioBlock
          const audioTool = tools.find((t) => t.name.includes("audio_tool"));
          expect(audioTool).toBeDefined();
          const { content: audioContent, artifact: audioArtifact } =
            await audioTool!.invoke({
              ...fakeToolCallBase,
              name: audioTool!.name,
              args: toolInput,
            });
          expect(audioArtifact).toEqual([]);
          const audioContentArray = audioContent as ContentBlock[];
          const audioBlock = audioContentArray.find(
            (c) => c.type === "audio"
          ) as ContentBlock.Multimodal.Audio;
          expect(audioBlock.source_type).toBe("base64");
          expect(audioBlock.mime_type).toBe("audio/wav");
        } finally {
          await client.close();
        }
      }
    );
  });

  describe("Output Handling Configuration", () => {
    const serverNameBase = "output-handling-test";
    const imageToolInput: ToolCall = {
      type: "tool_call",
      name: "resource_tool",
      id: "fake-tool-call-id",
      args: { input: "test output handling" },
    };
    const resourceToolInput: ToolCall = {
      type: "tool_call",
      name: "resource_tool",
      id: "fake-tool-call-id",
      args: { input: "test output handling" },
    };
    const audioToolInput: ToolCall = {
      type: "tool_call",
      name: "audio_tool",
      id: "fake-tool-call-id",
      args: { input: "test output handling" },
    };
    const findTool = (
      tools: StructuredToolInterface[],
      partialName: string
    ) => {
      const tool = tools.find((t) => t.name.includes(partialName));
      expect(tool).toBeDefined();
      return tool!;
    };

    it.each(["http", "sse"] as const)(
      "should use default output handling when not specified (%s)",
      async (transport) => {
        const serverName = `${serverNameBase}-default-${transport}`;
        const { baseUrl } = await testServers.createHTTPServer(serverName, {
          disableStreamableHttp: transport === "sse",
          supportSSEFallback: transport === "sse",
        });
        const client = new MultiServerMCPClient({
          mcpServers: {
            [serverName]: {
              transport: transport as "http" | "sse",
              url: `${baseUrl}/${transport === "http" ? "mcp" : "sse"}`,
            },
          },
        });

        try {
          const tools = await client.getTools();
          const imageTool = findTool(tools, "image_tool");
          const resourceTool = findTool(tools, "resource_tool");

          const { content: imgContentResult, artifact: imgArtifact } =
            await imageTool.invoke(imageToolInput);

          expect(Array.isArray(imgContentResult)).toBe(true);
          expect(imgArtifact).toEqual([]);

          const imgContentArray = imgContentResult as ContentBlock[];

          expect(imgContentArray).toHaveLength(2);
          expect(imgContentArray).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                type: "text",
                text: expect.stringContaining(
                  imageToolInput.args.input as string
                ),
              }),
              expect.objectContaining({
                type: "image_url",
                image_url: expect.objectContaining({
                  url: expect.stringMatching(/^data:image\/png;base64,/),
                }),
              }),
            ])
          );

          const { content: resContentResult, artifact: resArtifact } =
            await resourceTool.invoke(resourceToolInput);

          if (typeof resContentResult === "string") {
            expect(resContentResult).toContain(
              resourceToolInput.args.input as string
            );
          } else {
            expect(Array.isArray(resContentResult)).toBe(true);
            const resContentArray = resContentResult as ContentBlock[];
            expect(resContentArray).toHaveLength(1);
            expect(resContentArray[0]).toEqual(
              expect.objectContaining({
                type: "text",
                text: expect.stringContaining(
                  resourceToolInput.args.input as string
                ),
              })
            );
          }
          expect(resArtifact).toEqual([
            expect.objectContaining({
              type: "resource",
              resource: expect.objectContaining({
                uri: "mem://test.txt",
                mimeType: "text/plain",
                text: "This is a test resource.",
              }),
            }),
          ]);
        } finally {
          await client.close();
        }
      }
    );

    it.each(["http", "sse"] as const)(
      "should send all output to artifact when client outputHandling is 'artifact' (%s)",
      async (transport) => {
        const serverName = `${serverNameBase}-client-artifact-${transport}`;
        const { baseUrl } = await testServers.createHTTPServer(serverName, {
          disableStreamableHttp: transport === "sse",
          supportSSEFallback: transport === "sse",
        });

        const client = new MultiServerMCPClient({
          mcpServers: {
            [serverName]: {
              transport: transport as "http" | "sse",
              url: `${baseUrl}/${transport === "http" ? "mcp" : "sse"}`,
            },
          },
          outputHandling: "artifact",
          useStandardContentBlocks: false,
        });

        try {
          const tools = await client.getTools();
          const imageTool = findTool(tools, "image_tool");
          const resourceTool = findTool(tools, "resource_tool");
          const audioTool = findTool(tools, "audio_tool");

          const { content: imgContent, artifact: imgArtifact } =
            await imageTool.invoke(imageToolInput);

          expect(imgContent).toEqual([]);
          expect(imgArtifact).toHaveLength(2);
          expect(imgArtifact).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                type: "text",
                text: expect.stringContaining(
                  imageToolInput.args.input as string
                ),
              }),
              expect.objectContaining({
                type: "image",
                data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
                mimeType: "image/png",
              }),
            ])
          );

          const { content: resContent, artifact: resArtifact } =
            await resourceTool.invoke(resourceToolInput);
          expect(resContent).toEqual([]);
          expect(resArtifact).toHaveLength(2);
          expect(resArtifact).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                type: "text",
                text: expect.stringContaining(
                  resourceToolInput.args.input as string
                ),
              }),
              expect.objectContaining({
                type: "resource",
                resource: expect.objectContaining({ uri: "mem://test.txt" }),
              }),
            ])
          );

          const { content: audioContent, artifact: audioArtifact } =
            await audioTool.invoke(audioToolInput);
          expect(audioContent).toEqual([]);
          expect(audioArtifact).toHaveLength(2);
          expect(audioArtifact).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                type: "text",
                text: expect.stringContaining(
                  audioToolInput.args.input as string
                ),
              }),
              expect.objectContaining({
                type: "audio",
                data: "UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA",
                mimeType: "audio/wav",
              }),
            ])
          );
        } finally {
          await client.close();
        }
      }
    );

    it.each(["http", "sse"] as const)(
      "should send all output to content when client outputHandling is 'content' (%s)",
      async (transport) => {
        const serverName = `${serverNameBase}-client-content-${transport}`;
        const { baseUrl } = await testServers.createHTTPServer(serverName, {
          disableStreamableHttp: transport === "sse",
          supportSSEFallback: transport === "sse",
        });
        const client = new MultiServerMCPClient({
          mcpServers: {
            [serverName]: {
              transport: transport as "http" | "sse",
              url: `${baseUrl}/${transport === "http" ? "mcp" : "sse"}`,
            },
          },
          outputHandling: "content",
          useStandardContentBlocks: false,
        });

        try {
          const tools = await client.getTools();
          const imageTool = findTool(tools, "image_tool");
          const resourceTool = findTool(tools, "resource_tool");

          const { content: imgContent, artifact: imgArtifact } =
            await imageTool.invoke(imageToolInput);
          expect(imgArtifact).toEqual([]);
          expect(Array.isArray(imgContent)).toBe(true);
          const imgContentArray = imgContent as ContentBlock[];
          expect(imgContentArray).toHaveLength(2);
          expect(imgContentArray).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                type: "text",
                text: expect.stringContaining(
                  imageToolInput.args.input as string
                ),
              }),
              expect.objectContaining({
                type: "image_url",
                image_url: expect.objectContaining({
                  url: expect.stringMatching(/^data:image\/png;base64,/),
                }),
              }),
            ])
          );

          const { content: resContent, artifact: resArtifact } =
            await resourceTool.invoke(resourceToolInput);
          expect(resArtifact).toEqual([]);
          expect(Array.isArray(resContent)).toBe(true);
          const resContentArray = resContent as ContentBlock[];
          expect(resContentArray).toHaveLength(2);
          expect(resContentArray).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                type: "text",
                text: expect.stringContaining(
                  resourceToolInput.args.input as string
                ),
              }),
              expect.objectContaining({
                type: "file",
                source_type: "text",
                mime_type: "text/plain",
                text: "This is a test resource.",
                metadata: { uri: "mem://test.txt" },
              }),
            ])
          );
        } finally {
          await client.close();
        }
      }
    );

    it.each(["http", "sse"] as const)(
      "should use client-level detailed outputHandling (%s)",
      async (transport) => {
        const serverName = `${serverNameBase}-client-detailed-${transport}`;
        const { baseUrl } = await testServers.createHTTPServer(serverName, {
          disableStreamableHttp: transport === "sse",
          supportSSEFallback: transport === "sse",
        });
        const client = new MultiServerMCPClient({
          mcpServers: {
            [serverName]: {
              transport: transport as "http" | "sse",
              url: `${baseUrl}/${transport === "http" ? "mcp" : "sse"}`,
            },
          },
          outputHandling: {
            text: "content",
            image: "artifact",
            audio: "content",
            resource: "content",
          },
          useStandardContentBlocks: false,
        });

        try {
          const tools = await client.getTools();
          const imageTool = findTool(tools, "image_tool");
          const resourceTool = findTool(tools, "resource_tool");

          const { content: imgContent, artifact: imgArtifact } =
            await imageTool.invoke(imageToolInput);
          if (typeof imgContent === "string") {
            expect(imgContent).toContain(imageToolInput.args.input);
          } else {
            const imgContentArray = imgContent as ContentBlock[];
            expect(imgContentArray).toHaveLength(1);
            expect(imgContentArray[0]).toEqual(
              expect.objectContaining({ type: "text" })
            );
          }
          expect(imgArtifact).toHaveLength(1);
          expect(imgArtifact[0]).toEqual({
            type: "image",
            data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
            mimeType: "image/png",
          });

          const { content: resContent, artifact: resArtifact } =
            await resourceTool.invoke(resourceToolInput);
          expect(resArtifact).toEqual([]);
          const resContentArray = resContent as ContentBlock[];
          expect(resContentArray).toHaveLength(2);
          expect(resContentArray).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ type: "text" }),
              expect.objectContaining({
                type: "file",
                metadata: { uri: "mem://test.txt" },
              }),
            ])
          );
        } finally {
          await client.close();
        }
      }
    );

    it.each(["http", "sse"] as const)(
      "should allow server-specific outputHandling to override client-level (%s)",
      async (transport) => {
        const serverName = `${serverNameBase}-server-override-${transport}`;
        const { baseUrl } = await testServers.createHTTPServer(serverName, {
          disableStreamableHttp: transport === "sse",
          supportSSEFallback: transport === "sse",
        });
        const clientConfig: ClientConfig = {
          mcpServers: {
            [serverName]: {
              transport: transport as "http" | "sse",
              url: `${baseUrl}/${transport === "http" ? "mcp" : "sse"}`,
              outputHandling: {
                image: "content",
                resource: "artifact",
              },
            },
          },
          outputHandling: "artifact",
          useStandardContentBlocks: false,
        };
        const client = new MultiServerMCPClient(clientConfig);

        try {
          const tools = await client.getTools();
          const imageTool = findTool(tools, "image_tool");
          const resourceTool = findTool(tools, "resource_tool");

          const { content: imgContent, artifact: imgArtifact } =
            await imageTool.invoke(imageToolInput);
          const imgContentArray = imgContent as ContentBlock[];
          expect(imgContentArray).toHaveLength(1);
          expect(imgContentArray[0]).toEqual({
            image_url: {
              url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
            },
            type: "image_url",
          });
          expect(imgArtifact).toHaveLength(1);
          expect(imgArtifact[0]).toEqual({
            type: "text",
            text: expect.stringContaining(imageToolInput.args.input as string),
          });

          const { content: resContent, artifact: resArtifact } =
            await resourceTool.invoke(resourceToolInput);
          expect(resContent).toEqual([]);
          expect(resArtifact).toHaveLength(2);
          expect(resArtifact).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ type: "text" }),
              expect.objectContaining({
                type: "resource",
                resource: expect.objectContaining({ uri: "mem://test.txt" }),
              }),
            ])
          );
        } finally {
          await client.close();
        }
      }
    );

    it.each(["http", "sse"] as const)(
      "should respect outputHandling with useStandardContentBlocks=true (%s)",
      async (transport) => {
        const serverName = `${serverNameBase}-std-blocks-${transport}`;
        const { baseUrl } = await testServers.createHTTPServer(serverName, {
          disableStreamableHttp: transport === "sse",
          supportSSEFallback: transport === "sse",
        });
        const client = new MultiServerMCPClient({
          mcpServers: {
            [serverName]: {
              transport: transport as "http" | "sse",
              url: `${baseUrl}/${transport === "http" ? "mcp" : "sse"}`,
            },
          },
          outputHandling: {
            text: "content",
            image: "artifact",
            audio: "content",
            resource: "artifact",
          },
          useStandardContentBlocks: true,
        });

        try {
          const tools = await client.getTools();
          const imageTool = findTool(tools, "image_tool");
          const audioTool = findTool(tools, "audio_tool");
          const resourceTool = findTool(tools, "resource_tool");

          const { content: imgContent, artifact: imgArtifact } =
            await imageTool.invoke(imageToolInput);
          if (typeof imgContent === "string") {
            expect(imgContent).toContain(imageToolInput.args.input);
          } else if (Array.isArray(imgContent)) {
            const imgContentArray = imgContent as ContentBlock[];
            expect(imgContentArray).toHaveLength(1);
            expect(imgContentArray[0]).toEqual(
              expect.objectContaining({ type: "text", source_type: "text" })
            );
          } else {
            expect(imgContent).toEqual([]);
          }
          expect(imgArtifact).toHaveLength(1);
          expect(imgArtifact[0]).toEqual(
            expect.objectContaining({
              type: "image",
              source_type: "base64",
              mime_type: "image/png",
            })
          );

          const { content: audioContent, artifact: audioArtifact } =
            await audioTool.invoke(audioToolInput);
          expect(audioArtifact).toEqual([]);
          const audioContentArray = audioContent as ContentBlock[];
          expect(audioContentArray).toHaveLength(2);
          expect(audioContentArray).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ type: "text", source_type: "text" }),
              expect.objectContaining({
                type: "audio",
                source_type: "base64",
                mime_type: "audio/wav",
              }),
            ])
          );

          const { content: resContent, artifact: resArtifact } =
            await resourceTool.invoke(resourceToolInput);
          if (typeof resContent === "string") {
            expect(resContent).toContain(resourceToolInput.args.input);
          } else if (Array.isArray(resContent)) {
            const resContentArray = resContent as ContentBlock[];
            expect(resContentArray).toHaveLength(1);
            expect(resContentArray[0]).toEqual(
              expect.objectContaining({ type: "text", source_type: "text" })
            );
          } else {
            expect(resContent).toEqual([]);
          }
          expect(resArtifact).toHaveLength(1);
          expect(resArtifact[0]).toEqual(
            expect.objectContaining({
              type: "file",
              source_type: "text",
              mime_type: "text/plain",
              metadata: { uri: "mem://test.txt" },
            })
          );
        } finally {
          await client.close();
        }
      }
    );
  });

  describe("Resource Management", () => {
    it.each(["http", "sse"] as const)(
      "should list resources from server (%s)",
      async (transport) => {
        const serverName = `resource-test-${transport}`;
        const { baseUrl } = await testServers.createHTTPServer(serverName, {
          disableStreamableHttp: transport === "sse",
          supportSSEFallback: transport === "sse",
        });
        const client = new MultiServerMCPClient({
          mcpServers: {
            [serverName]: {
              transport: transport as "http" | "sse",
              url: `${baseUrl}/${transport === "http" ? "mcp" : "sse"}`,
            },
          },
        });

        try {
          const resources = await client.listResources();
          expect(resources[serverName]).toBeDefined();
          expect(Array.isArray(resources[serverName])).toBe(true);
          expect(resources[serverName].length).toBeGreaterThan(0);

          const testResource = resources[serverName].find(
            (r: { uri: string }) => r.uri === "mem://test.txt"
          );
          expect(testResource).toBeDefined();
          expect(testResource?.name).toBe("Test Resource");
          expect(testResource?.description).toContain("test resource");
          expect(testResource?.mimeType).toBe("text/plain");
        } finally {
          await client.close();
        }
      }
    );

    it.each(["http", "sse"] as const)(
      "should list resource templates from server (%s)",
      async (transport) => {
        const serverName = `resource-template-test-${transport}`;
        const { baseUrl } = await testServers.createHTTPServer(serverName, {
          disableStreamableHttp: transport === "sse",
          supportSSEFallback: transport === "sse",
        });
        const client = new MultiServerMCPClient({
          mcpServers: {
            [serverName]: {
              transport: transport as "http" | "sse",
              url: `${baseUrl}/${transport === "http" ? "mcp" : "sse"}`,
            },
          },
        });

        try {
          const templates = await client.listResourceTemplates();
          expect(templates[serverName]).toBeDefined();
          expect(Array.isArray(templates[serverName])).toBe(true);
          expect(templates[serverName].length).toBeGreaterThan(0);

          const profileTemplate = templates[serverName].find(
            (t: { uriTemplate: string }) =>
              t.uriTemplate === "mem://user/{userId}/profile"
          );
          expect(profileTemplate).toBeDefined();
          expect(profileTemplate?.name).toBe("User Profile Template");
          expect(profileTemplate?.description).toContain("user profile");
        } finally {
          await client.close();
        }
      }
    );

    it.each(["http", "sse"] as const)(
      "should read resource from server (%s)",
      async (transport) => {
        const serverName = `read-resource-test-${transport}`;
        const { baseUrl } = await testServers.createHTTPServer(serverName, {
          disableStreamableHttp: transport === "sse",
          supportSSEFallback: transport === "sse",
        });
        const client = new MultiServerMCPClient({
          mcpServers: {
            [serverName]: {
              transport: transport as "http" | "sse",
              url: `${baseUrl}/${transport === "http" ? "mcp" : "sse"}`,
            },
          },
        });

        try {
          const content = await client.readResource(
            serverName,
            "mem://test.txt"
          );
          expect(Array.isArray(content)).toBe(true);
          expect(content.length).toBeGreaterThan(0);
          expect(content[0].uri).toBe("mem://test.txt");
          expect(content[0].mimeType).toBe("text/plain");
          expect(content[0].text).toBe("This is a test resource content.");
        } finally {
          await client.close();
        }
      }
    );

    it.each(["http", "sse"] as const)(
      "should handle reading non-existent resource (%s)",
      async (transport) => {
        const serverName = `read-resource-error-test-${transport}`;
        const { baseUrl } = await testServers.createHTTPServer(serverName, {
          disableStreamableHttp: transport === "sse",
          supportSSEFallback: transport === "sse",
        });
        const client = new MultiServerMCPClient({
          mcpServers: {
            [serverName]: {
              transport: transport as "http" | "sse",
              url: `${baseUrl}/${transport === "http" ? "mcp" : "sse"}`,
            },
          },
        });

        try {
          await expect(
            client.readResource(serverName, "mem://nonexistent.txt")
          ).rejects.toThrow();
        } finally {
          await client.close();
        }
      }
    );
  });

  describe("Structured Content and Meta", () => {
    it.each(["http", "sse"] as const)(
      "should parse structuredContent and _meta from tool result (%s)",
      async (transport) => {
        const serverName = `structured-test-${transport}`;
        const { baseUrl } = await testServers.createHTTPServer(serverName, {
          disableStreamableHttp: transport === "sse",
          supportSSEFallback: transport === "sse",
        });
        const client = new MultiServerMCPClient({
          mcpServers: {
            [serverName]: {
              transport: transport as "http" | "sse",
              url: `${baseUrl}/${transport === "http" ? "mcp" : "sse"}`,
            },
          },
        });

        try {
          const tools = await client.getTools();
          const structuredTool = tools.find((t: { name: string }) =>
            t.name.includes("structured_tool")
          );
          expect(structuredTool).toBeDefined();

          const result = await structuredTool!.invoke({ input: "test input" });
          expect(result).toBeDefined();

          // Check if structuredContent and meta are accessible
          // The result should be a string or content blocks
          if (typeof result === "string") {
            expect(result).toContain("test input");
          } else if (Array.isArray(result)) {
            // If it's an array, check for structured content in artifacts
            expect(result.length).toBeGreaterThan(0);
          }
        } finally {
          await client.close();
        }
      }
    );
  });
});
