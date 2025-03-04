/**
 * Example of using SSE transport with custom headers
 *
 * This example demonstrates how to connect to an MCP server using SSE transport
 * with custom headers for authentication.
 *
 * To run this example:
 * 1. Start an MCP server that supports SSE and requires authentication
 * 2. Set the SERVER_URL and AUTH_TOKEN environment variables
 * 3. Run: ts-node examples/sse_with_headers_example.ts
 */

import { MultiServerMCPClient } from '../src/index.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:8000/sse';
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'your-auth-token';

async function main() {
  console.log('Connecting to MCP server with SSE transport and custom headers...');

  // Create a client
  const client = new MultiServerMCPClient();

  try {
    // Method 1: Using the connectToServerViaSSE method
    console.log('Method 1: Using connectToServerViaSSE with headers');
    await client.connectToServerViaSSE(
      'auth-server',
      SERVER_URL,
      {
        Authorization: `Bearer ${AUTH_TOKEN}`,
        'X-Custom-Header': 'custom-value',
      },
      true // Use Node.js EventSource for headers support
    );

    // Get all tools
    const tools = client.getTools();
    console.log(`Successfully loaded ${tools.size} servers with tools`);

    // Print tool names
    for (const [serverName, serverTools] of tools.entries()) {
      console.log(`Server: ${serverName}, Tools: ${serverTools.length}`);
      for (const tool of serverTools) {
        console.log(`  - ${tool.name}: ${tool.description}`);
      }
    }

    // Close the client
    await client.close();

    // Method 2: Using the constructor
    console.log('\nMethod 2: Using constructor with configuration object');
    const client2 = new MultiServerMCPClient({
      'auth-server': {
        transport: 'sse',
        url: SERVER_URL,
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
          'X-Custom-Header': 'custom-value',
        },
        useNodeEventSource: true,
      },
    });

    // Initialize connections
    await client2.initializeConnections();

    // Get all tools
    const tools2 = client2.getTools();
    console.log(`Successfully loaded ${tools2.size} servers with tools`);

    // Print tool names
    for (const [serverName, serverTools] of tools2.entries()) {
      console.log(`Server: ${serverName}, Tools: ${serverTools.length}`);
      for (const tool of serverTools) {
        console.log(`  - ${tool.name}: ${tool.description}`);
      }
    }

    // Close the client
    await client2.close();

    // Method 3: Using a configuration file
    console.log('\nMethod 3: Using a configuration file');
    console.log('Create a JSON file with the following content:');
    console.log(`
{
  "servers": {
    "auth-server": {
      "transport": "sse",
      "url": "${SERVER_URL}",
      "headers": {
        "Authorization": "Bearer your-token-here",
        "X-Custom-Header": "custom-value"
      },
      "useNodeEventSource": true
    }
  }
}
    `);
    console.log('Then load it with: MultiServerMCPClient.fromConfigFile("path/to/config.json")');
  } catch (error) {
    console.error('Error:', error);
  }
}

main().catch(console.error);
