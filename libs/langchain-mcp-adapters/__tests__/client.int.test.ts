import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Server } from 'node:http';
import { join } from 'node:path';
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type { OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import { MultiServerMCPClient } from '../src/client.js';
import { createDummyHttpServer } from './fixtures/dummy-http-server.js';

// Manages dummy MCP servers for testing
class TestMCPServers {
  private _httpServers: Server[] = [];

  createStdioServer(name: string): { command: string; args: string[] } {
    // Use the fixture file instead of inline server code
    const fixturePath = join(__dirname, "fixtures", "dummy-stdio-server.ts");

    return {
      command: "node",
      args: ["--loader", "tsx", fixturePath, name],
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

describe('MultiServerMCPClient Integration Tests', () => {
  let testServers: TestMCPServers;

  beforeEach(() => {
    testServers = new TestMCPServers();
  });

  afterEach(async () => {
    await testServers.cleanup();
  });

  describe('Stdio Transport', () => {
    it('should connect to and communicate with a stdio MCP server', async () => {
      const { command, args } = testServers.createStdioServer('stdio-test');
      
      const client = new MultiServerMCPClient({
        'stdio-server': {
          command,
          args,
          env: { TEST_VAR: 'test-value' }
        }
      });

      try {
        const tools = await client.getTools();
        expect(tools.length).toBeGreaterThan(0);

        const testTool = tools.find(t => t.name.includes('test_tool'));
        expect(testTool).toBeDefined();

        const result = await testTool!.invoke({ input: 'test input' });
        expect(result).toContain('test input');
        expect(result).toContain('stdio-test');

        const envTool = tools.find(t => t.name.includes('check_env'));
        expect(envTool).toBeDefined();

        const envResult = await envTool!.invoke({ varName: 'TEST_VAR' });
        expect(envResult).toBe('test-value');
      } finally {
        await client.close();
      }
    });

    it('should handle stdio server restart configuration', async () => {
      const { command, args } = testServers.createStdioServer('stdio-restart');
      
      const client = new MultiServerMCPClient({
        'stdio-server': {
          command,
          args,
          restart: {
            enabled: true,
            maxAttempts: 2,
            delayMs: 100
          }
        }
      });

      try {
        const tools = await client.getTools();
        expect(tools.length).toBeGreaterThan(0);
      } finally {
        await client.close();
      }
    });
  });

  describe('HTTP Transport', () => {
    it('should connect to and communicate with an HTTP MCP server', async () => {
      const { baseUrl } = await testServers.createHTTPServer('http-test');
      
      const client = new MultiServerMCPClient({
        'http-server': {
          url: `${baseUrl}/mcp`
        }
      });

      try {
        const tools = await client.getTools();
        expect(tools.length).toBeGreaterThan(0);

        const testTool = tools.find(t => t.name.includes('test_tool'));
        expect(testTool).toBeDefined();

        const result = await testTool!.invoke({ input: 'http test' });
        expect(result).toContain('http test');
        expect(result).toContain('http-test');
      } finally {
        await client.close();
      }
    });

    it('should handle authentication headers', async () => {
      const { baseUrl } = await testServers.createHTTPServer('http-auth', { 
        requireAuth: true 
      });
      
      const client = new MultiServerMCPClient({
        'http-server': {
          url: `${baseUrl}/mcp`,
          headers: {
            'Authorization': 'Bearer test-token'
          }
        }
      });

      try {
        const tools = await client.getTools();
        expect(tools.length).toBeGreaterThan(0);
      } finally {
        await client.close();
      }
    });

    it('should fail gracefully with invalid authentication', async () => {
      const { baseUrl } = await testServers.createHTTPServer('http-auth-fail', { 
        requireAuth: true 
      });
      
      const client = new MultiServerMCPClient({
        'http-server': {
          url: `${baseUrl}/mcp`,
          headers: {
            'Authorization': 'Bearer invalid-token'
          }
        }
      });

      try {
        try {
          await client.getTools();
          expect.fail('Expected authentication error but got success');
        } catch (error) {
          console.log('Actual error message:', (error as Error).message);
          expect(error).toEqual(
            expect.objectContaining({
              name: 'MCPClientError',
              message: expect.stringMatching(/Authentication failed.*HTTP.*server.*http-server/i)
            })
          );
        }
      } finally {
        await client.close();
      }
    });

    it('should set authorization headers for streamableHttp transport - success case', async () => {
      const { baseUrl } = await testServers.createHTTPServer('streamable-auth-success', { 
        requireAuth: true,
        testHeaders: true  // Enable header inspection
      });
      
      const client = new MultiServerMCPClient({
        'streamable-server': {
          url: `${baseUrl}/mcp`,
          headers: {
            'Authorization': 'Bearer test-token',
            'X-API-Key': 'my-api-key'
          }
        }
      });

      try {
        const tools = await client.getTools();
        expect(tools.length).toBeGreaterThan(0);

        const testTool = tools.find(t => t.name.includes('test_tool'));
        expect(testTool).toBeDefined();

        const result = await testTool!.invoke({ input: 'streamable auth test' });
        expect(result).toContain('streamable auth test');
        expect(result).toContain('streamable-auth-success');

        // Actually test that X-API-Key was received
        const headerTool = tools.find(t => t.name.includes('check_headers'));
        const headerResult = await headerTool!.invoke({ headerName: 'X-API-Key' });
        expect(headerResult).toBe('my-api-key');
      } finally {
        await client.close();
      }
    });

    it('should set authorization headers for streamableHttp transport - failure case', async () => {
      const { baseUrl } = await testServers.createHTTPServer('streamable-auth-fail', { 
        requireAuth: true 
      });
      
      const client = new MultiServerMCPClient({
        'streamable-server': {
          url: `${baseUrl}/mcp`,
          headers: {
            'Authorization': 'Bearer wrong-token'
          }
        }
      });

      try {
        await expect(client.getTools()).rejects.toThrow(
          expect.objectContaining({
            name: 'MCPClientError',
            message: expect.stringMatching(/Authentication failed.*HTTP.*server.*streamable-server/i)
          })
        );
      } finally {
        await client.close();
      }
    });

    it('should automatically fallback to SSE when streamable HTTP fails', async () => {
      const { baseUrl } = await testServers.createHTTPServer('http-sse-fallback', { 
        disableStreamableHttp: true,
        supportSSEFallback: true 
      });
      
      // Configure client to connect to a non-existent streamable HTTP endpoint
      // but with SSE fallback available
      const client = new MultiServerMCPClient({
        'http-server': {
          url: `${baseUrl}/mcp`
        }
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

  describe('SSE Transport', () => {
    it('should connect to SSE MCP server when explicitly configured', async () => {
      const { baseUrl } = await testServers.createHTTPServer('sse-explicit', { 
        supportSSEFallback: true 
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

        const testTool = tools.find(t => t.name.includes('test_tool'));
        expect(testTool).toBeDefined();

        const result = await testTool!.invoke({ input: 'sse test' });
        expect(result).toContain('sse test');
      } finally {
        await client.close();
      }
    });

    it('should set authorization headers for SSE transport - success case', async () => {
      const { baseUrl } = await testServers.createHTTPServer('sse-auth-success', { 
        requireAuth: true,
        testHeaders: true,
        supportSSEFallback: true 
      });
      
      const client = new MultiServerMCPClient({
        'sse-server': {
          transport: 'sse',
          url: `${baseUrl}/sse`,
          headers: {
            'Authorization': 'Bearer test-token',
            'X-Custom-Header': 'sse-value'
          }
        }
      });

      try {
        const tools = await client.getTools();
        expect(tools.length).toBeGreaterThan(0);
        
        const headerTool = tools.find(t => t.name.includes('check_headers'));
        const headerResult = await headerTool!.invoke({ headerName: 'X-Custom-Header' });
        expect(headerResult).toBe('sse-value');

        const testTool = tools.find(t => t.name.includes('test_tool'));
        expect(testTool).toBeDefined();

        const result = await testTool!.invoke({ input: 'sse auth test' });
        expect(result).toContain('sse auth test');
        expect(result).toContain('sse-auth-success');
      } finally {
        await client.close();
      }
    });

    it('should set authorization headers for SSE transport - failure case', async () => {
      const { baseUrl } = await testServers.createHTTPServer('sse-auth-fail', { 
        requireAuth: true,
        supportSSEFallback: true 
      });
      
      const client = new MultiServerMCPClient({
        'sse-server': {
          transport: 'sse',
          url: `${baseUrl}/sse`,
          headers: {
            'Authorization': 'Bearer invalid-token'
          }
        }
      });

      try {
        await expect(client.getTools()).rejects.toThrow(
          expect.objectContaining({
            name: 'MCPClientError',
            message: expect.stringMatching(/Authentication failed.*SSE.*server.*sse-server/i)
          })
        );
      } finally {
        await client.close();
      }
    });

    it('should handle SSE transport without authorization when not required', async () => {
      const { baseUrl } = await testServers.createHTTPServer('sse-no-auth', { 
        supportSSEFallback: true 
      });
      
      const client = new MultiServerMCPClient({
        'sse-server': {
          transport: 'sse',
          url: `${baseUrl}/sse`
          // No headers provided - should still work
        }
      });

      try {
        const tools = await client.getTools();
        expect(tools.length).toBeGreaterThan(0);

        const testTool = tools.find(t => t.name.includes('test_tool'));
        expect(testTool).toBeDefined();

        const result = await testTool!.invoke({ input: 'sse no auth test' });
        expect(result).toContain('sse no auth test');
        expect(result).toContain('sse-no-auth');
      } finally {
        await client.close();
      }
    });
  });

  describe('Multiple Servers', () => {
    it('should connect to multiple servers of different transport types', async () => {
      const { command, args } = testServers.createStdioServer('multi-stdio');
      const { baseUrl: streamableHttpBaseUrl } = await testServers.createHTTPServer('multi-http');
      const { baseUrl: sseBaseUrl } = await testServers.createHTTPServer('multi-sse', { 
        supportSSEFallback: true 
      });
      
      const client = new MultiServerMCPClient({
        'stdio-server': {
          command,
          args
        },
        'http-server': {
          url: `${streamableHttpBaseUrl}/mcp`
        },
        'sse-server': {
          url: `${sseBaseUrl}/sse`,
          transport: "sse",
        },
      });

      try {
        const tools = await client.getTools();
        // Check tools from each server
        const stdioTools = tools.filter(t => t.name.includes('stdio-server'));
        const httpTools = tools.filter(t => t.name.includes('http-server'));
        const sseTools = tools.filter(t => t.name.includes('sse-server'));

        expect(stdioTools.length).toBe(2);
        expect(httpTools.length).toBe(1);
        expect(sseTools.length).toBe(1);

        expect(tools.length).toBe(4);

        // Test tool from each server
        const stdioTestTool = tools.find(t => t.name.includes('stdio-server') && t.name.includes('test_tool'));
        const result = await stdioTestTool!.invoke({ input: 'multi-server test' });
        expect(result).toContain('multi-stdio');
      } finally {
        await client.close();
      }
    });

    it('should filter tools by server name', async () => {
      const { command, args } = testServers.createStdioServer('filter-stdio');
      const { baseUrl: streamableHttpBaseUrl } = await testServers.createHTTPServer('filter-http');

      const client = new MultiServerMCPClient({
        'stdio-server': {
          command,
          args
        },
        'http-server': {
          url: `${streamableHttpBaseUrl}/mcp`
        }
      });

      try {
        const allTools = await client.getTools();
        const stdioTools = await client.getTools('stdio-server');
        const httpTools = await client.getTools('http-server');

        expect(allTools.length).toBe(stdioTools.length + httpTools.length);
        expect(stdioTools.every(t => t.name.includes('stdio-server'))).toBe(true);
        expect(httpTools.every(t => t.name.includes('http-server'))).toBe(true);
      } finally {
        await client.close();
      }
    });

    it('should provide access to individual server clients', async () => {
      const { baseUrl } = await testServers.createHTTPServer('client-access');

      const client = new MultiServerMCPClient({
        'test-server': {
          url: `${baseUrl}/mcp`
        }
      });

      try {
        await client.initializeConnections();
        const serverClient = await client.getClient('test-server');
        expect(serverClient).toBeDefined();

        const nonExistentClient = await client.getClient('nonexistent');
        expect(nonExistentClient).toBeUndefined();
      } finally {
        await client.close();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle connection failures gracefully', async () => {
      const client = new MultiServerMCPClient({
        "failing-server": {
          url: "http://totally-not-a-server.fakeurl.example.com:9999/mcp", // Non-existent server
        },
      });

      try {
        await expect(client.getTools()).rejects.toThrow(
          expect.objectContaining({
            name: 'MCPClientError',
            message: expect.stringMatching(/Failed to connect to.*server.*failing-server/i)
          })
        );
      } finally {
        await client.close();
      }
    });

    it('should handle invalid stdio command', async () => {
      const client = new MultiServerMCPClient({
        'failing-stdio': {
          command: 'nonexistent-command',
          args: []
        }
      });

      try {
        await expect(client.getTools()).rejects.toThrow(
          expect.objectContaining({
            name: 'MCPClientError',
            message: expect.stringMatching(/Failed to connect to stdio server.*failing-stdio/i)
          })
        );
      } finally {
        await client.close();
      }
    });
  });

  describe('Configuration', () => {
    it('should respect tool name prefixing configuration', async () => {
      const { baseUrl } = await testServers.createHTTPServer('prefix-test');

      const clientWithPrefix = new MultiServerMCPClient({
        mcpServers: {
          'test-server': {
            url: `${baseUrl}/mcp`
          }
        },
        prefixToolNameWithServerName: true,
        additionalToolNamePrefix: 'custom'
      });

      const clientWithoutPrefix = new MultiServerMCPClient({
        mcpServers: {
          'test-server': {
            url: `${baseUrl}/mcp`
          }
        },
        prefixToolNameWithServerName: false,
        additionalToolNamePrefix: ''
      });

      try {
        const toolsWithPrefix = await clientWithPrefix.getTools();
        const toolsWithoutPrefix = await clientWithoutPrefix.getTools();

        const prefixedTool = toolsWithPrefix.find(t => t.name.includes('custom__test-server__'));
        const unprefixedTool = toolsWithoutPrefix.find(t => t.name === 'test_tool');

        expect(prefixedTool).toBeDefined();
        expect(unprefixedTool).toBeDefined();
      } finally {
        await clientWithPrefix.close();
        await clientWithoutPrefix.close();
      }
    });

    it('should allow config inspection', async () => {
      const config = {
        mcpServers: {
          'test-server': {
            url: 'http://example.com/mcp'
          }
        },
        throwOnLoadError: false,
        prefixToolNameWithServerName: true
      };

      const client = new MultiServerMCPClient(config);

      const inspectedConfig = client.config;
      expect(inspectedConfig.mcpServers['test-server']).toBeDefined();
      expect(inspectedConfig.throwOnLoadError).toBe(false);
      expect(inspectedConfig.prefixToolNameWithServerName).toBe(true);

      // Ensure config is cloned (not a reference)
      config.throwOnLoadError = true;
      expect(client.config.throwOnLoadError).toBe(false);

      await client.close();
    });
  });

  describe('OAuth Authentication', () => {
    it('should use OAuth provider for HTTP transport authentication', async () => {
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
        async saveTokens(tokens: OAuthTokens) {
          // Mock implementation
        },
        async saveCodeVerifier(codeVerifier: string) {
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

    it('should use OAuth provider for SSE transport authentication', async () => {
      const { baseUrl } = await testServers.createHTTPServer('sse-oauth', { 
        requireAuth: true,
        supportSSEFallback: true 
      });
      
      // Create a mock OAuth provider
      const mockAuthProvider: OAuthClientProvider = {
        redirectUrl: 'unused',
        clientMetadata: {
          redirect_uris: [],
          scope: 'read write',
        },
        async clientInformation() {
          return {
            client_id: 'test-client-id',
            redirect_uri: this.redirectUrl,
          };
        },
        async tokens() {
          return {
            access_token: 'test-token',
            token_type: 'Bearer',
            expires_in: 3600,
          };
        },
        async saveTokens(tokens: OAuthTokens) {
          // Mock implementation
        },
        async saveCodeVerifier(codeVerifier: string) {
          // Mock implementation
        },
        async codeVerifier() {
          return 'mock-code-verifier';
        },
        async redirectToAuthorization() {
          throw new Error('Mock OAuth provider - authorization redirect not implemented');
        }
      };
      
      const client = new MultiServerMCPClient({
        'sse-oauth-server': {
          transport: 'sse',
          url: `${baseUrl}/sse`,
          authProvider: mockAuthProvider
        }
      });

      try {
        const tools = await client.getTools();
        expect(tools.length).toBeGreaterThan(0);

        const testTool = tools.find(t => t.name.includes('test_tool'));
        expect(testTool).toBeDefined();

        const result = await testTool!.invoke({ input: 'sse oauth test' });
        expect(result).toContain('sse oauth test');
        expect(result).toContain('sse-oauth');
      } finally {
        await client.close();
      }
    });

    it('should fail gracefully when OAuth provider returns invalid tokens for HTTP transport', async () => {
      const { baseUrl } = await testServers.createHTTPServer("http-oauth-invalid", {
        requireAuth: true,
      });

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
        async saveTokens(tokens: OAuthTokens) {
          // Mock implementation
        },
        async saveCodeVerifier(codeVerifier: string) {
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
            name: 'MCPClientError',
            message: expect.stringMatching(/Failed to connect to.*server.*oauth-invalid-server/i)
          })
        );
      } finally {
        await client.close();
      }
    });

    it('should fail gracefully when OAuth provider returns no tokens for HTTP transport', async () => {
      const { baseUrl } = await testServers.createHTTPServer("http-oauth-no-tokens", {
        requireAuth: true,
      });

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
        async saveTokens(tokens: OAuthTokens) {
          // Mock implementation
        },
        async saveCodeVerifier(codeVerifier: string) {
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
            name: 'MCPClientError',
            message: expect.stringMatching(/Failed to connect to.*server.*oauth-no-tokens-server/i)
          })
        );
      } finally {
        await client.close();
      }
    });

    it('should fail gracefully when OAuth provider throws errors for SSE transport', async () => {
      const { baseUrl } = await testServers.createHTTPServer("sse-oauth-error", {
        requireAuth: true,
        supportSSEFallback: true,
      });

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
        async saveTokens(tokens: OAuthTokens) {
          // Mock implementation
        },
        async saveCodeVerifier(codeVerifier: string) {
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
            name: 'MCPClientError',
            message: expect.stringMatching(/Failed to (connect to|create).*server.*sse-oauth-error-server/i)
          })
        );
      } finally {
        await client.close();
      }
    });

    it('should use OAuth provider with additional custom headers for HTTP transport', async () => {
      const { baseUrl } = await testServers.createHTTPServer("http-oauth-headers", {
        requireAuth: true,
        testHeaders: true,
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
        async saveTokens(tokens: OAuthTokens) {
          // Mock implementation
        },
        async saveCodeVerifier(codeVerifier: string) {
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

        const apiKeyResult = await headerTool!.invoke({ headerName: "X-Custom-API-Key" });
        expect(apiKeyResult).toBe("custom-api-key-123");

        const requestIdResult = await headerTool!.invoke({ headerName: "X-Request-ID" });
        expect(requestIdResult).toBe("req-oauth-headers-456");

        // Verify OAuth authorization header is also present
        const authHeaderResult = await headerTool!.invoke({ headerName: "Authorization" });
        expect(authHeaderResult).toBe("Bearer test-token");
      } finally {
        await client.close();
      }
    });

    it('should use OAuth provider with additional custom headers for SSE transport', async () => {
      const { baseUrl } = await testServers.createHTTPServer("sse-oauth-headers", {
        requireAuth: true,
        testHeaders: true,
        supportSSEFallback: true,
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
        async saveTokens(tokens: OAuthTokens) {
          // Mock implementation
        },
        async saveCodeVerifier(codeVerifier: string) {
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

        const result = await testTool!.invoke({ input: "sse oauth with headers" });
        expect(result).toContain("sse oauth with headers");
        expect(result).toContain("sse-oauth-headers");

        // Test that custom headers were received
        const headerTool = tools.find((t) => t.name.includes("check_headers"));
        expect(headerTool).toBeDefined();

        const customHeaderResult = await headerTool!.invoke({ headerName: "X-SSE-Custom-Header" });
        expect(customHeaderResult).toBe("sse-custom-value-789");

        const correlationIdResult = await headerTool!.invoke({ headerName: "X-Correlation-ID" });
        expect(correlationIdResult).toBe("corr-sse-oauth-101112");

        // Verify OAuth authorization header is also present
        const authHeaderResult = await headerTool!.invoke({ headerName: "Authorization" });
        expect(authHeaderResult).toBe("Bearer test-token");
      } finally {
        await client.close();
      }
    });

    it('should fail gracefully when OAuth provider returns invalid tokens for SSE transport', async () => {
      const { baseUrl } = await testServers.createHTTPServer("sse-oauth-invalid", {
        requireAuth: true,
        supportSSEFallback: true,
      });

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
        async saveTokens(tokens: OAuthTokens) {
          // Mock implementation
        },
        async saveCodeVerifier(codeVerifier: string) {
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
            name: 'MCPClientError',
            message: expect.stringMatching(/Failed to (connect to|create).*server.*sse-oauth-invalid-server/i)
          })
        );
      } finally {
        await client.close();
      }
    });
  });
}); 