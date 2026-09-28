import { vi, type Mock } from "vitest";

type SDKTransport =
  import("@modelcontextprotocol/client/stdio").StdioClientTransport;

// Mocks @modelcontextprotocol/client/stdio (v2). Was @modelcontextprotocol/sdk/client/stdio.js in v1.

const stdioClientTransportPrototype = {
  start: vi.fn<SDKTransport["start"]>().mockResolvedValue(undefined),
  send: vi.fn<SDKTransport["send"]>().mockResolvedValue(undefined),
  close: vi.fn<SDKTransport["close"]>().mockResolvedValue(undefined),
};

function mockStdioClientTransport(
  ...[config]: ConstructorParameters<
    typeof import("@modelcontextprotocol/client/stdio").StdioClientTransport
  >
) {
  return {
    ...stdioClientTransportPrototype,
    config,
  };
}

export const StdioClientTransport: Mock<typeof mockStdioClientTransport> =
  vi.fn(mockStdioClientTransport);

StdioClientTransport.prototype = stdioClientTransportPrototype;
