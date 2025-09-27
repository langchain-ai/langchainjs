/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line import/no-extraneous-dependencies
import { vi } from "vitest";

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
export const Client: any = vi.fn().mockImplementation(() => clientPrototype);
Client.prototype = clientPrototype;
