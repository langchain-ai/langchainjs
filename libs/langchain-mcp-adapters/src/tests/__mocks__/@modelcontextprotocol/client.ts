/* oxlint-disable @typescript-eslint/no-explicit-any */
import { vi } from "vitest";

// Mocks the exports of @modelcontextprotocol/client (v2). In v1 these lived under
// separate subpaths (client/index.js, client/sse.js, client/streamableHttp.js); v2
// re-exports them all from the package root, so their mocks are colocated here.

const clientPrototype = {
  connect: vi.fn().mockReturnValue(Promise.resolve()),
  setNotificationHandler: vi.fn().mockReturnValue(Promise.resolve()),
  listTools: vi.fn().mockReturnValue(
    Promise.resolve({
      tools: [
        {
          name: "tool1",
          description: "Test tool 1",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "tool2",
          description: "Test tool 2",
          inputSchema: { type: "object", properties: {} },
        },
      ],
    })
  ),
  callTool: vi
    .fn()
    .mockReturnValue(
      Promise.resolve({ content: [{ type: "text", text: "result" }] })
    ),
  close: vi.fn().mockImplementation(() => Promise.resolve()),
  tools: [], // Add the tools property
};
export const Client: any = vi
  .fn()
  .mockImplementation(function mockClient(clientInfo) {
    return {
      ...clientPrototype,
      clientInfo,
    };
  });
Client.prototype = clientPrototype;

const sseClientTransportPrototype = {
  connect: vi.fn().mockReturnValue(Promise.resolve()),
  send: vi.fn().mockReturnValue(Promise.resolve()),
  close: vi.fn().mockReturnValue(Promise.resolve()),
};
export const SSEClientTransport: any = vi
  .fn()
  .mockImplementation(function mockSSEClientTransport(url, options) {
    return {
      ...sseClientTransportPrototype,
      url,
      options,
    };
  });
SSEClientTransport.prototype = sseClientTransportPrototype;

const streamableHTTPClientTransportPrototype = {
  connect: vi.fn().mockReturnValue(Promise.resolve()),
  send: vi.fn().mockReturnValue(Promise.resolve()),
  close: vi.fn().mockReturnValue(Promise.resolve()),
};
export const StreamableHTTPClientTransport: any = vi
  .fn()
  .mockImplementation(function mockStreamableHTTPClientTransport(url, options) {
    return {
      ...streamableHTTPClientTransportPrototype,
      url,
      options,
    };
  });
StreamableHTTPClientTransport.prototype =
  streamableHTTPClientTransportPrototype;
