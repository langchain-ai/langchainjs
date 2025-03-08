/**
 * This example demonstrates how to connect to an MCP server via SSE with headers.
 *
 * To properly use headers with SSE, consider the following approaches:
 *
 * 1. For Node.js: Use the extended-eventsource package (recommended)
 *    npm install --save extended-eventsource
 *
 * 2. For browsers: Consider using a server-side proxy or query parameters
 */

import { MultiServerMCPClient } from '../src/index.js';

async function main() {
  console.log('SSE with Headers Example');
  console.log('========================\n');

  // Create a new client
  const client = new MultiServerMCPClient();

  // Define headers for authentication and other purposes
  const headers = {
    Authorization: 'Bearer my-access-token',
    'X-Api-Key': 'my-api-key',
    'X-Custom-Header': 'CustomValue',
  };

  // Method 1: Using the connectToServerViaSSE method with headers
  console.log('Method 1: Using connectToServerViaSSE with headers');
  await client.connectToServerViaSSE(
    'my-server',
    'https://example.com/sse-endpoint',
    headers,
    true // Set to true to use Node.js EventSource for better headers support
  );

  // Get the tools from the server
  let serverTools = client.getTools();
  console.log(`Retrieved ${serverTools.size} server tools from the first connection\n`);

  // Method 2: Alternative approach using a server with query parameters (for browsers)
  console.log('Method 2: Using SSE with authorization in query parameters (browser-compatible)');
  console.log('Note: This is less secure but works in browsers that cannot send custom headers');

  // Create a second client
  const client2 = new MultiServerMCPClient();

  // Connect using a URL with query parameters instead of headers
  await client2.connectToServerViaSSE(
    'browser-compatible',
    `https://example.com/sse-endpoint?token=${encodeURIComponent('my-access-token')}`,
    undefined, // No headers
    false // Use browser EventSource
  );

  // Get tools from the second connection
  serverTools = client2.getTools();
  console.log(`Retrieved ${serverTools.size} server tools from the second connection\n`);

  // Method 3: Using a proxy server (recommended for browser environments)
  console.log('Method 3: Using a proxy server (recommended for browsers)');
  console.log('In this approach, your backend adds the necessary headers to the SSE request');

  // Create a third client
  const client3 = new MultiServerMCPClient();

  // Connect to your proxy server that will add headers
  await client3.connectToServerViaSSE(
    'proxy-server',
    'https://your-proxy-server.com/sse-proxy',
    undefined, // No headers needed here as the proxy adds them
    false // Use browser EventSource
  );

  // Get tools from the third connection
  serverTools = client3.getTools();
  console.log(`Retrieved ${serverTools.size} server tools from the third connection\n`);

  // Close all clients
  console.log('Closing all connections...');
  await client.close();
  await client2.close();
  await client3.close();

  console.log('All connections closed');
  console.log('\nSummary of approaches for SSE with headers:');
  console.log('1. Node.js: Use extended-eventsource (npm install extended-eventsource)');
  console.log('2. Browsers: Use query parameters (less secure)');
  console.log('3. Best practice: Use a server-side proxy for browser environments');
}

// Run the example
main().catch(error => {
  console.error('Error in SSE example:', error);
});
