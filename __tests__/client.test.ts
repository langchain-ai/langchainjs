import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StructuredTool } from '@langchain/core/tools';
import { MultiServerMCPClient } from '../src/client';
import * as toolsModule from '../src/tools';
import fs from 'fs';
import path from 'path';

// Mock the Client class
jest.mock('@modelcontextprotocol/sdk/client/index.js', () => {
  return {
    Client: jest.fn().mockImplementation(() => {
      return {
        connect: jest.fn().mockResolvedValue(undefined),
        listTools: jest.fn().mockResolvedValue({ tools: [] }),
        callTool: jest.fn().mockResolvedValue({ content: [{ type: 'text', text: 'result' }] }),
      };
    }),
  };
});

// Mock the transports
jest.mock('@modelcontextprotocol/sdk/client/stdio.js', () => {
  return {
    StdioClientTransport: jest.fn().mockImplementation(() => ({
      close: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

jest.mock('@modelcontextprotocol/sdk/client/sse.js', () => {
  return {
    SSEClientTransport: jest.fn().mockImplementation(() => ({
      close: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

// Mock the tools module
jest.mock('../src/tools', () => {
  return {
    loadMcpTools: jest.fn().mockResolvedValue([
      {
        name: 'test-tool',
        description: 'A test tool',
        invoke: jest.fn().mockResolvedValue('test result'),
      },
    ]),
  };
});

// Mock the logger module instead of trying to fix the fs mock
jest.mock('../src/logger.js', () => {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    level: 'debug',
  };
});

// Replace the existing eventsource mock with this
jest.mock('eventsource', () => {
  return {
    __esModule: true, // This is important for ESM compatibility
    default: jest.fn().mockImplementation(() => {
      return {};
    }),
  };
});

// Add the fs mock for our tests
jest.mock('fs', () => {
  // Get the real fs module
  const realFs = jest.requireActual('fs');

  // Return a mock that uses the real fs for most functions
  // but mocks the ones we need for our tests
  return {
    ...realFs, // Keep all the real functions
    readFileSync: jest.fn(), // Mock only readFileSync for our tests
  };
});

describe('MultiServerMCPClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor with stdio config', () => {
    it('should set up a server with stdio transport', async () => {
      const client = new MultiServerMCPClient({
        'test-server': {
          transport: 'stdio',
          command: 'python',
          args: ['script.py'],
          env: { ENV_VAR: 'value' },
        },
      });

      await client.initializeConnections();

      // Verify StdioClientTransport was created with the correct parameters
      expect(StdioClientTransport).toHaveBeenCalledWith({
        command: 'python',
        args: ['script.py'],
        env: { ENV_VAR: 'value' },
      });

      // Verify Client was created and connected
      expect(Client).toHaveBeenCalled();
      const mockClientInstance = (Client as jest.Mock).mock.results[0].value;
      expect(mockClientInstance.connect).toHaveBeenCalled();

      // Verify tools were loaded
      expect(toolsModule.loadMcpTools).toHaveBeenCalled();
    });
  });

  describe('constructor with SSE config', () => {
    it('should set up a server with SSE transport', async () => {
      const client = new MultiServerMCPClient({
        'test-server': {
          transport: 'sse',
          url: 'https://example.com/sse',
        },
      });

      await client.initializeConnections();

      // Verify SSEClientTransport was created with the correct URL
      expect(SSEClientTransport).toHaveBeenCalledWith(new URL('https://example.com/sse'));

      // Verify Client was created and connected
      expect(Client).toHaveBeenCalled();
      const mockClientInstance = (Client as jest.Mock).mock.results[0].value;
      expect(mockClientInstance.connect).toHaveBeenCalled();

      // Verify tools were loaded
      expect(toolsModule.loadMcpTools).toHaveBeenCalled();
    });

    it('should set up a server with SSE transport and headers', async () => {
      const client = new MultiServerMCPClient({
        'test-server': {
          transport: 'sse',
          url: 'https://example.com/sse',
          headers: {
            Authorization: 'Bearer token',
            'Content-Type': 'application/json',
          },
          useNodeEventSource: true,
        },
      });

      await client.initializeConnections();

      // Verify SSEClientTransport was created with the correct URL and options
      expect(SSEClientTransport).toHaveBeenCalledWith(
        new URL('https://example.com/sse'),
        expect.objectContaining({
          requestInit: {
            headers: {
              Authorization: 'Bearer token',
              'Content-Type': 'application/json',
            },
          },
          eventSourceInit: {
            headers: {
              Authorization: 'Bearer token',
              'Content-Type': 'application/json',
            },
          },
        })
      );

      // Verify Client was created and connected
      expect(Client).toHaveBeenCalled();
      const mockClientInstance = (Client as jest.Mock).mock.results[0].value;
      expect(mockClientInstance.connect).toHaveBeenCalled();

      // Verify tools were loaded
      expect(toolsModule.loadMcpTools).toHaveBeenCalled();
    });

    it('should handle errors when loading the eventsource package', async () => {
      // Save original implementation
      const originalImport = jest.requireMock('eventsource').default;

      // Mock a failed import by temporarily replacing the implementation
      jest.requireMock('eventsource').default = null;

      // Test that we handle missing EventSource implementation
      const client = new MultiServerMCPClient({
        'test-server': {
          transport: 'sse',
          url: 'https://example.com/sse',
          headers: {
            Authorization: 'Bearer token',
          },
          useNodeEventSource: true,
        },
      });

      // Should not throw an error
      await client.initializeConnections();

      // Verify SSEClientTransport was still created
      expect(SSEClientTransport).toHaveBeenCalledWith(
        new URL('https://example.com/sse'),
        expect.objectContaining({
          requestInit: {
            headers: {
              Authorization: 'Bearer token',
            },
          },
        })
      );

      // Restore original implementation
      jest.requireMock('eventsource').default = originalImport;
    });
  });

  describe('constructor validation', () => {
    it('should skip servers with unsupported transport', async () => {
      const client = new MultiServerMCPClient({
        'test-server': {
          transport: 'unsupported' as any,
        },
      });

      // Should not throw, just log a warning and return empty Map
      const result = await client.initializeConnections();
      expect(result.size).toBe(0);
    });

    it('should skip servers with missing required parameters', async () => {
      const clientWithMissingCommand = new MultiServerMCPClient({
        'test-server': {
          transport: 'stdio',
        } as any,
      });

      // Should not throw, just log a warning and return empty Map
      const result1 = await clientWithMissingCommand.initializeConnections();
      expect(result1.size).toBe(0);

      const clientWithMissingArgs = new MultiServerMCPClient({
        'test-server': {
          transport: 'stdio',
          command: 'python',
        } as any,
      });

      // Should not throw, just log a warning and return empty Map
      const result2 = await clientWithMissingArgs.initializeConnections();
      expect(result2.size).toBe(0);

      const clientWithMissingUrl = new MultiServerMCPClient({
        'test-server': {
          transport: 'sse',
        } as any,
      });

      // Should not throw, just log a warning and return empty Map
      const result3 = await clientWithMissingUrl.initializeConnections();
      expect(result3.size).toBe(0);
    });
  });

  describe('getTools', () => {
    it('should return all tools from all servers', async () => {
      const client = new MultiServerMCPClient({
        server1: {
          transport: 'stdio',
          command: 'python',
          args: ['script1.py'],
        },
        server2: {
          transport: 'stdio',
          command: 'python',
          args: ['script2.py'],
        },
      });

      await client.initializeConnections();

      const serverTools = client.getTools();
      expect(serverTools.size).toBe(2); // Two servers

      const server1Tools = serverTools.get('server1');
      const server2Tools = serverTools.get('server2');

      expect(server1Tools).toBeDefined();
      expect(server2Tools).toBeDefined();
      expect(server1Tools![0].name).toBe('test-tool');
      expect(server2Tools![0].name).toBe('test-tool');
    });
  });

  describe('initializeConnections', () => {
    it('should initialize connections from constructor', async () => {
      const client = new MultiServerMCPClient({
        server1: {
          transport: 'stdio',
          command: 'python',
          args: ['script1.py'],
        },
        server2: {
          transport: 'sse',
          url: 'https://example.com/sse',
        },
      });

      await client.initializeConnections();

      // Verify both connections were established
      expect(StdioClientTransport).toHaveBeenCalledWith({
        command: 'python',
        args: ['script1.py'],
        env: undefined,
      });

      expect(SSEClientTransport).toHaveBeenCalledWith(new URL('https://example.com/sse'));

      // Verify Client was created and connected twice
      expect(Client).toHaveBeenCalledTimes(2);

      // Verify tools were loaded twice
      expect(toolsModule.loadMcpTools).toHaveBeenCalledTimes(2);
    });

    it('should do nothing if no connections are provided', async () => {
      const client = new MultiServerMCPClient();
      await client.initializeConnections();

      // Verify no connections were established
      expect(StdioClientTransport).not.toHaveBeenCalled();
      expect(SSEClientTransport).not.toHaveBeenCalled();
      expect(Client).not.toHaveBeenCalled();
      expect(toolsModule.loadMcpTools).not.toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should close all connections', async () => {
      const client = new MultiServerMCPClient({
        server1: {
          transport: 'stdio',
          command: 'python',
          args: ['script1.py'],
        },
        server2: {
          transport: 'stdio',
          command: 'python',
          args: ['script2.py'],
        },
      });

      await client.initializeConnections();
      await client.close();

      // Verify all transports were closed
      const mockTransportInstances = [
        (StdioClientTransport as jest.Mock).mock.results[0].value,
        (StdioClientTransport as jest.Mock).mock.results[1].value,
      ];
      expect(mockTransportInstances[0].close).toHaveBeenCalled();
      expect(mockTransportInstances[1].close).toHaveBeenCalled();
    });

    it('should handle errors during cleanup', async () => {
      // Create a client with a failing cleanup function
      const client = new MultiServerMCPClient();

      // Mock a failing cleanup function
      const mockCleanup = jest.fn().mockRejectedValue(new Error('Cleanup failed'));
      (client as any).cleanupFunctions = [mockCleanup];

      // Close should not throw, just log the error
      await client.close();

      // Verify the cleanup function was called
      expect(mockCleanup).toHaveBeenCalled();

      // Verify that the maps were cleared
      expect((client as any).clients.size).toBe(0);
      expect((client as any).serverNameToTools.size).toBe(0);
      expect((client as any).cleanupFunctions.length).toBe(0);
    });
  });
});

describe('fromConfigFile', () => {
  it('should load configuration from a file', () => {
    const mockConfig = {
      servers: {
        server1: {
          transport: 'stdio',
          command: 'python',
          args: ['script.py'],
        },
        server2: {
          transport: 'sse',
          url: 'https://example.com/sse',
        },
      },
    };

    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));

    const client = MultiServerMCPClient.fromConfigFile('config.json');

    // Verify fs.readFileSync was called with the correct path
    expect(fs.readFileSync).toHaveBeenCalledWith('config.json', 'utf8');

    // Should have created a client with the loaded configuration
    expect(client).toBeInstanceOf(MultiServerMCPClient);
  });

  it('should throw an error if the config file cannot be loaded', () => {
    (fs.readFileSync as jest.Mock).mockImplementation(() => {
      throw new Error('File not found');
    });

    // Should throw an error
    expect(() => {
      MultiServerMCPClient.fromConfigFile('nonexistent.json');
    }).toThrow('Failed to load MCP configuration: Error: File not found');
  });

  it('should throw an error if the config file contains invalid JSON', () => {
    (fs.readFileSync as jest.Mock).mockReturnValue('invalid json');

    // Should throw an error
    expect(() => {
      MultiServerMCPClient.fromConfigFile('invalid.json');
    }).toThrow('Failed to load MCP configuration: SyntaxError');
  });
});
