import { vi, type Mock } from "vitest";

// Mocks the exports of @modelcontextprotocol/client (v2). In v1 these lived under
// separate subpaths (client/index.js, client/sse.js, client/streamableHttp.js); v2
// re-exports them all from the package root, so their mocks are colocated here.

// Keep SDK error construction and protocol guards identical to production.
const actual = await vi.importActual<
  typeof import("@modelcontextprotocol/client")
>("@modelcontextprotocol/client");

export const SdkHttpError = actual.SdkHttpError;

export const isSpecType = actual.isSpecType;

const clientPrototype = {
  connect: vi
    .fn<InstanceType<typeof actual.Client>["connect"]>()
    .mockResolvedValue(undefined),
  setNotificationHandler:
    vi.fn<InstanceType<typeof actual.Client>["setNotificationHandler"]>(),
  listTools: vi
    .fn<InstanceType<typeof actual.Client>["listTools"]>()
    .mockReturnValue(
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
    .fn<InstanceType<typeof actual.Client>["callTool"]>()
    .mockReturnValue(
      Promise.resolve({ content: [{ type: "text", text: "result" }] })
    ),
  close: vi
    .fn<InstanceType<typeof actual.Client>["close"]>()
    .mockResolvedValue(undefined),
};

function mockClient(
  ...[clientInfo, options]: ConstructorParameters<typeof actual.Client>
) {
  return {
    ...clientPrototype,
    clientInfo,
    options,
  };
}

export const Client: Mock<typeof mockClient> = vi.fn(mockClient);

Client.prototype = clientPrototype;

const sseClientTransportPrototype = {
  start: vi
    .fn<InstanceType<typeof actual.SSEClientTransport>["start"]>()
    .mockResolvedValue(undefined),
  send: vi
    .fn<InstanceType<typeof actual.SSEClientTransport>["send"]>()
    .mockResolvedValue(undefined),
  close: vi
    .fn<InstanceType<typeof actual.SSEClientTransport>["close"]>()
    .mockResolvedValue(undefined),
};

function mockSSEClientTransport(
  ...[url, options]: ConstructorParameters<typeof actual.SSEClientTransport>
) {
  return {
    ...sseClientTransportPrototype,
    url,
    options,
  };
}

export const SSEClientTransport: Mock<typeof mockSSEClientTransport> = vi.fn(
  mockSSEClientTransport
);

SSEClientTransport.prototype = sseClientTransportPrototype;

const streamableHTTPClientTransportPrototype = {
  start: vi
    .fn<InstanceType<typeof actual.StreamableHTTPClientTransport>["start"]>()
    .mockResolvedValue(undefined),
  send: vi
    .fn<InstanceType<typeof actual.StreamableHTTPClientTransport>["send"]>()
    .mockResolvedValue(undefined),
  close: vi
    .fn<InstanceType<typeof actual.StreamableHTTPClientTransport>["close"]>()
    .mockResolvedValue(undefined),
};

function mockStreamableHTTPClientTransport(
  ...[url, options]: ConstructorParameters<
    typeof actual.StreamableHTTPClientTransport
  >
) {
  return {
    ...streamableHTTPClientTransportPrototype,
    url,
    options,
  };
}

export const StreamableHTTPClientTransport: Mock<
  typeof mockStreamableHTTPClientTransport
> = vi.fn(mockStreamableHTTPClientTransport);

StreamableHTTPClientTransport.prototype =
  streamableHTTPClientTransportPrototype;
