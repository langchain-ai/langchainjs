import { vi } from "vitest";

// Mocks @modelcontextprotocol/client/stdio (v2). Was @modelcontextprotocol/sdk/client/stdio.js in v1.

const stdioClientTransportPrototype = {
  connect: vi.fn().mockReturnValue(Promise.resolve()),
  send: vi.fn().mockReturnValue(Promise.resolve()),
  close: vi.fn().mockReturnValue(Promise.resolve()),
};
export const StdioClientTransport = vi
  .fn()
  .mockImplementation(function mockStdioClientTransport(
    ...[config]: ConstructorParameters<
      typeof import("@modelcontextprotocol/client/stdio").StdioClientTransport
    >
  ) {
    return {
      ...stdioClientTransportPrototype,
      config,
    };
  });
StdioClientTransport.prototype = stdioClientTransportPrototype;
