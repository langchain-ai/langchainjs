/* oxlint-disable @typescript-eslint/no-explicit-any */
import { vi } from "vitest";

const sseClientTransportPrototype = {
  connect: vi.fn().mockReturnValue(Promise.resolve()),
  send: vi.fn().mockReturnValue(Promise.resolve()),
  close: vi.fn().mockReturnValue(Promise.resolve()),
};
export const SSEClientTransport: any = vi.fn().mockImplementation((config) => {
  return {
    ...sseClientTransportPrototype,
    config,
  };
});
SSEClientTransport.prototype = sseClientTransportPrototype;
