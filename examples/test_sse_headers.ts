/**
 * Test script for SSE headers functionality
 *
 * This script tests the ability to pass custom headers to SSE connections.
 * It creates a simple client and attempts to connect with headers.
 */

import { MultiServerMCPClient } from '../src/index.js';
import dotenv from 'dotenv';
import logger from '../src/logger.js';

// Load environment variables
dotenv.config();

// Configure logger to show debug messages
logger.level = 'debug';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:8000/sse';
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'test-token';

async function main() {
  console.log('Testing SSE headers functionality...');
  console.log(`Server URL: ${SERVER_URL}`);
  console.log(`Auth Token: ${AUTH_TOKEN}`);

  // Create a client
  const client = new MultiServerMCPClient();

  try {
    console.log('\n1. Testing connectToServerViaSSE with headers...');
    await client.connectToServerViaSSE(
      'auth-server',
      SERVER_URL,
      {
        Authorization: `Bearer ${AUTH_TOKEN}`,
        'X-Test-Header': 'test-value',
      },
      true // Use Node.js EventSource
    );

    // Get tools
    const tools = client.getTools();
    console.log(`Successfully connected to ${tools.size} servers`);

    // Print tool names
    for (const [serverName, serverTools] of tools.entries()) {
      console.log(`Server: ${serverName}, Tools: ${serverTools.length}`);
      for (const tool of serverTools) {
        console.log(`  - ${tool.name}: ${tool.description}`);
      }
    }

    // Close the client
    await client.close();
    console.log('Connection closed successfully');

    console.log('\n2. Testing with configuration object...');
    const client2 = new MultiServerMCPClient({
      'auth-server': {
        transport: 'sse',
        url: SERVER_URL,
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
          'X-Test-Header': 'test-value',
        },
        useNodeEventSource: true,
      },
    });

    // Initialize connections
    await client2.initializeConnections();

    // Get tools
    const tools2 = client2.getTools();
    console.log(`Successfully connected to ${tools2.size} servers`);

    // Print tool names
    for (const [serverName, serverTools] of tools2.entries()) {
      console.log(`Server: ${serverName}, Tools: ${serverTools.length}`);
      for (const tool of serverTools) {
        console.log(`  - ${tool.name}: ${tool.description}`);
      }
    }

    // Close the client
    await client2.close();
    console.log('Connection closed successfully');

    console.log('\n3. Testing with configuration file...');
    console.log('Loading from examples/auth_mcp.json');
    const client3 = MultiServerMCPClient.fromConfigFile('./examples/auth_mcp.json');

    // Initialize connections
    await client3.initializeConnections();

    // Get tools
    const tools3 = client3.getTools();
    console.log(`Successfully connected to ${tools3.size} servers`);

    // Print tool names
    for (const [serverName, serverTools] of tools3.entries()) {
      console.log(`Server: ${serverName}, Tools: ${serverTools.length}`);
      for (const tool of serverTools) {
        console.log(`  - ${tool.name}: ${tool.description}`);
      }
    }

    // Close the client
    await client3.close();
    console.log('Connection closed successfully');

    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Error during testing:', error);
  }
}

main().catch(console.error);
