/* oxlint-disable @typescript-eslint/no-explicit-any */
import { vi } from "vitest";

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
