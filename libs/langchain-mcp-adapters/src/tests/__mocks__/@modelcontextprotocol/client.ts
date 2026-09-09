import { vi } from "vitest";

// Mocks the exports of @modelcontextprotocol/client (v2). In v1 these lived under
// separate subpaths (client/index.js, client/sse.js, client/streamableHttp.js); v2
// re-exports them all from the package root, so their mocks are colocated here.

// Keep SDK error construction identical to production.
const actual = await vi.importActual<
  typeof import("@modelcontextprotocol/client")
>("@modelcontextprotocol/client");
export const SdkHttpError = actual.SdkHttpError;

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
export const Client = vi.fn().mockImplementation(function mockClient(
  ...[clientInfo]: ConstructorParameters<typeof actual.Client>
) {
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
export const SSEClientTransport = vi
  .fn()
  .mockImplementation(function mockSSEClientTransport(
    ...[url, options]: ConstructorParameters<typeof actual.SSEClientTransport>
  ) {
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
export const StreamableHTTPClientTransport = vi
  .fn()
  .mockImplementation(function mockStreamableHTTPClientTransport(
    ...[url, options]: ConstructorParameters<
      typeof actual.StreamableHTTPClientTransport
    >
  ) {
    return {
      ...streamableHTTPClientTransportPrototype,
      url,
      options,
    };
  });
StreamableHTTPClientTransport.prototype =
  streamableHTTPClientTransportPrototype;
