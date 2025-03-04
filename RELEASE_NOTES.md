# Release v0.1.4: SSE Headers Support

## Overview

This release adds support for custom headers in Server-Sent Events (SSE) connections, which is particularly useful for authentication with MCP servers that require authorization headers.

## New Features

- **SSE Headers Support**: Added the ability to pass custom headers to SSE connections
- **Node.js EventSource Integration**: Added support for using the Node.js EventSource implementation for better headers support
- **Configuration Options**: Extended the configuration options to include headers and EventSource settings

## Improvements

- **Updated Documentation**: Improved README with clear examples of using headers with SSE connections
- **Better Error Handling**: Enhanced error handling for SSE connections with headers
- **Type Declarations**: Added TypeScript declarations for the eventsource module

## Examples

Added new example files demonstrating the use of headers with SSE connections:

- `sse_with_headers_example.ts`: Shows how to use custom headers with SSE connections
- `test_sse_headers.ts`: Test script for SSE headers functionality
- `auth_mcp.json`: Example configuration file with headers for SSE connections

## Usage

To use SSE with custom headers:

```typescript
// Method 1: Using the connectToServerViaSSE method
await client.connectToServerViaSSE(
  'auth-server',
  'http://localhost:8000/sse',
  {
    Authorization: 'Bearer your-token-here',
    'X-Custom-Header': 'custom-value',
  },
  true // Use Node.js EventSource for headers support
);

// Method 2: Using the constructor with configuration
const client = new MultiServerMCPClient({
  'auth-server': {
    transport: 'sse',
    url: 'http://localhost:8000/sse',
    headers: {
      Authorization: 'Bearer your-token-here',
      'X-Custom-Header': 'custom-value',
    },
    useNodeEventSource: true,
  },
});

// Method 3: Using a configuration file (mcp.json)
// {
//   "servers": {
//     "auth-server": {
//       "transport": "sse",
//       "url": "http://localhost:8000/sse",
//       "headers": {
//         "Authorization": "Bearer your-token-here",
//         "X-Custom-Header": "custom-value"
//       },
//       "useNodeEventSource": true
//     }
//   }
// }
```

## Requirements

For SSE connections with headers in Node.js environments, you need to install the optional dependency:

```bash
npm install eventsource
```
