import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StructuredTool } from '@langchain/core/tools';
import { MultiServerMCPClient } from '../src/client';
import * as toolsModule from '../src/tools';

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
  });
});
