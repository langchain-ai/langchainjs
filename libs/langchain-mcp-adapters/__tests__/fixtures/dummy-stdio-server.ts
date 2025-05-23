#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// Get server name from command line arguments
const serverName = process.argv[2] || 'dummy-server';

const server = new McpServer({ name: serverName, version: '1.0.0' });

// Add test tools that capture request metadata
server.tool(
  'test_tool',
  'A test tool that echoes input and metadata',
  { input: z.string() },
  async ({ input }, extra) => {
    return {
      content: [{ 
        type: 'text', 
        text: JSON.stringify({ 
          input, 
          meta: extra._meta,
          serverName
        })
      }],
    };
  }
);

// Add a tool that can check environment variables
server.tool(
  'check_env',
  'Check environment variable',
  { varName: z.string() },
  async ({ varName }) => {
    return {
      content: [{ 
        type: 'text', 
        text: process.env[varName] || 'NOT_SET'
      }],
    };
  }
);

// Connect to stdio transport
const transport = new StdioServerTransport();
await server.connect(transport); 