# Release v0.1.7: Improved SSE Headers Support and Test Coverage

## Overview

This release focuses on improving SSE headers support, enhancing error handling, and significantly boosting test coverage to over 80%. It also includes fixes for CI/CD workflows and development tooling.

## Bug Fixes

- **SSE Headers Support**: Fixed issues with passing headers to the eventsource library
- **Error Handling**: Improved error handling for SSE connections and client initialization
- **Type Compatibility**: Fixed type errors in agent integration tests to work with different versions of @langchain/core

## Improvements

- **Test Coverage**: Increased test coverage from ~30% to over 80%
- **CI/CD Workflows**: Fixed GitHub Actions issues with type compatibility
- **ESLint Configuration**: Updated to properly exclude the dist directory from linting
- **Build Process**: Improved to avoid linting errors and streamline development

## Requirements

For SSE connections with headers in Node.js environments, you need to install the optional dependency:

```bash
npm install eventsource
```

For best results with SSE headers support, consider using the extended-eventsource library:

```bash
npm install extended-eventsource
```

---

# Release v0.1.5: SSE Headers Support

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
